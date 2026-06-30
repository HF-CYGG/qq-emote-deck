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

test("renderer defines FLIP helpers for smooth sort reflow", () => {
  const renderer = readRenderer();

  assert.match(renderer, /function\s+lePrefersReducedMotion\s*\(/);
  assert.match(renderer, /matchMedia\('\(prefers-reduced-motion:\s*reduce\)'\)/);
  assert.match(renderer, /function\s+leCaptureSortRects\s*\(\s*container,\s*selector\s*\)/);
  assert.match(renderer, /new\s+Map\(\)/);
  assert.match(renderer, /getBoundingClientRect\(\)/);
  assert.match(renderer, /function\s+leAnimateSortReflow\s*\(\s*container,\s*selector,\s*beforeRects,\s*options\s*=\s*\{\}\s*\)/);
  assert.match(renderer, /function\s+leCancelSortAnimations\s*\(\s*nodes\s*\)/);
});

test("renderer animates sort reflow with transform-only FLIP transitions", () => {
  const renderer = readRenderer();
  const flipBody = renderer.slice(
    renderer.indexOf("function leAnimateSortReflow"),
    renderer.indexOf("function leInstallPointerSorter")
  );

  assert.match(renderer, /LE_SORT_ANIMATION_MS/);
  assert.match(renderer, /le-sort-animating/);
  assert.match(flipBody, /style\.transform\s*=\s*`translate\(\$\{dx\}px,\s*\$\{dy\}px\)`/);
  assert.match(flipBody, /style\.transition\s*=\s*`transform \$\{duration\}ms/);
  assert.match(flipBody, /requestAnimationFrame\(\(\)\s*=>\s*\{/);
  assert.match(flipBody, /style\.transform\s*=\s*'translate\(0,\s*0\)'/);
  assert.doesNotMatch(flipBody, /style\.(?:top|left)\s*=/);
});

test("renderer skips dragged item and clears interrupted sort animations", () => {
  const renderer = readRenderer();

  assert.match(renderer, /const\s+dragItem\s*=\s*options\.dragItem\s*\|\|\s*null/);
  assert.match(renderer, /if\s*\(node\s*===\s*dragItem\)\s*return;/);
  assert.match(renderer, /cancelAnimationFrame\(node\.__leSortAnimFrame\)/);
  assert.match(renderer, /clearTimeout\(node\.__leSortAnimTimer\)/);
  assert.match(renderer, /node\.style\.transition\s*=\s*''/);
  assert.match(renderer, /node\.style\.transform\s*=\s*''/);
});

test("renderer runs FLIP around DOM insertion during drag sorting", () => {
  const renderer = readRenderer();

  assert.match(renderer, /const\s+beforeRects\s*=\s*leCaptureSortRects\(container,\s*selector\)/);
  assert.match(renderer, /const\s+referenceNode\s*=\s*leGetSortReferenceNode\(state\.dragItem,\s*target,\s*before\)/);
  assert.match(renderer, /container\.insertBefore\(state\.dragItem,\s*referenceNode\)/);
  assert.match(renderer, /leAnimateSortReflow\(container,\s*selector,\s*beforeRects,\s*\{\s*dragItem:\s*state\.dragItem/);
});

test("renderer keeps dragged sort item under the pointer", () => {
  const renderer = readRenderer();

  assert.match(renderer, /function\s+leMoveSortDragItem\s*\(\s*state,\s*ev\s*\)/);
  assert.match(renderer, /grabOffsetX:\s*ev\.clientX\s*-\s*startRect\.left/);
  assert.match(renderer, /grabOffsetY:\s*ev\.clientY\s*-\s*startRect\.top/);
  assert.match(renderer, /const\s+tx\s*=\s*ev\.clientX\s*-\s*grabOffsetX\s*-\s*rect\.left/);
  assert.match(renderer, /const\s+ty\s*=\s*ev\.clientY\s*-\s*grabOffsetY\s*-\s*rect\.top/);
  assert.match(renderer, /style\.setProperty\('--le-drag-x',\s*`\$\{tx\}px`\)/);
  assert.match(renderer, /style\.setProperty\('--le-drag-y',\s*`\$\{ty\}px`\)/);
  assert.match(renderer, /leMoveSortDragItem\(state,\s*ev\)/);
});

test("renderer clears pointer-follow drag offsets after sorting ends", () => {
  const renderer = readRenderer();

  assert.match(renderer, /function\s+leResetSortDragItem\s*\(\s*dragItem\s*\)/);
  assert.match(renderer, /style\.removeProperty\('--le-drag-x'\)/);
  assert.match(renderer, /style\.removeProperty\('--le-drag-y'\)/);
  assert.match(renderer, /leResetSortDragItem\(dragItem\)/);
  assert.match(renderer, /translate3d\(var\(--le-drag-x,\s*0px\),\s*var\(--le-drag-y,\s*0px\),\s*0\)\s*scale\(\.96\)/);
  assert.match(renderer, /translate3d\(var\(--le-drag-x,\s*0px\),\s*var\(--le-drag-y,\s*0px\),\s*0\)\s*scale\(\.9\)/);
});

test("renderer measures the dragged slot without its active transform", () => {
  const renderer = readRenderer();
  const moveBody = renderer.slice(
    renderer.indexOf("function leMoveSortDragItem"),
    renderer.indexOf("function leResetSortDragItem")
  );
  const measureBody = renderer.slice(
    renderer.indexOf("function leMeasureSortSlotRect"),
    renderer.indexOf("function leMoveSortDragItem")
  );

  assert.match(renderer, /function\s+leMeasureSortSlotRect\s*\(\s*dragItem\s*\)/);
  assert.match(moveBody, /const\s+rect\s*=\s*leMeasureSortSlotRect\(state\.dragItem\)/);
  assert.doesNotMatch(moveBody, /state\.dragItem\.getBoundingClientRect\(\)/);
  assert.match(measureBody, /const\s+prevTransform\s*=\s*dragItem\.style\.transform/);
  assert.match(measureBody, /dragItem\.style\.transition\s*=\s*'none'/);
  assert.match(measureBody, /dragItem\.style\.transform\s*=\s*'none'/);
  assert.match(measureBody, /dragItem\.getBoundingClientRect\(\)/);
  assert.match(measureBody, /finally\s*\{/);
  assert.match(measureBody, /dragItem\.style\.transform\s*=\s*prevTransform/);
});

test("renderer skips DOM reflow when the pointer stays in the same sort slot", () => {
  const renderer = readRenderer();
  const pointerMoveBody = renderer.slice(
    renderer.indexOf("const onPointerMove = (ev) => {"),
    renderer.indexOf("const onPointerUp = (ev) => {")
  );

  assert.match(renderer, /function\s+leGetSortReferenceNode\s*\(\s*dragItem,\s*target,\s*before\s*\)/);
  assert.match(renderer, /function\s+leIsSortReferenceUnchanged\s*\(\s*dragItem,\s*referenceNode\s*\)/);
  assert.match(pointerMoveBody, /const\s+referenceNode\s*=\s*leGetSortReferenceNode\(state\.dragItem,\s*target,\s*before\)/);
  assert.match(pointerMoveBody, /if\s*\(leIsSortReferenceUnchanged\(state\.dragItem,\s*referenceNode\)\)\s*\{[\s\S]*?leMoveSortDragItem\(state,\s*ev\);[\s\S]*?return;/);
  assert.match(pointerMoveBody, /container\.insertBefore\(state\.dragItem,\s*referenceNode\)/);
  assert.doesNotMatch(pointerMoveBody, /container\.insertBefore\(state\.dragItem,\s*before\s*\?\s*target\s*:\s*target\.nextSibling\)/);
});

test("renderer only cancels FLIP animations for nodes that actually move", () => {
  const renderer = readRenderer();
  const flipBody = renderer.slice(
    renderer.indexOf("function leAnimateSortReflow"),
    renderer.indexOf("function leGetSortReferenceNode")
  );

  assert.doesNotMatch(flipBody, /leCancelSortAnimations\(nodes\)/);
  assert.match(flipBody, /const\s+movedNodes\s*=\s*\[\]/);
  assert.match(flipBody, /const\s+after\s*=\s*leMeasureSortSlotRect\(node\)/);
  assert.match(flipBody, /movedNodes\.push\(\{\s*node,\s*dx,\s*dy\s*\}\)/);
  assert.match(flipBody, /leCancelSortAnimations\(movedNodes\.map\(\(item\)\s*=>\s*item\.node\)\)/);
  assert.match(flipBody, /movedNodes\.forEach\(\(\{\s*node,\s*dx,\s*dy\s*\}\)\s*=>/);
});
