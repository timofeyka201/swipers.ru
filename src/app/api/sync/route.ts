import { readJson } from "@/lib/read-json";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { authStore } from "@/lib/auth/store";
import { cleanProfile } from "@/lib/profile-data";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Нужен вход" }, { status: 401 });
  const raw = await authStore().getProfile(user.id);
  const profile = raw ? JSON.parse(raw) : null;
  return NextResponse.json(
    {
      profile: profile ? cleanProfile(profile) : null,
      revision: profile?._revision ?? 0,
    },
    { headers },
  );
}
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Нужен вход" }, { status: 401 });
  try {
    const body = await readJson(req, 1000000);
    if (
      !body?.profile ||
      typeof body.profile !== "object" ||
      !Number.isSafeInteger(body.revision)
    )
      return NextResponse.json(
        { error: "Некорректный профиль" },
        { status: 400 },
      );
    const profile = cleanProfile(body.profile);
    let revision = 0;
    let conflict = false;
    await authStore().editProfile(user.id, (raw) => {
      const current = raw ? JSON.parse(raw) : null;
      revision = current?._revision ?? 0;
      conflict = body.revision !== revision;
      if (conflict) return null;
      revision++;
      return JSON.stringify({
        ...profile,
        updatedAt: Date.now(),
        _revision: revision,
      });
    });
    return NextResponse.json(
      conflict
        ? { error: "Профиль изменён на другом устройстве" }
        : { ok: true, revision },
      { status: conflict ? 409 : 200, headers },
    );
  } catch {
    return NextResponse.json(
      { error: "Не удалось сохранить профиль" },
      { status: 400 },
    );
  }
}
