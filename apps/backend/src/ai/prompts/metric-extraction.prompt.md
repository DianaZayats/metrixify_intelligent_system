---
version: "2.0.0"
---

# Metric extraction

## Purpose

Extract **analytics-ready** metric observations from diary text. Every observation must be plottable on a timeline and usable for correlation analysis.

**Maximize recall:** extract **every** assessable fact in the message. Short daily entries often contain 4–8 distinct metrics — do not stop after one symptom line.

**Allowed value types only:** `number`, `ordinal`, `boolean`. Never use `category`.

## Daily symptom diary (short entries — mandatory completeness)

When the user describes **today** in one paragraph (symptoms, energy, mood, food, sleep, activity, alcohol, stress):

Extract **separate metrics** for each dimension mentioned. Typical keys (match `existing_metrics` when present):

| Mention | Metric(s) | Type |
| --- | --- | --- |
| «симптоми X з 10», «дискомфорт», «важкість» | `evening_discomfort` or `symptom_severity` | ordinal — use **stated X/Y scale** in `scale_max`; backend rescales to definition |
| «енергія вища/нижча середньої», «втома» | `acute_energy_level` | ordinal 1–5 inferred |
| «настрій рівний/нормальний/поганий» | `morning_wellbeing` or `wellbeing` | ordinal 1–5 |
| «алкоголь», «без алкоголю» | `alcohol_consumed` | boolean true/false |
| «жирна їжа», «фастфуд», «закуска» | `fatty_food_consumed` or `fast_food_meal` — **not** mixed with alcohol in one boolean |
| «активності не було», «прогулянка» | `low_activity_day` / `daytime_walk_occurred` | boolean |
| «сон N годин» | `night_sleep_duration_minutes` | number |
| «недосип», «якість сну» | `night_sleep_quality` | ordinal — **only if sleep is mentioned** |
| «кава N чашок» | `caffeine_intake` | number |
| «стрес» | `stress_level` | ordinal |

Rules:
1. **One fact → one metric → one evidence quote** (never use alcohol text as evidence for food boolean).
2. **`evidence_text`** must be a **verbatim substring** of `entry.text` (same words; punctuation may differ slightly).
3. Do **not** invent `night_sleep_quality` when the user only mentions food/water.
4. Explicit **«без алкоголю»** → `alcohol_consumed: false`. Explicit **«без пізньої вечері»** → `late_dinner: false` when key exists.
5. Relative phrases («вище середньої») → ordinal **4** on 1–5 scale; («рівний настрій») → **3–4**.
6. If header contains **`(YYYY-MM-DD)`**, set `observed_date` to that calendar day with precision **`date_only`**.

## Input contract

TOON-encoded context pack:

- `schema_version` — `1`
- `entry.id`, `entry.entry_date`, **`entry.recorded_at`** (ISO timestamp when the message was sent)
- `entry.text` — raw message or voice transcript only
- `entry.source_type`
- `user.timezone`
- `existing_metrics` — active definitions (key, title, value_type, aliases, tags)

Prefer matching an existing metric key when the meaning is the same.

## Analytics-first values

| Type | Use for | Example |
| --- | --- | --- |
| `ordinal` | Subjective quality 1–5 | `breakfast_quality = 2` |
| `number` | Duration, count, measurement + unit | `run_duration_minutes = 4`, unit `min` |
| `boolean` | Event happened (`true` only when it happened) | `fast_food_breakfast = true` |

- **`evidence_text`** — short quote from `entry.text` (not the stored metric value).
- Do **not** store brand names, food names, or workout labels as metric values.
- Different workout types → **different metric keys** (`run_duration_minutes`, `gym_session_duration_minutes`), linked by **tags** (`fitness`, `cardio`).

## Multiple metrics from one fact

One real-world event may yield **1–3 metrics**:

1. Quality (`ordinal`) when assessable
2. Habit fact (`boolean`) when it is a reusable pattern
3. Quantity (`number`) when duration/count is stated

Example — McDonald's breakfast:

- `breakfast_quality` ordinal **2** (inferred, confidence ≤ 0.75)
- `fast_food_breakfast` boolean **true**

Do **not** create `mcdonalds_breakfast`, `burger_breakfast` — use the **broadest reusable boolean** (`fast_food_breakfast`).

Limits per entry: **≤ 15 metrics**, **≤ 5 new metric keys**, **≤ 3 metrics per distinct event**.

## Timeline placement (critical)

Each metric must include timeline fields:

```json
{
  "observed_at": "2026-05-19T08:15:00+03:00",
  "observed_at_precision": "inferred",
  "narrative_order": 2
}
```

### Rules

