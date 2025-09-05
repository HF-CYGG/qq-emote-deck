const { app, dialog, ipcMain, clipboard, nativeImage, BrowserWindow } = require("electron");
const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");

const SLUG = "local_emotes";

function getPluginDataDir() {
  try {
    const p = LiteLoader?.plugins?.[SLUG]?.path?.data;
    if (p) return p;
  } catch (_) {}
  return path.join(LiteLoader.path.profile, SLUG);
}

// 新增：确保目录存在（之前缺失会导致引用错误，进而使 IPC 未注册）
function ensureDirSync(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
}

const PLUGIN_DATA_DIR = getPluginDataDir();
const EMOTE_DIR = path.join(PLUGIN_DATA_DIR, "emotes");
const LOG_FILE = path.join(PLUGIN_DATA_DIR, "log.txt");

// 新增：运行时 IPC 捕获状态与工具
const CAPTURE_STATE = { enabled: false, up: [], down: [] };
function setCaptureEnabled(v) { CAPTURE_STATE.enabled = !!v; }
function safeCloneArgs(args) {
  try { return JSON.parse(JSON.stringify(args)); } catch (_) { return []; }
}
function extractCmd(entryArgs) {
  try {
    // 常见结构： [router, [ { cmdName, payload }, ... ] ] 或单对象
    for (const a of entryArgs) {
      if (!a) continue;
      if (Array.isArray(a)) {
        for (const b of a) {
          if (b && typeof b === 'object' && typeof b.cmdName === 'string') return b.cmdName;
        }
      } else if (typeof a === 'object') {
        if (typeof a.cmdName === 'string') return a.cmdName;
        // 也可能是 { list: [ { cmdName } ] }
        const vals = Object.values(a);
        for (const v of vals) {
          if (Array.isArray(v)) {
            for (const it of v) {
              if (it && typeof it === 'object' && typeof it.cmdName === 'string') return it.cmdName;
            }
          }
        }
      }
    }
  } catch (_) {}
  return undefined;
}
function pushCap(dir, channel, args, where, winId) {
  if (!CAPTURE_STATE.enabled) return;
  const entry = { ts: Date.now(), dir, channel, where, winId: Number.isFinite(winId) ? winId : undefined, cmdName: extractCmd(args), args: safeCloneArgs(args) };
  const bucket = dir === 'up' ? CAPTURE_STATE.up : CAPTURE_STATE.down;
  bucket.push(entry);
  if (bucket.length > 200) bucket.shift();
  try { fs.appendFile(LOG_FILE, `[cap] ${new Date().toISOString()} ${dir} ${channel} ${entry.cmdName || ''}\n`, () => {}); } catch (_) {}
}

function defaultConfig() {
  return { rootDir: "", recent: [], pinned: [], lastCategory: "", hotkey: "Alt+E", gridCols: 6, showFileName: false, sendMode: "multi", recentLimit: 60, pinLimit: 12 };
}
function readConfigSync() {
  try {
    const txt = fs.readFileSync(CONFIG_FILE, "utf-8");
    const obj = JSON.parse(txt);
    if (!obj || typeof obj !== "object") return defaultConfig();
    // merge to ensure all keys exist
    return Object.assign(defaultConfig(), obj);
  } catch (_) {
    return defaultConfig();
  }
}
function writeConfigSync(obj) {
  try {
    const merged = Object.assign(defaultConfig(), (obj && typeof obj === "object") ? obj : {});
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2));
    return true;
  } catch (e) {
    log("write config error", e?.message || e);
    return false;
  }
}

// 同步配置 IPC，供渲染进程 preload 同步读取
ipcMain.on("localEmote:getConfigSync", (event, def) => {
  try {
    event.returnValue = readConfigSync();
  } catch (_) {
    event.returnValue = def || defaultConfig();
  }
});
ipcMain.on("localEmote:setConfigSync", (event, cfg) => {
  try {
    event.returnValue = writeConfigSync(cfg);
  } catch (_) {
    event.returnValue = false;
  }
});
ensureDirSync(PLUGIN_DATA_DIR);
ensureDirSync(EMOTE_DIR);

function log(...args) {
  const line = `[local_emotes] ${new Date().toISOString()} ${args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")}` + "\n";
  try { fs.appendFile(LOG_FILE, line, () => {}); } catch (_) {}
}

