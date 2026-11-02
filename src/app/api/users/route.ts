import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { authStore } from "@/lib/auth/store";
import { nicknameProblem, normalizeNickname } from "@/lib/auth/nickname";
import { limit } from "@/lib/auth/otp";
export async function GET(req: Request) {
  const viewer = await currentUser();
  if (!viewer)
    return NextResponse.json(
      { error: "Войдите, чтобы искать друзей" },
      { status: 401 },
    );
  if (!(await limit("people:" + viewer.id, 30, 60000)))
    return NextResponse.json(
      { error: "Слишком много запросов" },
      { status: 429 },
    );
  const nick = normalizeNickname(new URL(req.url).searchParams.get("nickname"));
  if (nicknameProblem(nick))
    return NextResponse.json(
      { error: "Введите полный никнейм" },
      { status: 400 },
    );
  const store = authStore();
  const id = await store.getDoc("nickname:" + nick);
  const user = id ? await store.getUser(id) : null;
  if (!user?.nickname)
    return NextResponse.json(
      { error: "Пользователь не найден" },
      { status: 404 },
    );
  const raw = await store.getDoc("wish:" + user.id);
  const list = raw ? JSON.parse(raw) : null;
  return NextResponse.json(
    {
      user: {
        nickname: user.nickname,
        wishlistCode: list?.shared ? list.code : null,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
