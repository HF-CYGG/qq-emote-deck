const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  buildFolderTree,
  buildLibraryIndex,
  cleanConfigRefs,
  resolveInsideRoot,
} = require("../src/library-index.js");

function makeTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "emote-deck-"));
}

function writeImage(filePath, bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47])) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, bytes);
}

test("buildLibraryIndex scans root and nested packs with sticker metadata", async () => {
  const root = makeTempRoot();
  writeImage(path.join(root, "root.png"));
  writeImage(path.join(root, "cats", "cat.gif"), Buffer.from([0x47, 0x49, 0x46, 0x38]));
  writeImage(path.join(root, "cats", "icon.webp"), Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]));
  fs.writeFileSync(path.join(root, "cats", "notes.txt"), "ignore");
  fs.writeFileSync(path.join(root, "cats", "sticker.json"), JSON.stringify({ title: "猫猫", icon: "icon.webp" }));
  writeImage(path.join(root, "cats", "sleepy", "nap.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xdb]));

  const index = await buildLibraryIndex(root);

  assert.equal(index.exists, true);
  assert.equal(index.rootDir, path.resolve(root));
  assert.deepEqual(index.packs.map((pack) => pack.name), ["本地表情", "猫猫", "sleepy"]);
  assert.equal(index.packs[1].iconPath, path.join(root, "cats", "icon.webp"));
  assert.equal(index.packs[1].images.map((item) => item.name).includes("notes.txt"), false);
  assert.equal(index.images.length, 4);
  assert.match(index.hash, /^[a-f0-9]{32}$/);
});

test("buildLibraryIndex returns an empty missing-root state", async () => {
  const root = path.join(makeTempRoot(), "missing");

  const index = await buildLibraryIndex(root);

  assert.equal(index.exists, false);
  assert.equal(index.packs.length, 0);
  assert.equal(index.images.length, 0);
});

test("resolveInsideRoot rejects traversal outside the library root", () => {
  const root = makeTempRoot();

  assert.equal(resolveInsideRoot(root, path.join(root, "pack", "a.png")), path.join(root, "pack", "a.png"));
  assert.throws(() => resolveInsideRoot(root, path.join(root, "..", "outside.png")), /outside library root/);
});

test("cleanConfigRefs drops missing recent and pinned paths", async () => {
  const root = makeTempRoot();
  const kept = path.join(root, "cats", "cat.png");
  const missing = path.join(root, "dogs", "dog.png");
  writeImage(kept);
  const index = await buildLibraryIndex(root);

  const cleaned = cleanConfigRefs(
    {
      recent: [kept, missing],
      pinned: [missing, kept],
      lastCategory: "__dir__|" + path.join(root, "cats"),
    },
    index
  );

  assert.deepEqual(cleaned.recent, [kept.replace(/\\/g, "/")]);
  assert.deepEqual(cleaned.pinned, [kept.replace(/\\/g, "/")]);
  assert.equal(cleaned.lastCategory, "__dir__|" + path.join(root, "cats"));
});

test("cleanConfigRefs drops missing drag sort pack and image references", async () => {
  const root = makeTempRoot();
  const keptDir = path.join(root, "cats");
  const missingDir = path.join(root, "dogs");
  const keptImage = path.join(keptDir, "cat.png");
  const missingImage = path.join(keptDir, "missing.png");
  writeImage(keptImage);
  const index = await buildLibraryIndex(root);

  const cleaned = cleanConfigRefs(
    {
      packOrder: [missingDir, keptDir, keptDir],
      imageOrder: {
        [keptDir]: [missingImage, keptImage, keptImage],
        [missingDir]: [keptImage],
      },
    },
    index
  );

  const keptDirNorm = path.resolve(keptDir).replace(/\\/g, "/");
  const keptImageNorm = path.resolve(keptImage).replace(/\\/g, "/");
  assert.deepEqual(cleaned.packOrder, [keptDirNorm]);
  assert.deepEqual(cleaned.imageOrder, {
    [keptDirNorm]: [keptImageNorm],
  });
});

test("buildFolderTree creates a reusable menu tree from indexed packs", async () => {
  const root = makeTempRoot();
  writeImage(path.join(root, "animals", "cats", "cat.png"));
  writeImage(path.join(root, "animals", "dogs", "dog.png"));
  const index = await buildLibraryIndex(root);

  const tree = buildFolderTree(index.packs);

  assert.equal(tree.length, 1);
  assert.equal(tree[0].name, "animals");
  assert.deepEqual(tree[0].children.map((item) => item.name).sort(), ["cats", "dogs"]);
});
