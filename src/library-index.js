const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".apng", ".bmp"]);

function normalizeFsPath(filePath) {
  return String(filePath || "").replace(/\\/g, "/");
}

function hashValue(value) {
  return crypto.createHash("md5").update(String(value || "")).digest("hex");
}

function isPathInside(rootDir, targetPath) {
  const root = path.resolve(rootDir);
  const target = path.resolve(targetPath);
  const rel = path.relative(root, target);
  return rel === "" || (!!rel && !rel.startsWith("..") && !path.isAbsolute(rel));
}

function resolveInsideRoot(rootDir, targetPath) {
  if (!rootDir || !targetPath || !isPathInside(rootDir, targetPath)) {
    throw new Error("outside library root");
  }
  return path.resolve(targetPath);
}

function toLocalUrl(absPath) {
  try {
    const abs = normalizeFsPath(absPath);
    if (!abs) return "local:///";
    const encoded = abs
      .split("/")
      .map((item) => encodeURIComponent(encodeURIComponent(item)))
      .join("/");
    return "local:///" + encoded;
  } catch (_) {
    return "local:///";
  }
}

function isImageName(name) {
  return IMAGE_EXTS.has(path.extname(String(name || "")).toLowerCase());
}

function isValidImageMagic(buf, ext) {
  if (!buf || buf.length < 2) return false;
  const normalizedExt = String(ext || "").toLowerCase();
  if ((normalizedExt === ".png" || normalizedExt === ".apng") && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  if ((normalizedExt === ".jpg" || normalizedExt === ".jpeg") && buf[0] === 0xff && buf[1] === 0xd8) return true;
  if (normalizedExt === ".gif" && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true;
  if (normalizedExt === ".bmp" && buf[0] === 0x42 && buf[1] === 0x4d) return true;
  if (
    normalizedExt === ".webp" &&
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) return true;
  return false;
}

async function readHeaderBytes(filePath, len = 32) {
  const fh = await fsp.open(filePath, "r");
  try {
    const buf = Buffer.alloc(len);
    const { bytesRead } = await fh.read(buf, 0, len, 0);
    return buf.slice(0, bytesRead);
  } finally {
    await fh.close();
  }
}

async function isValidImageFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!IMAGE_EXTS.has(ext)) return false;
  const header = await readHeaderBytes(filePath).catch(() => null);
  return isValidImageMagic(header, ext);
}

async function readStickerMeta(dir) {
  const file = path.join(dir, "sticker.json");
  try {
    const raw = await fsp.readFile(file, "utf8");
    const meta = JSON.parse(raw);
    return meta && typeof meta === "object" ? meta : {};
  } catch (_) {
    return {};
  }
}

function createImageEntry(rootDir, filePath, stat, index) {
  const abs = path.resolve(filePath);
  const name = path.basename(abs);
  const ext = path.extname(name).toLowerCase();
  return {
    id: hashValue(abs),
    name,
    baseName: path.basename(name, ext),
    ext,
    path: abs,
    absPath: abs,
    normalizedPath: normalizeFsPath(abs),
    relativePath: normalizeFsPath(path.relative(rootDir, abs)),
    url: toLocalUrl(abs),
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    birthtimeMs: stat.birthtimeMs,
    index,
  };
}

function chooseIconPath(dir, images, meta) {
  if (meta && typeof meta.icon === "string" && meta.icon.trim()) {
    const iconPath = path.resolve(dir, meta.icon);
    if (isPathInside(dir, iconPath) && fs.existsSync(iconPath) && isImageName(iconPath)) return iconPath;
  }
  const namedIcon = images.find((item) => path.basename(item.name, item.ext).toLowerCase() === "icon");
  return (namedIcon || images[0] || {}).path || "";
}

