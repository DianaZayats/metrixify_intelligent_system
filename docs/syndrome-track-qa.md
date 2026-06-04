# Тестовий корпус «синдром-трек»

Для перевірки кореляцій підготовлено довгу серію записів з повторюваними метриками: **25 днів** (заголовок `День N (YYYY-MM-DD)`) і опційний **batch 26–55**.

## Зміни в коді під цей корпус

- Промпт витягування **v2.0.0** (чеклист, алкоголь/їжа окремо, анти-галюцинації сну).
- Парсер дати з заголовка `entry-date.ts`, backfill `qa:backfill-entry-dates`.
- Постобробка рейтингів, інтенсивності, stress remap, реактивація архівних метрик.

## Скрипти

| Команда | Дія |
| --- | --- |
| `npm run qa:audit-syndrome` | Звіт по всіх «День N» |
| `npm run qa:reprocess-syndrome` | Перезапуск пайплайну |
| `npm run qa:backfill-entry-dates` | Виправити `entryDate` з заголовка |
| `npm run qa:generate-syndrome-batch` | Згенерувати дні 26–55 |
| `npm run qa:seed-syndrome-batch` | Прогнати batch через ingest |

Код: `scripts/qa/`, фікстури: `fixtures/personas/qa-syndrome-correlation/`.

## Важливо для кореляцій

- Аналітика використовує **денні** агрегати по `observedAt`.
- Після seed потрібно натиснути **Analyze** на dashboard.
- Офіційний рівень — від 14 парних днів; на короткій історії будуть лише exploratory пари.

Тексти для копіювання в Telegram: [qa-syndrome-correlation-batch.md](./qa-syndrome-correlation-batch.md).
