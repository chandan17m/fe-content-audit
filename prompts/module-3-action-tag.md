# MODULE 3 — ACTION TAG AND OUTPUT

**Your job:** Apply the decision matrix. Produce the
final narrative output. Input: Module 2 JSON.
Read all upstream fields as fixed. Do not re-derive.
Output is narrative only — no JSON block.

---

## INPUT

```
INPUT — MODULE 2 JSON:
[paste complete Module 2 JSON]
```

If Module 2 JSON is missing required fields — stop:
`BLOCKED: Module 2 JSON incomplete. Re-run Module 2.`

---

## STEP 1 — MENTAL HEALTH CHECK

Runs before the decision matrix.

If [MENTAL_HEALTH_DISTRESS Level 2] is in `flags_fired`
from Module 2 JSON AND all three verdicts are Fail:
→ Action Tag: DELETE_410
→ HUMAN REVIEW: Yes — "Level 2 mental health distress
  flag with triple Fail."
→ Skip the decision matrix. Proceed directly to output.

---

## STEP 2 — DECISION MATRIX

Read `hcs_verdict`, `eeat_verdict`, and `spam_verdict`
from Module 2 JSON. Find the first row that matches exactly.
T3 Lite variants count as their base: Pass/Partial/Fail.

| Row | HCS | E-E-A-T | Spam | Action Tag |
|---|---|---|---|---|
| R01 | Pass | Pass | Pass | RETAIN |
| R02 | Pass | Pass | Partial | RETAIN |
| R03 | Pass | Partial | Pass | REWORK |
| R04 | Pass | Partial | Partial | REWORK |
| R05 | Pass | Fail | Pass | NOINDEX |
| R06 | Pass | Fail | Partial | NOINDEX |
| R07 | Pass | Fail | Fail | NOINDEX* |
| R08 | Partial | Pass | Pass | RETAIN |
| R09 | Partial | Pass | Partial | REWORK |
| R10 | Partial | Pass | Fail | REWORK |
| R11 | Partial | Partial | Pass | REWORK |
| R12 | Partial | Partial | Partial | REWORK |
| R13 | Partial | Partial | Fail | NOINDEX |
| R14 | Partial | Fail | Pass | NOINDEX |
| R15 | Partial | Fail | Partial | NOINDEX |
| R16 | Partial | Fail | Fail | NOINDEX* |
| R17 | Fail | Pass | Pass | REWORK |
| R18 | Fail | Pass | Partial | REWORK |
| R19 | Fail | Pass | Fail | NOINDEX |
| R20 | Fail | Partial | Pass | REWORK |
| R21 | Fail | Partial | Partial | NOINDEX |
| R22 | Fail | Partial | Fail | NOINDEX |
| R23 | Fail | Fail | Pass | NOINDEX |
| R24 | Fail | Fail | Partial | NOINDEX |
| R25 | Fail | Fail | Fail | NOINDEX* |

**Rows marked * — DELETE_410 upgrade:**
Upgrade NOINDEX → DELETE_410 if ALL THREE true:
(1) [SOCIAL_MEDIA_AGGREGATION] or [AUTHOR_LEVEL_SCALED_ABUSE]
    in `flags_fired` from Module 2 JSON.
(2) Article is older than 18 months (from `published_date`
    in Module 1 JSON) OR `pre_publication` is false and
    `published_date` is null.
(3) No reworkable editorial core — defined as: none of (a) a
    named court order or regulatory ruling cited by case name,
    (b) an original interview with a named expert, or (c) named
    primary data from Tier A or B.

**Fallback:** matrix row genuinely ambiguous → NOINDEX as
conservative default. Set HUMAN REVIEW REQUIRED: Yes.

---

## STEP 3 — DOMAIN SIGNAL IMPACT

| Condition | Domain Signal |
|---|---|
| RETAIN AND section_classification Core | Positive |
| REWORK AND section_classification Core | Neutral |
| NOINDEX | Negative |
| DELETE_410 | Negative |
| section_classification Non-Core — any tag | Negative |
| NOT_APPLICABLE | Neutral |

Write one sentence connecting this URL's verdict to
FE's domain-level recovery. Reference the specific
Google update dimension affected.

---

## STEP 4 — GOOGLE UPDATE IMPLICATION

**Core Update compliance:**
- Compliant: HCS Pass AND E-E-A-T Pass
- At Risk: HCS Partial OR E-E-A-T Partial
- Non-Compliant: HCS Fail OR E-E-A-T Fail

**Spam Policy compliance:**
- Compliant: Spam Pass
- At Risk: Spam Partial
- Non-Compliant: Spam Fail

**Discover eligibility:**
- Eligible: section_classification Core AND [DISCOVER_IDENTITY_RISK]
  not in flags_fired AND spam_verdict Pass
