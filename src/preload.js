const { contextBridge, ipcRenderer } = require("electron");
/* path module removed: provide string helpers instead */
function basename(p) {
  try {
    const s = String(p || "");
    const noTrail = s.replace(/[\\/]+$/, "");
    const parts = noTrail.split(/[\\/]/);
    return parts[parts.length - 1] || "";
  } catch (_) { return ""; }
}
function extname(p) {
  const b = basename(p);
  const idx = b.lastIndexOf(".");
  return idx >= 0 ? b.slice(idx).toLowerCase() : "";
}

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".apng", ".bmp"]);

// 支持的配置键新增 pinned、hotkey、gridCols、showFileName、sendMode、debug
const CONFIG_KEYS = new Set(["rootDir", "recent", "lastCategory", "pinned", "hotkey", "gridCols", "showFileName", "sendMode", "debug", "recentLimit", "pinLimit"]);
const RECENT_LIMIT = 60;
const PIN_LIMIT = 12;

// 本地存储兜底 + 主进程同步持久化
const LS_KEY = "local_emotes_config";
function readLSConfig() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : null;
  } catch (_) { return null; }
}
function writeLSConfig(obj) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(obj || {}));
    return true;
  } catch (_) { return false; }
}
function readConfigSyncIPC(def) {
  try { return ipcRenderer.sendSync("localEmote:getConfigSync", def) } catch (_) { return def; }
}
function writeConfigSyncIPC(cfg) {
  try { return !!ipcRenderer.sendSync("localEmote:setConfigSync", cfg) } catch (_) { return false; }
}

function hasMeaningful(cfg, def) {
  try {
    if (!cfg || typeof cfg !== 'object') return false;
    if (!def) def = { rootDir: "", recent: [], pinned: [], lastCategory: "", hotkey: "Alt+E", gridCols: 6, showFileName: false, sendMode: "multi", debug: false, recentLimit: 60, pinLimit: 12 };
    if (cfg.rootDir && typeof cfg.rootDir === 'string') return true;
    if (Array.isArray(cfg.recent) && cfg.recent.length) return true;
    if (Array.isArray(cfg.pinned) && cfg.pinned.length) return true;

    if (typeof cfg.lastCategory === 'string' && cfg.lastCategory) return true;
    if (typeof cfg.hotkey === 'string' && cfg.hotkey && cfg.hotkey !== def.hotkey) return true;
    if (Number.isFinite(cfg.gridCols) && cfg.gridCols !== def.gridCols) return true;
    if (typeof cfg.showFileName === 'boolean' && cfg.showFileName !== def.showFileName) return true;
    if (typeof cfg.sendMode === 'string' && cfg.sendMode !== def.sendMode) return true;
    if (cfg.debug === true) return true;
    if (Number.isFinite(cfg.recentLimit) && cfg.recentLimit !== def.recentLimit) return true;
    if (Number.isFinite(cfg.pinLimit) && cfg.pinLimit !== def.pinLimit) return true;
    return false;
  } catch (_) { return false; }
}

function getConfig() {
  const defaultConfig = { rootDir: "", recent: [], pinned: [], lastCategory: "", hotkey: "Alt+E", gridCols: 6, showFileName: false, sendMode: "multi", debug: false, recentLimit: 60, pinLimit: 12 };

  // 分别读取三个来源（都做 sanitize，避免脏数据污染）
  const fromIPC = sanitizeConfig(readConfigSyncIPC(defaultConfig) || {});
  let fromLL = null;
  try { fromLL = sanitizeConfig(LiteLoader.api.config.get("local_emotes", defaultConfig) || {}); } catch (_) { fromLL = null; }
  const lsRaw = readLSConfig();
  const fromLS = lsRaw ? sanitizeConfig(lsRaw) : null;

  // 统一合并：本地默认 < 本地存储 < LiteLoader 配置 < 主进程/文件（以主进程为最终权威）
  const merged = Object.assign({}, defaultConfig, fromLS || {}, fromLL || {}, fromIPC || {});
  const chosen = sanitizeConfig(merged);

  // 回写到各存储，保持一致
  try { writeConfigSyncIPC(chosen); } catch (_) {}
  try { LiteLoader.api.config.set("local_emotes", chosen); } catch (_) {}
  writeLSConfig(chosen);

  return chosen;
}

