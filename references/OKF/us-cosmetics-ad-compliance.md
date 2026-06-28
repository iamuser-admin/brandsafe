---
id: us-cosmetics-ad-compliance
jurisdiction: US
market: United States
domain: cosmetics-advertising
rule_language: en
version: 2024.10
status: active
last_reviewed: 2026-06-27
recent_change:
  effective: 2024-10-21
  note: "FTC Trade Regulation Rule on Consumer Reviews & Testimonials 施行 — fake/AI reviews 금지 (R-US-006); JP ステ마 규제에 대응"
authorities: [FTC, FDA, NAD]   # NAD = BBB National Programs (self-regulatory)
sources:
  - { ref: "FTC Act §5", title: "Unfair or deceptive acts — truthful, non-misleading, substantiated", type: statute }
  - { ref: "FTC Health Products Compliance Guidance (Dec 2022)", title: "substantiation standard (replaced 1998 Dietary Supplement guide)", type: guidance }
  - { ref: "FDCA — cosmetic vs drug", title: "FDA: 'intended to treat disease / affect structure or function' = drug", type: statute }
  - { ref: "FTC Endorsement Guides (16 CFR Part 255, rev. 2023)", title: "material-connection disclosure; typical results", type: guidance }
  - { ref: "16 CFR Part 465 (2024)", title: "FTC rule banning fake/AI reviews & testimonials", type: regulation }
  - { ref: "MoCRA 2022", title: "FDA cosmetics modernization — safety/listing (context, not ad-claims)", type: statute }
related:
  - shared/decency-language-universal           # US: decency lever is PLATFORM policy, not law
  - kr-cosmetics-ad-compliance#R-KR-001
  - jp-cosmetics-ad-compliance#R-JP-001         # JP strictest (56-item ceiling); US is claims+disclosure led
---

# US — Cosmetics Advertising Compliance

> Loaded into the evaluation prompt **only when** `target_market == US`.
> Same jurisdiction-agnostic detection signals as KR / JP; the US binds them
> differently. There is **no government pre-clearance** — enforcement is
> post-market (FTC orders / civil penalties, FDA Warning Letters). The biggest
> levers are the FDA drug line and FTC substantiation + disclosure, **not**
> an enumerated prohibited-expression list.

## Scope

Product advertising for **cosmetics** in the US market. The defining question
for most violations is the **cosmetic-vs-drug line**: a product marketed with
disease or structure/function claims becomes an *unapproved new drug* under the
FDCA, regardless of formulation. Decency / sexual-content limits here come from
**advertising-platform policy** (Meta, TikTok, Google), not federal law — see
`R-US-008`.

---

## Reference: the cosmetic-vs-drug line (the spine)

| claim type | classification | example |
|---|---|---|
| Appearance / sensory / makeup effect | **cosmetic — OK** | `reduces the appearance of fine lines`, `covers blemishes`, `evens skin tone` |
| Disease treatment / prevention | **drug — violation** | `treats acne`, `heals rosacea`, `prevents eczema` |
| Affects body structure / function | **drug — violation** | `removes wrinkles`, `stimulates collagen`, `regenerates skin` |

> Rule of thumb: "**appearance of**" stays cosmetic; verbs of *treating,
> removing, stimulating, regenerating* cross into drug territory.

---

## Rules

### R-US-001 — Drug claims (cosmetic-vs-drug line)
- **category:** `drug_misrepresentation`
- **severity:** `critical`
- **source:** FDCA (FDA) — intended use as treatment / structure-function
- **rule (EN):** Must not claim to treat, cure, prevent, or mitigate disease, or
  to affect the structure or function of the body. Such claims reclassify a
  cosmetic as an unapproved new drug → FDA Warning Letter.
- **✗ prohibited examples:** `treats acne`, `heals breakouts`, `stimulates collagen`, `removes wrinkles`
- **○ allowed alternatives:** `reduces the appearance of blemishes`, `for a smoother-looking complexion`
- **detection_signal:** `claim.medical_efficacy`, `claim.disease_reference`

### R-US-002 — Unsubstantiated efficacy claims
- **category:** `substantiation`
- **severity:** `high`
- **source:** FTC Act §5, FTC Health Products Compliance Guidance (2022)
- **rule (EN):** Express or implied efficacy claims must be supported by
  *competent and reliable scientific evidence* before dissemination.
  "Establishment" claims (e.g. `clinically proven`) require the specific level
  of proof claimed.
- **✗ prohibited examples:** `clinically proven to erase dark spots` (no study), `lasts 24 hours` (untested)
- **○ allowed alternatives:** claim only what evidence supports; qualify scope
- **detection_signal:** `claim.efficacy_general`, `evidence.substantiation_present`

### R-US-003 — Superlatives / comparative / "#1"
- **category:** `substantiation`
- **severity:** `medium`
- **source:** FTC Act §5 (deceptive)
- **rule (EN):** Superlative, ranking, and comparative-superiority claims must be
  substantiated; unqualified `#1 / best / longest-lasting` is deceptive without basis.
- **✗ prohibited examples:** `#1 coverage in the world`, `the best foundation ever`
- **detection_signal:** `claim.superlative`, `claim.ranking`

### R-US-004 — Endorsement / influencer disclosure
- **category:** `disclosure`
- **severity:** `high`
- **source:** FTC Endorsement Guides (16 CFR Part 255)
- **rule (EN):** A material connection between advertiser and endorser (payment,
  free product, affiliation) must be disclosed **clearly and conspicuously**.
  Disclosure must be hard to miss in the creative itself (not buried).
