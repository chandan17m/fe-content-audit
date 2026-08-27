# MODULE 3 — ACTION TAG AND OUTPUT
## Version M3-v1.0

---

## CALIBRATION — READ BEFORE EVERY RUN

```
MODULE: 3 of 3 — Action Tag and output only
THIS MODULE DOES NOT CLASSIFY.
THIS MODULE DOES NOT SCORE.
THIS MODULE READS MODULE 2 JSON AS FIXED,
LOCKED DATA AND APPLIES THE DECISION MATRIX.

YOUR ONLY JOB: Apply the matrix. Assign the Action
Tag. Produce the full output JSON and editorial
summary.

MANDATORY PRE-RUN CHECKS:
→ You have Module 2 complete JSON ready to paste

DETERMINISM RULE:
The Action Tag is the output of a matrix row lookup.
It is not a judgment call. Find the exact row that
matches the three scoring verdicts from Module 2.
Apply that row. Do not reason around it.
```

---

## YOUR INPUT — PASTE BEFORE RUNNING

```
INPUT — MODULE 2 SCORING JSON:
[paste complete Module 2 JSON here]
```

---

## STEP 1 — READ AND LOCK MODULE 2 FIELDS

Read the following fields from Module 2 JSON.
These are fixed. Do not re-derive them.

From carried_from_m1:
- ymyl_tier
- section_classification
- section_path
- author_status
- gates_fired
- published_date
- pre_publication
- section_mismatch_flag

From Module 2 scoring:
- hcs_verdict
- eeat_verdict
- spam_verdict
- flags_fired
- primary_source_tier
- disclaimer_found

If any field is missing → stop. Output only:

```
STOP — MODULE 2 JSON IS INCOMPLETE.
Missing field: [name it].
Team member must re-run Module 2 and paste the
complete JSON before Module 3 can proceed.
```

---

## STEP 2 — MENTAL HEALTH CHECK

Check flags_fired from Module 2 JSON first.
This check runs before the decision matrix.

If [MENTAL_HEALTH_DISTRESS_UNADDRESSED Level 2]
is in flags_fired AND all three verdicts are Fail:
→ Action Tag: DELETE_410
→ Set human_review_required: true
→ Set human_review_reason:
  "Level 2 mental health distress flag with
  triple Fail — mandatory human review before
  any CMS action."
→ Do not apply the decision matrix.
→ Proceed directly to Step 5 output.

---

## STEP 3 — DECISION MATRIX

Map the three scoring verdicts to the matrix.
Find the FIRST row that matches exactly.
That row determines the Action Tag.

Treat T3 Lite variants as their base equivalent:
- Pass (T3 Lite) = Pass
- Partial (T3 Lite) = Partial
- Fail (T3 Lite) = Fail

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

**Rows marked * — DELETE_410 upgrade condition:**
Upgrade NOINDEX to DELETE_410 if ALL THREE
conditions below are simultaneously true:

(1) [SOCIAL_MEDIA_AGGREGATION] or
    [AUTHOR_LEVEL_SCALED_ABUSE] is in flags_fired
(2) published_date confirms article is older than
    18 months — or pre_publication is false and
    published_date is null (treat as upgrade eligible)
(3) No reworkable editorial core exists.

**"No reworkable editorial core" — defined:**
A reworkable editorial core EXISTS if the article
contains at least one of:
(a) A named court order, ITAT order, or regulatory
    ruling cited by case name
(b) An original interview with a named expert
(c) Named primary data from a Tier A or B source

If none of (a), (b), or (c) exist → no reworkable
editorial core → upgrade condition (3) is met.

Record matrix_row_applied as the row code
e.g. "R12 — Partial/Partial/Partial".
Record delete_410_upgrade_applied as true or false.
Record delete_410_upgrade_reason if upgrade applied.

**FALLBACK RULES:**
- Matrix row genuinely ambiguous → assign NOINDEX
  as conservative default. Set human_review_required
  to true. State which row was ambiguous and why
  in human_review_reason.
- Article could not be scored upstream → action_tag:
  NOT_APPLICABLE. Set human_review_required to true.

---

## STEP 4 — DOMAIN SIGNAL IMPACT

Assign one of three values based on the Action Tag
and section classification.

| Condition | Domain Signal Impact |
|---|---|
| Action Tag is RETAIN AND section is Core | Positive |
| Action Tag is REWORK AND section is Core | Neutral |
| Action Tag is NOINDEX | Negative |
| Action Tag is DELETE_410 | Negative |
| Section is Non-Core — any Action Tag | Negative |
| Action Tag is NOT_APPLICABLE | Neutral |

Write domain_signal_reason: one sentence connecting
this URL's verdict to FE's domain-level recovery.
Reference the specific Google update dimension
this piece affects.

Examples:
"This RETAIN verdict on T1 market analysis with
VERIFIED-FALLBACK authorship directly strengthens
FE's Core% concentration and E-E-A-T signal —
Positive."

"This URL is in /trending/ and actively contributes
to the NON-CORE content dilution pattern that
triggered FE's Aug 2025 Spam and Feb 2026 Discover
penalty — Negative."

---

## STEP 5 — GOOGLE UPDATE IMPLICATION

Assign one value per sub-field based on the
scoring verdicts from Module 2.

**core_update_compliance:**
- Compliant: HCS Pass AND E-E-A-T Pass
- At Risk: HCS Partial OR E-E-A-T Partial
- Non-Compliant: HCS Fail OR E-E-A-T Fail

