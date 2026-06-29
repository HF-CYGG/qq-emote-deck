const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const {
  buildContextSaveTargets,
  createUniqueImagePath,
  inferImageExt,
  normalizeContextImageSource,
  prepareContextImageBuffer,
  resolveContextTargetDir,
  sanitizeContextFileName,
} = require("../src/context-save-utils.js");

test("buildContextSaveTargets includes root and single pack targets", () => {
  const root = path.resolve("C:/emotes");
  const targets = buildContextSaveTargets({
    rootDir: root,
    exists: true,
    packs: [
      {
        name: "cats",
        dir: path.join(root, "cats"),
        relativeDir: "cats",
        children: [],
      },
    ],
  });

  assert.equal(targets.length, 2);
  assert.deepEqual(targets.map((item) => item.name), ["保存到根目录", "cats"]);
  assert.equal(targets[0].dir, root);
  assert.equal(targets[0].path, "__dir__|" + root);
  assert.equal(targets[1].dir, path.join(root, "cats"));
  assert.equal(targets[1].path, "__dir__|" + path.join(root, "cats"));
});

test("buildContextSaveTargets creates stable nested tree without absolute common-prefix trimming", () => {
  const root = path.resolve("D:/qq/emotes");
  const targets = buildContextSaveTargets({
    rootDir: root,
    exists: true,
    packs: [
      { name: "cats", dir: path.join(root, "animals", "cats"), relativeDir: "animals/cats" },
      { name: "dogs", dir: path.join(root, "animals", "dogs"), relativeDir: "animals/dogs" },
    ],
  });

  assert.equal(targets[0].name, "保存到根目录");
  assert.equal(targets[1].name, "animals");
  assert.equal(targets[1].virtual, true);
  assert.deepEqual(targets[1].children.map((item) => item.name), ["cats", "dogs"]);
  assert.equal(targets[1].children[0].path, "__dir__|" + path.join(root, "animals", "cats"));
});

test("normalizeContextImageSource classifies local urls, data urls, remote urls, and unsupported urls", () => {
  const local = normalizeContextImageSource("local:///C%253A/Users/me/a.png");
  assert.equal(local.kind, "file");
  assert.match(local.source, /C:/);
  assert.match(local.source, /a\.png$/);

  const file = normalizeContextImageSource("file:///C:/Users/me/a.gif?size=1");
  assert.equal(file.kind, "file");
  assert.match(file.source, /a\.gif$/);

  const appimg = normalizeContextImageSource("appimg:///C%3A%5CUsers%5Cme%5Cb.webp");
  assert.equal(appimg.kind, "file");
  assert.match(appimg.source, /b\.webp$/);

  const abs = normalizeContextImageSource("C:\\Users\\me\\c.jpg");
  assert.equal(abs.kind, "file");
  assert.equal(abs.source, "C:\\Users\\me\\c.jpg");

  const data = normalizeContextImageSource("data:image/png;base64,iVBORw0KGgo=");
  assert.equal(data.kind, "data");
  assert.equal(data.mime, "image/png");

  const remote = normalizeContextImageSource("https://example.test/a.png");
  assert.equal(remote.kind, "remote");

  const unsupported = normalizeContextImageSource("qqface:123");
  assert.equal(unsupported.kind, "unsupported");
  assert.equal(unsupported.reason, "unsupported_source");
});

test("inferImageExt prefers magic bytes and falls back to mime or filename", () => {
  assert.equal(inferImageExt(Buffer.from([0x89, 0x50, 0x4e, 0x47]), "", "a.jpg"), ".png");
  assert.equal(inferImageExt(Buffer.from([0x47, 0x49, 0x46, 0x38]), "", "a.png"), ".gif");
  assert.equal(
    inferImageExt(Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]), "", "a.png"),
    ".webp"
  );
  assert.equal(inferImageExt(Buffer.from("not an image"), "image/jpeg", "a.bin"), ".jpg");
  assert.equal(inferImageExt(Buffer.from("not an image"), "", "a.bmp"), ".bmp");
  assert.equal(inferImageExt(Buffer.from("not an image"), "", "a.txt"), "");
});

test("resolveContextTargetDir rejects traversal outside root", () => {
  const root = path.resolve("C:/emotes");

  assert.equal(resolveContextTargetDir(root, ""), root);
  assert.equal(resolveContextTargetDir(root, path.join(root, "cats")), path.join(root, "cats"));
  assert.throws(
    () => resolveContextTargetDir(root, path.join(root, "..", "outside")),
    /target_outside_root/
  );
});

test("sanitizeContextFileName and createUniqueImagePath generate safe unique names", () => {
  assert.equal(sanitizeContextFileName("bad<>name", ".png"), "bad__name.png");

  const targetDir = path.resolve("C:/emotes/cats");
  const exists = new Set([path.join(targetDir, "cat.png"), path.join(targetDir, "cat_1.png")]);
  const unique = createUniqueImagePath(targetDir, "cat.png", (candidate) => exists.has(candidate));

  assert.equal(unique.name, "cat_2.png");
  assert.equal(unique.path, path.join(targetDir, "cat_2.png"));
});

test("prepareContextImageBuffer validates size and magic while normalizing filename", () => {
  const png = prepareContextImageBuffer({
    bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]),
    fileName: "chat-image.jpg",
    mime: "image/jpeg",
  });
  assert.equal(png.ok, true);
  assert.equal(png.fileName, "chat-image.png");

  const fake = prepareContextImageBuffer({
    bytes: Buffer.from("not an image"),
    fileName: "fake.png",
    mime: "image/png",
  });
  assert.equal(fake.ok, false);
  assert.equal(fake.reason, "bad_magic");

  const huge = prepareContextImageBuffer({
    bytes: Buffer.alloc(20 * 1024 * 1024 + 1),
    fileName: "huge.png",
    mime: "image/png",
  });
  assert.equal(huge.ok, false);
  assert.equal(huge.reason, "bad_size");
});
