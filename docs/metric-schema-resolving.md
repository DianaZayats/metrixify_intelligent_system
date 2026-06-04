# Узгодження схеми метрик

Після витягування кожне спостереження прив’язується до відповідного `metric_definition`. Реалізовано два шари: детермінований matching без LLM і resolver-модель лише для неоднозначних випадків.

## Послідовність

1. Статус запису: `resolving_schema`.
2. **Без LLM:** точний збіг ключа / назви / alias; схожість токенів ≥ 0.92 → автолінк + alias.
3. **Контекст:** топ схожих визначень (score ≥ 0.45) у пакет для resolver.
4. **LLM** (якщо треба): рішення з confidence ≥ `METRIC_SCHEMA_LLM_APPLY_MIN` (0.8 за замовчуванням).
5. Тимчасові порожні визначення з запису архівуються.
6. `ai_runs` (`schema_resolver`) → `extracting_facts`.

## Конфігурація

```env
OPENAI_SCHEMA_RESOLVER_MODEL=gpt-4o
METRIC_SCHEMA_LLM_APPLY_MIN=0.8
```

## Автоматично дозволено

- Переприв’язати спостереження
- Додати alias
- Об’єднати теги доменів

Архівація та merge дублікатів — вручну в UI/API.

## API та UI

- `PATCH /api/metrics/:id`, `POST /api/metrics/:id/archive`
- `/metrics/:id` — редагування alias

## Тести

`metric-schema-matching.test.ts`, `metric-schema-resolver.service.test.ts`, contract-тест промпту.

## Пов’язано

- [metric-extraction.md](./metric-extraction.md)