1. **Present tense** («сейчас», «только что», «чувствую себя…») → `observed_at` ≈ `entry.recorded_at`, precision **`exact`**.
2. **Explicit past time** («в 8 утра», «в 14:30») → `observed_at` at that time on `entry_date`, precision **`exact`**.
3. **End-of-day recap / past narrative** without exact clock time → assign **`narrative_order`** (1, 2, 3…) in chronological story order; set precision **`inferred`**; leave `observed_at` **null** (backend distributes evenly from 07:00 to `recorded_at`).

   **Recap detection signals:** «итог дня», «утром… потом…», «вечером», multiple past events in one message.

   **NEVER** set `observed_at` to `entry.recorded_at` for recap entries. **NEVER** assign the same `narrative_order` to every event in a recap.
4. **Different day** («вчора») → set `observed_date`; precision **`date_only`**; `observed_at` null.
5. **Weekly period recap** («Підсумок періоду», «Period recap») with **explicit calendar dates** (`1 січня — …`, `On 3 January — …`, `У суботу (10 січня) — …`):

   - Emit **one observation per `(observed_date, metric)`** for each dated line — not one metric for the whole message.
   - Set **`observed_date`** to that calendar day (YYYY-MM-DD, year from `entry.entry_date` unless the text states another year).
   - Set **`observed_at` null**, precision **`date_only`**, **`narrative_order` null** — never invent clock times for period recap lines.
   - **`evidence_text`** must quote **only that dated clause** (e.g. `12 січня — перекусив горіхами, без висипу`), not a different day’s clause.
   - **Independent clauses:** «перекусив горіхами, без висипу» → `nuts_consumed=true` **and** `skin_rash_occurred=false` from the **same** evidence line. Never attach «без висипу» evidence to `nuts_consumed`, or nut evidence to `skin_rash_occurred`.
   - When a line states both facts, emit **both booleans** (including explicit `false` when «без горіхів» / «без висипу»).
   - Prefer **`existing_metrics` keys** (`nuts_consumed`, `skin_rash_occurred`) over inventing new keys.
6. Metrics about the **same story event** share the same `narrative_order` (e.g. `breakfast_quality` and `fast_food_breakfast` both order 2) — **except** weekly period recap lines (rule 5), where use `observed_date` instead.

### Daytime nap vs night sleep (mandatory)

- Daytime nap («лёг поспать», «днём поспал», «минут на сорок» during the day) → **`daytime_nap_occurred`** (boolean) + **`daytime_nap_duration_minutes`** (number) when duration stated.
- **Repeated naps:** «два раза … по минут сорок» → **`daytime_nap_duration_minutes` = 80** (sum of sessions). Put the **full phrase including repeat count** in `evidence_text`.
- **NEVER** use `sleep_quality` or `gym_session_duration_minutes` for daytime naps.
- `sleep_quality` / `night_sleep_quality` only for **night sleep** or **morning wake after night**.

### Recap completeness (mandatory for «итог дня» / multi-event past narrative)

Extract **every distinct past event** as its own metric(s). Minimum expectations when mentioned:

1. Morning self-assessment («почувався непогано/нормально/погано») → **`wellbeing`** or **`morning_wellbeing`** (ordinal).
2. Breakfast → **`breakfast_quality`** (ordinal, inferred) + **`fast_food_breakfast`** (boolean) when applicable.
3. Each workout → duration key + optional post-exercise wellbeing.
4. Each work context → **`main_job_productivity`** and/or **`personal_project_productivity`** separately.
5. Daytime nap → **`daytime_nap_occurred`** + **`daytime_nap_duration_minutes`** when duration present.

**Each chronological story beat gets its own `narrative_order`.** Only metrics about the **same beat** share an order (e.g. breakfast quality + fast food = same order). Run and pet-project productivity must **not** share an order.

### Work productivity split (mandatory when user contrasts)

- Weak employer work + strong pet project → **`main_job_productivity`** AND **`personal_project_productivity`**, not one generic `productivity`.
- Two separate employer-work episodes in one recap → **two `main_job_productivity` metrics** with different `evidence_text` and `narrative_order`.
- **NEVER** invent count metrics (`number_of_items_worked_on`, `tasks_completed`) unless the user states an explicit number («3 задачи», «два тикета»).

### Exercise in recap (mandatory when mentioned)

- «пробежал минуты четыре» → **`run_duration_minutes`** = 4 + **`post_run_wellbeing`** if symptoms (dizziness, breathless).
- «час пробежал» → 60 min. Different workouts → different keys (`run_duration_minutes`, `gym_session_duration_minutes`).

### Context separation (same day)

| Situation | Separate metrics |
| --- | --- |
| Night wake vs daytime nap | `morning_wellbeing` vs `daytime_nap_occurred`, `daytime_nap_duration_minutes` |
| Run | `run_duration_minutes`, `post_run_wellbeing`, optional `exercise_occurred` |
| Work contexts | `main_job_productivity` vs `personal_project_productivity` |

## Ordinal inference

When the user does **not** give an explicit rating (`3 з 5`) but quality is inferable (e.g. fast food breakfast):

- Still emit `ordinal` with best estimate (often 2–3 for clearly poor choices).
- Set **confidence ≤ 0.75**.
- Prefer pairing with a **boolean** fact metric when applicable.

Explicit ratings override vague wording (confidence ≥ 0.85).

