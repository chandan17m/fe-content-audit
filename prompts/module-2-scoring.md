# MODULE 2 — SCORING

**Your job:** Score HCS, E-E-A-T, and Spam. Fire named flags.
Input: Module 1 JSON + Cleaned Body.
Read all Module 1 fields as fixed. Do not re-derive them.

---

## INPUTS

```
INPUT 1 — MODULE 1 JSON:
[paste complete Module 1 JSON block]

INPUT 2 — CLEANED BODY:
[paste Module 1 Cleaned Body block — not the original raw text]
```

If Module 1 JSON is missing required fields — stop:
`BLOCKED: Module 1 JSON incomplete. Re-run Module 1.`

---

## STEP 1 — PRIMARY SOURCE HIERARCHY

Identify the tier of the primary source supporting the
article's central claims. Assign one tier only.

| Tier | Sources |
|---|---|
| A | RBI, SEBI, IRDAI, DGCA, Ministry of Finance, Ministry of Labour, Supreme Court, High Courts, Official Gazette, EPFO, CMIE, NSE/BSE filings, audited annual reports, earnings transcripts, named court orders (ITAT, NCLAT), AMFI named report/release, PFRDA, MCA filings, CRISIL named report, ICRA, CARE Ratings, India Ratings, Morningstar India named report |
| B | US Fed, SEC, IRCC, IMF, World Bank, WHO, NIH, peer-reviewed journals |
| C | Named expert with named institutional affiliation and named role — SEBI-RIA, CFP, FPSB member, ICAI member, employment lawyer, named academic, named AMC executive (name + role + fund house all visible) |
| D | Reuters, Bloomberg, PTI reporting on primary sources. Named publication with editorial standards. Insufficient for T1 advice. |
| E | Wikipedia, social media, anonymous sources, unnamed experts/analysts, unattributed studies, "industry sources," "data showed" with no named dataset |

**Secondary Source Downgrade:** "according to [publication]"
or "reports [publication]" → that source downgrades to Tier D.

**Specific rules:**
- AMFI + named report/release → Tier A.
  "AMFI data showed" with no named report → Tier D.
- CRISIL Research/Intelligence + named report → Tier A.
  "CRISIL showed" with no named report → Tier D.
- Specific figures (percentages, return ranges, fund comparisons)
  with no named source, dataset, or time period → Tier E for those claims.

---

## STEP 2 — HCS SCORING

Apply in sequence. Stop at first match.

**HCS-1 — Vagueness Test (T1 and T2 only):**
If ALL THREE present simultaneously → HCS: Fail.

- No named figures (rupee amounts, percentages, thresholds)
- No named instruments (schemes, products, regulations, policies)
- No named Indian financial authorities or institutions

Skip HCS-1 for T3.

**HCS-2 — Gate A1 ceiling (T1 and T2 only):**
If Gate A1 in `gates_fired` (Module 1 JSON) → HCS ceiling: Partial.
HCS Pass unavailable. Proceed to HCS-3 with ceiling active.

**HCS-3 — Criteria table:**

| Verdict | All conditions must be met |
|---|---|
| Pass | (1) Article answers the specific question its headline poses with named specifics — named case, regulation, figure, fund, or institution. AND (2) Primary claims supported by Tier A, B, or C. AND (3) Reader gains substantive understanding not easily assembled from generic sources. |
| Partial | Some useful content BUT at least one of: key claims use unsourced figures or generic category references. OR article is structured primarily for search. OR Gate A1 ceiling applies. |
| Fail | Vagueness Test fired. OR headline makes a specific promise the body does not fulfil. OR entire informational contribution is replicable from any generic primer. OR zero information gain. |

---

## STEP 3 — E-E-A-T SCORING

Apply in sequence. Stop at first binding outcome.

**EEAT-1 — Author status ceiling:**

