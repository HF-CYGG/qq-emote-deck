const assert = require("node:assert/strict");
const test = require("node:test");

const {
  normalizeSendMode,
  planSendEmote,
  toSendResult,
} = require("../src/send-engine.js");

test("normalizeSendMode preserves known modes and falls back to multi", () => {
  assert.equal(normalizeSendMode("image"), "image");
  assert.equal(normalizeSendMode("native"), "native");
  assert.equal(normalizeSendMode("unknown"), "multi");
});

test("planSendEmote uses native image strategy when image mode has adapter support", () => {
  const plan = planSendEmote({
    mode: "image",
    capabilities: { imageMessage: true, peer: true },
    filePath: "D:\\emotes\\cat.png",
  });

  assert.deepEqual(plan, {
    mode: "image",
    strategy: "qqnt-image",
    fallbackStrategy: "clipboard",
    picSubType: 0,
    asFace: false,
    filePath: "D:\\emotes\\cat.png",
  });
});

test("planSendEmote marks native mode experimental and falls back when market face is unavailable", () => {
  const plan = planSendEmote({
    mode: "native",
    capabilities: { imageMessage: true, peer: true, marketFace: false },
    filePath: "D:\\emotes\\cat.png",
  });

  assert.equal(plan.strategy, "qqnt-image");
  assert.equal(plan.fallbackUsed, true);
  assert.equal(plan.reason, "native_market_face_unavailable");
});

test("planSendEmote uses clipboard when adapter support is missing", () => {
  const plan = planSendEmote({
    mode: "image",
    capabilities: { imageMessage: false, peer: false },
    filePath: "D:\\emotes\\cat.png",
  });

  assert.equal(plan.strategy, "clipboard");
  assert.equal(plan.fallbackUsed, true);
  assert.equal(plan.reason, "qqnt_image_unavailable");
});

test("toSendResult normalizes strategy execution results for UI callers", () => {
  assert.deepEqual(toSendResult({ ok: true, plan: { mode: "image", strategy: "qqnt-image" } }), {
    ok: true,
    modeUsed: "image",
    fallbackUsed: false,
    strategy: "qqnt-image",
    reason: "",
  });
});
