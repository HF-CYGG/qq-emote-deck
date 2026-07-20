const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const renderer = fs.readFileSync(path.join(__dirname, "..", "src", "renderer.js"), "utf8");

function sourceBetween(startMarker, endMarker) {
  const start = renderer.indexOf(startMarker);
  const end = renderer.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `missing source block: ${startMarker}`);
  return renderer.slice(start, end);
}

function createElement(tagName = "div") {
  return {
    tagName,
    id: "",
    isConnected: false,
    parentElement: null,
    children: [],
    style: {},
    attributes: new Map(),
    appendChild(child) {
      if (child.parentElement) {
        child.parentElement.children = child.parentElement.children.filter((item) => item !== child);
      }
      child.parentElement = this;
      child.isConnected = this.isConnected;
      this.children.push(child);
      return child;
    },
    remove() {
      if (this.parentElement) {
        this.parentElement.children = this.parentElement.children.filter((item) => item !== this);
      }
      this.parentElement = null;
      this.isConnected = false;
    },
    setAttribute(name, value) {
      this.attributes.set(name, value);
    },
    addEventListener() {},
    getBoundingClientRect() {
      return { left: 0, top: 0, right: 24, bottom: 24, width: 24, height: 24 };
    },
  };
}

function createToolbar(visible = true) {
  const bar = createElement("div");
  const left = createElement("div");
  bar.visible = visible;
  bar.isConnected = true;
  left.isConnected = true;
  bar.appendChild(left);
  return { bar, left };
}

function createHarness() {
  const state = {
    preferredBars: [],
    fallbackBars: [],
    overlayBuilds: 0,
    frames: [],
  };
  const document = {
    querySelectorAll(selector) {
      if (selector === ".chat-input-area .chat-func-bar") return state.preferredBars;
      if (selector === ".chat-func-bar") return state.fallbackBars;
      if (selector === "#local-emote-toolbar-btn") {
        const buttons = [];
        for (const { left } of state.fallbackBars.map((bar) => ({ left: bar.firstElementChild }))) {
          for (const child of left?.children || []) {
            if (child.id === "local-emote-toolbar-btn" && child.isConnected) buttons.push(child);
          }
        }
        return buttons;
      }
      return [];
    },
    createElement,
  };

  const findSource = sourceBetween("function findActiveChatFuncBar()", "function injectButton()");
  const injectSource = sourceBetween("function injectButton()", "document.addEventListener('keydown'");
  const scheduleSource = sourceBetween("function scheduleInjectCheck()", "const leContextMenuState");
  const context = {
    document,
    window: {},
    setTimeout(fn) { state.frames.push(fn); },
    requestAnimationFrame(fn) { state.frames.push(fn); },
    console,
    __state: state,
  };

  vm.runInNewContext(`
    let overlayInstance = null;
    let toolbarBtnRef = null;
    let injectCheckScheduled = false;
    function dbg() {}
    function isVisible(item) { return item.visible !== false; }
    function createIconSvg() { return document.createElement('svg'); }
    function buildOverlay() {
      globalThis.__state.overlayBuilds += 1;
      return { el: { isConnected: true, style: { display: 'none' } }, hide() {} };
    }
    ${findSource}
    ${injectSource}
    const tryInject = () => injectButton();
    ${scheduleSource}
    globalThis.__api = { injectButton, scheduleInjectCheck };
  `, context);

  return { state, context };
}

test("toolbar entry is reused, moved to a rebuilt active toolbar, and recreated after removal", () => {
  const { state, context } = createHarness();
  const first = createToolbar(true);
  first.bar.firstElementChild = first.left;
  state.preferredBars = [first.bar];
  state.fallbackBars = [first.bar];

  assert.equal(context.__api.injectButton(), true);
  const originalButton = first.left.children[0];
  assert.equal(context.__api.injectButton(), true);
  assert.equal(first.left.children.length, 1);
  assert.equal(state.overlayBuilds, 1);

  const second = createToolbar(true);
  second.bar.firstElementChild = second.left;
  first.bar.visible = false;
  state.preferredBars = [first.bar, second.bar];
  state.fallbackBars = [first.bar, second.bar];

  assert.equal(context.__api.injectButton(), true);
  assert.equal(second.left.children[0], originalButton);
  assert.equal(first.left.children.length, 0);

  originalButton.remove();
  assert.equal(context.__api.injectButton(), true);
  assert.notEqual(second.left.children[0], originalButton);
  assert.equal(second.left.children.length, 1);
  assert.equal(state.overlayBuilds, 1, "reinjecting must reuse the existing overlay");
});

test("repeated mutation checks coalesce into one animation-frame reconciliation", () => {
  const { state, context } = createHarness();
  const toolbar = createToolbar(true);
  toolbar.bar.firstElementChild = toolbar.left;
  state.preferredBars = [toolbar.bar];
  state.fallbackBars = [toolbar.bar];

  context.__api.scheduleInjectCheck();
  context.__api.scheduleInjectCheck();
  context.__api.scheduleInjectCheck();

  assert.equal(state.frames.length, 1);
  state.frames.shift()();
  assert.equal(toolbar.left.children.length, 1);
  assert.equal(state.overlayBuilds, 1);
});
