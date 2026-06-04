# Telegram-бот

Бот — окремий процес `apps/telegram-bot` на [grammY](https://grammy.dev/) з long polling. Це розв’язує навантаження від API і спрощує локальну розробку без webhook.

## Налаштування

1. [@BotFather](https://t.me/BotFather) → `/newbot`.
2. Токен у `.env`:

   ```env
   TELEGRAM_BOT_TOKEN=...
   BACKEND_URL=http://127.0.0.1:3000
   ```

3. `npm run env:setup`, потім `npm run app:dev`.

Опис і короткий «about» бота синхронізуються з коду при старті (`registerBotProfile` у `menu.ts`). За потреби їх можна змінити в BotFather вручну.

## Команда `/start`

Після `/start` бот надсилає стисле брендове зображення, текст привітання та inline-меню:

- Файл: `apps/telegram-bot/assets/intro-start.jpg` (до ліміту Telegram 10 MB)
- Вихідний макет: `brandbook/intro bot image 2.png` — **не** відправляти напряму (великий PNG/GIF Telegram відхиляє)
- Якщо фото недоступне — лише текст

## Меню та команди

Під повідомленням після `/start` або `/help`:

| Кнопка | Дія |
| --- | --- |
| Останні записи | як `/status` |
| Кореляції | топ пар метрик |
| Інсайти | останній знімок AI-звіту |
| Вхід у веб | як `/login` |
| Допомога | як `/help` |
| Мова | як `/language` |

| Команда | Опис |
| --- | --- |
| `/start` | Привітання + меню |
| `/help` | Інструкція |
| `/status` | 5 останніх записів |
| `/correlations` | До 5 кореляцій |
| `/insights` | Звіт (до 3 інсайтів + 2 рекомендації) |
| `/login` | Посилання для веб-входу |

Відповіді форматую HTML. URL-кнопки з’являються лише якщо `FRONTEND_URL` — публічний http(s); `localhost` Telegram у inline-кнопках не приймає — локально користуйтесь `/login` або текстом посилання.

Натискання inline-кнопок **не** створює записів у щоденнику.

## Записи в щоденник

- Текст або **голос** у приватному чаті.
- Голос → Whisper → той самий пайплайн, що й для тексту ([transcription.md](./transcription.md)).
- Групові чати в MVP не підтримуються.

## Виправлення метрик

Після зведення метрик можна писати природною мовою (UA/RU/EN): виправити значення, дату, додати/прибрати спостереження, архівувати метрику, перезапустити витягування. Краще **відповідати** на повідомлення бота зі списком метрик.

Детально: [telegram-metric-feedback.md](./telegram-metric-feedback.md).

Голосові **виправлення** поки не реалізовані — лише нові записи голосом.

## Зв’язок з backend

```http
X-Metrixify-Internal-Key: <INTERNAL_API_KEY або SESSION_SECRET>
```

| Endpoint | Призначення |
| --- | --- |
| `POST /api/internal/telegram/message` | Текст: новий запис або NL-корекція |
| `POST /api/internal/telegram/voice` | Голосовий запис |
| `GET …/status` | `/status` |
| `GET …/correlations` | `/correlations` |
| `GET …/insights` | `/insights` |
| `POST …/login-link` | `/login` |

Вхід у веб: [auth.md](./auth.md).

## Якщо щось не працює

| Симптом | Що перевірити |
| --- | --- |
| Бот одразу падає | `TELEGRAM_BOT_TOKEN` у `.env` |
| Processing failed | Backend на `BACKEND_URL` |
| Помилка транскрипції | `OPENAI_API_KEY`, логи backend |
| ECONNREFUSED ::1:3000 | `BACKEND_URL=http://127.0.0.1:3000` або `npm run env:setup` |
| Запису немає в журналі | `/login` → відкрити посилання → оновити `/journal` |
| Немає фото на `/start` | Наявність `intro-start.jpg`; інакше текстовий fallback |