## Tags vs value type

- **`tags`** — life domains (`sleep`, `fitness`, `nutrition`, …). 1–4 tags per metric.
- Tags group metrics for UI and future graphs; they are **not** observation values.

Suggested tags: `sleep`, `mood`, `energy`, `mental-health`, `fitness`, `nutrition`, `work`, `productivity`, `social`, `routine`, `health`, `habits`

## Bilingual display (required)

Provide English and Ukrainian display strings in one response. **`candidate_key` stays English snake_case.**

- **`title_i18n`**: `{ "en": "...", "uk": "..." }` — human-readable metric title
- **`tag_entries`**: array of `{ "slug": "sleep", "label_i18n": { "en": "Sleep", "uk": "Сон" } }`
- Keep **`title`** equal to `title_i18n.en` for compatibility
- Keep **`tags`** as slug array matching `tag_entries.slug`

## Output contract

```json
{
  "candidate_key": "fast_food_breakfast",
  "title": "Fast food breakfast",
  "value_type": "boolean",
  "value_number": null,
  "value_text": null,
  "value_boolean": true,
  "unit": null,
  "scale_min": null,
  "scale_max": null,
  "evidence_text": "покушал бургером из макдональдса",
  "confidence": 0.88,
  "reasoning": "Explicit fast food breakfast event",
  "observed_date": null,
  "observed_at": null,
  "observed_at_precision": "inferred",
  "narrative_order": 2,
  "tags": ["nutrition", "habits"]
}
```

## Anti-patterns

- ❌ `value_type: category` or text stored as metric value
- ❌ One generic `wellbeing` / `productivity` / `sleep_quality` for the whole day
- ❌ `sleep_quality` or `gym_session_duration_minutes` for daytime nap («лёг поспать минут на сорок»)
- ❌ Invented count metrics without explicit number in text (`number_of_items_worked_on`, `tasks_completed`)
- ❌ Skipping **`wellbeing`** / **`morning_wellbeing`** in recap when user describes how they felt
- ❌ Skipping **`daytime_nap_duration_minutes`** when nap duration is stated (including repeated sessions)
- ❌ Sharing `narrative_order` across unrelated events (run vs pet-project work)
- ❌ Setting `observed_at = recorded_at` for multi-event recap
- ❌ Same `narrative_order: 1` on every metric in a recap
- ❌ Duplicate booleans (`burger_breakfast` + `fast_food_breakfast`)
- ❌ Boolean `false` when event not mentioned (omit instead)
- ❌ > 3 metrics for one event
- ❌ Skipping `narrative_order` in multi-event recap entries
- ❌ One boolean for a whole «Підсумок періоду» message instead of per dated line
- ❌ Cross-clause evidence (rash quote on nuts metric or vice versa) in period recap
- ❌ Invalid or guessed `observed_at` on period recap — use `observed_date` + `date_only` only

## Examples

**Short:** «Сьогодні пізно прокинувся і почувався не дуже.»  
→ `wake_time_quality`, `wellbeing` with `narrative_order` 1 and 2.

**Short cross-day event:** «Вчора рано вранці прокинувся і поснідав вівсянкою»  
→ emit **habit booleans + quality**, not only generic wellbeing/energy ordinals:

- `early_wake_occurred` boolean **true** (`evidence_text`: «рано вранці прокинувся»)
- `breakfast_occurred` boolean **true** (`evidence_text`: «поснідав вівсянкою»)
- `breakfast_quality` ordinal **3–4** (inferred, confidence ≤ 0.75) — same `narrative_order` as breakfast boolean
- `observed_date`: **yesterday** relative to `entry.entry_date`, precision **`date_only`**
- Do **not** replace these with a single `wellbeing` / `energy` guess when breakfast and wake facts are explicit

**Rich day recap:** see fixture `output-rich-day-uk-01.json`.

## Changelog

- **2.0.0** — Maximize recall for short daily/symptom entries; mandatory multi-metric checklist; separate alcohol/food booleans; verbatim evidence; observed_date from header; anti sleep hallucination.
- **1.9.0** — Short cross-day breakfast/wake example; require habit booleans, not only wellbeing/energy ordinals. (`Підсумок періоду`): one observation per dated line; `observed_date` + `date_only`; independent clause booleans; no invented `observed_at`; anti cross-clause bleed.
- **1.6.0** — Recap completeness checklist; mandatory wellbeing; nap total duration + full evidence; ban junk count metrics; unique narrative_order per story beat.
- **1.5.0** — Stricter recap timeline; daytime nap vs sleep_quality; work/exercise mandatory extraction; no observed_at on recap.
- **1.4.0** — Analytics-only types; timeline fields; narrative_order; multi-metric per fact; boolean dedup hierarchy; ordinal inference cap.
- **1.3.0** — Multi-event extraction strategy; context separation.
- **1.2.0** — Life-domain tags.
- **1.1.0** — Plain text only; explicit ratings.
- **1.0.0** — Initial MVP.
