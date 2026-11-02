import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { Agent, fetch } from "undici";

const blocked = new BlockList();
for (const [ip, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["192.0.0.0", 24],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(ip, bits, "ipv4");
// Only globally routable IPv6 unicast is eligible; exclude special ranges within it.
blocked.addSubnet("2001:db8::", 32, "ipv6");
blocked.addSubnet("2001::", 32, "ipv6");
blocked.addSubnet("2002::", 16, "ipv6");
export function publicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, "ipv4");
  return (
    family === 6 && /^[23]/.test(address) && !blocked.check(address, "ipv6")
  );
}
/** Resolve once, then pin the actual socket to a validated address. */
export async function safeFetch(
  raw: string,
  maxBytes = 8 * 1024 * 1024,
  timeout = 6000,
): Promise<{ body: Buffer; type: string; url: string }> {
  const signal = AbortSignal.timeout(timeout);
  let target = new URL(raw);
  for (let hop = 0; hop <= 3; hop++) {
    if (
      !["https:", "http:"].includes(target.protocol) ||
      target.username ||
      target.password ||
      (target.port && !["80", "443"].includes(target.port))
    )
      throw new Error("Unsafe URL");
    const hostname = target.hostname.replace(/^\[|\]$/g, "");
    const addresses = isIP(hostname)
      ? [{ address: hostname, family: isIP(hostname) }]
      : await Promise.race([
          lookup(hostname, { all: true }),
          new Promise<never>((_, reject) => {
            if (signal.aborted) reject(new Error("Timeout"));
            else
              signal.addEventListener(
                "abort",
                () => reject(new Error("Timeout")),
                { once: true },
              );
          }),
        ]);
    if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
      throw new Error("Private address");
    const agent = new Agent({
      connect: {
        lookup: (_hostname, options, callback) => {
          const selected = addresses[0];
          if (options.all) callback(null, addresses as never);
          else callback(null, selected.address, selected.family);
        },
      },
    });
    try {
      const res = await fetch(target, {
        dispatcher: agent,
        redirect: "manual",
        signal,
        headers: {
          "User-Agent": "Swiper/1.0",
          Accept: "image/*,text/html;q=0.8",
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        await res.body?.cancel();
        if (!location) throw new Error("Missing redirect");
        target = new URL(location, target);
        continue;
      }
      if (!res.ok) {
        await res.body?.cancel();
        throw new Error("Upstream error");
      }
      const type = res.headers.get("content-type") ?? "";
      const chunks: Buffer[] = [];
      let size = 0;
      if (Number(res.headers.get("content-length")) > maxBytes) {
        await res.body?.cancel();
        throw new Error("Too large");
      }
      if (res.body)
        for await (const chunk of res.body) {
          size += chunk.length;
          if (size > maxBytes) throw new Error("Too large");
          chunks.push(Buffer.from(chunk));
        }
      return { body: Buffer.concat(chunks), type, url: target.toString() };
    } finally {
      await agent.destroy();
    }
  }
  throw new Error("Too many redirects");
}
