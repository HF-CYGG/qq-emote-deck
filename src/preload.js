const { contextBridge, ipcRenderer } = require("electron");
const {
  DEFAULT_CONFIG,
  isMeaningfulConfig,
  mergeConfigPatch,
  sanitizeConfig,
} = require("./config-utils");
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

const RECENT_LIMIT = DEFAULT_CONFIG.recentLimit;
const PIN_LIMIT = DEFAULT_CONFIG.pinLimit;

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
function readConfigSyncIPC(def) {
  try { return ipcRenderer.sendSync("localEmote:getConfigSync", def) } catch (_) { return def; }
}
function writeConfigSyncIPC(cfg) {
  try { return !!ipcRenderer.sendSync("localEmote:setConfigSync", cfg) } catch (_) { return false; }
}
function importBrowserConfigSyncIPC(cfg) {
  try { return ipcRenderer.sendSync("localEmote:importBrowserConfigSync", cfg) } catch (_) { return null; }
}
function cloneConfig(cfg) {
  const sanitized = sanitizeConfig(cfg);
  return { ...sanitized, recent: sanitized.recent.slice(), pinned: sanitized.pinned.slice() };
}

let configCache = null;
let browserConfigImportTried = false;

function getConfig() {
  let current = sanitizeConfig(readConfigSyncIPC(DEFAULT_CONFIG) || DEFAULT_CONFIG);
  if (!browserConfigImportTried) {
    browserConfigImportTried = true;
    const legacyBrowserConfig = readLSConfig();
    if (!isMeaningfulConfig(current) && isMeaningfulConfig(legacyBrowserConfig)) {
      current = sanitizeConfig(importBrowserConfigSyncIPC(legacyBrowserConfig) || current);
    }
  }
  configCache = current;
  return cloneConfig(current);
}

function setConfig(newConfig) {
  try {
    const current = configCache || sanitizeConfig(readConfigSyncIPC(DEFAULT_CONFIG) || DEFAULT_CONFIG);
    const sanitized = mergeConfigPatch(current, newConfig);
    const ok = writeConfigSyncIPC(sanitized);
    if (ok) configCache = sanitized;
    return ok;
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
async function ipcCopyToCategory(src, category) {
  try { return await ipcRenderer.invoke("localEmote:copyToCategory", src, category); } catch (_) { return { ok: false }; }
}
async function ipcOpenDataDir() {
  try { return await ipcRenderer.invoke("localEmote:openDataDir"); } catch (_) { return false; }
}

// 调用主进程：运行时 IPC 捕获开关与日志访问
async function setCaptureEnabled(v) {
  try { return await ipcRenderer.invoke("localEmote:setCaptureEnabled", !!v); } catch (_) { return false; }
}
async function getCaptureEnabled() {
  try { return await ipcRenderer.invoke("localEmote:getCaptureEnabled"); } catch (_) { return false; }
}
async function getIpcLog() {
  try { return await ipcRenderer.invoke("localEmote:getIpcLog"); } catch (_) { return { up: [], down: [] }; }
}
async function clearIpcLog() {
  try { return await ipcRenderer.invoke("localEmote:clearIpcLog"); } catch (_) { return false; }
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
    const abs = String(filePath || "").replace(/\\/g, "/");
    if (!abs) return "local:///";
    const encoded = abs
      .split("/")
      .map((item) => encodeURIComponent(encodeURIComponent(item)))
      .join("/");
    return "local:///" + encoded;
  } catch (_) {
    return "local:///";
  }
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
  copyToCategory: ipcCopyToCategory,
  openDataDir: ipcOpenDataDir,
  // 工具
  toLocalUrl,
  // 发送
  sendEmote,
  // 调试：IPC 捕获控制与日志
  setCaptureEnabled,
  getCaptureEnabled,
  getIpcLog,
  clearIpcLog,
  // LiteLoader 路径（只读）
  paths: LiteLoader.path,
  // 新增：Peer 更新监听
  onUpdatePeer: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, peer) => callback(peer);
    ipcRenderer.on('localEmote:updatePeer', handler);
    return () => ipcRenderer.removeListener('localEmote:updatePeer', handler);
  },
});
