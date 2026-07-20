const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const renderer = fs.readFileSync(path.join(__dirname, "..", "src", "renderer.js"), "utf8");

test("opening the emote overlay resets the vertical content scroll after rendering", () => {
  const showBody = renderer.match(/async function show\(anchorRect\) \{([\s\S]*?)\n\s*function hide\(\)/);

  assert.ok(showBody, "overlay show body should be present");
  assert.match(
    showBody[1],
    /await renderGrid\(\);[\s\S]*?applyActiveAfterRender\(\);[\s\S]*?scroll\.scrollTop\s*=\s*0;/
  );
});

test("passive grid rendering does not scroll the active local card into view", () => {
  const applyBody = renderer.match(/function applyActiveAfterRender\(\) \{([\s\S]*?)\n\s*function moveActive\(delta\)/);
  const moveBody = renderer.match(/function moveActive\(delta\) \{([\s\S]*?)\n\s*searchInput\.addEventListener/);

  assert.ok(applyBody, "passive active-state updater should be present");
  assert.ok(moveBody, "keyboard active-state mover should be present");
  assert.doesNotMatch(applyBody[1], /scrollIntoView/);
  assert.match(moveBody[1], /scrollIntoView\(\{\s*block:\s*'nearest',\s*inline:\s*'nearest'\s*\}\)/);
});
