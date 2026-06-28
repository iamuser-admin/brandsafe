---
id: kr-cosmetics-ad-compliance
jurisdiction: KR
market: South Korea
domain: cosmetics-advertising
rule_language: en          # rule text in English; example phrases kept in Korean
version: 2025.1
status: active
last_reviewed: 2026-06-27
upcoming_change:
  effective: 2026-10-08
  note: "화장품법 개정 시행 — 금지표현 목록 및 실증 규정 재검토 필요 (diff 대상)"
authorities: [MFDS, KFTC, KCIA]
sources:
  - { ref: "화장품법 §13", title: "부당한 표시·광고 행위의 금지", type: statute }
  - { ref: "화장품법 §14", title: "표시·광고 내용의 실증", type: statute }
  - { ref: "화장품법 시행규칙 별표5", title: "부당한 표시·광고의 범위 (제22조 관련)", type: regulation }
  - { ref: "식약처 화장품 표시·광고 관리 지침", title: "민원인 안내서 (2025.1)", type: guidance }
  - { ref: "대한화장품협회 광고 자문 기준 및 해설서 2023", title: "KCIA 자율심의 해설", type: self_regulation }
  - { ref: "표시·광고의 공정화에 관한 법률", title: "Fair Labeling and Advertising Act (KFTC)", type: statute }
related:
  - shared/decency-language-universal      # 선정성·언어·주제이탈 공통 레이어
  - jp-cosmetics-ad-compliance#drug-claim-line   # 의약품 경계선 비교 (가장 엄격)
  - us-cosmetics-ad-compliance#cosmetic-vs-drug
---

# KR — Cosmetics Advertising Compliance

> Loaded into the evaluation prompt **only when** `target_market == KR`.
> The detection layer (TwelveLabs Pegasus) extracts jurisdiction-agnostic
> *signals* from the video; the rules below map those signals to KR verdicts
> with a citable clause. Korean example phrases are preserved verbatim so
> Pegasus can match on-screen captions / audio in the original language.

## Scope

Applies to product advertising for **cosmetics (화장품)** distributed in the
Korean market, across video / social / display creatives. Does **not** cover
quasi-drugs (의약외품) or functional-cosmetic registration itself — only the
*advertising claims* made about the product.

---

## Reference: allowed functional-cosmetic claim categories (기능성화장품)

A claim in these categories is permitted **only if the product is registered
as a functional cosmetic (기능성화장품)** in that category. Otherwise it is a
violation (see `R-KR-002`).

| category | allowed claim scope | foundation relevance |
|---|---|---|
| 미백 (whitening) | 피부 미백에 도움 | only if registered |
| 주름개선 (anti-wrinkle) | 피부 주름 개선에 도움 | only if registered |
| 자외선차단 (UV protection) | 자외선 차단·산란 (SPF/PA 표기) | only if tested & registered |
| 여드름성 피부 완화 | 인체세정용(wash-off) 제품 한정 | ✗ not valid for leave-on foundation |

---

## Rules

### R-KR-001 — Drug-like / disease-treatment claims
- **category:** `drug_misrepresentation`
- **severity:** `critical`
- **source:** 화장품법 §13①, 시행규칙 별표5 (의약품으로 잘못 인식할 우려)
- **rule (EN):** Must not state or imply that the product diagnoses, treats,
  mitigates, cures, or prevents any disease, or has medicinal / pharmacological
  effect on the body.
- **✗ prohibited examples:**
  - `여드름을 치료` (treats acne)
  - `아토피 개선` (improves atopic dermatitis)
  - `탈모 치료` / `발모` (treats hair loss / regrows hair)
  - `상처·흉터를 회복` (heals wounds / scars)
  - `피부 염증을 가라앉혀` (calms skin inflammation — medical)
- **○ allowed alternatives:**
  - `여드름성 피부를 위한 메이크업` (makeup *for* acne-prone skin — descriptive)
  - `피부를 깨끗하게 가꾸어 줍니다` (helps keep skin clean/conditioned)
- **detection_signal:** `claim.medical_efficacy`, `claim.disease_reference`
- **notes:** "여드름성 피부 완화" is an allowed *functional* claim **only** for
  registered wash-off products — never for a leave-on foundation.

### R-KR-002 — Functional claims without registration
- **category:** `functional_misrepresentation`
- **severity:** `high`
- **source:** 화장품법 §2(2), §13①, 시행규칙 별표5
- **rule (EN):** Must not make a whitening / anti-wrinkle / UV-protection (etc.)
  efficacy claim unless the product is registered as a functional cosmetic in
  that category. Generic makeup coverage ≠ functional whitening.
- **✗ prohibited examples (for a non-functional foundation):**
  - `바르는 순간 미백` (instant whitening)
  - `주름이 펴지는` (wrinkles get smoothed out)
- **○ allowed alternatives:**
  - `화사한 톤으로 표현` (expresses a brighter tone — optical/makeup effect)
  - `잡티를 자연스럽게 커버` (naturally covers blemishes — coverage, not treatment)
- **detection_signal:** `claim.whitening`, `claim.anti_wrinkle`, `product.registration_status`

