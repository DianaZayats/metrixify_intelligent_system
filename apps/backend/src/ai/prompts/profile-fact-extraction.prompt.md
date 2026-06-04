---
version: "1.1.0"
---

# Profile fact extraction

## Purpose

Extract **stable personal context** about the user from a diary entry. Profile facts are long-lived anamnesis — job, habits, goals, constraints — not day-to-day mood or metrics.

**Save only:** `stable` or `evolving` facts with clear evidence in the entry text.

**Do not save:** temporary states (mood today, anxiety today, tired today) — those belong in metrics/entries.

## Input contract

TOON-encoded context pack:

- `schema_version` — `1`
- `entry.id`, `entry.entry_date`, `entry.recorded_at`
- `entry.text` — raw message or voice transcript
- `entry.summary` — optional short summary
- `entry.source_type`
- `user.timezone`
- `existing_profile_facts` — active facts (key, value_text, fact_type, stability)

When a fact already exists, prefer `update_fact` or `add_fact_evidence` over `create_fact`.

## Output contract

Return JSON:

```json
{
  "facts": [
    {
      "key": "job_title",
      "value_text": "Works as a software developer",
      "fact_type": "work",
      "stability": "stable",
      "evidence_text": "работаю разработчиком",
      "confidence": 0.92,
      "reasoning": "Explicit stable employment statement",
      "operation": "create_fact"
    }
  ]
}
```

### Fields

| Field | Rules |
| --- | --- |
| `key` | snake_case, reusable identifier (e.g. `job_title`, `pet_project_habit`) |
| `value_text` | Human-readable fact in neutral third person (English canonical) |
| `value_i18n` | `{ "en": "...", "uk": "..." }` — bilingual display; `en` must match `value_text` |
| `fact_type` | One of: `work`, `health_context`, `routine`, `preference`, `habit`, `goal`, `constraint`, `personal_context` |
| `stability` | `stable` \| `evolving` \| `temporary` — backend drops `temporary` |
| `evidence_text` | Short **exact substring** from `entry.text` (case may differ) |
| `confidence` | 0–1; backend skips below 0.7 |
| `operation` | `create_fact` \| `update_fact` \| `add_fact_evidence` \| `skip` |

Limits: **≤ 10 facts** per entry.

## Constraints

1. Never invent facts not supported by `entry.text`.
2. `evidence_text` must appear verbatim in the entry (backend validates substring).
3. Mood, sleep quality, anxiety, energy for **today** → use `skip` (metrics handle these).
4. Prefer updating an existing key when meaning is the same.
5. One key per distinct stable fact; do not duplicate synonyms as separate keys.

## Examples

### Stable work fact

Entry: «Працюю розробником у продуктовій компанії.»

```json
{
  "key": "job_title",
  "value_text": "Works as a software developer at a product company",
  "fact_type": "work",
  "stability": "stable",
  "evidence_text": "працюю розробником",
  "confidence": 0.9,
  "reasoning": "Explicit job statement",
  "operation": "create_fact"
}
```

### Temporary state — skip

Entry: «Сегодня тревожно, настроение на нуле.»

→ No profile facts (mood is temporary; metrics capture wellbeing).

### Evolving habit

Entry: «Вечерами работаю над pet-проектом, уже месяц держусь.»

```json
{
  "key": "pet_project_evening_habit",
  "value_text": "Works on a personal pet project in the evenings",
  "fact_type": "habit",
  "stability": "evolving",
  "evidence_text": "работаю над pet-проектом",
  "confidence": 0.85,
  "reasoning": "Recurring personal project habit",
  "operation": "create_fact"
}
```

## Changelog

### 1.0.0

- Initial profile fact extraction prompt for Stage 8 MVP.
