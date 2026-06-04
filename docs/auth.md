# Авторизація в веб-застосунку

У дипломному MVP реалізовано **одноразове посилання з Telegram-бота** замість Telegram Login Widget — це спрощує локальне розгортання без публічного HTTPS. Деталі вимог — у [`технічне-завдання.md`](../технічне-завдання.md), розділ про авторизацію.

## Як це працює

1. Користувач надсилає `/login` у боті або натискає **Вхід у веб** в меню.
2. Backend створює одноразовий токен у `login_tokens` (термін дії 10 хвилин, один раз).
3. Бот відповідає посиланням на фронтенд: `…/auth/telegram-token?token=…` (домен з `FRONTEND_URL` або порту з `.env`).
4. Сторінка `AuthTelegramTokenPage` викликає `POST /api/auth/telegram-token`.
5. Після перевірки токена створюється сесія в `sessions`, у cookie записується `metrixify_session` (httpOnly).
6. Редірект на `/journal`. Усі запити до записів прив’язані до `user_id` з сесії.

## Безпека

| Властивість | Реалізація |
| --- | --- |
| Термін токена входу | 10 хвилин |
| Зберігання токена | лише SHA-256 хеш (+ `SESSION_SECRET` як pepper) |
| Одноразовість | `login_tokens.consumed_at` при обміні |
| Cookie сесії | `httpOnly`, `sameSite: lax` |
| Secure у prod | `secure: true` лише в production |
| Захист API | `requireSession` на `GET /api/entries*` |

Публічні маршрути: `GET /api/system/*`, `POST/GET /api/auth/*` (крім `GET /api/auth/me`), внутрішні `POST /api/internal/*` з ключем.

## Змінні середовища

| Змінна | Навіщо |
| --- | --- |
| `SESSION_SECRET` | Підпис cookie та хеш токенів (у prod ≥ 32 символів; локально генерує `env:setup`) |
| `FRONTEND_URL` | База посилання для входу (за замовчуванням `http://localhost:5173`) |
| `INTERNAL_API_KEY` | Бот → backend; у dev може збігатися з `SESSION_SECRET` |

## REST API

| Метод | Шлях | Опис |
| --- | --- | --- |
| `POST` | `/api/auth/telegram-token` | Тіло `{ "token": "..." }` — встановлює cookie |
| `GET` | `/api/auth/me` | Поточний користувач за cookie |
| `POST` | `/api/auth/logout` | Завершення сесії |

## Внутрішній API (для бота)

| Метод | Шлях | Опис |
| --- | --- | --- |
| `POST` | `/api/internal/telegram/login-link` | `telegramUserId` → `{ loginUrl, expiresAt }` |

Заголовок: `X-Metrixify-Internal-Key`.

## Фронтенд

| Маршрут | Призначення |
| --- | --- |
| `/login` | Підказка: отримати посилання в Telegram |
| `/auth/telegram-token?token=` | Обмін токена, редірект у журнал |
| `/journal`, `/journal/:id` | Захищені маршрути (guard + `refreshSession`) |

Сховище: `apps/frontend/src/stores/auth.ts`. Запити з `credentials: 'include'`.

Після виходу — `/login?signedOut=1`.

## Обліковий запис

На сторінці `/account` реалізовано:

| Метод | Шлях | Опис |
| --- | --- | --- |
| `PATCH` | `/api/user/locale` | `en` або `uk` |
| `POST` | `/api/user/delete-data` | Видалення даних користувача (`confirmation: "DELETE"`) |
| `GET` | `/api/user/export` | Експорт `json` або `xlsx` |

## Де шукати в коді

- `apps/backend/src/modules/auth/`
- `apps/backend/src/shared/hooks/session-auth.hook.ts`
- `apps/backend/src/shared/lib/token-crypto.ts`

Тести: `apps/backend/src/modules/auth/auth.integration.test.ts`.
