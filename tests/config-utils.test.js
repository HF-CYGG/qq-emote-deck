const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const {
  DEFAULT_CONFIG,
  mergeConfigPatch,
  resolveConfigPaths,
  sanitizeConfig,
  selectStartupConfig,
} = require("../src/config-utils.js");

test("resolveConfigPaths uses LiteLoader data path and falls back to profile/data", () => {
  const pluginDataPath = path.join("E:", "QQNT", "resources", "app", "LiteLoaderQQNT", "data", "local_emotes");
  const profilePath = path.join("E:", "QQNT", "resources", "app", "LiteLoaderQQNT");
  const resolvedWithPlugin = resolveConfigPaths({ pluginDataPath, profilePath, slug: "local_emotes" });

  assert.equal(resolvedWithPlugin.dataDir, path.resolve(pluginDataPath));
  assert.equal(resolvedWithPlugin.configFile, path.join(path.resolve(pluginDataPath), "config.json"));

  const resolvedFallback = resolveConfigPaths({ profilePath, slug: "local_emotes" });
  assert.equal(resolvedFallback.dataDir, path.join(path.resolve(profilePath), "data", "local_emotes"));
  assert.equal(resolvedFallback.legacyDataDir, path.join(path.resolve(profilePath), "local_emotes"));
});

test("sanitizeConfig preserves user choices and clamps numeric options", () => {
  const cfg = sanitizeConfig({
    rootDir: "C:\\Users\\me\\Documents\\QQNT 插件\\本地表情",
    sendMode: "native",
    recentLimit: 5000,
    pinLimit: -20,
    gridCols: 99,
    recent: ["a.png", 42, "b.gif"],
    pinned: ["a.png", "a.png", "b.gif"],
    unknown: "ignored",
  });

  assert.equal(cfg.rootDir, "C:\\Users\\me\\Documents\\QQNT 插件\\本地表情");
  assert.equal(cfg.sendMode, "native");
  assert.equal(cfg.recentLimit, 999);
  assert.equal(cfg.pinLimit, 1);
  assert.equal(cfg.gridCols, 12);
  assert.deepEqual(cfg.recent, ["a.png", "b.gif"]);
  assert.deepEqual(cfg.pinned, ["a.png"]);
  assert.equal(Object.hasOwn(cfg, "unknown"), false);
});

test("mergeConfigPatch keeps existing persisted values when patch is partial", () => {
  const current = sanitizeConfig({
    rootDir: "D:\\emotes",
    sendMode: "image",
    lastCategory: "__dir__|D:\\emotes\\cats",
    recentLimit: 60,
  });

  const merged = mergeConfigPatch(current, { recentLimit: 10 });

  assert.equal(merged.rootDir, "D:\\emotes");
  assert.equal(merged.sendMode, "image");
  assert.equal(merged.lastCategory, "__dir__|D:\\emotes\\cats");
  assert.equal(merged.recentLimit, 10);
});

test("selectStartupConfig prefers meaningful official config over legacy sources", () => {
  const selected = selectStartupConfig({
    officialConfig: { rootDir: "D:\\official", sendMode: "native" },
    legacyConfig: { rootDir: "D:\\legacy", sendMode: "image" },
    localStorageConfig: { rootDir: "D:\\browser", sendMode: "multi" },
  });

  assert.equal(selected.source, "official");
  assert.equal(selected.config.rootDir, "D:\\official");
  assert.equal(selected.config.sendMode, "native");
});

test("selectStartupConfig migrates meaningful legacy config when official config is default", () => {
  const selected = selectStartupConfig({
    officialConfig: DEFAULT_CONFIG,
    legacyConfig: { rootDir: "D:\\legacy", sendMode: "image" },
    localStorageConfig: { rootDir: "D:\\browser", sendMode: "native" },
  });

  assert.equal(selected.source, "legacy");
  assert.equal(selected.config.rootDir, "D:\\legacy");
  assert.equal(selected.config.sendMode, "image");
});

test("selectStartupConfig can import localStorage only when file configs are not meaningful", () => {
  const selected = selectStartupConfig({
    officialConfig: DEFAULT_CONFIG,
    legacyConfig: {},
    localStorageConfig: { rootDir: "D:\\browser", sendMode: "native" },
  });

  assert.equal(selected.source, "localStorage");
  assert.equal(selected.config.rootDir, "D:\\browser");
  assert.equal(selected.config.sendMode, "native");
});
