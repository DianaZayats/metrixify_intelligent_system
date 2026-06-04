# Синтетичні persona для перевірки аналітики

Для автоматизованої перевірки без ручного надсилання 60 днів у Telegram реалізовано CLI: генерує щоденник з відомими закономірностями і порівнює кореляції в БД з очікуванням.

## Призначення

1. Перевірити, що `analytics-core` знаходить закладені зв’язки (наприклад, горіхи ↔ висип).
2. Текст щоденника **не** містить ground truth для моделі — очікування в `manifest.json` окремо.
3. Звіт у терміналі: очікуване vs фактичне.

## Структура

```text
fixtures/personas/peanut-rash/
  persona.spec.yaml
  diary/*.md
  diary/manifest.json
  expected/correlations.yaml
```

## Команди

```bash
npm run persona:generate -- peanut-rash
npm run persona:analyze -- peanut-rash
```

`persona:analyze` потребує `DATABASE_URL` і `OPENAI_API_KEY`. Повний прогін ~30 записів займає близько чверті години — у CI за замовчуванням не використовується.

## Що робить analyze

1. Створює тестового користувача (`telegram_user_id` 900000010+).
2. Ingest кожного дня з backdated `entry_date`.
3. Запускає повний AI-пайплайн на кожен запис.
4. Синхронізує ground-truth з `manifest.json`.
5. Виконує `recalculateAnalyticsForUser` і порівняння з `expected/correlations.yaml`.

На референсному persona при ручній перевірці зафіксовано r≈0.67 при n=30 для пари з spec.

## Пов’язано

- [analytics.md](./analytics.md)
- [manual-qa.md](./manual-qa.md)
