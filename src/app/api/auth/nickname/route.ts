import { readJson } from "@/lib/read-json";
import { NextResponse } from "next/server";
import { currentUser, toPublic } from "@/lib/auth/session";
import { authStore } from "@/lib/auth/store";
export async function PATCH(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Нужен вход" }, { status: 401 });
  try {
    const body = await readJson(req, 32768);
    if (typeof body?.nickname !== "string" || body.nickname.trim().length > 40)
      return NextResponse.json(
        { error: "Никнейм до 40 символов" },
        { status: 400 },
      );
    const updated = { ...user, name: body.nickname.trim() || undefined };
    await authStore().updateUser(updated);
    return NextResponse.json({ user: toPublic(updated) });
  } catch {
    return NextResponse.json(
      { error: "Не удалось сохранить" },
      { status: 503 },
    );
  }
}
