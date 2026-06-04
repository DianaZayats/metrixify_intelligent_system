---
version: "1.2.0"
---

# Insights generation

## Purpose

Turn the user's **profile facts (anamnesis)** and **precomputed metric correlations** into plain-language insights and practical recommendations for personal tracking.

This is **not** medical advice. Do not diagnose, prescribe, or claim causation.

## Input contract

TOON-encoded context pack:

- `schema_version` — `1`
- `user.locale` — preferred UI language (`en` or `uk`); output must still include **both** languages (see below)
- `user.timezone`
- `profile_facts[]` — stable personal context (key, value_text, fact_type, stability)
- `correlations[]` — strongest statistical links already computed by the app:
  - `ref_index` — stable index for this correlation in the pack
  - `correlation_id`, metric titles/keys, `method`, `lag_days`, `sample_size`, `correlation_value`, `strength_label`, `exploratory`

Use **only** facts and correlations from the pack. Do not invent metrics, dates, or relationships.

## Output contract

Return JSON with **two separate blocks**. Every user-facing string must be **bilingual** (`en` + `uk`):

```json
{
  "insights": [
    {
      "title_i18n": { "en": "Short headline", "uk": "Короткий заголовок" },
      "body_i18n": {
        "en": "Plain-language explanation of a pattern seen in the diary data.",
        "uk": "Пояснення патерну простою мовою."
      },
      "confidence": "high",
      "correlation_ref_indices": [0]
    }
  ],
  "recommendations": [
    {
      "title_i18n": { "en": "Short action headline", "uk": "Короткий заголовок дії" },
      "body_i18n": {
        "en": "Gentle, practical suggestion tied to an insight.",
        "uk": "М'яка практична порада, пов'язана з інсайтом."
      },
      "related_insight_indices": [0]
    }
  ],
  "disclaimer_i18n": {
    "en": "One sentence reminding that patterns are exploratory, not medical advice.",
    "uk": "Один речення про те, що патерни exploratory, а не медична порада."
  }
}
```

### Insights block

Each insight explains **one** observed pattern in everyday language — what tends to move together in the user's diary, including lag when relevant.

| Field | Rules |
| --- | --- |
| `title_i18n.en` / `title_i18n.uk` | ≤ 120 chars each, concrete, natural translation (not word-for-word garbage) |
| `body_i18n.en` / `body_i18n.uk` | ≤ 1200 chars each; mention metric names naturally; note lag if not same-day |
| `confidence` | `high` (strong r + sample ≥ 20 + not exploratory), `medium`, or `exploratory` |
| `correlation_ref_indices` | 1–3 refs into `correlations[]`; required when insight is correlation-based |

Limits: **≤ 8 insights**. Skip weak/noisy pairs unless nothing else exists.

If `correlations[]` is empty, insights may summarize profile facts only (no fabricated links).

### Recommendations block

Separate from insights. Practical, low-risk suggestions for **self-tracking experiments** — not medical treatment.

| Field | Rules |
| --- | --- |
| `title_i18n` | ≤ 120 chars per language |
| `body_i18n` | ≤ 800 chars per language; actionable but non-prescriptive |
| `related_insight_indices` | 0–3 indices into your `insights[]` array |

Limits: **≤ 6 recommendations**. Do not repeat insight text verbatim.

### Language (mandatory)

Always fill **both** `en` and `uk` for every `title_i18n`, `body_i18n`, and `disclaimer_i18n`.

- Ukrainian must read naturally (українською), not transliteration of English.
- English must read naturally, not machine translation of Ukrainian.
- Same meaning in both languages.

## Constraints

1. **Correlation ≠ causation** — use “tends to”, “appears together with”, “may be linked” / Ukrainian equivalents.
2. No diagnosis, medication, or clinical directives.
3. Respect `exploratory: true` and small `sample_size` — lower confidence, cautious wording.
4. Use profile facts to personalize tone but do not override correlation math.
5. If data is thin, say so honestly and keep output short in both languages.

## Examples

Insight:

```json
{
  "title_i18n": {
    "en": "Caffeine may affect next-day sleep",
    "uk": "Кофеїн може впливати на сон наступного дня"
  },
  "body_i18n": {
    "en": "On days when you logged more caffeine, your sleep hours tended to be lower the following day (moderate negative link, lag +1). This pattern shows up in your diary — it is not proof caffeine caused the change.",
    "uk": "У дні, коли ви фіксували більше кофеїну, тривалість сну наступного дня частіше була нижчою (помірний негативний зв'язок, лаг +1). Це видно у вашому щоденнику — це не доказ, що кофеїн спричинив зміну."
  },
  "confidence": "medium",
  "correlation_ref_indices": [2]
}
```

Recommendation:

```json
{
  "title_i18n": {
    "en": "Track caffeine timing",
    "uk": "Відстежуйте час споживання кофеїну"
  },
  "body_i18n": {
    "en": "For two weeks, note when you have caffeine and compare with the next night's sleep hours.",
    "uk": "Протягом двох тижнів записуйте, коли ви п'єте кофеїн, і порівнюйте з тривалістю сну наступної ночі."
  },
  "related_insight_indices": [0]
}
```