| STATUS | Outcome |
|---|---|
| CONFLICT-UNVERIFIED | E-E-A-T: Fail — stop. |
| WIRE on T1 | Partial ceiling — cannot reach Pass. |
| UNVERIFIED | Partial ceiling — cannot reach Pass. |
| NO-BYLINE | Partial ceiling — cannot reach Pass. |
| VERIFIED-FALLBACK | No ceiling — proceed to EEAT-2. |
| WIRE on T2 or T3 | No ceiling — proceed to EEAT-2. |

**EEAT-2 — Gate check:**
Gate A1 in `gates_fired` (Module 1 JSON) → E-E-A-T: Fail — stop.
Gate A3 in `gates_fired` (Module 1 JSON) → E-E-A-T: Fail — stop.

**EEAT-3 — Criteria table (T1 and T2):**

| Verdict | All conditions must be met |
|---|---|
| Pass | (1) VERIFIED-FALLBACK status. AND (2) Primary claims supported by Tier A or B. AND (3) On T1: actionable advice validated by a named Tier C expert quoted with name, role, and institution all visible. |
| Partial | VERIFIED-FALLBACK or WIRE (T2). AND at least one of: sourcing Tier C/D rather than A/B; one gap in source chain; wire on T2. AND no Tier A gate fired. |
| Fail | Any Tier A gate fired. OR CONFLICT-UNVERIFIED. OR UNVERIFIED on T1 with no independent named Tier C expert providing primary backing. |

**EEAT-4 — T3 Lite (T3 only):**

| Verdict | Criteria |
|---|---|
| Pass (T3 Lite) | VERIFIED-FALLBACK status AND primary claims from Tier A, B, or C. |
| Partial (T3 Lite) | UNVERIFIED or NO-BYLINE status. OR sourcing primarily Tier D. |
| Fail (T3 Lite) | NO-BYLINE. OR primary source Tier E. OR demonstrably AI-generated with no human attribution. |

---

## STEP 4 — SPAM SCORING

Apply in sequence. Stop at first match.

**SPAM-1 — Gate A2:**
Gate A2 in `gates_fired` (Module 1 JSON) → Spam: Fail.
Record [SOCIAL_MEDIA_AGGREGATION].

**SPAM-2 — Thin Content:**
If ALL THREE simultaneously true → Spam: Fail.
Record [STRUCTURAL_INFLATION].

(a) Primary claims have no named source, dataset, or time period.
(b) Advice or analysis is generic — replicable without proprietary
    data, original reporting, or original research.
(c) Apparent depth is structural only — created by subheadings
    or formatting, not substantive contribution.

> Authorship alone does not pass Spam. Authored thin content
> with no sourced data fails the Thin Content check.

**SPAM-3 — Criteria table:**

| Verdict | Criteria |
|---|---|
| Pass | Genuine original reporting. No scaled production signals. Primary data claims are sourced, named, or tied to named events that make them non-replicable. |
| Partial | Some templated structure or aggregation BUT at least one claim independently verified with a named Tier C source OR at least one non-replicable original contribution. Gate A2 not fired. |
| Fail | Gate A2 fired. OR Thin Content check fired. OR scaled or scraped content confirmed. |

**Batch flag:** If same author produces 2+ articles in same
session with SMA format AND identical/near-identical disclaimer
wording → fire [AUTHOR_LEVEL_SCALED_ABUSE]. Overrides Spam
Partial to Fail for all matching articles.

---

## STEP 5 — NAMED FLAGS

Fire all that apply. Each flag = one mandatory recommendation
item in Module 3. Priority order:

