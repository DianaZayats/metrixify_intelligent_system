# Metrixify

**Metrixify** — персональний інтелектуальний щоденник (кваліфікаційна робота). Користувач надсилає текст або голос у Telegram-бот, система будує резюме, витягує метрики та факти профілю, а в веб-інтерфейсі доступні журнал, динаміка та кореляції між показниками.

Повне технічне завдання: [`технічне-завдання.md`](технічне-завдання.md).

## Що потрібно для запуску

- [Node.js](https://nodejs.org/) 22+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

## Швидкий старт (Windows)

1. Клонуйте репозиторій і відкрийте термінал у папці проєкту.

2. Налаштуйте змінні середовища:

   ```powershell
   copy .env.example .env
   npm run env:setup
   ```

   `env:setup` створює `.env`, якщо його ще немає, і генерує `SESSION_SECRET` для локальної розробки.

   `SESSION_SECRET` — секрет сервера для підпису cookie та хешування токенів входу. Це **не** одноразове посилання з `/login` у Telegram. У продакшені секрет потрібно задати вручну (мінімум 32 символи).

   `TELEGRAM_BOT_TOKEN` обов’язковий для бота. `OPENAI_API_KEY` потрібен для голосу, резюме та витягування метрик.

3. Встановіть залежності:

   ```powershell
   npm install
   ```

4. Підніміть інфраструктуру та застосуйте міграції:

   ```powershell
   npm run docker:up
   npm run db:generate
   npm run db:migrate:deploy
   npm run db:seed
   ```

5. Запустіть увесь стек:

   ```powershell
   npm run app:dev
   ```

6. Відкрийте в браузері:

   - Фронтенд: http://localhost:5173
   - Журнал (після входу): http://localhost:5173/journal
   - Health API: http://localhost:3000/api/system/health

## Telegram-бот

1. Створіть бота через [@BotFather](https://t.me/BotFather) (`/newbot`).
2. Додайте токен у `.env` як `TELEGRAM_BOT_TOKEN`.
3. Перезапустіть `npm run app:dev`.
4. У приватному чаті надішліть `/start`, потім текстове повідомлення — з’явиться запис у щоденнику.

Деталі: [docs/telegram-bot.md](docs/telegram-bot.md).

## Вхід у веб-застосунок

Журнал прив’язаний до користувача. Вхід реалізовано без Telegram Login Widget — через одноразове посилання з бота:

1. У Telegram: **Вхід у веб** або `/login`.
2. Відкрийте посилання (діє 10 хвилин, одноразове).
3. Потрапите в журнал; вихід — кнопка **Sign out**.

Деталі: [docs/auth.md](docs/auth.md).

## Структура репозиторію

```text
apps/
  backend/       REST API (Fastify)
  frontend/      Vue 3 + Vite
  worker/        BullMQ (заглушка)
  telegram-bot/  Бот (grammY, long polling)
packages/
  config/              Конфігурація (Zod)
  shared-types/        Спільні типи
  llm-payload-codec/   JSON → TOON для LLM
  analytics-core/      Математика кореляцій
prisma/                Схема БД, міграції, seed
docs/                  Документація проєкту
```

## Корисні команди

| Команда | Опис |
| --- | --- |
| `npm run env:setup` | `.env` + `SESSION_SECRET` для dev |
| `npm run app:dev` | Docker + backend + bot + frontend |
| `npm run docker:down` | Зупинити контейнери |
| `npm run test` | Тести (інтеграційні потребують Docker і міграцій) |
| `npm run db:migrate` | Міграція в dev |
| `npm run db:seed` | Демо-дані |

## Документація

| Тема | Файл |
| --- | --- |
| Технічне завдання | [технічне-завдання.md](технічне-завдання.md) |
| План і хронологія розробки | [docs/план-розробки.md](docs/план-розробки.md), [docs/щоденник-розробки.md](docs/щоденник-розробки.md) |
| Авторизація | [docs/auth.md](docs/auth.md) |
| Telegram-бот | [docs/telegram-bot.md](docs/telegram-bot.md) |
| Виправлення метрик у боті | [docs/telegram-metric-feedback.md](docs/telegram-metric-feedback.md) |
| Резюме запису | [docs/summary.md](docs/summary.md) |
| Транскрипція голосу | [docs/transcription.md](docs/transcription.md) |
| Витягування метрик | [docs/metric-extraction.md](docs/metric-extraction.md) |
| Узгодження схеми метрик | [docs/metric-schema-resolving.md](docs/metric-schema-resolving.md) |
| Факти профілю | [docs/profile-facts.md](docs/profile-facts.md) |
| Аналітика та кореляції | [docs/analytics.md](docs/analytics.md) |
| База даних | [docs/database-schema.md](docs/database-schema.md) |
| Дизайн-система | [docs/design-system.md](docs/design-system.md) |
| Локалізація UI | [docs/i18n.md](docs/i18n.md) |
| Ручне тестування | [docs/manual-qa.md](docs/manual-qa.md) |
| Відомі обмеження | [docs/відомі-обмеження.md](docs/відомі-обмеження.md) |

## Типові проблеми

**Docker не запущений** — увімкніть Docker Desktop, дочекайтесь «running», знову `npm run docker:up`.

**Порт Redis зайнятий** — у `.env.example` за замовчуванням **6380**. У `.env`:

```env
REDIS_PORT=6380
REDIS_URL=redis://localhost:6380
```

**Помилка міграції** — скиньте локальну БД:

```powershell
npm run db:reset
```

**Фронтенд: Backend unavailable / ECONNREFUSED ::1:3000** — на Windows `localhost` інколи йде на IPv6. Запустіть `npm run env:setup` (підставить `127.0.0.1`) і перезапустіть `npm run app:dev`.

**Health: database error** — після старту Postgres: `npm run db:migrate:deploy`.

## Кваліфікаційна робота

Виконавець: Діана-Марія Заяць, група МІТ-41, ФІТ, КНУ ім. Тараса Шевченка.
