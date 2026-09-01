# MODULE 1 — CLASSIFICATION

**Your job:** Clean the article body. Classify YMYL tier,
section, author status, and gates. Output two blocks.
Do not score. Do not assign action tags.

---

## INPUTS

```
INPUT TYPE: [A — Published Article | B — Editor Draft]
URL PATH: [null if Type B]
SECTION PATH: [e.g. /market/stock-insights/]
HEADLINE: [verbatim]
PUBLISHED DATE: [null only if editor did not provide]
AUTHOR NAME: ["No byline present" if absent]
AUTHOR BIO: ["No bio found" if absent]

RAW ARTICLE BODY:
[paste — Step 0 cleans it]
```

If AUTHOR BIO is completely blank (not "No bio found"
but genuinely empty) — stop and return:
`BLOCKED: Author bio field is empty. Provide bio before re-running.`

---

## STEP 0 — CONTENT CLEANING
Silent. Do not mention in output.

**Remove:**
1. Breadcrumb navigation (e.g. "Business News > market")
2. "FE Google Preferred Button" label
3. "Follow Us" tag
4. "FE Stock Insights on WhatsApp" block + "Join now" CTA
5. All "STORIES YOU MAY LIKE" sections and teasers
6. All "ALSO READ" inline links and anchor text
7. Standalone chart image placeholder lines
   (e.g. "Jyoti CNC: 1 Year Stock Price Chart / Source: Screener.in")

**Retain:**
1. Headline + standfirst
2. Author name + published date
3. Clean article body prose
4. Financial data tables with Source citations intact
5. "Note:" data sourcing paragraphs
6. Author bio and credentials
7. Disclosure / disclaimer statement

Edge rule: `Source: Screener.in` inside a data table → retain.
Same text as a standalone chart image label → remove.

---

## STEP 1 — YMYL CLASSIFICATION

Stop at the first YES. Record which question fired.

**Q1 — Direct personal impact:**
Primary subject is a named person's financial, employment,
health, legal, or safety situation AND readers in similar
circumstances will apply this to their own decisions? → **T1**

> Vicarious YMYL rule: third-person framing does not reduce
> the tier. "Reddit user's EMI default" / "Employee shocked
> by layoff" / "Man earns ₹30L, ITAT rules on penalty" = T1.

**Q2 — Specific instruction:**
Article gives specific financial product advice, investment
guidance, portfolio construction, insurance recommendation,
tax filing instruction, or immigration procedure? → **T1**

> Investment guidance rule: any article that tells or implies
> what to do with money — portfolio, fund selection, asset
> allocation — is T1 regardless of whether "advice" is used.

**Q3 — Commentary or analysis:**
Technology policy opinion, business trend analysis, regulatory
explainer, sector commentary, or macroeconomic observation
where readers form views but are not instructed to act? → **T2**

**Q4 — General content:**
Technology explainer, entertainment, lifestyle, science,
sports, opinion with no financial/health/legal application? → **T3**

Fallback: if uncertain between two tiers, assign the higher.
Record in NOTES.

---

## STEP 2 — SECTION CLASSIFICATION

Match section path against this table. Fixed — do not
override based on article content.

| Section path | Classification |
|---|---|
| /market/ | Core |
| /market/stock-insights/ | Core |
| /money/ | Core |
| /policy/ | Core |
| /business/ | Non-Core |
| /business/start-ups/ | Non-Core |
| /life/ | Non-Core |
| /sports/ | Non-Core |
| /world-news/ | Non-Core |
| /world-news/us-news/ | Non-Core |
| /india-news/ | Non-Core |
| /auto/ | Non-Core |
| /auto/car-news/ | Non-Core |
| /jobs-career/ | Non-Core |
| /trending/ | Non-Core |
| /business/industry/ | Mixed |

Section path not in table → classify Core; record in NOTES.
YMYL tier T1 or T2 AND section Non-Core → SECTION_MISMATCH: true.

---

## STEP 3 — AUTHOR STATUS

Derived from provided bio only. No URL fetch.
Highest achievable status: VERIFIED-FALLBACK.
Use the first matching row.

| # | Situation | STATUS |
|---|---|---|
| 1 | Named author + bio confirms named role at FE or IE Group | VERIFIED-FALLBACK |
| 2 | Named author + bio confirms named credential and named institution | VERIFIED-FALLBACK |
| 3 | Wire service byline only — PTI / Reuters / Bloomberg | WIRE |
| 4 | Named author + bio present but generic — no named role, institution, or credential | UNVERIFIED |
| 5 | Named author + bio field is "No bio found" | UNVERIFIED |
| 6 | Named author + bio confirms director/partner/owner of financial/advisory/insurance firm AND YMYL is T1 | CONFLICT-UNVERIFIED |
| 7 | "No byline present" OR collective desk name with no named individual | NO-BYLINE |

Fallback: no row matches → UNVERIFIED. Record in NOTES.

---

## STEP 4 — GATE DETECTION

Check all three independently. Multiple can fire.

**Gate A1 — Unverifiable source (T1/T2 only):**
YMYL tier T1 or T2 AND primary claims rely on unnamed experts,
unnamed analysts, unnamed industry sources, social media as
sole source, Wikipedia, or no source at all.

**Gate A2 — Social Media Aggregation:**
ALL THREE present simultaneously: (1) social media post summary
structure, (2) user comment quotes, (3) editorial observation,
AND primary source is a social media platform.

**Gate A3 — Reporting-on-advice accountability (T1/T2 only):**
Article reports on financial, medical, legal, or employment
advice given by anonymous or unqualified sources.
"We are reporting what Reddit said" does not transfer liability.

---

## OUTPUT

Two blocks. Both required.

**Block 1 — Classification JSON**

```json
{
  "schema_version": "M1-v2.0",
  "input_type": "A | B",
  "url_path": "string | null",
  "section_path": "string",
  "headline": "string",
  "published_date": "string | null",
  "published_date_source": "page | editor-provided | not-available",
  "pre_publication": "true | false",
  "author_name": "string | null",
  "author_bio_provided": "true | false",
  "author_bio_summary": "string | null",
  "ymyl_tier": "T1 | T2 | T3",
  "ymyl_tier_rule_fired": "Q1 | Q2 | Q3 | Q4",
  "ymyl_tier_one_line_reason": "string",
  "section_classification": "Core | Non-Core | Mixed",
  "author_status": "VERIFIED-FALLBACK | WIRE | UNVERIFIED | CONFLICT-UNVERIFIED | NO-BYLINE",
  "author_status_basis": "string",
  "gates_fired": [],
  "gate_a1_detail": "string | null",
  "gate_a2_detail": "string | null",
  "gate_a3_detail": "string | null",
  "section_mismatch_flag": "true | false",
  "module1_notes": "string | null"
}
```

**Block 2 — Cleaned body (plain text)**

```
CLEANED BODY
-------------------------------------------------
[cleaned article text]
-------------------------------------------------
END CLEANED BODY
```

Populate every JSON field. null only where explicitly
permitted above. module1_notes is for prompt quality
signals only — not editorial observations.

---

## RULES

1. Do not score content. Do not comment on quality.
2. No URL fetch. Work only from provided input.
3. VERIFIED is not a valid status — max is VERIFIED-FALLBACK.
4. If two author status rows appear to match, apply the
   lower-numbered row. Record conflict in NOTES.
5. NOTES is for prompt quality signals only —
   not editorial observations about the content.

---
---

