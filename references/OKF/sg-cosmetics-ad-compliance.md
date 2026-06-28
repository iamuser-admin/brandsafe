---
id: sg-cosmetics-ad-compliance
jurisdiction: SG
market: Singapore
domain: cosmetics-advertising
rule_language: en
version: 2019.4            # HSA Guidelines (Apr 2019) + SCAP 2008 (3rd ed)
status: active
last_reviewed: 2026-06-27
recent_change:
  effective: 2025-12
  note: "ASEAN Cosmetic Directive Annexes 업데이트(성분 리스트) — claims 규칙엔 영향 없음, 성분 검증용 참고"
authorities: [HSA, ASAS, CCCS]   # HSA(법정) / ASAS(자율, under CASE) / CCCS(소비자보호)
regime: "notification-based — no pre-market approval; post-market enforcement"
sources:
  - { ref: "Singapore Code of Advertising Practice (SCAP, 3rd ed 2008)", title: "ASAS — legal · decent · honest · truthful", type: self_regulation }
  - { ref: "ASAS Guidelines for Interactive/Social Media Marketing", title: "ad identification & disclosure", type: self_regulation }
  - { ref: "HSA Guidelines on the Control of Cosmetic Products (GUIDE-CHP-200-004)", title: "cosmetic advertising + penalties", type: guidance }
  - { ref: "ASEAN Cosmetic Claims Guidelines (Appendix III)", title: "5-step decision process + unacceptable-claim examples", type: guidance }
  - { ref: "Health Products (Cosmetic Products – ACD) Regulations 2007", title: "subsidiary legislation under Health Products Act", type: statute }
  - { ref: "Consumer Protection (Fair Trading) Act (CPFTA / CCCS)", title: "false or misleading practices", type: statute }
related:
  - shared/decency-language-universal
  - kr-cosmetics-ad-compliance#R-KR-001
  - jp-cosmetics-ad-compliance#R-JP-001
  - us-cosmetics-ad-compliance#R-US-001
---

# SG — Cosmetics Advertising Compliance

> Loaded into the evaluation prompt **only when** `target_market == SG`.
> Same jurisdiction-agnostic detection signals as KR / JP / US. Singapore is a
> **notification regime** (no pre-market approval); claims are governed by the
> ASEAN Cosmetic Claims Guideline (the *what can a cosmetic claim* line) plus
> SCAP (decent / honest / truthful) and must be substantiated on request.
> Enforcement is post-market by HSA.

## Scope

Product advertising for **cosmetics** supplied in Singapore. The defining test
is the **ASEAN cosmetic-claim boundary**: a claim must be consistent with the
cosmetic product definition; claiming to *modify a physiological process* (e.g.
reverse hair loss) or to *prevent / treat disease* takes the product outside the
cosmetic category (→ `R-SG-001`).

---

## Reference: ASEAN Cosmetic Claims — 5-step decision process (Appendix III)

> Use to decide whether a claim stays within cosmetic boundaries. A claim that
> fails any step is out of scope. Note: claims can be **softened with modifiers**
> to become more cosmetic (e.g. `removes all oil` → `helps reduce excess oil`).

1. **Composition** — is the basis a recognised cosmetic ingredient?
2. **Site of application** — external parts only (skin, hair, nails, lips,
   external genitalia, teeth, oral mucosa)?
3. **Primary function** — cleansing, perfuming, changing appearance, protecting,
   keeping in good condition, correcting body odour? (secondary minor functions allowed)
4. **Physiological vs surface action** — must act on the surface; must not
   modify a physiological process.
5. **Claim wording** — no therapeutic / disease / structural claim; substantiable.

| boundary | cosmetic — OK | out of scope — violation |
|---|---|---|
| appearance | `evens out skin tone`, `covers blemishes` | `permanently removes pigmentation` |
| physiology | `helps skin feel hydrated` | `reverses hair loss`, `stimulates cell renewal` |
| disease | `for blemish-prone skin` | `treats acne`, `prevents eczema` |

---

## Rules

### R-SG-001 — Disease / physiological-modification claims
- **category:** `drug_misrepresentation`
- **severity:** `critical`
- **source:** ASEAN Cosmetic Claims Guideline; HSA Guidelines on Control of Cosmetic Products
- **rule (EN):** Must not claim to prevent or treat a disease/medical condition,
  or to modify a physiological process (e.g. reversal of hair loss). Such claims
  remove the product from the cosmetic category.
- **✗ prohibited examples:** `treats acne`, `reverses hair loss`, `stimulates collagen production`
- **○ allowed alternatives:** `for blemish-prone skin`, `helps skin look smoother`
- **detection_signal:** `claim.medical_efficacy`, `claim.disease_reference`, `claim.physiological_modification`

### R-SG-002 — Claims outside the cosmetic boundary (5-step)
- **category:** `efficacy_out_of_scope`
- **severity:** `high`
- **source:** ASEAN Cosmetic Claims Guideline (Appendix III)
- **rule (EN):** A claim must pass the 5-step decision process. Absolute or
  function-level claims that imply more than surface/cosmetic action are
  unacceptable; soften with modifiers where appropriate.
