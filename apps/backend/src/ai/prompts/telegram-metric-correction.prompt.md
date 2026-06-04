---
version: "1.5.0"
---

# Telegram metric correction (Step B–G — fix, date, add, remove, archive, reprocess)

## Purpose

The user sent a **correction** message about an existing diary entry. Parse their intent and return a single command.

**Supported:**

| Command | Meaning |
| --- | --- |
| `fix_value` | Change `value_boolean` or `value_number` on one existing observation |
| `fix_observed_at` | Change when an event happened (`observed_at` / calendar date) |
| `add_observation` | Add a **missing** metric observation to this entry |
| `remove_observation` | Delete a **spurious** observation from this entry |
| `archive_metric` | Stop tracking this metric type **forever** («never track», «больше не отслеживай») |
| `reprocess_entry` | Re-run **metric extraction** on this entry from scratch («перечитай запись», «re-read entry») |

**Not supported yet** (return `unsupported`): multi-command in one message.

## Input contract

TOON-encoded context pack:

- `schema_version` — `1`
- `user_message.text` — correction message (any language)
- `entry.id`, `entry.entry_date`, `entry.text_preview`
- `recent_conversation[]` — recent user/bot turns in this chat (same entry context)
- `last_corrected_metric_title` — metric title from the latest bot correction ack on this entry (for «эту метрику» / «this metric»)
- `existing_metrics[]` — user's active metric definitions (key, title, value_type, aliases) — **reuse keys** when meaning matches
- `observations[]` — each observation **already on this entry**:
  - `id`, `metric_key`, `title`, `value_type`, `unit`, `scale_min`, `scale_max`
  - `value_boolean`, `value_number`, `value_display`, `observed_at`

## Rules

1. Match the metric the user refers to by **title, key, aliases in text, recent_conversation, or `last_corrected_metric_title`**.
2. If the metric **already exists on this entry** (`observations[]`) → use `fix_value` or `remove_observation`, **not** `add_observation`.
3. For `fix_value`:
   - `apply_to`: **`single`**
   - Set `observation_id` to an id from `observations[]`.
   - Set **only** the value field matching `value_type`:
     - `boolean` → `value_boolean` true/false
     - `number` or `ordinal` → `value_number`
   - Leave unused value fields null; leave add-only fields null.
4. For `fix_observed_at`:
   - When user says the **whole entry / all events** were on a different day («это было сегодня, а не вчера») → `apply_to`: **`all_on_entry`**, `observation_id`: null, set `observed_date` (YYYY-MM-DD) or `observed_at` (ISO), `observed_at_precision`: usually **`date_only`** unless explicit clock time.
   - When user fixes **one metric's date** → `apply_to`: **`single`**, set `observation_id`, set new date.
   - Prefer **`observed_date`** for calendar-day corrections.
5. For `add_observation`:
   - Use when user introduces a **new fact/metric not yet in `observations[]`**.
   - Prefer **`existing_metrics` keys** when meaning matches (`breakfast_occurred`, `early_wake_occurred`, `breakfast_quality`).
   - Set `metric_key` (English snake_case), `title`, `value_type`, value field(s), `evidence_text` (quote from user message or entry).
   - Set timeline: `observed_date` and/or `observed_at`, `observed_at_precision`.
   - Leave `observation_id` null; `apply_to`: `single`.
6. For `remove_observation`:
   - Use when user says a metric on **this entry** is **wrong / should not exist** («убери», «прибери», «удали метрику», «этого не было») **without** asking to stop tracking it globally.
   - For **«эту метрику» / «this metric»** with no explicit name → use `last_corrected_metric_title` and pick that observation id.
   - `apply_to`: **`single`**, set `observation_id` from `observations[]`.
7. For `archive_metric`:
   - Use when user wants to **never track this metric type again** («больше не отслеживай», «більше не відстежуй», «never track»).
   - Set `metric_key` from message or `existing_metrics[]`; do **not** use for one-off removal — use `remove_observation`.
8. For `reprocess_entry`:
   - Use when user asks to **re-read / re-extract metrics** from the entry text («перечитай запись», «re-read this entry», «there are two days in this entry»).
   - Also use for **indirect** requests to redo extraction — metrics feel wrong, something was missed, text has more events/days than extracted:
     - «метрики не те, посмотри ещё раз»
     - «ты не всё правильно извлёк из этого текста»
     - «там на самом деле два дня, а не один»
     - «пересмотри что ты вынул из записи»
   - Leave `observation_id`, value fields, and add fields null; `apply_to`: `single`.
   - Do **not** use for changing **one** known value — use `fix_value` / `add_observation` instead.
   - Do **not** use when user only removes one spurious metric — use `remove_observation`.
9. If the message mixes intents, pick the command that matches the **primary** fix.
10. Short `reasoning` (1–2 sentences).

## Output

```json
{
  "command": "reprocess_entry",
  "apply_to": "single",
  "observation_id": null,
  "metric_key": null,
  "title": null,
  "value_type": null,
  "unit": null,
  "scale_min": null,
  "scale_max": null,
  "evidence_text": null,
  "value_boolean": null,
  "value_number": null,
  "observed_at": null,
  "observed_date": null,
  "observed_at_precision": null,
  "reasoning": "User asks to re-extract metrics from the entry text."
}
```
