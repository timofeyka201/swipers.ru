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

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "swiper-ali-"));
process.env.AUTH_FILE = path.join(temp, "auth.json");
process.env.AE_CLIENT_ID = "test";
process.env.AE_CLIENT_SECRET = "test";
process.env.AE_PLACEMENT_ID = "999999";
process.env.APP_URL = "https://swipers.ru";
test.after(() => fs.rmSync(temp, { recursive: true, force: true }));
const client = require("../src/lib/ae/client.ts");
const {
  matchingReviewCount,
  productReviewCount,
} = require("../src/lib/ae/reviews.ts");
const product = {
  id: "ae-123456",
  source: "ae",
  title: "Test",
  url: "https://aliexpress.ru/item/123456.html",
};
test("review count comes only from the exact item, including zero", () => {
  assert.equal(
    matchingReviewCount(
      [{ link: "https://aliexpress.ru/item/999999.html", reviewsCount: 77 }],
      product.id,
    ),
    undefined,
  );
  assert.equal(
    matchingReviewCount([{ link: product.url, reviewsCount: 0 }], product.id),
    0,
  );
  assert.equal(
    matchingReviewCount([{ link: product.url, reviewsCount: -1 }], product.id),
    undefined,
  );
  assert.equal(
    matchingReviewCount(
      [{ link: product.url, reviewsCount: 23 }],
      "ae-123456-r2",
    ),
    23,
  );
});
test("review enrichment coalesces requests, caches results and respects a persistent budget", async () => {
  const original = client.aeFetch;
  let calls = 0;
  client.aeFetch = async () => {
    calls++;
    return { products: [{ link: product.url, reviewsCount: 21 }] };
  };
  try {
    const values = await Promise.all([
      productReviewCount(product),
      productReviewCount(product),
    ]);
    assert.deepEqual(values, [21, 21]);
    assert.equal(calls, 1);
    assert.equal(await productReviewCount(product), 21);
    assert.equal(calls, 1);
    process.env.AE_REVIEWS_DAILY_BUDGET = "1";
    assert.equal(
      await productReviewCount({ ...product, id: "ae-222222" }),
      undefined,
    );
    assert.equal(calls, 1);
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(temp, "ae-reviews.json"), "utf8"))
        .calls,
      1,
    );
  } finally {
    client.aeFetch = original;
    delete process.env.AE_REVIEWS_DAILY_BUDGET;
  }
});
test("stale placement is replaced with the unique active website placement, not the first other site", async () => {
  const original = client.aeFetch,
    originalUser = client.aeUserId;
  let created;
  client.aeUserId = async () => "123";
  client.aeFetch = async (p, o) => {
    if (p.endsWith("/active"))
      return {
        placements: [
          { id: 1, link: "https://other.example" },
          { id: 42, link: "https://swipers.ru/" },
        ],
      };
    created = o.body;
    return {
      status: "on",
      targetLink: "https://aliclick.shop/r/c/test?erid=example",
    };
  };
  try {
    const { affiliateLink } = require("../src/lib/ae/links.ts");
    const result = await affiliateLink(product.id, product.url, product.title);
    assert.equal(created.placementId, 42);
    assert.equal(new URL(result.target).hostname, "aliclick.shop");
    client.aeFetch = async () => ({
      status: "needMarking",
      targetLink: "https://aliclick.shop/r/c/pending",
    });
    assert.equal(
      await affiliateLink("ae-333333", product.url, product.title),
      null,
    );
  } finally {
    client.aeFetch = original;
    client.aeUserId = originalUser;
  }
});
