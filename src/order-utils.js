function normalizeOrderPath(value) {
  if (typeof value !== "string") return "";
  const normalized = value.trim().replace(/\\/g, "/");
  if (!normalized) return "";
  if (/^[A-Za-z]:\/$/.test(normalized)) return normalized;
  return normalized.replace(/\/+$/g, "");
}

function dedupeOrderArray(value, limit = 2000) {
  if (!Array.isArray(value)) return [];
  const max = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 2000;
  const seen = new Set();
  const out = [];
  for (const item of value) {
    const normalized = normalizeOrderPath(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
    if (out.length >= max) break;
  }
  return out;
}

function sanitizeImageOrderMap(value, options = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const maxPacks = Number.isFinite(options.maxPacks) ? Math.max(0, Math.floor(options.maxPacks)) : 500;
  const maxImagesPerPack = Number.isFinite(options.maxImagesPerPack)
    ? Math.max(0, Math.floor(options.maxImagesPerPack))
    : 2000;
  const out = {};
  for (const [rawDir, rawOrder] of Object.entries(value)) {
    if (Object.keys(out).length >= maxPacks) break;
    const dir = normalizeOrderPath(rawDir);
    if (!dir || !Array.isArray(rawOrder)) continue;
    const merged = out[dir] ? out[dir].concat(rawOrder) : rawOrder;
    const order = dedupeOrderArray(merged, maxImagesPerPack);
    if (order.length > 0) out[dir] = order;
  }
  return out;
}

function applyCustomOrder(items, order, getId) {
  const list = Array.isArray(items) ? items.slice() : [];
  const orderList = dedupeOrderArray(order);
  if (orderList.length === 0 || typeof getId !== "function") return list;
  const rank = new Map();
  orderList.forEach((item, index) => {
    if (!rank.has(item)) rank.set(item, index);
  });
  return list
    .map((item, index) => {
      const id = normalizeOrderPath(getId(item));
      return { item, index, rank: rank.has(id) ? rank.get(id) : Number.POSITIVE_INFINITY };
    })
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.index - b.index;
    })
    .map((entry) => entry.item);
}

module.exports = {
  applyCustomOrder,
  dedupeOrderArray,
  normalizeOrderPath,
  sanitizeImageOrderMap,
};
