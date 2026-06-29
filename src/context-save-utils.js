const path = require("path");

const MAX_CONTEXT_IMAGE_BYTES = 20 * 1024 * 1024;
const ALLOWED_CONTEXT_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".apng", ".bmp"]);

function stripQueryAndHash(value) {
  let out = String(value || "");
  const qIdx = out.indexOf("?");
  if (qIdx >= 0) out = out.slice(0, qIdx);
  const hIdx = out.indexOf("#");
  if (hIdx >= 0) out = out.slice(0, hIdx);
  return out;
}

function decodeMaybeTwice(value, twice = false) {
  let out = String(value || "");
  try { out = decodeURIComponent(out); } catch (_) {}
  if (twice) {
    try { out = decodeURIComponent(out); } catch (_) {}
  }
  return out;
}

function decodeSlashPath(raw, twice) {
  return String(raw || "")
    .split("/")
    .filter((part) => part.length > 0)
    .map((part) => decodeMaybeTwice(part, twice))
    .join("/")
    .replace(/\//g, "\\");
}

function normalizeAppimgPath(raw) {
  let out = decodeMaybeTwice(raw, true);
  const driveIdx = out.search(/[A-Za-z]:[\\/]/);
  if (driveIdx >= 0) out = out.slice(driveIdx);
  out = out.replace(/^\/+/, "");
  return out.replace(/\//g, "\\");
}

function fileNameOf(value) {
  try {
    const clean = stripQueryAndHash(String(value || "")).replace(/[\\/]+$/, "");
    const parts = clean.split(/[\\/]/);
    return parts[parts.length - 1] || "";
  } catch (_) {
    return "";
  }
}

function normalizeContextImageSource(input) {
  const src = typeof input === "string" ? input.trim() : String(input?.src || input?.source || "").trim();
  if (!src) return { kind: "unsupported", source: "", fileName: "", mime: "", reason: "unsupported_source" };
  if (src.startsWith("qqface:")) return { kind: "unsupported", source: src, fileName: "", mime: "", reason: "unsupported_source" };
  if (/^data:/i.test(src)) {
    const match = src.match(/^data:([^;,]+)?(?:;[^,]*)?,/i);
    const mime = (match && match[1] ? match[1] : "").toLowerCase();
    return { kind: "data", source: src, fileName: "context-image", mime, reason: "" };
  }
  if (/^(blob:|https?:)/i.test(src)) {
    return { kind: "remote", source: src, fileName: fileNameOf(src) || "context-image", mime: "", reason: "" };
  }

  const clean = stripQueryAndHash(src);
  if (clean.startsWith("local:///")) {
    const source = decodeSlashPath(clean.slice("local:///".length), true);
    return { kind: "file", source, fileName: fileNameOf(source), mime: "", reason: "" };
  }
  if (clean.startsWith("file:///")) {
    const source = decodeSlashPath(clean.slice("file:///".length), false);
    return { kind: "file", source, fileName: fileNameOf(source), mime: "", reason: "" };
  }
  if (clean.startsWith("appimg:///")) {
    const source = normalizeAppimgPath(clean.slice("appimg:///".length));
    return { kind: "file", source, fileName: fileNameOf(source), mime: "", reason: "" };
  }
  if (clean.startsWith("appimg://")) {
    const source = normalizeAppimgPath(clean.slice("appimg://".length));
    return { kind: "file", source, fileName: fileNameOf(source), mime: "", reason: "" };
  }
  if (/^[A-Za-z]:[\\/]/.test(clean) || /^\\\\/.test(clean) || path.isAbsolute(clean)) {
    return { kind: "file", source: clean, fileName: fileNameOf(clean), mime: "", reason: "" };
  }
  return { kind: "unsupported", source: src, fileName: fileNameOf(src), mime: "", reason: "unsupported_source" };
}

function targetNode(name, dir, relativeDir, children = [], virtual = false) {
  return {
    name,
    dir,
    path: "__dir__|" + dir,
    relativeDir,
    children,
    virtual,
  };
}

function buildContextSaveTargets(index) {
  const rootDir = index?.rootDir ? path.resolve(index.rootDir) : "";
  if (!rootDir || index?.exists === false) return [];
  const roots = [targetNode("保存到根目录", rootDir, ".", [], false)];
  const byRelative = new Map();

  function ensureNode(parts) {
    let list = roots;
    let current = "";
    let node = null;
    for (const part of parts) {
      current = current ? current + "/" + part : part;
      node = byRelative.get(current);
      if (!node) {
        const dir = path.join(rootDir, ...current.split("/"));
        node = targetNode(part, dir, current, [], true);
        byRelative.set(current, node);
        list.push(node);
      }
      list = node.children;
    }
    return node;
  }

  for (const pack of index?.packs || []) {
    if (!pack || !pack.relativeDir || pack.relativeDir === ".") continue;
    const parts = String(pack.relativeDir).split("/").filter(Boolean);
    if (!parts.length) continue;
    const node = ensureNode(parts);
    node.name = pack.name || node.name;
    node.dir = pack.dir || node.dir;
    node.path = "__dir__|" + node.dir;
    node.relativeDir = pack.relativeDir;
    node.virtual = false;
  }

  function sortChildren(nodes) {
    const first = nodes[0] && nodes[0].relativeDir === "." ? [nodes[0]] : [];
    const rest = nodes.slice(first.length).sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
    for (const node of rest) sortChildren(node.children);
    nodes.splice(0, nodes.length, ...first, ...rest);
    return nodes;
  }
  return sortChildren(roots);
}

function hasImageMagic(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  if (buf.length < 4) return false;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  if (buf[0] === 0xff && buf[1] === 0xd8) return true;
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true;
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf.length >= 12 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return true;
  if (buf[0] === 0x42 && buf[1] === 0x4d) return true;
  return false;
}

function inferImageExt(buffer, mime = "", fallbackName = "") {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return ".png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return ".jpg";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return ".gif";
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf.length >= 12 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return ".webp";
  if (buf[0] === 0x42 && buf[1] === 0x4d) return ".bmp";

  const mimeExt = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/bmp": ".bmp",
    "image/x-ms-bmp": ".bmp",
    "image/apng": ".apng",
  }[String(mime || "").toLowerCase()];
  if (mimeExt) return mimeExt;

  const ext = path.extname(String(fallbackName || "")).toLowerCase();
  return ALLOWED_CONTEXT_EXTS.has(ext) ? ext : "";
}

function sanitizeContextFileName(name, ext) {
  const cleanExt = ALLOWED_CONTEXT_EXTS.has(String(ext || "").toLowerCase()) ? String(ext).toLowerCase() : ".png";
  let base = path.basename(String(name || ""), path.extname(String(name || "")));
  base = base
    .replace(/[<>:"/\\|?*]/g, "_")
    .split("")
    .map((char) => (char.charCodeAt(0) < 32 ? "_" : char))
    .join("")
    .replace(/[. ]+$/g, "")
    .trim();
  if (!base) base = "context-image";
  return base.slice(0, 80) + cleanExt;
}

function createUniqueImagePath(targetDir, fileName, existsFn) {
  const ext = path.extname(String(fileName || "")).toLowerCase();
  const safe = sanitizeContextFileName(fileName, ext);
  const safeExt = path.extname(safe);
  const base = path.basename(safe, safeExt);
  const exists = typeof existsFn === "function" ? existsFn : () => false;
  let name = safe;
  let target = path.join(targetDir, name);
  let i = 1;
  while (exists(target)) {
    name = `${base}_${i}${safeExt}`;
    target = path.join(targetDir, name);
    i++;
  }
  return { name, path: target };
}

function prepareContextImageBuffer({ bytes, fileName = "", mime = "" } = {}) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || []);
  if (buffer.length <= 0 || buffer.length > MAX_CONTEXT_IMAGE_BYTES) {
    return { ok: false, reason: "bad_size" };
  }
  const ext = inferImageExt(buffer, mime, fileName);
  if (!ext || !ALLOWED_CONTEXT_EXTS.has(ext)) {
    return { ok: false, reason: "bad_ext" };
  }
  if (!hasImageMagic(buffer)) {
    return { ok: false, reason: "bad_magic" };
  }
  return {
    ok: true,
    buffer,
    fileName: sanitizeContextFileName(fileName || "context-image", ext),
    ext,
  };
}

function resolveContextTargetDir(rootDir, targetDir) {
  if (!rootDir) throw new Error("root_dir_missing");
  const root = path.resolve(rootDir);
  const raw = String(targetDir || "");
  const clean = raw.startsWith("__dir__|") ? raw.slice("__dir__|".length) : raw;
  const target = path.resolve(clean || root);
  const rel = path.relative(root, target);
  if (rel && (rel.startsWith("..") || path.isAbsolute(rel))) throw new Error("target_outside_root");
  return target;
}

module.exports = {
  ALLOWED_CONTEXT_EXTS,
  MAX_CONTEXT_IMAGE_BYTES,
  buildContextSaveTargets,
  createUniqueImagePath,
  hasImageMagic,
  inferImageExt,
  normalizeContextImageSource,
  prepareContextImageBuffer,
  resolveContextTargetDir,
  sanitizeContextFileName,
};