async function scanDir(rootDir, dir, packs, images) {
  const entries = await fsp.readdir(dir, { withFileTypes: true }).catch(() => []);
  const localImages = [];
  const dirs = [];

  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      dirs.push(abs);
      continue;
    }
    if (!entry.isFile() || !isImageName(entry.name)) continue;
    if (!(await isValidImageFile(abs))) continue;
    const stat = await fsp.stat(abs).catch(() => null);
    if (!stat || !stat.isFile()) continue;
    localImages.push(createImageEntry(rootDir, abs, stat, localImages.length));
  }

  localImages.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
  localImages.forEach((item, index) => { item.index = index; });
  images.push(...localImages);

  if (localImages.length > 0) {
    const relativeDir = normalizeFsPath(path.relative(rootDir, dir)) || ".";
    const meta = await readStickerMeta(dir);
    const iconPath = chooseIconPath(dir, localImages, meta);
    const displayName = relativeDir === "."
      ? "本地表情"
      : (typeof meta.title === "string" && meta.title.trim() ? meta.title.trim() : path.basename(dir));
    packs.push({
      id: hashValue(dir),
      name: displayName,
      dir: path.resolve(dir),
      path: path.resolve(dir),
      relativeDir,
      iconPath,
      iconUrl: iconPath ? toLocalUrl(iconPath) : "",
      coverPath: iconPath || localImages[0].path,
      coverUrl: toLocalUrl(iconPath || localImages[0].path),
      meta,
      images: localImages,
      count: localImages.length,
    });
  }

  dirs.sort((a, b) => path.basename(a).localeCompare(path.basename(b), "zh-Hans-CN"));
  for (const child of dirs) {
    await scanDir(rootDir, child, packs, images);
  }
}

async function buildLibraryIndex(rootDir) {
  const root = path.resolve(rootDir || "");
  const stat = rootDir ? await fsp.stat(root).catch(() => null) : null;
  if (!stat || !stat.isDirectory()) {
    return { rootDir: root, exists: false, hash: hashValue("missing:" + root), packs: [], images: [], tree: [] };
  }

  const packs = [];
  const images = [];
  await scanDir(root, root, packs, images);
  packs.sort((a, b) => {
    if (a.relativeDir === ".") return -1;
    if (b.relativeDir === ".") return 1;
    return a.relativeDir.localeCompare(b.relativeDir, "zh-Hans-CN");
  });
  const hash = hashValue(JSON.stringify(packs.map((pack) => ({
    dir: pack.relativeDir,
    count: pack.count,
    icon: pack.iconPath,
    images: pack.images.map((item) => [item.relativePath, item.size, item.mtimeMs]),
  }))));
  return { rootDir: root, exists: true, hash, packs, images, tree: buildFolderTree(packs) };
}

function buildFolderTree(packs) {
  const roots = [];
  const byPath = new Map();

  function ensureNode(parts, absDir) {
    let currentList = roots;
    let currentPath = "";
    let node = null;
    for (const part of parts) {
      currentPath = currentPath ? currentPath + "/" + part : part;
      node = byPath.get(currentPath);
      if (!node) {
        node = { name: part, path: absDir, dir: absDir, relativeDir: currentPath, children: [], virtual: true };
        byPath.set(currentPath, node);
        currentList.push(node);
      }
      currentList = node.children;
    }
    return node;
  }

  for (const pack of packs || []) {
    if (!pack || !pack.relativeDir || pack.relativeDir === ".") continue;
    const parts = pack.relativeDir.split("/").filter(Boolean);
    const node = ensureNode(parts, pack.dir);
    Object.assign(node, {
      name: pack.name || node.name,
      path: pack.dir,
      dir: pack.dir,
      iconPath: pack.iconPath,
      coverPath: pack.coverPath,
      count: pack.count,
      virtual: false,
    });
  }

  function sortNodes(nodes) {
    nodes.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
    nodes.forEach((node) => sortNodes(node.children));
    return nodes;
  }
  return sortNodes(roots);
}

function cleanConfigRefs(config, index) {
  const imageSet = new Set((index?.images || []).map((item) => normalizeFsPath(item.path || item.absPath)));
  const packDirSet = new Set((index?.packs || []).map((pack) => path.resolve(pack.dir)));
  const cleanPathArray = (value) => {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    const out = [];
    for (const item of value) {
      if (typeof item !== "string") continue;
      const normalized = normalizeFsPath(path.resolve(item));
      if (!imageSet.has(normalized) || seen.has(normalized)) continue;
      seen.add(normalized);
      out.push(normalized);
    }
    return out;
  };
  const result = {
    ...config,
    recent: cleanPathArray(config?.recent),
    pinned: cleanPathArray(config?.pinned),
  };
  if (typeof result.lastCategory === "string" && result.lastCategory.startsWith("__dir__|")) {
    const dir = path.resolve(result.lastCategory.slice("__dir__|".length));
    if (!packDirSet.has(dir)) result.lastCategory = "";
  }
  return result;
}

module.exports = {
  IMAGE_EXTS,
  buildFolderTree,
  buildLibraryIndex,
  cleanConfigRefs,
  isImageName,
  isPathInside,
  isValidImageMagic,
  normalizeFsPath,
  resolveInsideRoot,
  toLocalUrl,
};