function sanitizeConfig(input) {
  const out = { rootDir: "", recent: [], pinned: [], lastCategory: "", hotkey: "Alt+E", gridCols: 6, showFileName: false, sendMode: "multi", debug: false, recentLimit: 60, pinLimit: 12 };
  if (input && typeof input === "object") {
    // 先确定上限
    let rlim = 60;
    let plim = 12;
    if (Number.isFinite(input.recentLimit)) {
      rlim = Math.max(1, Math.min(999, Math.floor(input.recentLimit)));
      out.recentLimit = rlim;
    }
    if (Number.isFinite(input.pinLimit)) {
      plim = Math.max(1, Math.min(99, Math.floor(input.pinLimit)));
      out.pinLimit = plim;
    }

    if (typeof input.rootDir === "string") out.rootDir = input.rootDir;
    if (Array.isArray(input.recent)) out.recent = input.recent.filter(p => typeof p === "string").slice(0, rlim);
    if (Array.isArray(input.pinned)) {
      const seen = new Set();
      const arr = [];
      for (const p of input.pinned) {
        if (typeof p !== "string") continue;
        const norm = p.replace(/\\/g, "/");
        if (seen.has(norm)) continue; seen.add(norm); arr.push(norm);
        if (arr.length >= plim) break;
      }
      out.pinned = arr;
    }

    if (typeof input.lastCategory === "string") out.lastCategory = input.lastCategory.slice(0, 128);
    if (typeof input.hotkey === "string") out.hotkey = input.hotkey.slice(0, 64) || "Alt+E";
    if (Number.isFinite(input.gridCols)) {
      const n = Math.max(2, Math.min(12, Math.floor(input.gridCols)));
      out.gridCols = n;
    }
    out.showFileName = !!input.showFileName;
    if (typeof input.sendMode === 'string') {
      const v = String(input.sendMode).toLowerCase();
      out.sendMode = ["multi", "image", "native"].includes(v) ? v : "multi";
    }
    out.debug = !!input.debug;
  }
  return out;
}

function setConfig(newConfig) {
  try {
    const current = getConfig();
    const merged = { ...current };
    if (newConfig && typeof newConfig === "object") {
      for (const k of Object.keys(newConfig)) {
        if (!CONFIG_KEYS.has(k)) continue;
        merged[k] = newConfig[k];
      }
    }
    const sanitized = sanitizeConfig(merged);
    // 先写主进程（落盘），再写 LiteLoader，再写本地存储
    writeConfigSyncIPC(sanitized);
    try { LiteLoader.api.config.set("local_emotes", sanitized); } catch (_) {}
    writeLSConfig(sanitized);
    return true;
  } catch (e) {
    return false;
  }
}

function isImageFile(filePath) {
  try {
    const ext = extname(filePath);
    return IMAGE_EXTS.has(ext);
  } catch (_) { return false; }
}

// 记录最近使用
function markRecent(absPath, max) {
  try {
    if (!absPath || !isImageFile(absPath)) return false;
    const cfg = getConfig();
    const list = Array.isArray(cfg.recent) ? cfg.recent.slice() : [];
    const norm = absPath.replace(/\\/g, "/");
    const filtered = list.filter(p => p !== norm);
    filtered.unshift(norm);
    const limit = Number.isFinite(max) ? Math.max(1, Math.floor(max)) : (Number.isFinite(cfg.recentLimit) ? cfg.recentLimit : RECENT_LIMIT);
    cfg.recent = filtered.slice(0, limit);
    setConfig(cfg);
    return true;
  } catch (_) { return false; }
}

function isPinned(absPath) {
  try {
    if (!absPath) return false;
    const cfg = getConfig();
    const norm = absPath.replace(/\\/g, "/");
    return Array.isArray(cfg.pinned) && cfg.pinned.includes(norm);
  } catch (_) { return false; }
}

function setPinned(absPath, value) {
  try {
    if (!absPath || !isImageFile(absPath)) return false;
    const cfg = getConfig();
    const norm = absPath.replace(/\\/g, "/");
    const pinned = Array.isArray(cfg.pinned) ? cfg.pinned.slice() : [];
    const idx = pinned.indexOf(norm);
    if (value) {
      if (idx === -1) {
        pinned.unshift(norm);
        cfg.pinned = pinned.slice(0, Number.isFinite(cfg.pinLimit) ? cfg.pinLimit : PIN_LIMIT);
      }
    } else {
      if (idx !== -1) {
        pinned.splice(idx, 1);
        cfg.pinned = pinned;
      }
    }
    setConfig(cfg);
    return true;
  } catch (_) { return false; }
}

function togglePin(absPath) {
  try {
    return setPinned(absPath, !isPinned(absPath));
  } catch (_) { return false; }
}

function listRecent(limit) {
  try {
    const cfg = getConfig();
    const arr = Array.isArray(cfg.recent) ? cfg.recent.slice() : [];
    const pinned = Array.isArray(cfg.pinned) ? cfg.pinned.slice() : [];
    const pinnedSet = new Set(pinned);
    const pinnedArr = pinned.filter(p => arr.includes(p));
    const recentArr = arr.filter(p => !pinnedSet.has(p));
    const merged = pinnedArr.map(p => ({ absPath: p, url: toLocalUrl(p), name: basename(p), pinned: true }))
      .concat(recentArr.map(p => ({ absPath: p, url: toLocalUrl(p), name: basename(p), pinned: false })));
    const eff = Number.isFinite(limit) ? Math.max(1, Math.min(Math.floor(limit), 999)) : (Number.isFinite(cfg.recentLimit) ? cfg.recentLimit : RECENT_LIMIT);
    return merged.slice(0, Math.max(1, Math.min(eff || RECENT_LIMIT, 999)));
  } catch (_) { return []; }
}

function clearRecent() {
  try {
    const cfg = getConfig();
    cfg.recent = [];
    setConfig(cfg);
    return true;
  } catch (_) { return false; }
}

