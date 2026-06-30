const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("preload script does not require local relative modules under LiteLoader eval loader", () => {
  const preload = fs.readFileSync(path.join(__dirname, "..", "src", "preload.js"), "utf8");

  assert.equal(/require\(\s*["']\.{1,2}\//.test(preload), false);
});
