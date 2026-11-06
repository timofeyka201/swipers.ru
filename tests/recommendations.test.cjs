const test = require("node:test");
const localValues = new Map();
global.localStorage = {
  getItem: (key) => localValues.get(key) ?? null,
  setItem: (key, value) => localValues.set(key, value),
  removeItem: (key) => localValues.delete(key),
};
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const original = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  return original.call(
    this,
    request.startsWith("@/")
      ? path.join(root, "src", request.slice(2))
      : request,
    ...args,
  );
};
require.extensions[".ts"] = (module, file) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    file,
  );

const {
  emptyTaste,
  learn,
  learnAction,
  learnReason,
  toHint,
  undoLearning,
} = require("../src/lib/taste.ts");
const { recommend } = require("../src/lib/recommendations.ts");
const item = (id, category = "mens-watches") => ({
  id: String(id),
  title: "Product " + id,
  category,
  currency: "RUB",
  price: 1000,
  images: ["/photo"],
  url: "https://example.com",
  source: "ae",
  tags: ["цвет:чёрный"],
  seller: { name: "seller-" + id },
  attributes: [],
  skus: [],
  reviews: [],
  tiers: [],
});
test("legacy category keys match newly learned interests", () => {
  const t = learn(
    { ...emptyTaste(), categories: { "mens-watches": 2 } },
    item(1),
    "like",
  );
  assert.equal(t.categories["Мужские часы"], 3);
  assert.equal(toHint(t, []).categories["Мужские часы"], 3);
});
test("ordinary rejection does not infer dislike for brand or appearance", () => {
  const p = { ...item(1), brand: "Brand" };
  const t = learn(emptyTaste(), p, "dislike");
  assert.equal(t.categories["Мужские часы"], -0.15);
  assert.deepEqual(t.brands, {});
  assert.deepEqual(t.tags, {});
});
test("explicit price rejection changes only the category budget", () => {
  const t = learnReason(
    { ...emptyTaste(), budget: 5000 },
    item(1),
    "price",
    1000,
  );
  assert.equal(t.budget, 5000);
  assert.equal(t.categoryBudgets["Мужские часы"], 800);
});
test("shop signal is deduplicated for a day including round-suffixed IDs", () => {
  const t = learnAction(emptyTaste(), item(1), "shop", 100000);
  assert.equal(learnAction(t, item("1-r2"), "shop", 100001), t);
  assert.notEqual(learnAction(t, item(1), "shop", 100000 + 86400001), t);
});
test("undo restores capped signal but preserves subsequent shop activity", () => {
  const before = { ...emptyTaste(), categories: { "Мужские часы": 7.8 } };
  const after = learnAction(before, item(1), "like", 100000);
  const current = learnAction(after, item(2, "womens-bags"), "shop", 100001);
  const undone = undoLearning(current, before, after);
  assert.equal(undone.categories["Мужские часы"], 7.8);
  assert.equal(undone.categories["Женские сумки"], 3);
  assert.equal(undone.signals["like:1"], undefined);
  assert.equal(undone.signals["shop:2"], 100001);
});
test("rare positive interest is retrieved from whole catalogue", () => {
  const all = Array.from({ length: 10000 }, (_, i) =>
    item(i, i < 9950 ? "womens-bags" : "mens-watches"),
  );
  const out = recommend(
    all,
    { categories: { "Мужские часы": 8 } },
    71,
    0,
    () => true,
  );
  assert.equal(out.length, 18);
  assert.ok(out.filter((p) => p.category === "mens-watches").length >= 10);
});
test("successive pages keep unselected candidates available and obey filters/exclusions", () => {
  const all = Array.from({ length: 73 }, (_, i) => item(i));
  const seen = [];
  for (let page = 0; page < 5; page++) {
    const out = recommend(
      all,
      { exclude: seen },
      18,
      page,
      (p) => Number(p.id) % 2 === 0,
    );
    assert.ok(out.every((p) => Number(p.id) % 2 === 0 && !seen.includes(p.id)));
    seen.push(...out.map((p) => p.id));
  }
  assert.equal(seen.length, 37);
  assert.equal(new Set(seen).size, 37);
  assert.deepEqual(
    recommend(all, { exclude: seen }, 18, 6, (p) => Number(p.id) % 2 === 0),
    [],
  );
});
test("duplicate titles do not fill the same page and seller diversity breaks ties", () => {
  const all = Array.from({ length: 80 }, (_, i) => ({
    ...item(i),
    seller: { name: i < 40 ? "same" : "seller-" + i },
    title: i < 5 ? "duplicate" : "Product " + i,
  }));
  const out = recommend(all, {}, 81, 0, () => true);
  assert.equal(new Set(out.map((p) => p.title)).size, out.length);
  assert.ok(out.filter((p) => p.seller.name === "same").length < 9);
});
test("store like and wishlist teach recommendations once, repeated shop visits do not inflate them", () => {
  const { useStore } = require("../src/lib/store.ts");
  useStore.setState({
    taste: emptyTaste(),
    liked: [],
    wishlist: [],
    cart: [],
    watch: {},
  });
  useStore.getState().like(item(1));
  assert.equal(useStore.getState().taste.categories["Мужские часы"], 1);
  useStore.getState().like(item(1));
  assert.equal(useStore.getState().taste.categories["Мужские часы"], 1);
  useStore.getState().toggleWish(item(2));
  assert.equal(useStore.getState().taste.categories["Мужские часы"], 3);
  useStore.getState().noteOrder(item(3));
  const t = useStore.getState().taste;
  useStore.getState().noteOrder(item(3));
  assert.equal(useStore.getState().taste, t);
});

test("session interests expire without changing the long-term profile", () => {
  const t = emptyTaste();
  const current = toHint(t, [], undefined, [
    { product: item(1), decision: "like", at: Date.now() },
  ]);
  assert.ok(current.categories["Мужские часы"] > 0.9);
  const expired = toHint(t, [], undefined, [
    { product: item(1), decision: "like", at: Date.now() - 3600000 },
  ]);
  assert.deepEqual(expired.categories, {});
  assert.deepEqual(t.categories, {});
});