const ALLOWED_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".apng"]);
const MAX_IMPORT_SIZE_BYTES = 20 * 1024 * 1024; // 20MB 上限

function safeName(name) {
  return (name || "").replace(/[<>:"/\\|?*]/g, "_").trim().slice(0, 64) || "未命名";
}

// 读取文件前若干字节
async function readHeaderBytes(filePath, len = 32) {
  const fh = await fsp.open(filePath, "r");
  try {
    const buf = Buffer.alloc(len);
    const { bytesRead } = await fh.read(buf, 0, len, 0);
    return buf.slice(0, bytesRead);
  } finally {
    await fh.close();
  }
}

// 基于魔数的简单图片校验
function isValidImageMagic(buf) {
  if (!buf || buf.length < 4) return false;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  // JPEG: FF D8
  if (buf[0] === 0xff && buf[1] === 0xd8) return true;
  // GIF87a / GIF89a: 47 49 46 38
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true;
  // WEBP: RIFF....WEBP
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf.length >= 12 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return true;
  // BMP: 42 4D
  if (buf[0] === 0x42 && buf[1] === 0x4d) return true;
  return false;
}

function toLocalUrl(absPath) {
  try {
    const abs = absPath.replace(/\\+/g, "/");
    const profile = LiteLoader.path.profile.replace(/\\+/g, "/");
    const root = LiteLoader.path.root.replace(/\\+/g, "/");
    if (abs.startsWith(profile)) return "local://profile" + abs.slice(profile.length);
    if (abs.startsWith(root)) return "local://root" + abs.slice(root.length);
    // 兜底：尽量转为 root
    return "local://root" + abs;
  } catch (_) { return "local:///" + encodeURI(absPath.replace(/\\+/g, "/")); }
}

function resolveCategoryDir(name) {
  const n = safeName(name);
  const dir = path.resolve(EMOTE_DIR, n);
  const rel = path.relative(EMOTE_DIR, dir);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("非法分类路径");
  return dir;
}

function resolveFileInCategory(category, filename) {
  const dir = resolveCategoryDir(category);
  const f = safeName(filename);
  const abs = path.resolve(dir, f);
  const rel = path.relative(dir, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("非法文件路径");
  return { dir, abs, name: path.basename(abs) };
}

async function listCategories() {
  try {
    const entries = await fsp.readdir(EMOTE_DIR, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => e.name);
  } catch (e) {
    log("listCategories error", e?.message || e);
    return [];
  }
}

async function addCategory(name) {
  try {
    const dir = resolveCategoryDir(name);
    await fsp.mkdir(dir, { recursive: true });
    return path.basename(dir);
  } catch (e) {
    log("addCategory error", name, e?.message || e);
    return safeName(name);
  }
}

async function deleteCategory(name) {
  try {
    const dir = resolveCategoryDir(name);
    await fsp.rm(dir, { recursive: true, force: true });
    return true;
  } catch (e) {
    log("deleteCategory error", name, e?.message || e);
    return false;
  }
}

async function listEmojis(category) {
  try {
    const dir = resolveCategoryDir(category);
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    const files = entries.filter(e => e.isFile()).map(e => e.name);
    return files.filter(f => ALLOWED_EXT.has(path.extname(f).toLowerCase())).map(f => {
      const abs = path.join(dir, f);
      return { name: f, absPath: abs, url: toLocalUrl(abs) };
    });
  } catch (e) {
    log("listEmojis error", category, e?.message || e);
    return [];
  }
}

async function importEmojis(category) {
  try {
    const targetDir = resolveCategoryDir(category);
    await fsp.mkdir(targetDir, { recursive: true });
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: "选择要导入的表情",
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "apng"] }],
    });
    if (canceled) return [];
    const imported = [];
    for (const src of filePaths) {
      try {
        const stat = await fsp.stat(src).catch(() => null);
        if (!stat || !stat.isFile() || stat.size <= 0 || stat.size > MAX_IMPORT_SIZE_BYTES) {
          log("skip import by size/type", src);
          continue;
        }
        const ext = path.extname(src).toLowerCase();
        if (!ALLOWED_EXT.has(ext)) { log("skip import by ext", src); continue; }
        const header = await readHeaderBytes(src).catch(() => null);
        if (!isValidImageMagic(header)) { log("skip import by magic", src); continue; }

        const base = safeName(path.basename(src, ext)) + ext;
        let dest = path.join(targetDir, base);
        let i = 1;
        while (fs.existsSync(dest)) {
          dest = path.join(targetDir, safeName(path.basename(src, ext)) + `_${i}` + ext);
          i++;
        }
        await fsp.copyFile(src, dest);
        imported.push({ name: path.basename(dest), absPath: dest, url: toLocalUrl(dest) });
      } catch (e) {
        log("import error", src, e?.message || e);
      }
    }
    return imported;
  } catch (e) {
    log("importEmojis error", category, e?.message || e);
    return [];
  }
}

