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
