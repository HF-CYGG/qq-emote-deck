const assert = require("node:assert/strict");
const test = require("node:test");

const {
  applyCustomOrder,
  dedupeOrderArray,
  normalizeOrderPath,
  sanitizeImageOrderMap,
} = require("../src/order-utils.js");

test("normalizeOrderPath produces stable slash-normalized keys", () => {
  assert.equal(normalizeOrderPath("D:\\emotes\\cats\\"), "D:/emotes/cats");
  assert.equal(normalizeOrderPath("  D:/emotes/cats  "), "D:/emotes/cats");
  assert.equal(normalizeOrderPath(null), "");
});

test("dedupeOrderArray keeps unique normalized string paths only", () => {
  assert.deepEqual(
    dedupeOrderArray(["D:\\a\\b", "D:/a/b", "", 7, "D:/a/c/", "D:/a/d"], 2),
    ["D:/a/b", "D:/a/c"]
  );
});

test("sanitizeImageOrderMap normalizes pack keys and image values", () => {
  assert.deepEqual(
    sanitizeImageOrderMap({
      "D:\\packs\\cats": ["D:\\packs\\cats\\b.png", "D:/packs/cats/b.png", "D:\\packs\\cats\\a.gif"],
      "": ["ignored.png"],
      "D:\\packs\\dogs": "invalid",
    }),
    {
      "D:/packs/cats": ["D:/packs/cats/b.png", "D:/packs/cats/a.gif"],
    }
  );
});

test("applyCustomOrder puts configured items first and appends unknown items stably", () => {
  const items = [
    { path: "D:\\packs\\cats\\a.png", name: "a" },
    { path: "D:\\packs\\cats\\b.png", name: "b" },
    { path: "D:\\packs\\cats\\c.png", name: "c" },
  ];

  assert.deepEqual(
    applyCustomOrder(items, ["D:/packs/cats/c.png", "D:/packs/cats/a.png"], (item) => item.path).map((item) => item.name),
    ["c", "a", "b"]
  );
});
