# Транскрипція голосових повідомлень

Голосові повідомлення в Telegram обробляються через OpenAI Whisper у тому ж запиті ingest, що й текст (для MVP без окремої черги).

## Послідовність

1. Користувач надсилає voice у приватному чаті.
2. Бот → `POST /api/internal/telegram/voice` (`fileId`, тривалість).
3. Створюється `diary_entries` (`sourceType: voice`, `transcribing`).
4. Backend завантажує `.ogg` з Telegram API у тимчасову папку.
5. `whisper-1` (або `OPENAI_TRANSCRIPTION_MODEL`) → текст.
6. Успіх: `rawText`, `transcriptText`, статус `transcribed`, запис у `ai_runs`.
7. Помилка: `failed`, `processingError`.

Далі — той самий ланцюжок, що для тексту (резюме → метрики → …).

## Конфігурація

```env
OPENAI_API_KEY=sk-...
OPENAI_TRANSCRIPTION_MODEL=whisper-1
TELEGRAM_BOT_TOKEN=...
```

## API (внутрішній)

```http
POST /api/internal/telegram/voice
X-Metrixify-Internal-Key: <key>
```

Відповідь: `{ entryId, created, transcribed }`.

У журналі в API видно `transcriptText`.

## Тести

Моки OpenAI — без живих викликів у CI.

## Пов’язано

- [telegram-bot.md](./telegram-bot.md)
- [summary.md](./summary.md)