async function removeEmoji(category, filename) {
  try {
    const { abs } = resolveFileInCategory(category, filename);
    await fsp.rm(abs, { force: true });
    return true;
  } catch (e) {
    log("removeEmoji error", category, filename, e?.message || e);
    return false;
  }
}

// 新增：扫描指定根目录下的所有包含图片的子文件夹，返回按名称排序的分组及首张预览图
async function listPacksInDir(rootDir) {
  try {
    const st = await fsp.stat(rootDir).catch(() => null);
    if (!st || !st.isDirectory()) return [];

    const entries = await fsp.readdir(rootDir, { withFileTypes: true });

    // 1) 根目录下直接包含的图片，作为一个独立分组：本地表情
    const rootImgs = entries
      .filter(e => e.isFile() && ALLOWED_EXT.has(path.extname(e.name).toLowerCase()))
      .map(e => e.name)
      .sort((a, b) => a.localeCompare(b));
    const rootPack = rootImgs.length > 0
      ? { name: "本地表情", dir: rootDir, first: path.join(rootDir, rootImgs[0]) }
      : null;

    // 2) 子文件夹各自作为表情包，名称为子文件夹名
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    const subPacks = [];
    for (const name of dirs) {
      const dir = path.join(rootDir, name);
      const files = await fsp.readdir(dir, { withFileTypes: true }).catch(() => []);
      const imgs = files
        .filter(e => e.isFile() && ALLOWED_EXT.has(path.extname(e.name).toLowerCase()))
        .map(e => e.name)
        .sort((a, b) => a.localeCompare(b));
      if (imgs.length > 0) {
        subPacks.push({ name, dir, first: path.join(dir, imgs[0]) });
      }
    }
    subPacks.sort((a, b) => a.name.localeCompare(b.name));

    // 根目录分组优先置前，其后为按名称排序的子包
    return rootPack ? [rootPack, ...subPacks] : subPacks;
  } catch (e) {
    log("listPacksInDir error", rootDir, e?.message || e);
    return [];
  }
}

function getState() {
  return {
    dataDir: PLUGIN_DATA_DIR,
    platform: LiteLoader?.os?.platform || process.platform,
    versions: LiteLoader?.versions || {},
  };
}

// removed duplicate ping handler to avoid re-register error

ipcMain.handle("localEmote:getState", async () => getState());
ipcMain.handle("localEmote:listCategories", async () => listCategories());
ipcMain.handle("localEmote:addCategory", async (_e, name) => addCategory(name));
ipcMain.handle("localEmote:deleteCategory", async (_e, name) => deleteCategory(name));
ipcMain.handle("localEmote:listEmojis", async (_e, cat) => listEmojis(cat));
ipcMain.handle("localEmote:importEmojis", async (_e, cat) => importEmojis(cat));
ipcMain.handle("localEmote:removeEmoji", async (_e, cat, file) => removeEmoji(cat, file));
ipcMain.handle("localEmote:openDataDir", async () => {
  try {
    LiteLoader.api.openPath(PLUGIN_DATA_DIR);
    return true;
  } catch (e) {
    log("openPath error", e?.message || e);
    return false;
  }
});

