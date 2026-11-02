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
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "swiper-test-"));
process.env.AUTH_FILE = path.join(temp, "auth.json");
const { authStore } = require("../src/lib/auth/store.ts");
const store = authStore();
test.after(() => fs.rmSync(temp, { recursive: true, force: true }));
test("private IPv4/IPv6 and mapped addresses are blocked", () => {
  const { publicAddress } = require("../src/lib/safe-fetch.ts");
  for (const ip of [
    "127.0.0.1",
    "10.1.2.3",
    "169.254.169.254",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
  ])
    assert.equal(publicAddress(ip), false, ip);
  assert.equal(publicAddress("8.8.8.8"), true);
  assert.equal(publicAddress("2606:4700:4700::1111"), true);
});
test("body size and JSON object validation", async () => {
  const { readJson } = require("../src/lib/read-json.ts");
  await assert.rejects(
    readJson(new Request("http://local", { method: "POST", body: "null" })),
  );
  await assert.rejects(
    readJson(
      new Request("http://local", {
        method: "POST",
        body: JSON.stringify({ x: "a".repeat(200) }),
      }),
      30,
    ),
  );
});
test("profile discards personal identity fields", () => {
  const { cleanProfile } = require("../src/lib/profile-data.ts");
  assert.deepEqual(
    cleanProfile({
      person: { phone: "private" },
      sizes: { height: 180 },
      liked: [],
      tasted: true,
    }),
    { liked: [], tasted: true },
  );
});
test("one-time token can be consumed only once concurrently", async () => {
  await store.putToken("one", "value", 60);
  const results = await Promise.all([
    store.takeToken("one"),
    store.takeToken("one"),
  ]);
  assert.equal(results.filter(Boolean).length, 1);
});
test("parallel reservations and owner edits preserve the winner", async () => {
  const {
    myWishlist,
    saveWishlist,
    reserve,
  } = require("../src/lib/wish/server.ts");
  const user = {
    id: "owner",
    email: "owner@example.com",
    createdAt: new Date().toISOString(),
  };
  const list = await myWishlist(user);
  list.items = [
    {
      id: "gift",
      title: "Gift",
      currency: "RUB",
      source: "custom",
      addedAt: new Date().toISOString(),
    },
  ];
  await saveWishlist(list);
  const stale = await myWishlist(user);
  const results = await Promise.all([
    reserve("owner", "gift", { id: "a", name: "A" }, true),
    reserve("owner", "gift", { id: "b", name: "B" }, true),
  ]);
  assert.deepEqual(results.map((r) => r.outcome).sort(), ["reserved", "taken"]);
  stale.title = "Changed";
  await saveWishlist(stale);
  const fresh = await myWishlist(user);
  assert.equal(fresh.title, "Changed");
  assert.ok(fresh.items[0].reserved);
});
test("parallel first wishlist reads share the same code", async () => {
  const { myWishlist } = require("../src/lib/wish/server.ts");
  const u = {
    id: "new-owner",
    email: "new@example.com",
    createdAt: new Date().toISOString(),
  };
  const lists = await Promise.all([myWishlist(u), myWishlist(u)]);
  assert.equal(lists[0].code, lists[1].code);
});
test("corrupted auth file is not silently replaced with an empty database", async () => {
  const backup = fs.readFileSync(process.env.AUTH_FILE);
  fs.writeFileSync(process.env.AUTH_FILE, "{broken");
  await assert.rejects(store.putDoc("x", "y"));
  assert.equal(fs.readFileSync(process.env.AUTH_FILE, "utf8"), "{broken");
  fs.writeFileSync(process.env.AUTH_FILE, backup);
});
test("email codes expire after five wrong attempts and are single-use", async () => {
  let sent;
  const mailPath = require.resolve("../src/lib/auth/mail.ts");
  require.cache[mailPath] = {
    id: mailPath,
    filename: mailPath,
    loaded: true,
    exports: {
      sendMail: async (to, subject, html, text) => {
        sent = { to, text };
        return { delivered: true };
      },
    },
  };
  const { issueCode, verifyCode } = require("../src/lib/auth/otp.ts");
  const id = await issueCode("code@example.com");
  const code = /Код входа: (\d{6})/.exec(sent.text)[1];
  assert.equal(await verifyCode(id, code), "code@example.com");
  assert.equal(await verifyCode(id, code), null);
  const locked = await issueCode("locked@example.com");
  const actual = /Код входа: (\d{6})/.exec(sent.text)[1];
  const wrong = actual === "000000" ? "999999" : "000000";
  for (let i = 0; i < 5; i++)
    assert.equal(await verifyCode(locked, wrong), null);
  assert.equal(await verifyCode(locked, actual), null);
  const expired = await issueCode("old@example.com");
  const raw = JSON.parse(await store.takeToken("otp:" + expired));
  raw.expires = Date.now() - 1;
  await store.putToken("otp:" + expired, JSON.stringify(raw), 60);
  assert.equal(
    await verifyCode(expired, /Код входа: (\d{6})/.exec(sent.text)[1]),
    null,
  );
});
test("rate limit survives independent requests and concurrent calls", async () => {
  const { limit } = require("../src/lib/auth/otp.ts");
  const results = await Promise.all(
    Array.from({ length: 12 }, () => limit("test-burst", 3, 60000)),
  );
  assert.equal(results.filter(Boolean).length, 3);
});
test("profile CAS rejects an old revision", async () => {
  await store.putProfile("cas", JSON.stringify({ _revision: 1, liked: [] }));
  const attempt = async (expected) => {
    let ok = false;
    await store.editProfile("cas", (raw) => {
      const p = JSON.parse(raw);
      ok = p._revision === expected;
      return ok ? JSON.stringify({ ...p, _revision: p._revision + 1 }) : null;
    });
    return ok;
  };
  assert.equal(await attempt(1), true);
  assert.equal(await attempt(1), false);
  assert.equal(JSON.parse(await store.getProfile("cas"))._revision, 2);
});
test("email login creates an account, sets a session and protects sync revisions", async () => {
  const cookies = new Map();
  const load = Module._load;
  Module._load = function (request, ...args) {
    if (request === "next/headers")
      return {
        cookies: async () => ({
          get: (k) => (cookies.has(k) ? { value: cookies.get(k) } : undefined),
          set: (k, v) => cookies.set(k, v),
          delete: (k) => cookies.delete(k),
        }),
        headers: async () => new Headers(),
      };
    return load.call(this, request, ...args);
  };
  let letter;
  require("../src/lib/auth/mail.ts").sendMail = async (
    to,
    subject,
    html,
    text,
  ) => {
    letter = text;
    return { delivered: true };
  };
  try {
    const route = require("../src/app/api/auth/code/route.ts");
    const request = (body) =>
      new Request("http://local/api/auth/code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-real-ip": "test-code",
        },
        body: JSON.stringify(body),
      });
    const sent = await route.POST(request({ email: "route@example.com" }));
    assert.equal(sent.status, 200);
    const challenge = (await sent.json()).challenge;
    const code = /Код входа: (\d{6})/.exec(letter)[1];
    const verified = await route.POST(request({ challenge, code }));
    assert.equal(verified.status, 200);
    const pending = await verified.json();
    assert.ok(pending.registration);
    assert.equal(cookies.get("swiper_session"), undefined);
    assert.equal(await store.userIdByEmail("route@example.com"), null);
    const nicknameRoute = require("../src/app/api/auth/nickname/route.ts");
    const completed = await nicknameRoute.POST(
      request({ registration: pending.registration, nickname: "Route_User" }),
    );
    assert.equal(completed.status, 200);
    const user = (await completed.json()).user;
    assert.equal(user.nickname, "route_user");
    assert.equal(
      (await nicknameRoute.POST(request({ nickname: "different_nick" })))
        .status,
      409,
    );
    const lookup = require("../src/app/api/users/route.ts");
    const found = await lookup.GET(
      new Request("http://local/api/users?nickname=ROUTE_USER"),
    );
    const publicUser = (await found.json()).user;
    assert.equal(publicUser.nickname, "route_user");
    assert.equal(publicUser.email, undefined);
    assert.equal(user.email, "route@example.com");
    assert.ok(cookies.get("swiper_session"));
    const repeat = await route.POST(request({ challenge, code }));
    assert.equal(repeat.status, 400);
    const sync = require("../src/app/api/sync/route.ts");
    const put = (body) =>
      sync.POST(
        new Request("http://local/api/sync", {
          method: "POST",
          body: JSON.stringify(body),
        }),
      );
    assert.equal(
      (
        await put({
          revision: 0,
          profile: {
            liked: [],
            person: { phone: "private" },
            sizes: { height: 180 },
          },
        })
      ).status,
      200,
    );
    assert.equal(
      (await put({ revision: 0, profile: { liked: [] } })).status,
      409,
    );
    const profile = await (await sync.GET()).json();
    assert.equal(profile.revision, 1);
    assert.equal(profile.profile.person, undefined);
    assert.equal(profile.profile.sizes, undefined);
    const logout = require("../src/app/api/auth/logout/route.ts");
    await logout.POST();
    assert.equal((await sync.GET()).status, 401);
  } finally {
    Module._load = load;
  }
});
test("logging out clears identity and service state before a second account logs in", () => {
  const { useStore } = require("../src/lib/store.ts");
  useStore
    .getState()
    .setAccount({ id: "a", email: "a@example.com", createdAt: "" });
  useStore.setState({
    liked: [{ id: "secret" }],
    person: { phone: "secret" },
    orders: [{ id: "secret" }],
  });
  useStore.getState().setAccount(null);
  assert.deepEqual(useStore.getState().liked, []);
  assert.deepEqual(useStore.getState().orders, []);
  assert.equal(useStore.getState().person.phone, "");
  useStore
    .getState()
    .setAccount({ id: "b", email: "b@example.com", createdAt: "" });
  assert.deepEqual(useStore.getState().liked, []);
});