- At Risk: section_classification Core AND [DISCOVER_IDENTITY_RISK]
  in flags_fired OR spam_verdict Partial
- Ineligible: section_classification Non-Core OR spam_verdict Fail
  OR [NON_CORE_DOMAIN_DILUTION] in flags_fired

---

## STEP 5 — CONFIDENCE

| Level | Criteria |
|---|---|
| High | Every verdict traces to a named rule. Matrix row unambiguous. Another run on the same input reaches the same Action Tag. |
| Medium | At least one verdict relied on a secondary criterion, not a hard gate. Matrix row still unambiguous. State the secondary criterion in output. |
| Low | YMYL tier uncertain. OR a verdict cannot be traced to a single named rule. OR matrix row ambiguous. Set HUMAN REVIEW: Yes. State which verdict and why. |

---

## STEP 6 — RECOMMENDATIONS

Maximum 3 items. Priority order.
Each flag in `flags_fired` from Module 2 JSON is a mandatory
item. Apply flag priority order from Module 2 Step 5.

**Urgency label — determined by Action Tag:**

| Action Tag | Item 1 label | Items 2–3 label |
|---|---|---|
| RETAIN | Ideally | Ideally |
| REWORK | Minimum fix before republishing | Strengthens the piece |
| NOINDEX | Required before any reinstatement | Required before any reinstatement |
| DELETE_410 | Deletion rationale | Redirect note if applicable |

**For RETAIN:** write `None.` No items needed.

**Format for all other Action Tags:**
`[Urgency label] [Specific editorial action] — [what it
achieves for the reader or signal] [FLAG_CODE]`

Rules:
- Flag code at END, in brackets. Never lead with flag code.
- Action must be specific enough for a journalist to execute
  without reading this prompt.
- Name the exact section, source type, or structural element.

---

## STEP 7 — EDITORIAL OPPORTUNITY

Identify a follow-up story angle that is distinct from the
current URL — something that would score better as a
standalone piece than as a tail paragraph here.

Populate when ANY of these apply:
(1) A named case, order, or tender has a time-bound outcome
    the current piece cannot track.
(2) A sub-topic has its own primary source and reader need,
    strong enough to anchor its own URL.
(3) A sourcing gap is more efficiently resolved by
    commissioning a new story than reworking this one.

Write one sentence, editorial voice, for the desk editor.
No flag codes, no framework language.

Write `null` when none of the three conditions apply.

---

## OUTPUT — NARRATIVE ONLY

```
[ACTION: RETAIN | REWORK | NOINDEX | DELETE_410 | NOT_APPLICABLE]

DOMAIN SIGNAL: [Positive | Neutral | Negative] — [one sentence]

GOOGLE UPDATE:
- Core Update:  [Compliant | At Risk | Non-Compliant]
- Spam Policy:  [Compliant | At Risk | Non-Compliant]
- Discover:     [Eligible | At Risk | Ineligible]

CONFIDENCE: [High | Medium | Low]
HUMAN REVIEW: [Yes | No]
[If Yes — one sentence: which verdict is uncertain and why]

SCORING SUMMARY:
HCS:     [hcs_verdict] — [hcs_core_finding from Module 2 JSON]
E-E-A-T: [eeat_verdict] — [eeat_core_finding from Module 2 JSON]
Spam:    [spam_verdict] — [spam_core_finding from Module 2 JSON]

RECOMMENDATIONS:
[None. — for RETAIN]
[Or numbered list 1–3 items for all others]
1. [Urgency label] [Specific action] — [what it achieves] [FLAG]
2. [Urgency label] [Specific action] — [what it achieves] [FLAG]
3. [Urgency label] [Specific action] — [what it achieves] [FLAG]

EDITORIAL OPPORTUNITY:
[One sentence or null]

EDITORIAL SUMMARY:
[Two sentences. Plain English. No flag codes, no framework
language. Written for the journalist receiving this verdict.]
```

---

## RULES

1. Do not classify. Do not score. Matrix lookup only.
2. Read all upstream fields as fixed. Do not re-derive.
3. Action Tag is determined by the matrix row only —
   not by overall impression.
4. SCORING SUMMARY must carry the verbatim FINDING text
   from Module 2 output — not rewritten.
5. Recommendations lead with urgency label.
   Flag code appears at end only.
6. For RETAIN: write "None." Do not populate items.
7. EDITORIAL OPPORTUNITY is mandatory — string or null.
   Never omit.
8. EDITORIAL SUMMARY: zero technical framework language,
   zero flag codes, zero module names.
9. If Action Tag in narrative contradicts the matrix row
   applied — stop, correct, then output.

---

*FE Content Audit Pipeline | M1-v2.0 | M2-v2.0 | M3-v2.0*
*Parent: v3.9.0*
