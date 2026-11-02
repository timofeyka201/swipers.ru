import { NextResponse } from "next/server";
import {
  currentUser,
  toPublic,
  startSession,
  clientKey,
} from "@/lib/auth/session";
import { authStore } from "@/lib/auth/store";
import { readJson } from "@/lib/read-json";
import { nicknameProblem, normalizeNickname } from "@/lib/auth/nickname";
import { limit } from "@/lib/auth/otp";
import { randomUUID } from "node:crypto";
export async function POST(req: Request) {
  const store = authStore();
  let pending: { email: string; expires: number } | null = null;
  let ticket = "";
  try {
    const body = await readJson(req, 4096);
    const error = nicknameProblem(body.nickname);
    if (error) return NextResponse.json({ error }, { status: 400 });
    let user = await currentUser();
    if (
      typeof body.registration === "string" &&
      body.registration.length < 100
    ) {
      ticket = body.registration;
      const raw = await store.takeToken("signup:" + ticket);
      pending = raw ? JSON.parse(raw) : null;
      if (!pending || pending.expires < Date.now())
        return NextResponse.json(
          { error: "Подтвердите почту ещё раз" },
          { status: 401 },
        );
      const id = await store.userIdByEmail(pending.email);
      user = id ? await store.getUser(id) : null;
      if (!user) {
        const created = {
          id: randomUUID(),
          email: pending.email,
          emailVerified: true,
          createdAt: new Date().toISOString(),
        };
        try {
          await store.createUser(created);
          user = created;
        } catch (e) {
          if (!(e instanceof Error) || e.message !== "EMAIL_TAKEN") throw e;
          const existing = await store.userIdByEmail(pending.email);
          user = existing ? await store.getUser(existing) : null;
        }
      }
    }
    if (!user)
      return NextResponse.json({ error: "Нужен вход" }, { status: 401 });
    if (
      !(await limit("nickname:" + user.id + ":" + clientKey(req), 30, 600000))
    )
      throw new Error("TOO_MANY");
    const updated = await store.claimNickname(
      user.id,
      normalizeNickname(body.nickname),
    );
    if (pending) await startSession(user.id);
    return NextResponse.json(
      { user: toPublic(updated) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    if (pending && pending.expires > Date.now())
      await store.putToken(
        "signup:" + ticket,
        JSON.stringify(pending),
        Math.ceil((pending.expires - Date.now()) / 1000),
      );
    const code = e instanceof Error ? e.message : "";
    if (code === "NICKNAME_TAKEN")
      return NextResponse.json(
        { error: "Этот никнейм уже занят. Выберите другой." },
        { status: 409 },
      );
    if (code === "NICKNAME_LOCKED")
      return NextResponse.json(
        { error: "Никнейм уже закреплён. Изменить его нельзя." },
        { status: 409 },
      );
    return NextResponse.json(
      {
        error:
          code === "TOO_MANY"
            ? "Слишком много попыток"
            : "Не удалось закрепить никнейм",
      },
      { status: code === "TOO_MANY" ? 429 : 503 },
    );
  }
}
export const PATCH = POST;