**spam_policy_compliance:**
- Compliant: Spam Pass
- At Risk: Spam Partial
- Non-Compliant: Spam Fail

**discover_eligibility:**
- Eligible: section is Core AND [DISCOVER_IDENTITY_RISK]
  is NOT in flags_fired AND Spam Pass
- At Risk: section is Core AND [DISCOVER_IDENTITY_RISK]
  IS in flags_fired OR Spam Partial
- Ineligible: section is Non-Core OR Spam Fail OR
  [NON_CORE_DOMAIN_DILUTION] is in flags_fired

---

## STEP 6 — CONFIDENCE SCORE

Assign one level. Apply the criteria as written.
Do not apply judgment.

| Level | Criteria |
|---|---|
| High | Every verdict traces directly to a named rule. No competing signals. Matrix row was unambiguous. A different device applying this prompt to the same Module 2 JSON would reach the same Action Tag. |
| Medium | At least one verdict relied on a secondary criterion within a scoring table — not a hard gate. Matrix row was still unambiguous. One sentence must explain the secondary criterion applied. |
| Low | YMYL tier was genuinely uncertain after applying all four questions. OR a scoring verdict could not be traced to a single named rule. OR matrix row was genuinely ambiguous. human_review_required: true. State which verdict or tier is uncertain and why. |

---

## STEP 7 — RECOMMENDATIONS

Build the recommendations array.
Maximum 3 items. Priority order.
Flags from Module 2 flags_fired are mandatory items.
Apply flag priority order from Module 2.

For RETAIN: recommendations array is empty [].

For REWORK and NOINDEX: list specific edits or
actions required. Each item references the flag
that triggered it where applicable.
One line per item. Specific — not generic.
Name the exact field, source, or structural element
that needs to change.

For DELETE_410: one item stating the deletion
rationale citing the specific Google policy or
update criterion violated.
Include redirect recommendation only if a stronger
canonical FE URL exists on the same topic.

---

## STEP 8 — EDITORIAL SUMMARY

Two sentences maximum.
Written for the editorial team member who receives
this output and must act on it.
State: what the article is, what the verdict is,
what the single most important action is.
No technical language from the scoring framework.
No module names, no field names, no flag codes.
Plain English only.

---

## STEP 9 — SELF-CHECK BEFORE OUTPUT

Answer all seven. Fix any NO before producing output.

1. Does the matrix_row_applied match the three
   verdicts from Module 2 JSON exactly?
2. If a * row fired, have I checked all three
   DELETE_410 upgrade conditions explicitly?
3. Does domain_signal_impact match the condition
   table in Step 4 exactly?
4. Are all three google_update_implication sub-fields
   populated?
5. Does confidence level trace to a testable
   criterion — not a general impression?
6. Are recommendations specific — naming exact
   fields, sources, or structural elements?
7. Is the editorial_summary free of technical
   framework language?

---

## OUTPUT — ONE BLOCK

```json
{
  "schema_version": "M3-v1.0",
  "classifier_version": "v3.9.0",

  "carried_from_m1": {
    "url_path": "string | null",
    "section_path": "string",
    "section_classification": "Core | Non-Core | Mixed",
    "ymyl_tier": "T1 | T2 | T3",
    "author_status": "string",
    "pre_publication": "true | false",
    "published_date": "string | null"
  },

  "carried_from_m2": {
    "hcs_verdict": "Pass | Partial | Fail",
    "eeat_verdict": "string",
    "spam_verdict": "Pass | Partial | Fail",
    "flags_fired": [],
    "primary_source_tier": "A | B | C | D | E",
    "disclaimer_found": "true | false"
  },

  "matrix_row_applied": "string",
  "delete_410_upgrade_applied": "true | false",
  "delete_410_upgrade_reason": "string | null",

  "action_tag": "RETAIN | REWORK | NOINDEX | DELETE_410 | NOT_APPLICABLE",

  "domain_signal_impact": "Positive | Neutral | Negative",
  "domain_signal_reason": "string",

  "google_update_implication": {
    "core_update_compliance": "Compliant | At Risk | Non-Compliant",
    "spam_policy_compliance": "Compliant | At Risk | Non-Compliant",
    "discover_eligibility": "Eligible | At Risk | Ineligible"
  },

  "confidence": "High | Medium | Low",
  "human_review_required": "true | false",
  "human_review_reason": "string | null",

  "recommendations": [
    {
      "priority": "1 | 2 | 3",
      "flag": "flag code | null",
      "action": "string"
    }
  ],

  "editorial_summary": "string"
}
```

Populate every field. No field may be omitted.
null is only valid where explicitly permitted.
carried_from_m1 and carried_from_m2 values must
match upstream JSON exactly.

---

## ABSOLUTE RULES

1. Do not classify. Do not score. Matrix lookup only.
2. Do not re-derive any upstream field. Read all
   Module 1 and Module 2 fields as locked data.
3. The Action Tag is determined by the matrix row
   only — not by overall impression of the article.
4. editorial_summary must contain zero technical
   framework language — no module names, no flag
   codes, no schema field names.
5. For RETAIN verdicts, recommendations array is
   empty. Do not populate it.
6. Narrative JSON contradictions are scoring errors.
   If the Action Tag in the JSON does not match the
   matrix row stated in matrix_row_applied, stop and
   correct before submitting output.
7. Do not produce output until Step 9 self-check
   passes on all seven points.

---

*FE Content Audit Pipeline — Module 3 of 3*
*Version: M3-v1.0 | Parent: v3.9.0*
*Do not edit. Report ambiguities to prompt owner
via the feedback log.*

---
---

