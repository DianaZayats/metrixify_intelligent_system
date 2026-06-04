# Дизайн-система Metrixify

UI побудовано за brandbook **AI Diary Bot**: м’який лавандовий фон, фіолетові акценти, великі радіуси. Джерело токенів — [`packages/design-tokens/tokens.json`](../packages/design-tokens/tokens.json); макети та логотип — [`brandbook/`](../brandbook/).

## Принципи

1. Світла тема, фон сторінки `#F5F2FF` (Pale Mist).
2. Акцентні кнопки — Accent Purple `#7E67CC`.
3. Тіні з лавандовим відтінком замість жорстких рамок.
4. Pill-кнопки, радіуси карток 16–48px.
5. Шрифт **Inter** (збережено з ранньої версії UI).
6. Ключі метрик і коди — англійською; підписи в UI — EN/UK через i18n.

Після зміни `tokens.json`:

```bash
npm run build -w @metrixify/design-tokens
```

CSS: `apps/frontend/src/styles/tokens.css`.

## Палітра (основне)

| Назва | Hex | Використання |
| --- | --- | --- |
| Pale Mist | `#F5F2FF` | Фон сторінки |
| Light Lavender | `#D9CFFD` | Картки, бордери |
| Accent Purple | `#7E67CC` | Primary, CTA |
| Night Violet | `#2B2948` | Темні блоки, heatmap |
| Deep Curve | `#171827` | Заголовки |

Семантика: `--color-positive`, `--color-warning`, `--color-negative`, кольори кореляцій, теги метрик (`--color-tag-sleep`, mood, …).

## Компоненти

`AppShell`, `Button`, `Card`, `Badge`, `DataTable`, стани loading/empty/error — у `apps/frontend/src/components/ui/`.

Для перевірки верстки є dev-сторінка `/design-system` (можна вимкнути перед продакшеном).

## Верстка

- Макс. ширина контенту 1200px
- Від 320px (мобільний)
- Breakpoints: 480, 768, 1024px

## Пов’язано

- [i18n.md](./i18n.md)