| Flag | Trigger |
|---|---|
| [MENTAL_HEALTH_DISTRESS Level 2] | "Hopeless," "helpless," or survival-only motivation language published without any mental health resource. Auto-escalate. |
| [MENTAL_HEALTH_DISTRESS Level 1] | General financial/employment distress language without mental health resource. |
| [DATA_CLARITY_FAIL] | Performance/return/penalty figures with no named source, no named dataset, no named time period. OR sole citation >3 years old on fast-moving topic. |
| [SOCIAL_MEDIA_AGGREGATION] | Gate A2 confirmed. |
| [STRUCTURAL_INFLATION] | Subheadings creating appearance of depth over 2–3 sentence sections with thin content. |
| [DIRECTIVE_HEADLINE_FAIL] | Action directive in headline; body names no specifics to fulfil it. |
| [EXCERPT_MISMATCH] | Excerpt and body contain materially different claims. |
| [T1_YMYL_ACTIONABILITY_GAP] | T1 financial topic — data reported — no guidance layer for a reader in the same situation. |
| [SECTION_MISMATCH] | `section_mismatch_flag` is true in Module 1 JSON. |
| [AUTHOR_LEVEL_SCALED_ABUSE] | Same author + SMA format + 2+ articles in same session. Overrides Spam Partial to Fail. |
| [NON_CORE_DOMAIN_DILUTION] | Any Non-Core section content. |
| [DISCOVER_IDENTITY_RISK] | Core section content covering topic outside FE's financial/business identity. |

---

## STEP 6 — DISCLAIMER AND FRESHNESS

**Disclaimer:** Search full cleaned body.
- Found → quote verbatim in output. Effect: neutral only.
  Never use to upgrade any verdict.
- Not found → negative signal against E-E-A-T. Does not
  override verdicts but record absent.

**Freshness:**
- Market, regulatory, AI, crypto: faster decay. Flag if
  primary citation >6 months on a fast-moving topic.
- Evergreen: 18-month decay threshold.
- PRE_PUBLICATION with no date → freshness: skipped.

---

## OUTPUT

```json
{
  "schema_version": "M2-v2.0",

  "carried_from_m1": {
    "ymyl_tier": "T1 | T2 | T3",
    "section_classification": "Core | Non-Core | Mixed",
    "section_path": "string",
    "author_status": "string",
    "gates_fired": [],
    "published_date": "string | null",
    "published_date_source": "page | editor-provided | not-available",
    "pre_publication": "true | false",
    "section_mismatch_flag": "true | false"
  },

  "primary_source_tier": "A | B | C | D | E",
  "primary_source_basis": "string",

  "hcs_step_fired": "HCS-1 | HCS-2 | HCS-3",
  "hcs_verdict": "Pass | Partial | Fail",
  "hcs_verdict_rule": "string",
  "hcs_core_finding": "string",
  "hcs_verbatim_evidence": "string | null",

  "eeat_step_fired": "EEAT-1 | EEAT-2 | EEAT-3 | EEAT-4",
  "eeat_verdict": "Pass | Partial | Fail | Pass (T3 Lite) | Partial (T3 Lite) | Fail (T3 Lite)",
  "eeat_verdict_rule": "string",
  "eeat_core_finding": "string",
  "eeat_verbatim_evidence": "string | null",

  "spam_step_fired": "SPAM-1 | SPAM-2 | SPAM-3",
  "spam_verdict": "Pass | Partial | Fail",
  "spam_verdict_rule": "string",
  "spam_core_finding": "string",
  "spam_verbatim_evidence": "string | null",

  "disclaimer_found": "true | false",
  "disclaimer_verbatim": "string | null",

  "flags_fired": [],

  "freshness_note": "string | null",

  "module2_notes": "string | null"
}
```

Populate every field. null only where explicitly permitted.
carried_from_m1 values must match Module 1 JSON exactly.
module2_notes is for prompt quality signals only.

---

## RULES

1. Do not assign Action Tags. Do not know Module 3.
2. Read all Module 1 fields as fixed data.
   Do not re-derive any of them.
3. Verbatim evidence must be verbatim — paraphrased
   text inside quotation marks is a scoring error.
4. When a criteria row is partially met, assign the
   lower verdict — never round up.
5. Disclaimer present is neutral. Never use to upgrade.
6. [AUTHOR_LEVEL_SCALED_ABUSE] overrides Spam Partial
   to Fail before writing output.
7. NOTES is for prompt quality signals only.

---
---

