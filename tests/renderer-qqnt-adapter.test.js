const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const adapterSource = fs.readFileSync(
  path.join(__dirname, "..", "src", "renderer-qqnt-adapter.js"),
  "utf8"
);

async function loadAdapter(windowValue) {
  globalThis.window = windowValue;
  const encoded = Buffer.from(adapterSource, "utf8").toString("base64");
  return import(`data:text/javascript;base64,${encoded}#${Math.random()}`);
}

test.afterEach(() => {
  delete globalThis.window;
});

test("getCurrentPeer prefers a freshly resolved group over the diagnostic snapshot", async () => {
  const groupA = { chatType: 2, peerUid: "10001", groupCode: "10001" };
  const groupB = { chatType: 2, peerUid: "10002", groupCode: "10002" };
  const runtime = {
    __le_lastPeer: groupA,
    async derivePeerAsync() {
      return groupB;
    },
  };
  const adapter = await loadAdapter(runtime);

  const peer = await adapter.getCurrentPeer();

  assert.deepEqual(peer, groupB);
  assert.deepEqual(runtime.__le_lastPeer, groupB, "fresh peer should refresh the diagnostic snapshot");
});

test("getCurrentPeer returns null when only a stale diagnostic snapshot exists", async () => {
  const groupA = { chatType: 2, peerUid: "10001", groupCode: "10001" };
  const adapter = await loadAdapter({
    __le_lastPeer: groupA,
    async derivePeerAsync() {
      return null;
    },
    derivePeer() {
      return null;
    },
  });

  assert.equal(await adapter.getCurrentPeer(), null);
});

test("getCurrentPeer continues to the synchronous live resolver when the async resolver fails", async () => {
  const livePeer = { chatType: 1, peerUid: "u_live" };
  const adapter = await loadAdapter({
    async derivePeerAsync() {
      throw new Error("bridge unavailable");
    },
    derivePeer() {
      return livePeer;
    },
  });

  assert.deepEqual(await adapter.getCurrentPeer(), livePeer);
});
