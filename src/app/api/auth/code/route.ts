import { readJson } from "@/lib/read-json";
import { NextResponse } from "next/server";
import { emailProblem, normalizeEmail } from "@/lib/auth/rules";
import { clientKey, startSession, toPublic } from "@/lib/auth/session";
import { authStore } from "@/lib/auth/store";
import { issueCode, verifyCode, limit } from "@/lib/auth/otp";
import { randomUUID } from "node:crypto";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    if (Number(req.headers.get("content-length")) > 4096)
      return NextResponse.json(
        { error: "Слишком большой запрос" },
        { status: 413 },
      );
    const body = await readJson(req, 32768);
    if (!body || typeof body !== "object")
      return NextResponse.json(
        { error: "Некорректный запрос" },
        { status: 400 },
      );
    if (typeof body.challenge === "string") {
      if (body.challenge.length > 100 || !/^\d{6}$/.test(body.code ?? ""))
        return NextResponse.json({ error: "Введите 6 цифр" }, { status: 400 });
      if (!(await limit("confirm:" + clientKey(req), 30, 600000)))
        return NextResponse.json(
          { error: "Слишком много попыток" },
          { status: 429 },
        );
      const email = await verifyCode(body.challenge, body.code);
      if (!email)
        return NextResponse.json(
          { error: "Код неверный или истёк" },
          { status: 400 },
        );
      const store = authStore();
      const id = await store.userIdByEmail(email);
      const user = id ? await store.getUser(id) : null;
      if (!user?.nickname) {
        const registration = randomUUID();
        await store.putToken(
          "signup:" + registration,
          JSON.stringify({ email, expires: Date.now() + 600000 }),
          600,
        );
        return NextResponse.json(
          { registration, suggestedNickname: user?.name ?? "" },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
      const { passwordHash: _password, ...clean } = user;
      await store.updateUser({ ...clean, emailVerified: true });
      await startSession(user.id);
      return NextResponse.json(
        { user: toPublic({ ...clean, emailVerified: true }) },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const email = normalizeEmail(
      typeof body.email === "string" ? body.email : "",
    );
    const error = emailProblem(email);
    if (error) return NextResponse.json({ error }, { status: 400 });
    if (
      !(await limit("mail-ip:" + clientKey(req), 10, 600000)) ||
      !(await limit("mail:" + email, 3, 600000))
    )
      return NextResponse.json(
        { error: "Подождите перед повторной отправкой" },
        { status: 429 },
      );
    return NextResponse.json(
      { challenge: await issueCode(email) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Вход по коду:", error);
    return NextResponse.json(
      { error: "Не удалось выполнить вход. Попробуйте позже." },
      { status: 503 },
    );
  }
}