### R-KR-003 — Exaggeration beyond cosmetic scope (과대광고)
- **category:** `exaggeration`
- **severity:** `high`
- **source:** 화장품법 §13①, 시행규칙 별표5 (사실과 다르거나 과장)
- **rule (EN):** Must not claim effects exceeding the cosmetic definition or
  not supported by fact (permanent / absolute / complete removal of skin
  conditions).
- **✗ prohibited examples:**
  - `검버섯·기미를 완전히 제거` (completely removes age spots / melasma)
  - `모공이 사라지는` (pores disappear)
  - `100% 천연` without substantiation (see also `R-KR-007`)
- **○ allowed alternatives:**
  - `기미·잡티를 가려 줍니다` (covers spots and blemishes — visual coverage)
- **detection_signal:** `claim.absolute_terms`, `claim.removal_of_condition`

### R-KR-004 — Vulgar or offensive expression (저속·혐오)
- **category:** `decency`
- **severity:** `medium`
- **source:** 화장품법 시행규칙 별표5 (저속하거나 혐오감을 주는 표현·도안·사진)
- **rule (EN):** Must not use vulgar, offensive, or repugnant expressions,
  illustrations, or imagery. (Sexualized framing is also caught by the shared
  `decency-language-universal` layer; this rule is the KR-specific statutory hook.)
- **detection_signal:** `content.sexual_suggestive`, `content.vulgar_language`, `content.offensive_imagery`
- **notes:** Threshold is stricter than US; defer to the shared layer for the
  base signal, apply this clause for the KR citation.

### R-KR-005 — Disparagement of other products (비방광고)
- **category:** `disparagement`
- **severity:** `medium`
- **source:** 화장품법 시행규칙 별표5 (타 제품 비방)
- **rule (EN):** Must not disparage other companies' products, or imply
  superiority by denigrating competitors (explicitly or implicitly).
- **✗ prohibited examples:** `다른 파운데이션은 금방 무너지지만` (unlike other foundations that break down…)
- **detection_signal:** `claim.comparative_negative`

### R-KR-006 — Medical / expert endorsement (전문가 추천·보증)
- **category:** `endorsement`
- **severity:** `high`
- **source:** 화장품법 시행규칙 별표5 (의사·치과의사·약사·의료기관 등의 추천·지정·공인)
- **rule (EN):** Must not state or imply that the product is recommended,
  designated, certified, or used by doctors, pharmacists, or medical
  institutions.
- **✗ prohibited examples:**
  - `피부과 전문의 추천` (recommended by dermatologists)
  - `○○병원 사용` (used by ○○ hospital)
- **detection_signal:** `endorsement.medical_authority`

### R-KR-007 — Superlatives & unsubstantiated claims (실증)
- **category:** `substantiation`
- **severity:** `medium`
- **source:** 화장품법 §14 (실증), 표시·광고의 공정화에 관한 법률
- **rule (EN):** Objective efficacy / superlative / ranking claims must be
  substantiated on request. Unqualified "best / No.1 / world-first" without
  evidence is a violation.
- **✗ prohibited examples:** `세계 1위 커버력`, `국내 최고` (without basis)
- **detection_signal:** `claim.superlative`, `claim.ranking`, `evidence.substantiation_present`

---

## Detection-signal → rule map

> The detection layer emits these signals per creative; the resolver applies
> only the rules whose `detection_signal` fires, scoped to KR.

```yaml
claim.medical_efficacy      -> [R-KR-001]
claim.disease_reference     -> [R-KR-001]
claim.whitening             -> [R-KR-002]
claim.anti_wrinkle          -> [R-KR-002]
claim.absolute_terms        -> [R-KR-003]
claim.removal_of_condition  -> [R-KR-003]
content.sexual_suggestive   -> [R-KR-004, shared/decency-language-universal]
content.vulgar_language     -> [R-KR-004]
claim.comparative_negative  -> [R-KR-005]
endorsement.medical_authority -> [R-KR-006]
claim.superlative           -> [R-KR-007]
claim.ranking               -> [R-KR-007]
```

---

## Verdict output schema (per finding)

```json
{
  "jurisdiction": "KR",
  "rule_id": "R-KR-001",
  "category": "drug_misrepresentation",
  "severity": "critical",
  "verdict": "fail",
  "evidence": {
    "modality": "on_screen_text",
    "timecode": "00:07-00:09",
    "matched_text": "여드름을 치료하면서 커버"
  },
  "citation": "화장품법 §13① / 시행규칙 별표5 (의약품 오인)",
  "explanation": "Implies the foundation treats acne — a drug claim outside the cosmetic scope.",
  "remediation": "Reframe as descriptive: '여드름성 피부를 위한 커버' (coverage for acne-prone skin)."
}
```

---

## Worked example (MUFE foundation creative)

| creative variant | KR verdict | rule | citation |
|---|---|---|---|
| `여드름을 치료하며 커버` | ✗ fail | R-KR-001 | 화장품법 §13① |
| `바르는 순간 미백` (non-functional) | ✗ fail | R-KR-002 | 화장품법 §2(2)·§13① |
| `검버섯을 완전히 제거` | ✗ fail | R-KR-003 | 별표5 (과대) |
| `피부과 전문의 추천` | ✗ fail | R-KR-006 | 별표5 (전문가 추천) |
| `잡티를 자연스럽게 커버, 화사한 톤 표현` | ○ pass | — | within cosmetic scope |
