import { safeFetch } from "@/lib/safe-fetch";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { extractPreview } from "@/lib/wish/opengraph";
import { safeUrl } from "@/lib/wish/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * Карточка по ссылке: человек присылает адрес товара, а название, фото и цену
 * достаём сами — переписывать их руками никто не станет.
 *
 * Запрос уходит с нашего сервера, поэтому ссылка — чужой ввод, которым можно
 * попробовать дотянуться до внутренней сети. Отсюда проверка адреса на каждом
 * шаге, ручные перенаправления и жёсткие ограничения на время и объём.
 */

const TIMEOUT = 6000;
const MAX_BYTES = 512 * 1024;
export async function GET(req: Request) {
  // Ходить по чужим ссылкам с нашего адреса разрешаем только своим.
  if (!(await currentUser()))
    return NextResponse.json({ error: "Нужен вход" }, { status: 401 });

  const raw = new URL(req.url).searchParams.get("url") ?? "";
  const normalized = safeUrl(raw);
  if (!normalized)
    return NextResponse.json(
      { error: "Это не похоже на ссылку" },
      { status: 400 },
    );

  let result;
  try {
    result = await safeFetch(normalized, MAX_BYTES, TIMEOUT);
  } catch {
    return NextResponse.json(
      { error: "Не удалось открыть ссылку" },
      { status: 400 },
    );
  }
  if (!result.type.includes("html"))
    return NextResponse.json({ error: "По ссылке не HTML" }, { status: 415 });
  const target = new URL(result.url);
  const preview = extractPreview(result.body.toString("utf8"), result.url);

  return NextResponse.json(
    { ...preview, url: target.toString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
