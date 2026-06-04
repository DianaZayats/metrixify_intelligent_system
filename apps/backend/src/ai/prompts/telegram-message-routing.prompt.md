---
version: "1.0.0"
---

# Telegram message routing

## Purpose

Decide how to handle the user's **latest Telegram message** in an ongoing private chat with the Metrixify bot.

Two intents only:

| Intent | Meaning |
| --- | --- |
| `diary_entry` | A **new journal log** — the user describes events, feelings, symptoms, habits, or facts to record now. Run the diary pipeline. |
| `correction` | The user wants to **change an existing entry** — fix a metric value/date, remove/add an observation, say they were wrong, or clarify something about a **past logged entry**. Do **not** create a new diary entry. |

Use **full conversational context** (recent turns + recent entries). Do **not** rely on rigid keyword lists. Infer intent the way a human assistant would.

## Input contract

TOON-encoded context pack:

- `schema_version` — `1`
- `incoming_message.text` — the new user message
- `incoming_message.reply_to_message_id` — Telegram reply id, or null
- `incoming_message.reply_target_entry_id` — diary entry id if reply points to a known entry message, or null
- `recent_conversation` — newest-first bot/user turns (role, turn_type, text, entry_id, created_at)
- `recent_entries` — newest-first diary entries (id, entry_date, text_preview, metric titles, processing_status)

## Decision rules

1. **New diary entry** when the message primarily **adds new information** for the journal — even if the chat recently discussed another entry or the bot sent a summary/correction reply.

   Examples:
   - «Сьогодні похмілля після вчорашнього» → `diary_entry` (new symptom today)
   - «Сьогодні вранці бігав 40 хвилин…» → `diary_entry`

2. **Correction** when the message primarily **fixes, retracts, or adjusts** something about an **already logged entry**, without being a standalone new log.

   Examples:
   - Reply to entry/summary: «Помилився, насправді бігав 2 хвилини» → `correction`, target = that entry
   - «горіхи — ні» right after bot listed nuts for an entry → `correction`
   - «убери метрику про висип за вчора» → `correction`
   - «перечитай запис, там два дні» → `correction`, target = entry being discussed
   - «метрики не те, посмотри ещё раз» → `correction`, target = last discussed entry

3. **Reply** to an entry-related message is a strong signal for `correction`, but **not required** — free-text corrections are valid if context makes the target entry clear.

4. When the message could be read both ways, prefer **`diary_entry`** if it introduces a **new day / new event / new symptom** unrelated to fixing the last entry.

5. Set `target_entry_id` to an `id` from `recent_entries` when intent is `correction`. Use `reply_target_entry_id` when present. Match the entry whose **`text_preview` shares the same facts** (breakfast, wake time, workout, symptom) — not merely the same day word («вчера» / «сегодня»). Example: correcting «встал днём, омлет» must target the entry about «позавтракал овсянкой», not an unrelated «бадун» entry that also mentions «вчера».

6. If the bot just sent a metric summary and the user immediately corrects without reply, target that **same entry** unless the correction clearly refers to another `text_preview`.

7. Write a short `reasoning` (1–2 sentences) explaining the choice.

## Output

Return JSON only:

```json
{
  "intent": "diary_entry",
  "target_entry_id": null,
  "reasoning": "User describes a new symptom today; not fixing a prior entry."
}
```