- **✗ prohibited examples:** paid creator review with no `#ad` / vague `#sp` only
- **○ allowed alternatives:** clear `#ad` / `Paid partnership with …` up front
- **detection_signal:** `endorsement.paid_undisclosed`, `disclosure.ad_label_present`

### R-US-005 — Testimonials & before/after (typical results)
- **category:** `endorsement`
- **severity:** `medium`
- **source:** FTC Endorsement Guides (16 CFR Part 255)
- **rule (EN):** Testimonials and before/after demonstrations must reflect what
  consumers can *generally expect*. A "results not typical" disclaimer does not
  cure an atypical depiction.
- **✗ prohibited examples:** dramatic before/after implying universal results
- **detection_signal:** `endorsement.testimonial`, `content.before_after`

### R-US-006 — Fake / AI-generated reviews & endorsements
- **category:** `disclosure`
- **severity:** `high`
- **source:** FTC Rule on Consumer Reviews & Testimonials (16 CFR Part 465, 2024)
- **rule (EN):** Must not create, buy, or disseminate fake or AI-fabricated
  reviews/testimonials, or undisclosed insider reviews.
- **✗ prohibited examples:** AI-generated user testimonial, undisclosed employee review
- **detection_signal:** `endorsement.fake_review`
- **notes:** US counterpart to JP `R-JP-007` (ステマ). Same disclosure family,
  different statutory hook — same detection vocabulary.

### R-US-007 — "Natural / organic / hypoallergenic / clean"
- **category:** `misleading_qualifier`
- **severity:** `medium`
- **source:** FTC Act §5; FDA (terms not defined for cosmetics)
- **rule (EN):** FDA does not define `natural`, `hypoallergenic`, or `clean` for
  cosmetics; unqualified use that implies safety or composition benefits can be
  deceptive without substantiation.
- **✗ prohibited examples:** `100% natural` (unsubstantiated), `hypoallergenic` (no support)
- **detection_signal:** `claim.natural_organic`

### R-US-008 — Decency / sexual content (platform-governed)
- **category:** `decency`
- **severity:** `contextual`
- **source:** **advertising-platform policy** (Meta / TikTok / Google), not federal law
- **rule (EN):** Sexualized or explicit creative is constrained by the ad
  platform's policy, not by US advertising statutes (First Amendment limits
  government restriction). Evaluate against the target platform's ad policy.
- **detection_signal:** `content.sexual_suggestive` → `shared/decency-language-universal` + `platform_policy.{meta|tiktok|google}`
- **notes:** **Contrast point:** KR binds this to a statutory clause
  (`R-KR-004`, 저속·혐오); the US binds it to platform policy. Same signal,
  different *authority class*.

---

## Detection-signal → rule map

> Same signal vocabulary as KR / JP. `endorsement.fake_review` and
> `claim.natural_organic` resolve to rules here but are unbound (no-op) in the
> current KR / JP bundles — divergence is config, not code.

```yaml
claim.medical_efficacy        -> [R-US-001]
claim.disease_reference       -> [R-US-001]
claim.efficacy_general        -> [R-US-002]
claim.superlative             -> [R-US-003]
claim.ranking                 -> [R-US-003]
endorsement.paid_undisclosed  -> [R-US-004]
disclosure.ad_label_present   -> [R-US-004]
endorsement.testimonial       -> [R-US-005]
content.before_after          -> [R-US-005]
endorsement.fake_review       -> [R-US-006]      # KR/JP: no rule bound
claim.natural_organic         -> [R-US-007]      # KR/JP: no rule bound
content.sexual_suggestive     -> [R-US-008 (platform), shared/decency-language-universal]
```

---

## Verdict output schema (per finding)

```json
{
  "jurisdiction": "US",
  "rule_id": "R-US-001",
  "category": "drug_misrepresentation",
  "severity": "critical",
  "verdict": "fail",
  "evidence": {
    "modality": "on_screen_text",
    "timecode": "00:06-00:08",
    "matched_text": "treats acne while you wear it"
  },
  "citation": "FDCA — cosmetic-vs-drug line (FDA)",
  "enforcement_note": "FDA Warning Letter (unapproved new drug); no pre-clearance",
  "explanation": "‘Treats acne’ is a disease claim that reclassifies the foundation as a drug.",
  "remediation": "Use ‘for acne-prone skin’ / ‘reduces the appearance of blemishes’ (cosmetic)."
}
```

---

## Worked example (MUFE foundation creative — three-market contrast)

| creative variant | US | KR | JP |
|---|---|---|---|
| `treats acne while you wear it` | ✗ R-US-001 (FDCA) | ✗ R-KR-001 (화장품법 §13①) | ✗ R-JP-001 (薬機법 §66) |
| `clinically proven to erase dark spots` (no study) | ✗ R-US-002 (FTC §5) | ✗ R-KR-003 (과대) | ✗ R-JP-002 (56項目 범위) |
| paid creator review, no `#ad` | ✗ R-US-004 (16 CFR 255) | — (no KR rule) | ✗ R-JP-007 (ステマ) |
| AI-generated 5-star testimonial | ✗ R-US-006 (16 CFR 465) | — | — |
| `100% natural` (unsubstantiated) | ✗ R-US-007 | ✗ R-KR-007 (실증) | ✗ R-JP-006 (優良誤認) |
| suggestive framing | ⚠ platform policy (R-US-008) | ✗ R-KR-004 (저속·혐오, statutory) | ⚠ 公序良俗 / JARO |
| `covers blemishes for an even, brighter-looking finish` | ○ pass | ○ pass | ○ pass |
