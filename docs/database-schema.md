# Схема бази даних

PostgreSQL 16 з розширенням `vector` (pgvector). Джерело правди — [`prisma/schema.prisma`](../prisma/schema.prisma).

## Основні таблиці

| Таблиця | Призначення |
| --- | --- |
| `users` | Користувач; часовий пояс для календарних дат |
| `telegram_accounts` | Зв’язок Telegram ↔ user |
| `sessions` | Сесії веб (хеш токена) |
| `login_tokens` | Одноразові токени входу |
| `diary_entries` | Записи: сирий текст, транскрипт, резюме, статус обробки |
| `entry_sources` | Метадані Telegram (ідемпотентність) |
| `prompt_versions` | Версії промптів для аудиту |
| `ai_runs` | Журнал викликів AI |
| `metric_definitions` | Динамічні визначення метрик користувача |
| `metric_observations` | Значення метрик у часі |
| `profile_facts` | Стабільні факти профілю |
| `profile_fact_evidence` | Докази з тексту записів |
| `memory_chunks` | Фрагменти + опційно embedding |
| `correlation_results` | Кеш кореляцій |
| `processing_jobs` | Черга BullMQ |

## Статуси обробки запису

`received` → `transcribing` → `transcribed` → `summarizing` → `extracting_metrics` → `resolving_schema` → `extracting_facts` → `saving_results` → `completed` (або `failed`).

## Команди

```bash
npm run db:migrate
npm run db:seed
npm run db:studio
```

Усі запити до даних користувача фільтруються по `user_id` з сесії.

## Діаграми для дипломної роботи

| Файл | Зміст |
| --- | --- |
| [`metrixify-dbdiagram.dbml`](./metrixify-dbdiagram.dbml) | Повна модель (17 таблиць) |
| [`metrixify-dbdiagram-thesis.dbml`](./metrixify-dbdiagram-thesis.dbml) | Спрощена (9 таблиць) для рисунка в роботі |

Імпорт у [dbdiagram.io](https://dbdiagram.io/).

## Демо-наповнення для захисту

```bash
npx tsx scripts/demo/seed-diploma-journal.ts
```

Скрипт заповнює журнал сценаріями, близькими до тестових повідомлень з мануалу QA.
