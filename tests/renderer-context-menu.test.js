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

test("context save menu item strips QQNT internal clone state", () => {
  const renderer = fs.readFileSync(path.join(__dirname, "..", "src", "renderer.js"), "utf8");

  assert.match(renderer, /function\s+leCreateCleanContextItem\s*\(/);
  assert.match(renderer, /removeAttribute\("id"\)/);
  assert.match(renderer, /startsWith\("bf-"\)|\/\^bf-\//);
  assert.match(renderer, /setAttribute\("data-le-context-item-id"/);
  assert.match(renderer, /leCreateCleanContextItem\(\s*sourceItem,\s*title\s*\)/);
  assert.doesNotMatch(renderer, /const\s+contextItem\s*=\s*qContextMenu\.querySelector[\s\S]*?cloneNode\(true\)/);
});

test("context save submenu has event and coordinate hover fallbacks", () => {
  const renderer = fs.readFileSync(path.join(__dirname, "..", "src", "renderer.js"), "utf8");

  assert.match(renderer, /function\s+leCreateContextSubMenu\s*\(/);
  assert.match(renderer, /function\s+leOpenContextSubMenu\s*\(/);
  assert.match(renderer, /parentEl\.addEventListener\("mouseenter"/);
  assert.match(renderer, /parentEl\.addEventListener\("mousemove"/);
  assert.match(renderer, /parentEl\.addEventListener\("pointermove"/);
  assert.match(renderer, /function\s+leOpenIfPointerOverAnchor\s*\(/);
  assert.match(renderer, /requestAnimationFrame\(leOpenIfPointerOverAnchor\)/);
  assert.match(renderer, /document\.addEventListener\("pointermove",\s*openFromPointer,\s*true\)/);
});

test("context save submenu style and cleanup are self-contained", () => {
  const renderer = fs.readFileSync(path.join(__dirname, "..", "src", "renderer.js"), "utf8");

  assert.match(renderer, /\.le-sub-context-menu\{[^}]*z-index:2147483647[^}]*pointer-events:none/);
  assert.match(renderer, /\.le-sub-context-menu\.show\{[^}]*pointer-events:auto/);
  assert.match(renderer, /function\s+leClampContextMenuPosition\s*\(/);
  assert.match(renderer, /function\s+leClearAllSubMenuTimers\s*\(/);
  assert.match(renderer, /document\.removeEventListener\("pointermove",\s*openFromPointer,\s*true\)/);
  assert.match(renderer, /document\.removeEventListener\("pointerdown",\s*closeOnOutsidePointer,\s*true\)/);
  assert.match(renderer, /document\.removeEventListener\("keydown",\s*closeOnEscape,\s*true\)/);
});

test("context save submenu is viewport constrained and scrollable", () => {
  const renderer = fs.readFileSync(path.join(__dirname, "..", "src", "renderer.js"), "utf8");

  assert.match(renderer, /--le-sub-menu-max-height/);
  assert.match(renderer, /\.le-sub-context-menu\{[^}]*max-height:var\(--le-sub-menu-max-height/);
  assert.match(renderer, /\.le-sub-context-menu \.le-sub-scroll\{[^}]*overflow-y:auto/);
  assert.match(renderer, /\.le-sub-context-menu \.le-sub-scroll\{[^}]*overscroll-behavior:contain/);
  assert.match(renderer, /\.le-sub-context-menu \.le-sub-scroll::-webkit-scrollbar-thumb/);
  assert.match(renderer, /function\s+leComputeSubMenuMaxHeight\s*\(/);
  assert.match(renderer, /menuEl\.style\.setProperty\("--le-sub-menu-max-height"/);
  assert.match(renderer, /scrollEl\.addEventListener\("wheel"/);
});

test("context save submenu matches QQNT menu theme and uses subtle scrollbars", () => {
  const renderer = fs.readFileSync(path.join(__dirname, "..", "src", "renderer.js"), "utf8");

  assert.match(renderer, /function\s+leReadQQNTMenuTheme\s*\(\s*qContextMenu,\s*sourceItem\s*\)/);
  assert.match(renderer, /function\s+leApplyQQNTMenuTheme\s*\(\s*menuEl,\s*theme\s*\)/);
  assert.match(renderer, /getComputedStyle\(qContextMenu\)/);
  assert.match(renderer, /getComputedStyle\(sourceItem\)/);
  assert.match(renderer, /--le-menu-font-family/);
  assert.match(renderer, /--le-menu-font-size/);
  assert.match(renderer, /--le-menu-line-height/);
  assert.match(renderer, /--le-menu-bg/);
  assert.match(renderer, /--le-menu-color/);
  assert.match(renderer, /--le-menu-item-height/);
  assert.match(renderer, /--le-menu-item-padding/);
  assert.match(renderer, /\.le-sub-context-menu \.le-sub-scroll::-webkit-scrollbar\{width:6px/);
  assert.match(renderer, /\.le-sub-context-menu \.le-sub-scroll::-webkit-scrollbar-track\{background:transparent\}/);
  assert.match(renderer, /scrollbar-color:var\(--le-menu-scrollbar-thumb,rgba\(255,255,255,\.18\)\) transparent/);
  assert.match(renderer, /\.le-sub-context-menu \.le-sub-scroll::-webkit-scrollbar-thumb\{background:var\(--le-menu-scrollbar-thumb,rgba\(255,255,255,\.18\)\);border:2px solid transparent;border-radius:999px;background-clip:content-box\}/);
  assert.match(renderer, /\.le-sub-context-menu \.le-sub-scroll::-webkit-scrollbar-thumb:hover\{background:var\(--le-menu-scrollbar-thumb-hover,rgba\(255,255,255,\.28\)\);background-clip:content-box\}/);
  assert.doesNotMatch(renderer, /\.le-sub-context-menu \.le-sub-scroll::-webkit-scrollbar\{width:8px/);
});

test("context save submenu avoids transparent or pure black menu backgrounds", () => {
  const renderer = fs.readFileSync(path.join(__dirname, "..", "src", "renderer.js"), "utf8");

  assert.match(renderer, /function\s+leIsUsableMenuBackground\s*\(\s*value\s*\)/);
  assert.match(renderer, /function\s+lePickQQNTMenuBackground\s*\(\s*menuStyle,\s*itemStyle\s*\)/);
  assert.match(renderer, /rgba\(0,\s*0,\s*0,\s*0\)/);
  assert.match(renderer, /rgb\(0,\s*0,\s*0\)/);
  assert.match(renderer, /--bg_transparent/);
  assert.match(renderer, /--bg_primary/);
  assert.match(renderer, /--bg_secondary/);
  assert.match(renderer, /bg:\s*lePickQQNTMenuBackground\(menuStyle,\s*itemStyle\)/);
  assert.match(renderer, /--le-menu-scrollbar-thumb/);
  assert.match(renderer, /--le-menu-scrollbar-thumb-hover/);
});

test("context save submenu manually handles wheel scrolling before QQNT menu swallows it", () => {
  const renderer = fs.readFileSync(path.join(__dirname, "..", "src", "renderer.js"), "utf8");

  assert.match(renderer, /function\s+leHandleSubMenuWheel\s*\(\s*scrollEl,\s*event\s*\)/);
  assert.match(renderer, /scrollEl\.scrollTop\s*=\s*nextTop/);
  assert.match(renderer, /event\.preventDefault\?\.\(\)/);
  assert.match(renderer, /event\.stopImmediatePropagation\?\.\(\)/);
  assert.match(renderer, /document\.addEventListener\("wheel",\s*handleSubMenuWheel,\s*\{\s*capture:\s*true,\s*passive:\s*false\s*\}\)/);
  assert.match(renderer, /document\.removeEventListener\("wheel",\s*handleSubMenuWheel,\s*\{\s*capture:\s*true\s*\}\)/);
});

test("context save submenu passes QQNT theme through nested menus", () => {
  const renderer = fs.readFileSync(path.join(__dirname, "..", "src", "renderer.js"), "utf8");

  assert.match(renderer, /function\s+leCreateContextSubMenu\s*\(\s*parentEl,\s*menuItems,\s*callback,\s*level\s*=\s*0,\s*theme\s*=\s*null\s*\)/);
  assert.match(renderer, /leApplyQQNTMenuTheme\(subMenuEl,\s*theme\)/);
  assert.match(renderer, /leCreateContextSubMenu\(subMenuItemEl,\s*children,\s*callback,\s*level\s*\+\s*1,\s*theme\)/);
  assert.match(renderer, /const\s+theme\s*=\s*leReadQQNTMenuTheme\(qContextMenu,\s*sourceItem\)/);
  assert.match(renderer, /leCreateContextSubMenu\(contextItem,\s*tree,\s*callback,\s*0,\s*theme\)/);
});

test("context save observer preserves submenus while a processed QQNT menu is still mounted", () => {
  const renderer = fs.readFileSync(path.join(__dirname, "..", "src", "renderer.js"), "utf8");
  const observerBody = renderer.match(/const\s+moCtx\s*=\s*new\s+MutationObserver\(\(\)\s*=>\s*\{\s*try\s*\{([\s\S]*?)qContextMenu\.classList\.add\("le-context-menu"\);/);

  assert.ok(observerBody, "right-click menu observer body should be present");
  assert.match(observerBody[1], /const\s+activeQContextMenu\s*=\s*document\.querySelector\("\.q-context-menu"\)/);
  assert.match(observerBody[1], /if\s*\(!activeQContextMenu\)\s*\{\s*leRemoveAllSubMenus\(\);\s*return;\s*\}/);
  assert.match(observerBody[1], /const\s+qContextMenu\s*=\s*document\.querySelector\("\.q-context-menu:not\(\.le-context-menu\)"\)/);
  assert.match(observerBody[1], /if\s*\(!qContextMenu\)\s*return;/);
  assert.doesNotMatch(observerBody[1], /if\s*\(!qContextMenu\)\s*\{\s*leRemoveAllSubMenus\(\);/);
});
