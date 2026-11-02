"use client";

import { useStore, type SyncedProfile } from "./store";
import { toast } from "@/components/Toast";
import { loadMyWishlist } from "./wish/client";

/**
 * Синхронизация личных данных с сервером. Работает только при входе; гость
 * живёт целиком в браузере, как и раньше.
 *
 * Конфликты решаются по-разному в двух разных ситуациях, и это важно:
 *
 *  • Возобновление сессии — побеждает более свежая сторона целиком. Слияние
 *    здесь воскрешало бы только что удалённое.
 *
 *  • Первый вход на устройстве — списки объединяются. Правило «свежее
 *    побеждает» тут нельзя: любое действие в приложении до входа (даже
 *    пропуск теста вкусов) делает пустое устройство «свежее» аккаунта, и
 *    данные пользователя стираются.
 */
const PUSH_DELAY = 2500;

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushing: Promise<void> | null = null;
let started = false;

let remoteRevision = 0;
let revisionUser = "";
let syncQueue: Promise<void> = Promise.resolve();
async function push(): Promise<void> {
  const user = useStore.getState().account?.id;
  const task = syncQueue.then(() =>
    user === useStore.getState().account?.id ? pushNow() : undefined,
  );
  syncQueue = task.catch(() => undefined);
  return task;
}
async function pushNow(): Promise<void> {
  const { account, exportProfile } = useStore.getState();
  if (!account) return;
  const profile = exportProfile();
  let responseError = "Нет связи: изменения сохранены на этом устройстве";
  try {
    const response = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile,
        updatedAt: profile.updatedAt || Date.now(),
        revision: revisionUser === account.id ? remoteRevision : 0,
      }),
    });
    if (response.status === 409)
      responseError =
        "Данные изменены на другом устройстве. Обновите страницу перед продолжением.";
    if (!response.ok) throw new Error("SYNC_FAILED");
    const data = await response.json();
    if (useStore.getState().account?.id === account.id) {
      remoteRevision = data.revision;
      revisionUser = account.id;
    }
  } catch {
    if (useStore.getState().account?.id === account.id) {
      toast(responseError);
    }
    /* Retry after connectivity returns; keep the local profile. */
  }
}

export function schedulePush(): void {
  if (!useStore.getState().account) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushing = push().finally(() => {
      pushing = null;
    });
  }, PUSH_DELAY);
}

export async function flushPush(): Promise<void> {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
    await push();
  }
  if (pushing) await pushing;
}

async function fetchRemote(): Promise<SyncedProfile | null | "error"> {
  try {
    const accountId = useStore.getState().account?.id;
    const res = await fetch("/api/sync", { cache: "no-store" });
    if (!res.ok) return "error";
    const { profile, revision } = (await res.json()) as {
      profile: SyncedProfile | null;
      revision: number;
    };
    if (accountId !== useStore.getState().account?.id) return "error";
    remoteRevision = revision ?? 0;
    revisionUser = accountId ?? "";
    return profile;
  } catch {
    return "error";
  }
}

const byId = <T extends { id: string }>(a: T[], b: T[]): T[] => {
  const out = [...a];
  const seen = new Set(a.map((x) => x.id));
  for (const item of b) if (!seen.has(item.id)) out.push(item);
  return out;
};

