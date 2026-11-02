import { Header } from "@/components/Ui";
import Link from "next/link";
export default function About() {
  return (
    <main className="ui-page">
      <Header title="Как это работает" back="/profile" />
      <div className="ui-page-body">
        <section className="ui-box space-y-3">
          <h2>Находите своё</h2>
          <p>
            Листайте карточки: вправо — нравится, влево — мимо. Можно
            пользоваться кнопками под товаром. Подборка учится на ваших
            решениях.
          </p>
        </section>
        <section className="ui-box space-y-3">
          <h2>Сохраняйте находки</h2>
          <p>
            В «Сохранённом» три вкладки: понравившиеся товары, «Куплю» и вишлист
            для подарков.
          </p>
        </section>
        <section className="ui-box space-y-3">
          <h2>Покупайте у продавца</h2>
          <p>
            Кнопка покупки открывает магазин. Наличие, актуальная цена,
            оформление, оплата и доставка — на стороне продавца. В Swiper можно
            отметить, что заказ уже оформлен.
          </p>
        </section>
        <section className="ui-box space-y-3">
          <h2>Делитесь желаниями</h2>
          <p>
            Отправьте друзьям ссылку на вишлист. Они смогут тайно забронировать
            подарок. Вы не увидите, кто и что выбрал.
          </p>
        </section>
        <Link className="ui-btn ui-dark" href="/">
          Смотреть товары
        </Link>
      </div>
    </main>
  );
}
