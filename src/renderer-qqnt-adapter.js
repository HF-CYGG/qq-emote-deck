export async function getCurrentPeer() {
  const rememberFreshPeer = (peer) => {
    if (!peer || !peer.peerUid || !peer.chatType) return null;
    try { window.__le_lastPeer = peer; } catch (_) {}
    return peer;
  };

  try {
    if (typeof window.derivePeerAsync === "function") {
      const peer = await window.derivePeerAsync();
      const freshPeer = rememberFreshPeer(peer);
      if (freshPeer) return freshPeer;
    }
  } catch (_) {}

  try {
    if (typeof window.derivePeer === "function") {
      const peer = await window.derivePeer();
      const freshPeer = rememberFreshPeer(peer);
      if (freshPeer) return freshPeer;
    }
  } catch (_) {}
  return null;
}

export async function sendImageMessage(peer, filePath, options = {}) {
  if (!peer || !filePath) throw new Error("sendImageMessage: peer/filePath missing");
  if (typeof window.le_sendMessage !== "function") throw new Error("sendImageMessage: le_sendMessage missing");
  const picSubType = Number.isFinite(options.picSubType) ? options.picSubType : 0;
  const asFace = !!options.asFace;
  return window.le_sendMessage(peer, [{ type: "image", path: filePath, picSubType, asFace }]);
}

export function insertImageToEditor(filePath) {
  try {
    if (typeof window.__localEmoteInsertImage === "function") {
      return !!window.__localEmoteInsertImage(filePath);
    }
  } catch (_) {}
  return false;
}

export function probeRuntimeCapabilities() {
  const liteTools = (globalThis && globalThis.lite_tools) || window.lite_tools || null;
  const nativeCall = !!(liteTools && typeof liteTools.nativeCall === "function");
  const peer = !!(window.__le_lastPeer && window.__le_lastPeer.peerUid);
  return {
    nativeCall,
    peer,
    imageMessage: nativeCall && peer,
    marketFace: false,
    adapter: true,
  };
}
