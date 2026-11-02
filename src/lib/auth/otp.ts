import {
  createHash,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { authStore } from "./store";
import { sendMail } from "./mail";
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export async function limit(
  key: string,
  max: number,
  windowMs: number,
): Promise<boolean> {
  let allowed = false;
  await authStore().editDoc("limit:" + digest(key), (raw) => {
    const now = Date.now();
    const previous = raw ? JSON.parse(raw) : null;
    const state =
      previous && previous.until > now
        ? previous
        : { count: 0, until: now + windowMs };
    allowed = state.count < max;
    state.count++;
    return JSON.stringify(state);
  });
  return allowed;
}
export async function issueCode(email: string): Promise<string> {
  const id = randomUUID();
  const code = String(randomInt(0, 1000000)).padStart(6, "0");
  await authStore().putToken(
    "otp:" + id,
    JSON.stringify({
      email,
      hash: digest(id + code),
      expires: Date.now() + 600000,
      attempts: 0,
    }),
    600,
  );
  const sent = await sendMail(
    email,
    "Код входа в Swiper",
    "<p>Код входа: <strong>" +
      code +
      "</strong></p><p>Действует 10 минут. Никому его не сообщайте.</p>",
    "Код входа: " + code + ". Действует 10 минут. Никому его не сообщайте.",
  );
  if (!sent.delivered) {
    await authStore().takeToken("otp:" + id);
    throw new Error("MAIL_UNAVAILABLE");
  }
  return id;
}
export async function verifyCode(
  id: string,
  code: string,
): Promise<string | null> {
  // Claiming consumes the challenge before comparison, so concurrent confirmations cannot both succeed.
  const raw = await authStore().takeToken("otp:" + id);
  if (!raw) return null;
  const state = JSON.parse(raw);
  if (state.expires < Date.now() || state.attempts >= 5) return null;
  if (
    timingSafeEqual(
      Buffer.from(state.hash, "hex"),
      Buffer.from(digest(id + code), "hex"),
    )
  )
    return state.email;
  state.attempts++;
  if (state.attempts < 5)
    await authStore().putToken(
      "otp:" + id,
      JSON.stringify(state),
      Math.ceil((state.expires - Date.now()) / 1000),
    );
  return null;
}