// 新增：运行时捕获开关与日志访问 IPC
ipcMain.handle("localEmote:setCaptureEnabled", async (_e, v) => {
  setCaptureEnabled(!!v);
  const cfg = readConfigSync();
  cfg.debug = !!v;
  writeConfigSync(cfg);
  return CAPTURE_STATE.enabled;
});
ipcMain.handle("localEmote:getCaptureEnabled", async () => CAPTURE_STATE.enabled);
ipcMain.handle("localEmote:getIpcLog", async () => ({ up: CAPTURE_STATE.up.slice(-100), down: CAPTURE_STATE.down.slice(-100) }));
ipcMain.handle("localEmote:clearIpcLog", async () => { CAPTURE_STATE.up = []; CAPTURE_STATE.down = []; return true; });

// 新增：从指定根目录列出子文件夹表情包
ipcMain.handle("localEmote:listPacksInDir", async (_e, dir) => listPacksInDir(dir));

exports.onBrowserWindowCreated = (window) => {
  // 新增：hook webContents，捕获上下行 IPC
  try {
    const wc = window.webContents;
    const winId = window.id;
    // 下行：wrap send
    if (wc && typeof wc.send === 'function') {
      const origSend = wc.send.bind(wc);
      wc.send = (channel, ...args) => {
        try { pushCap('down', channel, args, 'wc.send', winId); } catch (_) {}
        return origSend(channel, ...args);
      };
    }
    // 上行：监听 renderer -> main 的 IPC 事件
    wc.on('ipc-message', (_event, channel, ...args) => {
      try { pushCap('up', channel, args, 'ipc-message', winId); } catch (_) {}
    });
    wc.on('ipc-message-sync', (_event, channel, ...args) => {
      try { pushCap('up', channel, args, 'ipc-message-sync', winId); } catch (_) {}
    });
    // 一些 invoke 请求也可以监听
    wc.on('ipc-invoke', (_event, channel, ...args) => {
      try { pushCap('up', channel, args, 'ipc-invoke', winId); } catch (_) {}
    });
  } catch (e) {
    log('onBrowserWindowCreated hook error', e?.message || e);
  }
};

exports.onLogin = (uid) => {
  // 登录时初始化目录
  ensureDirSync(EMOTE_DIR);
  // 从配置恢复捕获开关
  try { CAPTURE_STATE.enabled = !!readConfigSync().debug; } catch (_) {}
};

// IPC: ping
ipcMain.handle("localEmote:ping", () => ({ ok: true, time: Date.now() }));

// IPC: 浏览用户自定义根目录（仅一层）
ipcMain.handle("localEmote:listBrowseDir", async (_e, dir) => {
  try {
    const st = await fsp.stat(dir).catch(() => null);
    if (!st || !st.isDirectory()) return [];
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    const files = entries.filter(e => e.isFile()).map(e => e.name);
    return files
      .filter(f => ALLOWED_EXT.has(path.extname(f).toLowerCase()))
      .map(f => ({ name: f, path: path.join(dir, f) }));
  } catch (e) {
    log("listBrowseDir error", dir, e?.message || e);
    return [];
  }
});

// IPC: 选择表情根目录
ipcMain.handle("localEmote:selectRootDir", async () => {
  try {
    const res = await dialog.showOpenDialog({
      title: "选择本地表情目录",
      properties: ["openDirectory", "dontAddToRecent"],
    });
    return res;
  } catch (e) {
    log("selectRootDir error", e?.message || e);
    return { canceled: true, filePaths: [] };
  }
});

// IPC: 发送表情（从文件写入剪贴板并尝试在当前窗口执行粘贴）
ipcMain.handle("localEmote:send", async (e, filePath) => {
  try {
    const img = nativeImage.createFromPath(String(filePath || ""));
    if (!img || img.isEmpty()) return { ok: false, path: filePath, reason: "bad_image" };
    clipboard.writeImage(img);
    const wc = e && e.sender;
    if (wc && !wc.isDestroyed()) {
      try { wc.paste(); } catch (_) {}
      return { ok: true, path: filePath, method: "clipboard-paste" };
    }
    const win = BrowserWindow.getFocusedWindow();
    if (win && win.webContents && !win.webContents.isDestroyed()) {
      try { win.webContents.paste(); } catch (_) {}
      return { ok: true, path: filePath, method: "clipboard-paste" };
    }
    return { ok: false, path: filePath, reason: "no_target" };
  } catch (e2) {
    log("send error", filePath, e2?.message || e2);
    return { ok: false, path: filePath };
  }
});