// ===== Missing IPC wrappers for category & emoji management =====
async function ipcListCategories() {
  try { return await ipcRenderer.invoke("localEmote:listCategories"); } catch (_) { return []; }
}
async function ipcAddCategory(name) {
  try { return await ipcRenderer.invoke("localEmote:addCategory", name); } catch (_) { return false; }
}
async function ipcDeleteCategory(name) {
  try { return await ipcRenderer.invoke("localEmote:deleteCategory", name); } catch (_) { return false; }
}
async function ipcListEmojis(cat) {
  try { return await ipcRenderer.invoke("localEmote:listEmojis", cat); } catch (_) { return []; }
}
async function ipcImportEmojis(cat) {
  try { return await ipcRenderer.invoke("localEmote:importEmojis", cat); } catch (_) { return []; }
}
async function ipcRemoveEmoji(cat, file) {
  try { return await ipcRenderer.invoke("localEmote:removeEmoji", cat, file); } catch (_) { return false; }
}
async function ipcOpenDataDir() {
  try { return await ipcRenderer.invoke("localEmote:openDataDir"); } catch (_) { return false; }
}

// A safe stub for sendEmote; renderer handles DOM insertion/animation.
async function sendEmote(_absPath) {
  try { return await ipcRenderer.invoke("localEmote:send", _absPath); } catch (_) { return { ok: false }; }
}
// ===== End of missing wrappers =====
function walkDirOnce(dir) {
  try {
    return [];
  } catch (e) {
    return [];
  }
}

function toLocalUrl(filePath) {
  try {
    const abs = filePath.replace(/\\/g, "/");
    const profile = LiteLoader.path.profile.replace(/\\/g, "/");
    const root = LiteLoader.path.root.replace(/\\/g, "/");
    if (abs.startsWith(profile)) return "local://profile" + abs.slice(profile.length);
    if (abs.startsWith(root)) return "local://root" + abs.slice(root.length);
  } catch (_) {}
  return `local:///${encodeURI(filePath.replace(/\\/g, "/"))}`;
}

async function selectRootDir() {
  try {
    const res = await ipcRenderer.invoke("localEmote:selectRootDir");
    if (res && res.canceled === false && res.filePaths && res.filePaths[0])
      {
        const cfg = getConfig();
        cfg.rootDir = res.filePaths[0];
        setConfig(cfg);
        return cfg.rootDir;
      }
    return null;
  } catch (_) {
    return null;
  }
}

async function listEmotes() {
  try {
    const cfg = getConfig();
    if (!cfg.rootDir) return [];
    const arr = await ipcRenderer.invoke("localEmote:listBrowseDir", cfg.rootDir);
    return (Array.isArray(arr) ? arr : []).map((i) => {
      const p = i?.path || i?.absPath || "";
      return {
        name: i?.name || (p ? basename(p) : ""),
        path: p,
        url: toLocalUrl(p),
      };
    });
  } catch (_) {
    return [];
  }
}

// 新增：列出指定根目录下包含图片的子文件夹作为表情包
async function listPacksInDir(root) {
  try {
    const arr = await ipcRenderer.invoke("localEmote:listPacksInDir", root);
    return (Array.isArray(arr) ? arr : []).map((p) => ({
      name: p?.name || "",
      dir: p?.dir || "",
      first: p?.first || "",
      firstUrl: p?.first ? toLocalUrl(p.first) : "",
    }));
  } catch (_) { return []; }
}

// 新增：列出某个目录内的所有图片（用于点选某个包后渲染网格）
async function listImagesInDir(dir) {
  try {
    const arr = await ipcRenderer.invoke("localEmote:listBrowseDir", dir);
    return (Array.isArray(arr) ? arr : []).map((i) => {
      const p = i?.path || "";
      return { name: i?.name || (p ? basename(p) : ""), path: p, url: toLocalUrl(p) };
    });
  } catch (_) { return []; }
}

contextBridge.exposeInMainWorld("localEmote", {
  ping: () => ipcRenderer.invoke("localEmote:ping").catch(() => ({ ok: false })),
  getState: () => ipcRenderer.invoke("localEmote:getState").catch(() => ({})),
  // 配置
  getConfig,
  setConfig,
  // 最近使用
  markRecent,
  listRecent,
  clearRecent,
  isPinned,
  togglePin,
  // 目录选择与扫描（用户自定义浏览目录）
  selectRootDir,
  listEmotes,
  // 新增 API：扫描根目录的表情包子文件夹与列目录图片
  listPacksInDir,
  listImagesInDir,
  // 分类与导入（插件数据目录内的分类存储）
  listCategories: ipcListCategories,
  addCategory: ipcAddCategory,
  deleteCategory: ipcDeleteCategory,
  listEmojis: ipcListEmojis,
  importEmojis: ipcImportEmojis,
  removeEmoji: ipcRemoveEmoji,
  openDataDir: ipcOpenDataDir,
  // 工具
  toLocalUrl,
  // 发送
  sendEmote,
  // LiteLoader 路径（只读）
  paths: LiteLoader.path,
});