/** Объединение профилей: ничего не теряем, спорные скаляры берём у свежего. */
function merge(local: SyncedProfile, remote: SyncedProfile): SyncedProfile {
  const remoteNewer = (remote.updatedAt ?? 0) >= (local.updatedAt ?? 0);
  const fresh = remoteNewer ? remote : local;
  const stale = remoteNewer ? local : remote;

  const weights = (
    a: Record<string, number> = {},
    b: Record<string, number> = {},
    limit = 8,
  ) => {
    const out: Record<string, number> = { ...a };
    for (const [k, v] of Object.entries(b))
      out[k] = Math.max(-limit, Math.min(limit, (out[k] ?? 0) + v));
    return out;
  };

  return {
    purchases: { ...(stale.purchases ?? {}), ...(fresh.purchases ?? {}) },
    priceAlerts: fresh.priceAlerts ?? true,
    liked: byId(remote.liked ?? [], local.liked ?? []),
    wishlist: byId(remote.wishlist ?? [], local.wishlist ?? []),
    cart: (() => {
      const out = [...(remote.cart ?? [])];
      const ids = new Set(out.map((c) => c.product.id));
      for (const c of local.cart ?? []) if (!ids.has(c.product.id)) out.push(c);
      return out;
    })(),
    rejected: [
      ...new Set([...(remote.rejected ?? []), ...(local.rejected ?? [])]),
    ].slice(0, 2000),
    watch: { ...(local.watch ?? {}), ...(remote.watch ?? {}) },
    taste: {
      picked: fresh.taste?.picked?.length
        ? fresh.taste.picked
        : (stale.taste?.picked ?? []),
      budget: fresh.taste?.budget ?? stale.taste?.budget,
      categories: weights(remote.taste?.categories, local.taste?.categories),
      brands: weights(remote.taste?.brands, local.taste?.brands),
      // У меток свой потолок — вчетверо ниже, чем у категорий.
      tags: weights(remote.taste?.tags, local.taste?.tags, 4),
      reasons: weights(remote.taste?.reasons, local.taste?.reasons),
      // Обе стороны к этому моменту уже остыли каждая по своим часам, а
      // сложенные веса — новое начало отсчёта.
      decayedAt: Date.now(),
    },
    sizes: Object.keys(fresh.sizes ?? {}).length
      ? fresh.sizes
      : (stale.sizes ?? {}),
    // Имя и телефон: поле за полем, иначе заполненное на одном устройстве
    // затирается пустотой с другого.
    person: {
      firstName: fresh.person?.firstName || stale.person?.firstName || "",
      lastName: fresh.person?.lastName || stale.person?.lastName || "",
      phone: fresh.person?.phone || stale.person?.phone || "",
    },
    orders: byId(remote.orders ?? [], local.orders ?? []).slice(0, 60),
    tasted: (local.tasted ?? false) || (remote.tasted ?? false),
    updatedAt: Date.now(),
  };
}

/**
 * Первый вход на устройстве: объединяем то, что человек уже успел здесь
 * насвайпать, с тем, что лежит в аккаунте.
 */
export async function syncOnLogin(): Promise<"merged" | "pushed" | "none"> {
  const state = useStore.getState();
  if (!state.account) return "none";

  const remote = await fetchRemote();
  if (useStore.getState().account?.id !== state.account.id) return "none";
  if (remote === "error") return "none";
  if (!remote) {
    await push();
    await loadMyWishlist();
    return "pushed";
  }

  state.importProfile(merge(state.exportProfile(), remote));
  await push();
  // Вишлист, отложенный до входа, переезжает в аккаунт: иначе список желаний
  // на сервере окажется пустым ровно у тех, кто уже начал им пользоваться.
  await loadMyWishlist();
  return "merged";
}

/** Возобновление сессии: побеждает более свежая сторона целиком. */
export async function pullProfile(): Promise<"pulled" | "pushed" | "none"> {
  const state = useStore.getState();
  if (!state.account) return "none";

  const remote = await fetchRemote();
  if (remote === "error") return "none";
  if (!remote) {
    await push();
    return "pushed";
  }
  if ((remote.updatedAt ?? 0) > state.updatedAt) {
    state.importProfile(remote);
    return "pulled";
  }
  await push();
  return "pushed";
}

/** Подписка на изменения: любое движение личных данных откладывает отправку. */
export function startSyncAgent(): () => void {
  if (started) return () => undefined;
  started = true;

  const unsubscribe = useStore.subscribe((state, prev) => {
    if (!state.account) return;
    if (state.updatedAt !== prev.updatedAt) schedulePush();
  });

  const onHide = () => {
    if (document.visibilityState === "hidden") void flushPush();
  };
  document.addEventListener("visibilitychange", onHide);
  const online = () => void pullProfile();
  window.addEventListener("online", online);

  return () => {
    unsubscribe();
    window.removeEventListener("online", online);
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = null;
    document.removeEventListener("visibilitychange", onHide);
    started = false;
  };
}