- **✗ prohibited examples:** `removes all oil from skin`, `pores permanently gone`
- **○ allowed alternatives:** `helps reduce the appearance of excess shine`
- **detection_signal:** `claim.absolute_terms`, `claim.removal_of_condition`

### R-SG-003 — Substantiation (SCAP)
- **category:** `substantiation`
- **severity:** `high`
- **source:** SCAP; HSA Guidelines (claims must be fully substantiated on request)
- **rule (EN):** All advertising claims must be capable of substantiation by
  scientific data/evidence or by the formulation itself, and produced on request.
- **✗ prohibited examples:** `clinically proven 48-hour coverage` (no study)
- **detection_signal:** `claim.efficacy_general`, `evidence.substantiation_present`

### R-SG-004 — Decency (SCAP clause 2.1)
- **category:** `decency`
- **severity:** `medium`
- **source:** SCAP clause 2.1 (offence to prevailing standards of decency)
- **rule (EN):** Advertisements should not contain anything that offends
  prevailing standards of decency.
- **detection_signal:** `content.sexual_suggestive`, `content.vulgar_language`, `content.offensive_imagery`
- **notes:** Defers to `shared/decency-language-universal` for the base signal;
  this clause supplies the SG citation. (See "shared layer" discussion.)

### R-SG-005 — Honest & truthful / testimonials (SCAP)
- **category:** `endorsement`
- **severity:** `medium`
- **source:** SCAP (honest, truthful; genuine testimonials)
- **rule (EN):** Claims must be honest and not misleading; testimonials must be
  genuine and reflect typical experience.
- **detection_signal:** `endorsement.testimonial`, `content.before_after`

### R-SG-006 — Advertising identification / influencer disclosure
- **category:** `disclosure`
- **severity:** `high`
- **source:** ASAS Guidelines for Interactive/Social Media Marketing
- **rule (EN):** Paid or incentivised content must be clearly identifiable as
  advertising (e.g. `#ad`, `Sponsored`).
- **✗ prohibited examples:** paid creator post with no ad label
- **detection_signal:** `endorsement.paid_undisclosed`, `disclosure.ad_label_present`

### R-SG-007 — Superlatives / ranking
- **category:** `substantiation`
- **severity:** `medium`
- **source:** SCAP (truthful); CPFTA (CCCS)
- **rule (EN):** Superlative / ranking claims require substantiation; unsupported
  `#1 / best` is misleading.
- **detection_signal:** `claim.superlative`, `claim.ranking`

---

## Detection-signal → rule map

```yaml
claim.medical_efficacy         -> [R-SG-001]
claim.disease_reference        -> [R-SG-001]
claim.physiological_modification -> [R-SG-001]
claim.absolute_terms           -> [R-SG-002]
claim.removal_of_condition     -> [R-SG-002]
claim.efficacy_general         -> [R-SG-003]
content.sexual_suggestive      -> [R-SG-004, shared/decency-language-universal]
content.vulgar_language        -> [R-SG-004]
endorsement.testimonial        -> [R-SG-005]
content.before_after           -> [R-SG-005]
endorsement.paid_undisclosed   -> [R-SG-006]
disclosure.ad_label_present    -> [R-SG-006]
claim.superlative              -> [R-SG-007]
claim.ranking                  -> [R-SG-007]
```

---

## Verdict output schema (per finding)

```json
{
  "jurisdiction": "SG",
  "rule_id": "R-SG-001",
  "category": "drug_misrepresentation",
  "severity": "critical",
  "verdict": "fail",
  "evidence": {
    "modality": "on_screen_text",
    "timecode": "00:09-00:11",
    "matched_text": "reverses hair loss"
  },
  "citation": "ASEAN Cosmetic Claims Guideline (Appendix III) / HSA GUIDE-CHP-200-004",
  "enforcement_note": "HSA may direct withdrawal; offence under Health Products (ACD) Regulations — fine up to S$20,000 and/or 12 months",
  "explanation": "Modifying a physiological process (hair regrowth) is outside the cosmetic boundary.",
  "remediation": "Reframe to a cosmetic surface claim or drop the physiological claim."
}
```

---

## Worked example (MUFE foundation creative — four-market contrast)

| creative variant | SG | US | KR | JP |
|---|---|---|---|---|
| `treats acne while you wear it` | ✗ R-SG-001 | ✗ R-US-001 | ✗ R-KR-001 | ✗ R-JP-001 |
| `removes all oil from skin` | ✗ R-SG-002 | ✗ R-US-002 | ✗ R-KR-003 | ✗ R-JP-002 |
| paid creator review, no `#ad` | ✗ R-SG-006 | ✗ R-US-004 | — | ✗ R-JP-007 |
| suggestive framing | ✗ R-SG-004 (SCAP 2.1) | ⚠ platform policy | ✗ R-KR-004 | ⚠ 公序良俗 |
| `covers blemishes for an even, brighter-looking finish` | ○ pass | ○ pass | ○ pass | ○ pass |
