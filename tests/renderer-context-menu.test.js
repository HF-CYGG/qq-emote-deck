const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("context save menu main item clicks the first save target instead of doing nothing", () => {
  const renderer = fs.readFileSync(path.join(__dirname, "..", "src", "renderer.js"), "utf8");

  assert.match(renderer, /const\s+target\s*=\s*data\s*\|\|\s*subMenuList\?.\[0\]/);
  assert.match(
    renderer,
    /leAddQContextMenu\(\s*qContextMenu,\s*"保存到本地表情",\s*subMenuList,[\s\S]*?\},\s*true\s*\);/
  );
});

test("context save submenu has hover fallbacks and topmost z-index", () => {
  const renderer = fs.readFileSync(path.join(__dirname, "..", "src", "renderer.js"), "utf8");

  assert.match(renderer, /\.le-sub-context-menu\{[^}]*z-index:2147483647/);
  assert.match(renderer, /function\s+leOpenSubMenuFromAnchor/);
  assert.match(renderer, /parentEl\.matches\(":hover"\)/);
  assert.match(renderer, /document\.addEventListener\("pointermove",\s*openFromPointer,\s*true\)/);
});
