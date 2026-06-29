const path = require("path");

const DEFAULT_CONFIG = Object.freeze({
  rootDir: "",
  recent: [],
  pinned: [],
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

function cloneDefaultConfig() {
  return {
    ...DEFAULT_CONFIG,
    recent: [],
    pinned: [],
  };
}

function clampInt(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function sanitizeConfig(input) {
  const out = cloneDefaultConfig();
  if (!input || typeof input !== "object") return out;

  const recentLimit = clampInt(input.recentLimit, 1, 999, out.recentLimit);
  const pinLimit = clampInt(input.pinLimit, 1, 99, out.pinLimit);
  out.recentLimit = recentLimit;
  out.pinLimit = pinLimit;

  if (typeof input.rootDir === "string") out.rootDir = input.rootDir;
  if (Array.isArray(input.recent)) {
    out.recent = input.recent.filter((p) => typeof p === "string").slice(0, recentLimit);
  }
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
  if (cfg.rootDir) return true;
  if (cfg.recent.length > 0 || cfg.pinned.length > 0) return true;
  if (cfg.lastCategory) return true;
  if (cfg.hotkey !== DEFAULT_CONFIG.hotkey) return true;
  if (cfg.gridCols !== DEFAULT_CONFIG.gridCols) return true;
  if (cfg.showFileName !== DEFAULT_CONFIG.showFileName) return true;
  if (cfg.sendMode !== DEFAULT_CONFIG.sendMode) return true;
  if (cfg.debug !== DEFAULT_CONFIG.debug) return true;
  if (cfg.recentLimit !== DEFAULT_CONFIG.recentLimit) return true;
  if (cfg.pinLimit !== DEFAULT_CONFIG.pinLimit) return true;
  if (cfg.imageContextMenu !== DEFAULT_CONFIG.imageContextMenu) return true;
  if (cfg.hoverPreview !== DEFAULT_CONFIG.hoverPreview) return true;
  return false;
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

function resolveConfigPaths({ pluginDataPath, profilePath, slug = "local_emotes" } = {}) {
  const profile = profilePath ? path.resolve(profilePath) : "";
  const dataDir = pluginDataPath
    ? path.resolve(pluginDataPath)
    : path.join(profile, "data", slug);
  const legacyDataDir = profile ? path.join(profile, slug) : "";
  return {
    dataDir,
    emoteDir: path.join(dataDir, "emotes"),
    logFile: path.join(dataDir, "log.txt"),
    configFile: path.join(dataDir, "config.json"),
    legacyDataDir,
    legacyConfigFile: legacyDataDir ? path.join(legacyDataDir, "config.json") : "",
  };
}

function selectStartupConfig({ officialConfig, legacyConfig, localStorageConfig } = {}) {
  if (isMeaningfulConfig(officialConfig)) {
    return { source: "official", config: sanitizeConfig(officialConfig), shouldPersist: false };
  }
  if (isMeaningfulConfig(legacyConfig)) {
    return { source: "legacy", config: sanitizeConfig(legacyConfig), shouldPersist: true };
  }
  if (isMeaningfulConfig(localStorageConfig)) {
    return { source: "localStorage", config: sanitizeConfig(localStorageConfig), shouldPersist: true };
  }
  return { source: "default", config: sanitizeConfig(officialConfig || DEFAULT_CONFIG), shouldPersist: false };
}

module.exports = {
  CONFIG_KEYS,
  DEFAULT_CONFIG,
  cloneDefaultConfig,
  isMeaningfulConfig,
  mergeConfigPatch,
  resolveConfigPaths,
  sanitizeConfig,
  selectStartupConfig,
};