test("nicknames normalize case and reject invalid identifiers", () => {
  const {
    normalizeNickname,
    nicknameProblem,
  } = require("../src/lib/auth/nickname.ts");
  assert.equal(normalizeNickname(" @Kotletkad "), "kotletkad");
  for (const value of ["ab", "1user", "друг", "has space", "a".repeat(25)])
    assert.ok(nicknameProblem(value));
  assert.equal(nicknameProblem("Good_name12"), null);
});
test("only one account can claim a nickname and it cannot be changed", async () => {
  await store.createUser({
    id: "nick-a",
    email: "nick-a@example.com",
    createdAt: "",
  });
  await store.createUser({
    id: "nick-b",
    email: "nick-b@example.com",
    createdAt: "",
  });
  const results = await Promise.allSettled([
    store.claimNickname("nick-a", "unique_user"),
    store.claimNickname("nick-b", "unique_user"),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const winner = results.find((r) => r.status === "fulfilled").value;
  await assert.rejects(
    store.claimNickname(winner.id, "another_user"),
    /NICKNAME_LOCKED/,
  );
  assert.equal(
    (await store.claimNickname(winner.id, "unique_user")).nickname,
    "unique_user",
  );
  await store.updateUser({ ...winner, name: "changed", nickname: "changed" });
  assert.equal((await store.getUser(winner.id)).nickname, "unique_user");
  assert.equal(await store.getDoc("nickname:unique_user"), winner.id);
});

test("legacy game state is discarded without losing service data", () => {
  const { useStore } = require("../src/lib/store.ts");
  const current = useStore.getState();
  const merged = useStore.persist.getOptions().merge(
    {
      stats: { swipes: 100, streak: 20, bestStreak: 30, daySwipes: 20 },
      liked: [{ id: "kept" }],
      seen: ["viewed"],
    },
    current,
  );
  assert.equal("stats" in merged, false);
  assert.equal(merged.liked[0].id, "kept");
  assert.deepEqual(merged.seen, ["viewed"]);
  assert.equal("stats" in current.exportProfile(), false);
  const { cleanProfile } = require("../src/lib/profile-data.ts");
  assert.deepEqual(cleanProfile({ stats: { streak: 1 }, liked: [] }), {
    liked: [],
  });
});

test("wishlist metadata edits survive persistence without duplicating items", () => {
  const { useStore } = require("../src/lib/store.ts");
  useStore.setState({ wishlist: [], watch: {} });
  const item = {
    id: "custom-test",
    title: "Wish",
    price: 100,
    currency: "RUB",
    images: [],
  };
  useStore.getState().setWishlist([item]);
  useStore.getState().setWishlist([{ ...item, title: "Edited", price: 200 }]);
  assert.equal(useStore.getState().wishlist.length, 1);
  assert.equal(useStore.getState().wishlist[0].title, "Edited");
  assert.equal(useStore.getState().wishlist[0].price, 200);
  const persisted = JSON.parse(localValues.get("swipe1688")).state;
  assert.equal(persisted.wishlist[0].price, 200);
});

test("purchase state persists and is cleared when leaving the account", () => {
  const { useStore } = require("../src/lib/store.ts");
  useStore.getState().setAccount({
    id: "purchase-owner",
    email: "local@example.test",
    createdAt: "",
  });
  useStore.getState().setPurchaseStatus("p", "bought");
  useStore.getState().setPendingPurchase({ id: "p", at: 100 });
  useStore.getState().setPriceAlerts(false);
  const persisted = JSON.parse(localValues.get("swipe1688")).state;
  assert.equal(persisted.purchases.p, "bought");
  assert.equal(persisted.pendingPurchase.id, "p");
  assert.equal(persisted.priceAlerts, false);
  assert.equal("pendingPurchase" in useStore.getState().exportProfile(), false);
  useStore.getState().setAccount(null);
  assert.deepEqual(useStore.getState().purchases, {});
  assert.equal(useStore.getState().pendingPurchase, null);
});

test("a late feed response cannot overwrite a newer search", async () => {
  const { useStore } = require("../src/lib/store.ts");
  const { loadNextPage } = require("../src/lib/feed.ts");
  const originalFetch = global.fetch;
  let release;
  useStore.setState({
    query: "old",
    filters: {},
    seed: 17,
    deck: [],
    index: 0,
    cursor: null,
  });
  global.fetch = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  try {
    const pending = loadNextPage();
    useStore.setState({
      query: "new",
      filters: { minPrice: 100, priceCurrency: "RUB" },
      deck: [],
    });
    release(
      new Response(
        JSON.stringify({
          products: [{ id: "old" }],
          cursor: "6.0",
          provider: "local",
          providerLabel: "Local",
        }),
      ),
    );
    await pending;
    assert.deepEqual(useStore.getState().deck, []);
    assert.equal(useStore.getState().query, "new");
  } finally {
    global.fetch = originalFetch;
  }
});
