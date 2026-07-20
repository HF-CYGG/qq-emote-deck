const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const renderer = fs.readFileSync(path.join(__dirname, "..", "src", "renderer.js"), "utf8");

function createActivationHarness({ mode, peer = null, directError = null, editor = null } = {}) {
  const start = renderer.indexOf("async function handleEmoteActivation");
  const end = renderer.indexOf("// 新增：渲染“历史表情”", start);
  assert.ok(start >= 0 && end > start, "shared activation handler source should be extractable");
  const handlerSource = renderer.slice(start, end);
  const calls = { direct: 0, clipboard: 0, toasts: [] };
  const context = {
    calls,
    window: {
      localEmote: {
        getConfig() { return { sendMode: mode }; },
        async sendEmote() { calls.clipboard += 1; return { ok: true }; },
        markRecent() {},
      },
    },
    qqntAdapter: {
      async getCurrentPeer() { return peer; },
      async sendImageMessage() {
        calls.direct += 1;
        if (directError) throw directError;
        return { ok: true };
      },
    },
    getEditorEl() { return editor; },
    tryInsertImageToEditor() { return false; },
    ensureSelectionAtEditorEnd() {},
    ensureLESendMsgDebugHookInstalled() {},
    async animateEmoteFlight() {},
    leShowToast(message) { calls.toasts.push(message); },
    dbg() {},
    overlayInstance: null,
  };
  vm.runInNewContext(`${handlerSource}\nglobalThis.__handler = handleEmoteActivation;`, context);
  return { calls, handler: context.__handler };
}

test("IPC peer updates are observations and cannot replace the current send target", () => {
  const subscription = renderer.match(
    /window\.localEmote\.onUpdatePeer\(\(peer\)\s*=>\s*\{([\s\S]*?)\n\s*\}\);/
  );

  assert.ok(subscription, "peer observation subscription should exist");
  assert.match(subscription[1], /window\.__le_observedPeer\s*=\s*peer/);
  assert.doesNotMatch(subscription[1], /window\.__le_lastPeer\s*=\s*peer/);
});

test("live peer derivation excludes stale message and unscoped peer caches", () => {
  const derivePeerBody = renderer.match(
    /function\s+derivePeer\(\)\s*\{([\s\S]*?)\n\}\ntry\s*\{\s*window\.derivePeer\s*=\s*derivePeer;/
  );

  assert.ok(derivePeerBody, "derivePeer implementation should be present");
  assert.doesNotMatch(derivePeerBody[1], /__le_lastPeer/);
  assert.doesNotMatch(derivePeerBody[1], /__le_lastSendMsg/);
  assert.doesNotMatch(derivePeerBody[1], /scanRoots|scanAny|bfsFindPeer\(window\)/);
});

test("recent and normal cards share one fail-closed activation handler", () => {
  assert.match(renderer, /async\s+function\s+handleEmoteActivation\s*\(/);
  assert.equal(
    (renderer.match(/handleEmoteActivation\(\{\s*item:/g) || []).length,
    2,
    "recent and normal grids should call the same activation handler"
  );

  const handler = renderer.match(
    /async\s+function\s+handleEmoteActivation\s*\([^)]*\)\s*\{([\s\S]*?)\r?\n\s*\}\r?\n\r?\n\s*\/\/[^\r\n]*\r?\n\s*async\s+function\s+renderRecentGrid/
  );
  assert.ok(handler, "shared activation handler should be defined before recent rendering");
  assert.match(handler[1], /if\s*\(!peer\)\s*\{[\s\S]*?return\s+false;/);
  assert.match(handler[1], /sendImageMessage\(peer,/);
  assert.match(handler[1], /if\s*\(!editor\)\s*\{[\s\S]*?return\s+false;/);
  assert.doesNotMatch(handler[1], /pressEnterToSend|findSendButton/);
});

test("native and image direct modes do not send or touch the clipboard without a live peer", async () => {
  for (const mode of ["native", "image"]) {
    const { calls, handler } = createActivationHarness({ mode, peer: null });
    assert.equal(await handler({ item: { path: "D:\\emotes\\cat.png" }, imageEl: null, event: {} }), false);
    assert.equal(calls.direct, 0, `${mode} must not call sendImageMessage without a live peer`);
    assert.equal(calls.clipboard, 0, `${mode} must not fall back to clipboard insertion`);
  }
});

test("a failed direct send remains fail-closed and does not fall back to clipboard insertion", async () => {
  const { calls, handler } = createActivationHarness({
    mode: "image",
    peer: { chatType: 2, peerUid: "10002" },
    directError: new Error("send failed"),
  });

  assert.equal(await handler({ item: { path: "D:\\emotes\\cat.png" }, imageEl: null, event: {} }), false);
  assert.equal(calls.direct, 1);
  assert.equal(calls.clipboard, 0);
});

test("multi mode does not invoke clipboard insertion when the current editor is missing", async () => {
  const { calls, handler } = createActivationHarness({ mode: "multi", editor: null });

  assert.equal(await handler({ item: { path: "D:\\emotes\\cat.png" }, imageEl: null, event: {} }), false);
  assert.equal(calls.direct, 0);
  assert.equal(calls.clipboard, 0);
});

test("toolbar reconciliation is DOM-driven and mutation checks are frame-coalesced", () => {
  assert.doesNotMatch(renderer, /let\s+injected\s*=/);
  assert.doesNotMatch(renderer, /if\s*\(injected\)/);
  assert.match(renderer, /function\s+findActiveChatFuncBar\s*\(/);
  assert.match(renderer, /\.chat-input-area\s+\.chat-func-bar/);
  assert.match(renderer, /overlayInstance\?\.el\?\.isConnected/);
  assert.match(renderer, /function\s+scheduleInjectCheck\s*\(/);
  assert.match(renderer, /requestAnimationFrame\(run\)/);
  assert.match(renderer, /new\s+MutationObserver\(scheduleInjectCheck\)/);
  assert.match(renderer, /setInterval\(scheduleInjectCheck,\s*OBSERVER_INTERVAL\)/);
});
