# Факти профілю (анамнез)

Окремий шар від «метрик дня»: стабільний контекст (робота, звички, цілі, обмеження). Настрій «сьогодні» лишається в метриках, не в профілі.

## Місце в пайплайні

```text
summary → extracting_metrics → resolving_schema → extracting_facts → completed
```

## Витягування

- Промпт: `profile-fact-extraction.prompt.md` (v1.0.0)
- Модель: `OPENAI_FACT_EXTRACTION_MODEL` (за замовчуванням `gpt-4o-mini`)

### Фільтри перед збереженням

| Умова | Дія |
| --- | --- |
| `stability === temporary` | не зберігати |
| `confidence < 0.7` | не зберігати |
| `evidence_text` не в тексті запису | не зберігати |
| дубль `user_id + key` | оновити або додати evidence |

Значення в `value_json` як `{ "text": "..." }`.

## Контекст для інших кроків

Активні факти (до 20) потрапляють у пакет витягування метрик і резюме. При витягуванні фактів — до 30 з типом і stability.

## API

| Метод | Шлях |
| --- | --- |
| GET | `/api/profile-facts` |
| PATCH | `/api/profile-facts/:id` |
| POST | `/api/profile-facts/:id/archive` |

## UI `/profile-facts`

Картки з міткою надійності:

| Мітка | Умова |
| --- | --- |
| **Likely fact** | confidence ≥ 0.85 і ≥ 2 докази |
| **Hypothesis** | інакше |

Логіка: `classifyProfileFactReliability()` у `@metrixify/shared-types`.

## Код

`apps/backend/src/modules/profile-facts/`

## Пов’язано

- [metric-extraction.md](./metric-extraction.md)
- [i18n.md](./i18n.md)
