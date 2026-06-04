# Резюме запису (AI)

Після збереження тексту (або транскрипту голосу) backend формує коротке резюме запису в поле `summary_text`.

## Послідовність

1. Статус запису: `received` або `transcribed` → `summarizing`.
2. У контекст для моделі потрапляють поточний запис, часовий пояс користувача, слабка підказка `preferred_locale` і резюме **останніх 5** записів (не вся історія).
3. Мова резюме збігається з мовою тексту запису (український вхід → український вихід).
4. Контекст кодується в TOON (`@metrixify/llm-payload-codec`), промпт — `entry-summary.prompt.md`.
5. Відповідь валідується Zod; результат зберігається.
6. Далі пайплайн переходить до витягування метрик (`extracting_metrics`).
7. У `ai_runs` логується `runType: summary`.

## Конфігурація

```env
OPENAI_API_KEY=sk-...
OPENAI_SUMMARY_MODEL=gpt-4o-mini
```

## Промпт і тести

- Файл: `apps/backend/src/ai/prompts/entry-summary.prompt.md`
- Версія — у frontmatter і в `ai_runs.prompt_version`
- Фікстури: `apps/backend/src/ai/prompts/__fixtures__/entry-summary/`

Тести: contract + `summary.service.test.ts` + інтеграція ingest з моком OpenAI.

## Пов’язано

- [transcription.md](./transcription.md) — передумова для голосу
- [metric-extraction.md](./metric-extraction.md) — наступний крок пайплайну
