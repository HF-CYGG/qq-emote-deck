const SEND_MODES = new Set(["multi", "image", "native"]);

function normalizeSendMode(mode) {
  const value = String(mode || "").toLowerCase();
  return SEND_MODES.has(value) ? value : "multi";
}

function planSendEmote({ mode, capabilities = {}, filePath = "" } = {}) {
  const normalizedMode = normalizeSendMode(mode);
  const canImage = !!(capabilities.imageMessage && capabilities.peer);

  if (normalizedMode === "multi") {
    return {
      mode: "multi",
      strategy: "editor-insert",
      fallbackStrategy: "clipboard",
      picSubType: 1,
      asFace: true,
      filePath,
    };
  }

  if (normalizedMode === "native" && !capabilities.marketFace) {
    if (canImage) {
      return {
        mode: "native",
        strategy: "qqnt-image",
        fallbackStrategy: "clipboard",
        picSubType: 1,
        asFace: true,
        filePath,
        fallbackUsed: true,
        reason: "native_market_face_unavailable",
      };
    }
    return {
      mode: "native",
      strategy: "clipboard",
      picSubType: 1,
      asFace: true,
      filePath,
      fallbackUsed: true,
      reason: "native_market_face_unavailable",
    };
  }

  if (normalizedMode === "image") {
    if (canImage) {
      return {
        mode: "image",
        strategy: "qqnt-image",
        fallbackStrategy: "clipboard",
        picSubType: 0,
        asFace: false,
        filePath,
      };
    }
    return {
      mode: "image",
      strategy: "clipboard",
      picSubType: 0,
      asFace: false,
      filePath,
      fallbackUsed: true,
      reason: "qqnt_image_unavailable",
    };
  }

  return {
    mode: normalizedMode,
    strategy: "clipboard",
    filePath,
    fallbackUsed: true,
    reason: "unsupported_send_mode",
  };
}

function toSendResult({ ok, plan, reason = "" } = {}) {
  return {
    ok: !!ok,
    modeUsed: plan?.mode || "multi",
    fallbackUsed: !!plan?.fallbackUsed,
    strategy: plan?.strategy || "",
    reason: reason || plan?.reason || "",
  };
}

module.exports = {
  normalizeSendMode,
  planSendEmote,
  toSendResult,
};
