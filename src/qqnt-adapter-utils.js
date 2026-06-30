const path = require("path");

function normalizePeer(candidate) {
  if (!candidate || typeof candidate !== "object") return null;
  const peerLike = candidate.peer && typeof candidate.peer === "object" ? candidate.peer : candidate;
  const header = candidate.header || peerLike.header || {};
  let chatType = Number(peerLike.chatType ?? candidate.chatType ?? peerLike.type ?? candidate.type ?? peerLike.scene ?? candidate.scene);
  let groupCode = peerLike.groupCode || candidate.groupCode || header.groupCode || "";
  let peerUid =
    peerLike.peerUid ||
    candidate.peerUid ||
    peerLike.uid ||
    candidate.uid ||
    peerLike.uinStr ||
    candidate.uinStr ||
    peerLike.uin ||
    candidate.uin ||
    header.uid ||
    groupCode;
  if (!Number.isFinite(chatType) && peerUid) chatType = 1;
  if (groupCode && chatType === 1) chatType = 2;
  if (chatType === 2) {
    if (!groupCode && peerUid) groupCode = peerUid;
    if (groupCode) peerUid = groupCode;
  }
  if (!Number.isFinite(chatType) || !peerUid) return null;
  const peer = {
    chatType,
    peerUid: String(peerUid),
    guildId: String(peerLike.guildId || candidate.guildId || peerLike.channelId || candidate.channelId || ""),
  };
  if (chatType === 2 && groupCode) peer.groupCode = String(groupCode);
  return peer;
}

function fileNameOf(filePath) {
  return path.basename(String(filePath || "").replace(/[\\/]+$/, "")) || "image";
}

function createImageMsgElement({
  sourcePath,
  md5 = "",
  width = 0,
  height = 0,
  fileSize = 0,
  ext = "",
  picSubType = 1,
} = {}) {
  const fileName = fileNameOf(sourcePath);
  const normalizedExt = String(ext || path.extname(fileName).slice(1)).toLowerCase();
  return {
    elementType: 2,
    elementId: "",
    extBufForUI: new Uint8Array(),
    picElement: {
      md5HexStr: md5,
      picWidth: Number(width) || 0,
      picHeight: Number(height) || 0,
      fileName,
      fileSize: Number(fileSize) || 0,
      original: true,
      picType: normalizedExt === "gif" ? 2000 : 1000,
      picSubType: Number.isFinite(picSubType) ? picSubType : 1,
      sourcePath,
      fileUuid: "",
      fileSubId: "",
      thumbFileSize: 0,
      thumbPath: undefined,
      summary: "",
    },
  };
}

function createSendMsgPayload(peer, msgElements) {
  return {
    cmdName: "nodeIKernelMsgService/sendMsg",
    cmdType: "invoke",
    payload: [
      {
        msgId: "0",
        peer,
        msgElements: Array.isArray(msgElements) ? msgElements : [msgElements].filter(Boolean),
        msgAttributeInfos: new Map(),
      },
      null,
    ],
  };
}

function probeRuntimeCapabilities(runtime = {}) {
  const nativeCall = typeof runtime?.liteTools?.nativeCall === "function" || typeof runtime?.nativeCall === "function";
  const peer = !!normalizePeer(runtime.peer);
  return {
    nativeCall,
    peer,
    imageMessage: nativeCall && peer,
    marketFace: false,
  };
}

module.exports = {
  createImageMsgElement,
  createSendMsgPayload,
  normalizePeer,
  probeRuntimeCapabilities,
};
