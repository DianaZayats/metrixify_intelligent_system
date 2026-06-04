# Витягування метрик

Після резюме запис переходить у статус `extracting_metrics`. Модель отримує **сирий текст / транскрипт** (без резюме), список наявних визначень метрик і повертає кандидатів у JSON. Далі спрацьовує детермінована постобробка на backend — без другого виклику LLM.

## Кроки пайплайну

1. Контекст у TOON: текст запису, `recorded_at`, існуючі `metric_definitions` (з тегами).
2. OpenAI Structured Outputs → кандидати з тегами доменів життя.
3. Постобробка: рейтинги, тривалості, обмеження впевненості, нормалізація, дати спостереження.
4. Для кожного ключа: знайти або створити визначення (`ensureMetricDefinitionForCandidate`), при архіві — реактивувати.
5. Записати `metric_observations`, залогувати `ai_runs`.
6. Навіть при нуль метриках — перехід до `resolving_schema`.

## Конфігурація

```env
OPENAI_API_KEY=sk-...
OPENAI_EXTRACTION_MODEL=gpt-4o-mini
```

Промпт: `metric-extraction.prompt.md`, поточна версія **v2.0.0** (максимальний recall для коротких щоденних записів, анти-«галюцинації» сну, заголовок `observed_date`).

## Схема для OpenAI

Strict JSON Schema не приймає Zod `.optional()` і `z.record()`. Тому:

- `metricExtractionAiOutputSchema` — для API (усі поля required, `uk` nullable)
- `metricExtractionOutputSchema` — м’якша валідація для фікстур

## Двомовні назви (з етапу локалізації)

AI повертає `title_i18n`, `tag_entries`. При збігу ключа з існуючим визначенням викликається `syncDefinitionDisplayFromCandidate()` — інакше в UI лишався англійський заголовок зі старих рядків.

## Поля часової лінії

- `observed_at`, `observed_at_precision`, `narrative_order`, опційно `observed_date`
- «Вчора» + «сьогодні» в одному повідомленні — **не** recap; `narrative_order` скидається, дати з `observed_date`
- Recap на кінець дня — LLM задає порядок подій; backend розкладає між 07:00 і `recorded_at` у TZ користувача

Типи значень з AI: `number`, `ordinal`, `boolean` (без `category`).

## Модулі постобробки

| Модуль | Роль |
| --- | --- |
| `metric-rating-parse` | «3 з 5», шкали /10 |
| `metric-intensity-parse` | Лексика інтенсивності UA/RU |
| `metric-count-parse` | Явні кількості («2 чашки») |
| `metric-duration-parse` | Хвилини/години з evidence; сума повторів |
| `metric-inference-cap` | Стеля confidence 0.75 для inferred ordinal |
| `metric-candidate-align` | Підгонка під scale визначення |
| `metric-candidate-normalize` | Дедуп, nap/productivity, cross-day, анти-hallucination |
| `metric-observed-at` | Фінальний `observed_at` |

## Дата з заголовка «День N (YYYY-MM-DD)»

Парсер у `entry-date.ts` при ingest (текст і голос після транскрипції). Backfill старих записів:

```bash
npm run qa:backfill-entry-dates -- [telegramUserId]
```

Скрипти для тестового корпусу «синдром-трек»: `qa:audit-syndrome`, `qa:reprocess-syndrome`, `qa:seed-syndrome-batch` — див. [manual-qa.md](./manual-qa.md).

## API та UI

- `GET /api/metrics`, `GET /api/metrics/observations`, `GET /api/metrics/:id`
- `/metrics`, `/metrics/:id`, метрики на сторінці запису

**Теги** — домени життя; **value_type** — як зберігається число.

## Відмінність від узгодження схеми

На цьому кроці — точний match по `key`. Дублікати та alias об’єднуються на наступному кроці: [metric-schema-resolving.md](./metric-schema-resolving.md).

## Тести

Contract + unit-тести на кожен модуль постобробки + інтеграція ingest з моком OpenAI.

## Пов’язано

- [summary.md](./summary.md)
- [telegram-metric-feedback.md](./telegram-metric-feedback.md)
- [відомі-обмеження.md](./відомі-обмеження.md)
