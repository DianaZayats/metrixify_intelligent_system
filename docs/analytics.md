# Аналітика та кореляції

Один із головних результатів системи — виявлення зв’язків між метриками в часі. Реалізовано щоденну агрегацію спостережень, Pearson/Spearman з лагом −1/0/+1 день і веб-інтерфейс з тепловою картою.

## Що входить

1. **Агрегація по днях** (календарний день у TZ користувача)
2. **Кореляції** — Pearson, Spearman; лаг 0, −1, +1
3. **Мінімум даних** — ≥ 14 парних днів для розрахунку
4. **Кеш** у `correlation_results`
5. **Перерахунок** — кнопка Analyze → `POST /api/analytics/recalculate`
6. **UI** — Dashboard `/`, сторінка `/correlations`, деталі пари
7. **Дисклеймер** — кореляція ≠ причинність; аналіз на **денних** агрегатах

## Правила агрегації

| `value_type` | Правило |
| --- | --- |
| `ordinal` | Середнє |
| `number` | Сума |
| `boolean` | Будь-яке `true` за день |

Обмеження: втрачається порядок подій протягом дня — відображається дисклеймер у UI.

## Пакети та API

```text
packages/analytics-core/
apps/backend/src/modules/analytics/
```

| Метод | Шлях |
| --- | --- |
| GET | `/api/analytics/dashboard` |
| GET | `/api/analytics/correlations` |
| GET | `/api/analytics/correlations/:id` |
| POST | `/api/analytics/recalculate` |

Заголовки метрик локалізуються через `resolveRequestLocale`.

## Інтерфейс

- **Dashboard** — активність за 7 днів, топ кореляцій, фрагмент журналу
- **Correlations** — heatmap, таблиця, фільтри method/lag
- **Деталь** — scatter, порівняння рядів, приклади записів (ECharts + токени дизайн-системи)

## Інтерпретація вибірки

| Парних днів | Сенс |
| --- | --- |
| 14–19 | обережно |
| 20–39 | помірна надійність |
| 40+ | стабільніше |

14 — поріг **обчислення**, не медичний діагноз.

Сила зв’язку: `negligible` | `weak` | `moderate` | `strong` за |r|.

## Перевірка на синтетичних даних

CLI `persona:generate` / `persona:analyze` — див. [persona-fixtures.md](./persona-fixtures.md). На референсному persona `peanut-rash` при ручній перевірці зафіксовано r≈0.67, n=30.

## Тестовий корпус для кореляцій

Для перевірки підготовлено 30+ днів повідомлень (stress/sleep/симптоми). Після seed:

1. `npm run qa:backfill-entry-dates`
2. За потреби `npm run qa:seed-syndrome-batch`
3. У Dashboard натиснути **Analyze** (автоматично не рахується)
4. `/correlations` — режим «усі лаги (найкращий)»

Тексти повідомлень: [qa-syndrome-correlation-batch.md](./qa-syndrome-correlation-batch.md).

## Поза scope MVP

- Медичні рекомендації
- Каузальні моделі
- Автоматичний LLM-insights (заготовка в боті `/insights` — окремий модуль)

## Пов’язано

- [metric-extraction.md](./metric-extraction.md)
- [design-system.md](./design-system.md)
