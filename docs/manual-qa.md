# Ручне тестування

Опис сценаріїв перевірки в Telegram і в браузері після змін у пайплайні або аналітиці. Автотести: `npm run test`.

## Перед перевіркою

1. `npm run app:dev`
2. У `.env`: `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `OPENAI_API_KEY`
3. Для веб: `/login` у боті

Docker і міграції потрібні й для `npm test`.

## Де дивитися результат

| Що | Де |
| --- | --- |
| Статус пайплайну | `/journal/:id`, поле `processing_status` |
| Метрики | деталь запису, `/metrics` |
| Час спостереження | `observed_at`, `metadata_json` |
| Факти профілю | `/profile-facts` |
| Кореляції | Dashboard → **Analyze**, `/correlations` |
| Persona | `npm run persona:analyze -- peanut-rash` → `RESULT: PASS` |

## Витягування метрик (Telegram)

Промпт: `metric-extraction.prompt.md` v2.0.0+.

### ME-01 — Поточний день

**Надіслати:**

> Сьогодні снідав fast food. Почуваю себе на **3 з 5**.

**Очікування:** `fast_food_breakfast` (або подібний) = true; `wellbeing` = 3. Статус перевірки: пройдено.

### ME-02 — Вчора і сьогодні

**Надіслати** повідомлення з бігом «вчора» і залом «сьогодні» + оцінка 4/5.

**Очікування:** різні `observed_at` для подій; без змішування тривалостей між днями.

### ME-03 — Recap на кінець дня

**Надіслати** довгий recap (їжа, робота, дрімоти, pet-проєкт).

**Очікування:** розподіл `narrative_order`, сума дрімот, без «сміттєвих» count-метрик.

## Виправлення метрик (TF-01 … TF-10)

Після зведення бота: змінити значення, дату, додати/видалити, архівувати метрику, reprocess. Сценарії в [telegram-metric-feedback.md](./telegram-metric-feedback.md). Голосове виправлення — не реалізовано.

## Кореляції

Потрібно ≥14 парних календарних днів. Пакет повідомлень днів 26–55: [qa-syndrome-correlation-batch.md](./qa-syndrome-correlation-batch.md). Скрипти: `qa:backfill-entry-dates`, `qa:seed-syndrome-batch`.

## Аналітика (AN-01 … AN-03)

1. Dashboard відкривається, кнопка Analyze працює.
2. Heatmap на `/correlations` з фільтрами.
3. Дисклеймер про причинність відображається.

Деталі тестового корпусу: [syndrome-track-qa.md](./syndrome-track-qa.md).
