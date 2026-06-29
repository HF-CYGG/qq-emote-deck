const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createImageMsgElement,
  createSendMsgPayload,
  normalizePeer,
  probeRuntimeCapabilities,
} = require("../src/qqnt-adapter-utils.js");

test("normalizePeer converts group candidates to QQNT peer shape", () => {
  const peer = normalizePeer({ chatType: 1, header: { groupCode: "123456", uid: "u_1" } });

  assert.deepEqual(peer, {
    chatType: 2,
    peerUid: "123456",
    guildId: "",
    groupCode: "123456",
  });
});

test("createImageMsgElement builds a sendMsg-compatible image element", () => {
  const element = createImageMsgElement({
    sourcePath: "D:\\emotes\\cat.gif",
    md5: "abc",
    width: 120,
    height: 96,
    fileSize: 12345,
    ext: "gif",
    picSubType: 0,
  });

  assert.equal(element.elementType, 2);
  assert.equal(element.picElement.picType, 2000);
  assert.equal(element.picElement.picSubType, 0);
  assert.equal(element.picElement.fileName, "cat.gif");
  assert.equal(element.picElement.sourcePath, "D:\\emotes\\cat.gif");
});

test("createSendMsgPayload wraps peer and msg elements for nodeIKernelMsgService/sendMsg", () => {
  const peer = { chatType: 1, peerUid: "u_1", guildId: "" };
  const element = createImageMsgElement({ sourcePath: "D:\\emotes\\cat.png" });
  const request = createSendMsgPayload(peer, [element]);

  assert.equal(request.cmdName, "nodeIKernelMsgService/sendMsg");
  assert.equal(request.cmdType, "invoke");
  assert.equal(request.payload[0].peer, peer);
  assert.deepEqual(request.payload[0].msgElements, [element]);
});

test("probeRuntimeCapabilities reports adapter capabilities without touching QQNT globals", () => {
  assert.deepEqual(probeRuntimeCapabilities({ liteTools: { nativeCall() {} }, peer: { peerUid: "u_1" } }), {
    nativeCall: true,
    peer: true,
    imageMessage: true,
    marketFace: false,
  });
});
