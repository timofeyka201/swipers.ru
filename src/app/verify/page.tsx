import Link from "next/link";
export default function Page() {
  return (
    <main className="p-6">
      <h1>Вход теперь по коду из письма</h1>
      <Link href="/profile">Перейти в профиль</Link>
    </main>
  );
}
