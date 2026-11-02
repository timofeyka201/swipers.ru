import Link from "next/link";
import { Header, Empty } from "@/components/Ui";
export default function Offline() {
  return (
    <main className="ui-page">
      <Header title="Для вас" />
      <div className="ui-page-body">
        <Empty
          title="Нет связи"
          detail="Новые карточки подгрузятся, когда появится интернет. Сохранённое открывается и без сети."
        >
          <Link className="ui-btn ui-dark" href="/">
            Попробовать снова
          </Link>
          <Link className="ui-btn ui-soft" href="/likes">
            Открыть сохранённое
          </Link>
        </Empty>
      </div>
    </main>
  );
}
