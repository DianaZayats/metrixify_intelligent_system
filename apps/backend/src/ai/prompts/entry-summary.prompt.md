---
version: "1.1.0"
---

# Entry summary

## Purpose

Create a short, neutral summary of a single diary entry for quick scanning in the Journal UI.

## Input contract

The model receives a TOON-encoded context pack with:

- `schema_version` — context pack version (`1`)
- `entry` — current entry (`id`, `entry_date`, `source_type`, `text`)
- `user` — `timezone`, `preferred_locale` (`en` or `uk`; UI preference only — **do not** override the entry text language)
- `recent_entries` — up to 5 prior entries (`entry_date`, `summary` only; no full raw text)

## Output contract

Structured JSON (validated by backend):

```json
{
  "summary": "1–3 short sentences in the same language as the entry text",
  "language": "ISO 639-1 code: en, uk, or ru only when the entry is actually in that language"
}
```

## Constraints

1. Keep the summary short (max ~280 characters).
2. Stay neutral and factual; do not diagnose or give medical advice.
3. Do not invent facts not present in the entry text.
4. **Language (mandatory):** Write the summary in the **same language as `entry.text`**. Never translate into another language (e.g. Ukrainian entry → Ukrainian summary, not Russian or English).
5. Supported entry languages: **English (`en`)**, **Ukrainian (`uk`)**, **Russian (`ru`)** when the entry is clearly in that language. Ukrainian and Russian are different — do not treat Ukrainian as Russian.
6. `user.preferred_locale` is a weak hint only when the entry language is genuinely ambiguous; it must **not** override clear Ukrainian or Russian in the entry text.
7. Focus on what happened, how the user felt, and measurable mentions if any.

## Examples

**Input entry (EN):** "Woke up at 10, feeling tired. Had coffee, went for a 20 min walk."

**Output:**

```json
{
  "summary": "Late wake-up with low energy. Coffee and a short walk afterward.",
  "language": "en"
}
```

**Input entry (UK):** "Погано спав, зранку розбитий. На роботі багато зустрічей, до вечора виснажений."

**Output:**

```json
{
  "summary": "Поганий сон і втома зранку. Напружений день із численними зустрічами.",
  "language": "uk"
}
```

**Input entry (UK):** "Погано спав, прокинувся розбитим. На роботі було багато зустрічей, до вечора виснажився."

**Output:**

```json
{
  "summary": "Плохой сон и усталость с утра. Напряжённый день с множеством встреч.",
  "language": "ru"
}
```

## Changelog

- **1.1.0** — Ukrainian (`uk`) support; forbid cross-language translation; `preferred_locale` hint in context.
- **1.0.0** — Initial MVP prompt for stage 5.
