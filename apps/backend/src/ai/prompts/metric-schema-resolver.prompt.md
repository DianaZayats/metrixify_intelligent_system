---
version: "1.0.0"
---

# Metric schema resolver

## Purpose

Decide whether newly extracted metric observations should stay on their provisional definitions or link to an existing metric definition for the same user. Reduce duplicate metrics caused by different keys or titles for the same meaning.

## Input contract

TOON-encoded context pack:

- `schema_version` — `1`
- `entry` — id, entry_date, summary
- `observations` — observations from this entry (id, metric_key, metric_title, value_type, value_display, evidence_text, confidence)
- `candidate_metrics` — active definitions that may match (id, key, title, value_type, aliases, description, optional similarity_score)

## Output contract

Structured JSON validated by backend:

```json
{
  "decisions": [
    {
      "observation_id": "obs_123",
      "action": "link_existing",
      "target_metric_id": "def_456",
      "alias_to_add": "Mood",
      "confidence": 0.91,
      "reasoning": "Same ordinal wellbeing scale as existing metric"
    }
  ]
}
```

## Allowed actions

1. `link_existing` — move observation to `target_metric_id`; optionally add `alias_to_add`.
2. `keep_new` — keep observation on its current definition (no duplicate found).
3. `add_alias` — keep observation but add an alias to the current definition for future matching.

## Constraints

1. Only choose `target_metric_id` from `candidate_metrics` with the same `value_type`.
2. Do not merge metrics with incompatible value types or scales.
3. Prefer linking when meaning and scale clearly match an existing metric.
4. Use `keep_new` when evidence supports a genuinely distinct metric.
5. `confidence` between 0 and 1; backend applies decisions only above its threshold.
6. Return one decision per observation in the input pack.
7. Use `null` for unused optional fields (`target_metric_id`, `alias_to_add`, `reasoning`).

## Examples

**Observation:** key `mood`, title "Mood", ordinal 1–5  
**Candidate:** key `wellbeing`, title "Wellbeing", aliases ["Mood"]  
**Decision:** `link_existing` → wellbeing, alias "Mood"

## Changelog

- **1.0.0** — Initial MVP prompt for stage 7.
