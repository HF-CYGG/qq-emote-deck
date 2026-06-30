const { contextBridge, ipcRenderer } = require("electron");

// LiteLoader 1.2.4 executes preload as fetched text via runPreloadScript().
// Keep this file self-contained: local relative require() is not reliable here.
const DEFAULT_CONFIG = Object.freeze({
  rootDir: "",
  recent: [],
  pinned: [],
  packOrder: [],
  imageOrder: {},
  lastCategory: "",
  hotkey: "Alt+E",
  gridCols: 6,
  showFileName: false,
  sendMode: "multi",
  debug: false,
  recentLimit: 60,
  pinLimit: 12,
  imageContextMenu: true,
  hoverPreview: true,
});
const CONFIG_KEYS = new Set(Object.keys(DEFAULT_CONFIG));
const SEND_MODES = new Set(["multi", "image", "native"]);

function cloneDefaultConfig() {
  return { ...DEFAULT_CONFIG, recent: [], pinned: [], packOrder: [], imageOrder: {} };
}
function clampInt(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}
function normalizeOrderPath(value) {
  if (typeof value !== "string") return "";
  const normalized = value.trim().replace(/\\/g, "/");
  if (!normalized) return "";
  if (/^[A-Za-z]:\/$/.test(normalized)) return normalized;
  return normalized.replace(/\/+$/g, "");
}
function dedupeOrderArray(value, limit = 2000) {
  if (!Array.isArray(value)) return [];
  const max = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 2000;
  const seen = new Set();
  const out = [];
  for (const item of value) {
    const normalized = normalizeOrderPath(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
    if (out.length >= max) break;
  }
  return out;
}
function sanitizeImageOrderMap(value, options = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const maxPacks = Number.isFinite(options.maxPacks) ? Math.max(0, Math.floor(options.maxPacks)) : 500;
  const maxImagesPerPack = Number.isFinite(options.maxImagesPerPack) ? Math.max(0, Math.floor(options.maxImagesPerPack)) : 2000;
  const out = {};
  for (const [rawDir, rawOrder] of Object.entries(value)) {
    if (Object.keys(out).length >= maxPacks) break;
    const dir = normalizeOrderPath(rawDir);
    if (!dir || !Array.isArray(rawOrder)) continue;
    const merged = out[dir] ? out[dir].concat(rawOrder) : rawOrder;
    const order = dedupeOrderArray(merged, maxImagesPerPack);
    if (order.length > 0) out[dir] = order;
  }
  return out;
}
function applyCustomOrder(items, order, getId) {
  const list = Array.isArray(items) ? items.slice() : [];
  const orderList = dedupeOrderArray(order);
  if (orderList.length === 0 || typeof getId !== "function") return list;
  const rank = new Map();
  orderList.forEach((item, index) => {
    if (!rank.has(item)) rank.set(item, index);
  });
  return list
    .map((item, index) => {
      const id = normalizeOrderPath(getId(item));
      return { item, index, rank: rank.has(id) ? rank.get(id) : Number.POSITIVE_INFINITY };
    })
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.index - b.index;
    })
    .map((entry) => entry.item);
}
function sanitizeConfig(input) {
  const out = cloneDefaultConfig();
  if (!input || typeof input !== "object") return out;
  const recentLimit = clampInt(input.recentLimit, 1, 999, out.recentLimit);
  const pinLimit = clampInt(input.pinLimit, 1, 99, out.pinLimit);
  out.recentLimit = recentLimit;
  out.pinLimit = pinLimit;
  if (typeof input.rootDir === "string") out.rootDir = input.rootDir;
  if (Array.isArray(input.recent)) out.recent = input.recent.filter((p) => typeof p === "string").slice(0, recentLimit);
  if (Array.isArray(input.pinned)) {
    const seen = new Set();
    const pinned = [];
    for (const item of input.pinned) {
      if (typeof item !== "string") continue;
      const normalized = item.replace(/\\/g, "/");
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      pinned.push(normalized);
      if (pinned.length >= pinLimit) break;
    }
    out.pinned = pinned;
  }
  out.packOrder = dedupeOrderArray(input.packOrder, 1000);
  out.imageOrder = sanitizeImageOrderMap(input.imageOrder, { maxPacks: 500, maxImagesPerPack: 2000 });
  if (typeof input.lastCategory === "string") out.lastCategory = input.lastCategory.slice(0, 128);
  if (typeof input.hotkey === "string") out.hotkey = input.hotkey.slice(0, 64) || DEFAULT_CONFIG.hotkey;
  out.gridCols = clampInt(input.gridCols, 2, 12, out.gridCols);
  if (typeof input.showFileName === "boolean") out.showFileName = input.showFileName;
  if (typeof input.sendMode === "string") {
    const sendMode = input.sendMode.toLowerCase();
    out.sendMode = ["multi", "image", "native"].includes(sendMode) ? sendMode : DEFAULT_CONFIG.sendMode;
  }
  if (typeof input.debug === "boolean") out.debug = input.debug;
  if (typeof input.imageContextMenu === "boolean") out.imageContextMenu = input.imageContextMenu;
  if (typeof input.hoverPreview === "boolean") out.hoverPreview = input.hoverPreview;
  return out;
}
function isMeaningfulConfig(input) {
  const cfg = sanitizeConfig(input);
  return !!(
    cfg.rootDir ||
    cfg.recent.length ||
    cfg.pinned.length ||
    cfg.packOrder.length ||
    Object.keys(cfg.imageOrder).length ||
    cfg.lastCategory ||
    cfg.hotkey !== DEFAULT_CONFIG.hotkey ||
    cfg.gridCols !== DEFAULT_CONFIG.gridCols ||
    cfg.showFileName !== DEFAULT_CONFIG.showFileName ||
    cfg.sendMode !== DEFAULT_CONFIG.sendMode ||
    cfg.debug !== DEFAULT_CONFIG.debug ||
    cfg.recentLimit !== DEFAULT_CONFIG.recentLimit ||
    cfg.pinLimit !== DEFAULT_CONFIG.pinLimit ||
    cfg.imageContextMenu !== DEFAULT_CONFIG.imageContextMenu ||
    cfg.hoverPreview !== DEFAULT_CONFIG.hoverPreview
  );
}
function mergeConfigPatch(current, patch) {
  const merged = sanitizeConfig(current);
  if (patch && typeof patch === "object") {
    for (const key of Object.keys(patch)) {
      if (CONFIG_KEYS.has(key)) merged[key] = patch[key];
    }
  }
  return sanitizeConfig(merged);
}
function normalizeSendMode(mode) {
  const value = String(mode || "").toLowerCase();
  return SEND_MODES.has(value) ? value : "multi";
}
function planSendEmote({ mode, capabilities = {}, filePath = "" } = {}) {
  const normalizedMode = normalizeSendMode(mode);
  const canImage = !!(capabilities.imageMessage && capabilities.peer);
  if (normalizedMode === "multi") {
    return { mode: "multi", strategy: "editor-insert", fallbackStrategy: "clipboard", picSubType: 1, asFace: true, filePath };
  }
  if (normalizedMode === "native" && !capabilities.marketFace) {
    return canImage
      ? { mode: "native", strategy: "qqnt-image", fallbackStrategy: "clipboard", picSubType: 1, asFace: true, filePath, fallbackUsed: true, reason: "native_market_face_unavailable" }
      : { mode: "native", strategy: "clipboard", picSubType: 1, asFace: true, filePath, fallbackUsed: true, reason: "native_market_face_unavailable" };
  }
  if (normalizedMode === "image") {
    return canImage
      ? { mode: "image", strategy: "qqnt-image", fallbackStrategy: "clipboard", picSubType: 0, asFace: false, filePath }
      : { mode: "image", strategy: "clipboard", picSubType: 0, asFace: false, filePath, fallbackUsed: true, reason: "qqnt_image_unavailable" };
  }
  return { mode: normalizedMode, strategy: "clipboard", filePath, fallbackUsed: true, reason: "unsupported_send_mode" };
}
function toSendResult({ ok, plan, reason = "" } = {}) {
  return {
    ok: !!ok,
    modeUsed: plan?.mode || "multi",
    fallbackUsed: !!plan?.fallbackUsed,
    strategy: plan?.strategy || "",
    reason: reason || plan?.reason || "",
  };
}
function stripQueryAndHash(value) {
  let out = String(value || "");
  const qIdx = out.indexOf("?");
  if (qIdx >= 0) out = out.slice(0, qIdx);
  const hIdx = out.indexOf("#");
  if (hIdx >= 0) out = out.slice(0, hIdx);
  return out;
}
function decodeMaybeTwice(value, twice = false) {
  let out = String(value || "");
  try { out = decodeURIComponent(out); } catch (_) {}
  if (twice) {
    try { out = decodeURIComponent(out); } catch (_) {}
  }
  return out;
}
function fileNameOf(value) {
  const clean = stripQueryAndHash(String(value || "")).replace(/[\\/]+$/, "");
  const parts = clean.split(/[\\/]/);
  return parts[parts.length - 1] || "";
}
function decodeSlashPath(raw, twice) {
  return String(raw || "")
    .split("/")
    .filter((part) => part.length > 0)
    .map((part) => decodeMaybeTwice(part, twice))
    .join("/")
    .replace(/\//g, "\\");
}
function normalizeAppimgPath(raw) {
  let out = decodeMaybeTwice(raw, true);
  const driveIdx = out.search(/[A-Za-z]:[\\/]/);
  if (driveIdx >= 0) out = out.slice(driveIdx);
  return out.replace(/^\/+/, "").replace(/\//g, "\\");
}
function normalizeContextImageSource(input) {
  const src = typeof input === "string" ? input.trim() : String(input?.src || input?.source || "").trim();
  if (!src || src.startsWith("qqface:")) return { kind: "unsupported", source: src, fileName: "", mime: "", reason: "unsupported_source" };
  if (/^data:/i.test(src)) {
    const match = src.match(/^data:([^;,]+)?(?:;[^,]*)?,/i);
    return { kind: "data", source: src, fileName: "context-image", mime: (match?.[1] || "").toLowerCase(), reason: "" };
  }
  if (/^(blob:|https?:)/i.test(src)) return { kind: "remote", source: src, fileName: fileNameOf(src) || "context-image", mime: "", reason: "" };
  const clean = stripQueryAndHash(src);
  if (clean.startsWith("local:///")) {
    const source = decodeSlashPath(clean.slice("local:///".length), true);
    return { kind: "file", source, fileName: fileNameOf(source), mime: "", reason: "" };
  }
  if (clean.startsWith("file:///")) {
    const source = decodeSlashPath(clean.slice("file:///".length), false);
    return { kind: "file", source, fileName: fileNameOf(source), mime: "", reason: "" };
  }
  if (clean.startsWith("appimg:///")) {
    const source = normalizeAppimgPath(clean.slice("appimg:///".length));
    return { kind: "file", source, fileName: fileNameOf(source), mime: "", reason: "" };
  }
  if (clean.startsWith("appimg://")) {
    const source = normalizeAppimgPath(clean.slice("appimg://".length));
    return { kind: "file", source, fileName: fileNameOf(source), mime: "", reason: "" };
  }
  if (/^[A-Za-z]:[\\/]/.test(clean) || /^\\\\/.test(clean) || clean.startsWith("/")) {
    return { kind: "file", source: clean, fileName: fileNameOf(clean), mime: "", reason: "" };
  }
  return { kind: "unsupported", source: src, fileName: fileNameOf(src), mime: "", reason: "unsupported_source" };
}
function normalizeDir(value) {
  return String(value || "").replace(/[\\/]+$/g, "");
}
function joinDir(root, relativeDir) {
  const sep = root.includes("\\") ? "\\" : "/";
  return normalizeDir(root) + sep + String(relativeDir || "").split("/").filter(Boolean).join(sep);
}
function targetNode(name, dir, relativeDir, children = [], virtual = false) {
  return { name, dir, path: "__dir__|" + dir, relativeDir, children, virtual };
}
function buildContextSaveTargets(index) {
  const rootDir = normalizeDir(index?.rootDir || "");
  if (!rootDir || index?.exists === false) return [];
  const roots = [targetNode("保存到根目录", rootDir, ".", [], false)];
  const byRelative = new Map();
  function ensureNode(parts) {
    let list = roots;
    let current = "";
    let node = null;
    for (const part of parts) {
      current = current ? current + "/" + part : part;
      node = byRelative.get(current);
      if (!node) {
        node = targetNode(part, joinDir(rootDir, current), current, [], true);
        byRelative.set(current, node);
        list.push(node);
      }
      list = node.children;
    }
    return node;
  }
  for (const pack of index?.packs || []) {
    if (!pack || !pack.relativeDir || pack.relativeDir === ".") continue;
    const parts = String(pack.relativeDir).split("/").filter(Boolean);
    if (!parts.length) continue;
    const node = ensureNode(parts);
    node.name = pack.name || node.name;
    node.dir = pack.dir || node.dir;
    node.path = "__dir__|" + node.dir;
    node.relativeDir = pack.relativeDir;
    node.virtual = false;
  }
  function sortChildren(nodes) {
    const first = nodes[0] && nodes[0].relativeDir === "." ? [nodes[0]] : [];
    const rest = nodes.slice(first.length).sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
    for (const node of rest) sortChildren(node.children);
    nodes.splice(0, nodes.length, ...first, ...rest);
    return nodes;
  }
  return sortChildren(roots);
}
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
  return {
    ...sanitized,
    recent: sanitized.recent.slice(),
    pinned: sanitized.pinned.slice(),
    packOrder: sanitized.packOrder.slice(),
    imageOrder: Object.fromEntries(Object.entries(sanitized.imageOrder).map(([key, value]) => [key, value.slice()])),
  };
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
async function getLibraryIndex(refresh = false) {
  try {
    return await ipcRenderer.invoke(refresh ? "localEmote:refreshLibraryIndex" : "localEmote:getLibraryIndex");
  } catch (_) {
    return { rootDir: "", exists: false, hash: "", packs: [], images: [], tree: [] };
  }
}
async function refreshLibraryIndex() {
  return getLibraryIndex(true);
}
async function importFiles(packDir) {
  try { return await ipcRenderer.invoke("localEmote:importFiles", packDir); } catch (_) { return { ok: false, imported: [] }; }
}
async function copyImageToPack(src, packDir) {
  try { return await ipcRenderer.invoke("localEmote:copyImageToPack", src, packDir); } catch (_) { return { ok: false }; }
}
async function renamePack(packDir, title) {
  try { return await ipcRenderer.invoke("localEmote:renamePack", packDir, title); } catch (_) { return { ok: false }; }
}
async function deleteEmote(filePath) {
  try { return await ipcRenderer.invoke("localEmote:deleteEmote", filePath); } catch (_) { return { ok: false }; }
}
async function updatePackMeta(packDir, patch) {
  try { return await ipcRenderer.invoke("localEmote:updatePackMeta", packDir, patch); } catch (_) { return { ok: false }; }
}
async function getContextSaveTargets() {
  try {
    const index = await getLibraryIndex(false);
    return buildContextSaveTargets(index);
  } catch (_) { return []; }
}
async function saveContextImage(payload) {
  try { return await ipcRenderer.invoke("localEmote:saveContextImage", payload); } catch (e) { return { ok: false, reason: e?.message || "write_failed" }; }
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

// Unified send fallback. Renderer may use QQNT native adapter first, then this clipboard path.
async function sendEmote(absPath, options = {}) {
  const cfg = getConfig();
  const plan = planSendEmote({
    mode: options.mode || cfg.sendMode,
    capabilities: options.capabilities || {},
    filePath: absPath,
  });
  try {
    const res = await ipcRenderer.invoke("localEmote:send", absPath);
    return toSendResult({ ok: !!(res && res.ok), plan, reason: res?.reason || "" });
  } catch (e) {
    return toSendResult({ ok: false, plan, reason: e?.message || "send_failed" });
  }
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
    const cfg = getConfig();
    let arr = [];
    if (!root || (cfg.rootDir && root === cfg.rootDir)) {
      const index = await getLibraryIndex(false);
      arr = index.packs || [];
    } else {
      arr = await ipcRenderer.invoke("localEmote:listPacksInDir", root);
    }
    const mapped = (Array.isArray(arr) ? arr : []).map((p) => ({
      name: p?.name || "",
      dir: p?.dir || "",
      first: p?.first || "",
      firstUrl: p?.first ? toLocalUrl(p.first) : (p?.coverPath ? toLocalUrl(p.coverPath) : ""),
      coverPath: p?.coverPath || p?.first || "",
      count: p?.count || 0,
      relativeDir: p?.relativeDir || "",
    }));
    return applyCustomOrder(mapped, cfg.packOrder, (item) => item.dir || item.path);
  } catch (_) { return []; }
}

// 新增：列出某个目录内的所有图片（用于点选某个包后渲染网格）
async function listImagesInDir(dir) {
  try {
    const index = await getLibraryIndex(false);
    const pack = Array.isArray(index.packs) ? index.packs.find((p) => p.dir === dir || p.path === dir) : null;
    if (pack && Array.isArray(pack.images)) {
      const cfg = getConfig();
      const dirKey = normalizeOrderPath(dir);
      const mapped = pack.images.map((item) => ({
        name: item.name || basename(item.path),
        path: item.path || item.absPath,
        absPath: item.path || item.absPath,
        url: item.url || toLocalUrl(item.path || item.absPath),
      }));
      return applyCustomOrder(mapped, cfg.imageOrder?.[dirKey], (item) => item.absPath || item.path);
    }
    const arr = await ipcRenderer.invoke("localEmote:listBrowseDir", dir);
    const cfg = getConfig();
    const dirKey = normalizeOrderPath(dir);
    const mapped = (Array.isArray(arr) ? arr : []).map((i) => {
      const p = i?.path || "";
      return { name: i?.name || (p ? basename(p) : ""), path: p, url: toLocalUrl(p) };
    });
    return applyCustomOrder(mapped, cfg.imageOrder?.[dirKey], (item) => item.path);
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
  getLibraryIndex,
  refreshLibraryIndex,
  importFiles,
  copyImageToPack,
  renamePack,
  deleteEmote,
  updatePackMeta,
  getContextSaveTargets,
  saveContextImage,
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
  normalizeContextImageSource,
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
