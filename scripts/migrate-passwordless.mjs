import { readFile, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
// Run once during a maintenance window, with the same environment as the app.
const cleanProfile = (raw) => {
  const p = JSON.parse(raw);
  delete p.person;
  delete p.sizes;
  return JSON.stringify(p);
};
const cleanUser = (u) => {
  const { passwordHash, passwordChangedAt, ...rest } = u;
  return rest;
};
const url = process.env.AUTH_REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
const token =
  process.env.AUTH_REDIS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
if (url) {
  const call = async (command) => {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error("Redis unavailable");
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    return j.result;
  };
  let cursor = "0";
  let count = 0;
  do {
    const result = await call(["SCAN", cursor, "COUNT", 100]);
    cursor = String(result[0]);
    for (const key of result[1]) {
      if (key.startsWith("user:") && !key.startsWith("user:email:")) {
        const raw = await call(["GET", key]);
        if (raw) {
          await call(["SET", key, JSON.stringify(cleanUser(JSON.parse(raw)))]);
          count++;
        }
      } else if (key.startsWith("profile:")) {
        const raw = await call(["GET", key]);
        if (raw) await call(["SET", key, cleanProfile(raw)]);
      } else if (key.startsWith("tok:reset:") || key.startsWith("tok:verify:"))
        await call(["DEL", key]);
    }
  } while (cursor !== "0");
  console.log(`Migrated ${count} users`);
} else {
  const file = process.env.AUTH_FILE || ".data/auth.json";
  const data = JSON.parse(await readFile(file, "utf8"));
  for (const [id, u] of Object.entries(data.users || {}))
    data.users[id] = cleanUser(u);
  for (const [id, p] of Object.entries(data.profiles || {}))
    data.profiles[id] = cleanProfile(p);
  for (const key of Object.keys(data.tokens || {}))
    if (key.startsWith("reset:") || key.startsWith("verify:"))
      delete data.tokens[key];
  const tmp = file + "." + randomUUID() + ".tmp";
  await writeFile(tmp, JSON.stringify(data), { mode: 0o600 });
  await rename(tmp, file);
  console.log("Migrated local storage");
}
