export const normalizeNickname = (value: unknown) =>
  typeof value === "string" ? value.trim().replace(/^@/, "").toLowerCase() : "";
export function nicknameProblem(value: unknown): string | null {
  const nick = normalizeNickname(value);
  return /^[a-z][a-z0-9_]{2,23}$/.test(nick)
    ? null
    : "От 3 до 24 символов: латинские буквы, цифры и _. Первый символ — буква.";
}
