const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

function readRenderer() {
  return fs.readFileSync(path.join(__dirname, "..", "src", "renderer.js"), "utf8");
}

test("renderer installs drag sorting for local image grid only", () => {
  const renderer = readRenderer();

  assert.match(renderer, /function\s+leInstallSortableGrid\s*\(/);
  assert.match(renderer, /LE_SORT_DRAG_THRESHOLD/);
  assert.match(renderer, /if\s*\(searchQuery\.trim\(\)\)\s*return;/);
  assert.match(renderer, /leInstallSortableGrid\(\s*grid\s*\)/);

  const recentBody = renderer.match(/async function renderRecentGrid\(\) \{([\s\S]*?)async function renderGrid\(\)/);
  assert.ok(recentBody, "renderRecentGrid body should be present");
  assert.doesNotMatch(recentBody[1], /leInstallSortableGrid/);
});

test("renderer writes imageOrder after dragging image cards", () => {
  const renderer = readRenderer();

  assert.match(renderer, /function\s+leCommitImageOrder\s*\(/);
  assert.match(renderer, /cfg\.imageOrder\s*=\s*cfg\.imageOrder\s*\|\|\s*\{\}/);
  assert.match(renderer, /cfg\.imageOrder\[dirKey\]\s*=\s*order/);
  assert.match(renderer, /window\.localEmote\.setConfig\(cfg\)/);
  assert.match(renderer, /card\.dataset\.leSortPath\s*=/);
});

test("renderer installs pack bar drag sorting and writes packOrder", () => {
  const renderer = readRenderer();

  assert.match(renderer, /function\s+leInstallSortablePacksBar\s*\(/);
  assert.match(renderer, /function\s+leCommitPackOrder\s*\(/);
  assert.match(renderer, /cfg\.packOrder\s*=\s*order/);
  assert.match(renderer, /window\.localEmote\.setConfig\(cfg\)/);
  assert.match(renderer, /item\.dataset\.leSortDir\s*=/);
  assert.match(renderer, /leInstallSortablePacksBar\(\s*packsBar\s*\)/);
});

test("renderer suppresses click after a drag so sorting does not send emotes", () => {
  const renderer = readRenderer();

  assert.match(renderer, /__leSuppressClickOnce/);
  assert.match(renderer, /if\s*\(card\.__leSuppressClickOnce\)\s*\{/);
  assert.match(renderer, /if\s*\(item\.__leSuppressClickOnce\)\s*\{/);
  assert.match(renderer, /dragItem\.__leSuppressClickOnce\s*=\s*true/);
});

test("renderer disables native image dragging for sortable cards and packs", () => {
  const renderer = readRenderer();

  assert.match(renderer, /card\.draggable\s*=\s*false/);
  assert.match(renderer, /img\.draggable\s*=\s*false/);
  assert.match(renderer, /item\.draggable\s*=\s*false/);
  assert.match(renderer, /function\s+lePreventNativeSortDrag\s*\(/);
  assert.match(renderer, /container\.addEventListener\('dragstart',\s*lePreventNativeSortDrag,\s*true\)/);
});

test("renderer supports long-press activation and document-level pointer fallback", () => {
  const renderer = readRenderer();

  assert.match(renderer, /LE_SORT_HOLD_DELAY/);
  assert.match(renderer, /state\.holdTimer\s*=\s*window\.setTimeout/);
  assert.match(renderer, /function\s+startDragging\s*\(/);
  assert.match(renderer, /document\.addEventListener\('pointermove',\s*onPointerMove,\s*true\)/);
  assert.match(renderer, /document\.addEventListener\('pointerup',\s*onPointerUp,\s*true\)/);
  assert.match(renderer, /document\.removeEventListener\('pointermove',\s*onPointerMove,\s*true\)/);
  assert.match(renderer, /document\.removeEventListener\('pointerup',\s*onPointerUp,\s*true\)/);
});
