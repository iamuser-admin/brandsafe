---
id: jp-cosmetics-ad-compliance
jurisdiction: JP
market: Japan
domain: cosmetics-advertising
rule_language: en          # rule text in English; example phrases kept in Japanese
version: 2020.2            # JCIA guideline 2020 ed. (2nd print) + current 適正広告基準
status: active
last_reviewed: 2026-06-27
recent_change:
  effective: 2023-10-01
  note: "景表法 ステマ規制 告示 施行 — 事業者の表示であることが不明な広告は不当表示 (R-JP-007)"
authorities: [MHLW, CAA, JCIA, JARO]   # 厚労省 / 消費者庁 / 日本化粧品工業会 / 日本広告審査機構
sources:
  - { ref: "薬機法 §66", title: "虚偽・誇大広告の禁止 (医薬品医療機器等法)", type: statute }
  - { ref: "医薬品等適正広告基準 第4", title: "厚労省 — 広告基準 + 解説・留意事項", type: guidance }
  - { ref: "化粧品の効能の範囲（56項目）", title: "厚労省通知 — 化粧品の標榜可能な効能効果", type: guidance }
  - { ref: "化粧品等の適正広告ガイドライン 2020年版", title: "日本化粧品工業会 (JCIA) — 基本編F / 表現編E", type: self_regulation }
  - { ref: "景品表示法 §5", title: "優良誤認・有利誤認 + ステマ告示 (消費者庁)", type: statute }
related:
  - shared/decency-language-universal
  - kr-cosmetics-ad-compliance#R-KR-001        # 의약품 경계선 — KR도 critical, 단 JP가 標榜範囲로 더 엄격
  - us-cosmetics-ad-compliance#cosmetic-vs-drug
---

# JP — Cosmetics Advertising Compliance

> Loaded into the evaluation prompt **only when** `target_market == JP`.
> Same jurisdiction-agnostic detection signals as the KR bundle; Japan binds
> them to stricter rules — a cosmetic may **only** claim within the 56 approved
> efficacy expressions, and anything beyond falls into quasi-drug / drug
> territory under 薬機法. Japanese example phrases are preserved verbatim for
> caption / audio matching.

## Scope

Product advertising for **cosmetics (化粧品)** in the Japanese market.
Quasi-drugs / medicated cosmetics (医薬部外品・薬用化粧品) have a *separate,
approved* indication scope and are flagged distinctly (see `product.category`).
A makeup foundation is normally a 化粧品 unless registered as 薬用.

---

## Reference: the claim ceiling

| concept | rule of thumb | foundation relevance |
|---|---|---|
| 化粧品の効能の範囲（56項目） | A 化粧品 may only standardize-claim effects within this MHLW list | coverage / 化粧持ち / うるおい OK; disease or structure-function NOT |
| 美白 (mechanism whitening) | only for **医薬部外品** with approved indication (例: メラニンの生成を抑え、シミ・そばかすを防ぐ) | ✗ a plain cosmetic foundation cannot claim mechanism whitening |
| 乾燥による小ジワを目立たなくする | allowed **only if 効能評価試験済み** (抗シワ製品評価ガイドライン) — `jcia_ref: E7-1` | conditional; needs test evidence |
| エイジングケア | = 年齢に応じたお手入れ, within efficacy range, must annotate (※年齢に応じたお肌の手入れ) | OK with annotation only |

---

## Rules

### R-JP-001 — Drug / disease-treatment claims
- **category:** `drug_misrepresentation`
- **severity:** `critical`
- **source:** 薬機法 §66
- **jcia_ref:** F1.0 (≈ 適正広告基準 第4の1 — 虚偽・誇大広告)
- **rule (EN):** Must not state or imply treatment / prevention / cure of disease
  or effect on the body's structure or function. This is the hardest line in JP
  and triggers 措置命令 / 課徴金.
- **✗ prohibited examples:**
  - `ニキビを治す` (cures acne)
  - `アトピーが治る` (atopic dermatitis is cured)
  - `シワを止める` / `10歳若返る` (stops wrinkles / reverses 10 years)
  - `炎症を抑える` (suppresses inflammation — medical)
- **○ allowed alternatives:**
  - `ニキビを防ぐ（薬用・医薬部外品の承認範囲のみ）` (prevents acne — *only* if 薬用 approved)
  - `肌を清潔に保つ` (keeps skin clean — within cosmetic range)
- **detection_signal:** `claim.medical_efficacy`, `claim.disease_reference`

### R-JP-002 — Claims beyond the 56 approved cosmetic efficacy range
- **category:** `efficacy_out_of_scope`
- **severity:** `high`
- **source:** 化粧品の効能の範囲（56項目）, 薬機法 §66
- **jcia_ref:** 表現編 E (効能効果)
- **rule (EN):** A 化粧品 may only claim effects within the 56-item list.
  Anything outside (e.g. permanent change, physiological modification) is a
  violation.
- **✗ prohibited examples:**
  - `毛穴が消える` (pores disappear)
  - `肌細胞を再生` (regenerates skin cells)
- **○ allowed alternatives:**
  - `キメを整え、肌をなめらかに見せる` (refines texture, makes skin look smooth)
- **detection_signal:** `claim.absolute_terms`, `claim.removal_of_condition`, `claim.anti_wrinkle`

### R-JP-003 — Whitening (美白) outside approved quasi-drug scope
- **category:** `whitening_misrepresentation`
- **severity:** `high`
- **source:** 医薬品等適正広告基準 第4, 化粧品の効能の範囲
- **jcia_ref:** 表現編 E（美白）
- **rule (EN):** Mechanism-of-action whitening claims are reserved for approved
  医薬部外品. A cosmetic foundation may only claim makeup brightening (色彩効果),
  not pigment suppression. When a 薬用 claim is used, the mechanism phrase must
  **not** be partially omitted.
- **✗ prohibited examples:**
  - `バリ美白` on a non-薬用 foundation (whitening on a plain cosmetic)
  - `メラニンの生成を抑え` の部分を省略 (omitting the mechanism qualifier from the approved phrase)
- **○ allowed alternatives:**
  - `明るい印象の仕上がり` (a brighter-looking finish — makeup effect)
- **detection_signal:** `claim.whitening`, `product.category`

### R-JP-004 — Fine-line (小ジワ) claim without test evidence
- **category:** `substantiation`
- **severity:** `medium`
- **source:** 化粧品の効能の範囲
- **jcia_ref:** E7-1 (「効能評価試験済み」特例)
- **rule (EN):** "乾燥による小ジワを目立たなくする" is permitted **only** for
  products verified per the 抗シワ製品評価ガイドライン, and must be annotated
  (e.g. `※乾燥による`). Footnote-only qualification of `小ジワ＊` is not acceptable.
- **detection_signal:** `claim.fine_lines`, `evidence.substantiation_present`

### R-JP-005 — Ingredient pharmacological implication / fake active
- **category:** `ingredient_misrepresentation`
- **severity:** `medium`
- **source:** 医薬品等適正広告基準 第4, JCIA 基本編
- **jcia_ref:** F（成分表現）
- **rule (EN):** Must not present a cosmetic ingredient as if it were a
  pharmacologically active component (有効成分). When highlighting an ingredient,
  the 配合目的 (purpose) must be co-stated to avoid active-ingredient misreading.
- **✗ prohibited examples:** `生薬エキス` / `漢方成分` implying drug efficacy; a single ingredient emphasized as 有効成分
- **○ allowed alternatives:** `○○配合（うるおいを与える成分として）` (ingredient + purpose co-stated)
- **detection_signal:** `ingredient.active_implication`

### R-JP-006 — Superlatives / No.1 (景表法 優良誤認)
- **category:** `substantiation`
- **severity:** `medium`
- **source:** 景品表示法 §5(1) 優良誤認
- **jcia_ref:** F（最大級表現）
- **rule (EN):** "No.1 / 最高 / 世界初" and superiority claims require objective
  substantiation; unsupported superlatives are 優良誤認.
- **✗ prohibited examples:** `カバー力世界No.1`, `最高の仕上がり` (without basis)
- **detection_signal:** `claim.superlative`, `claim.ranking`

### R-JP-007 — Stealth marketing / undisclosed paid promotion
- **category:** `disclosure`
- **severity:** `high`
- **source:** 景品表示法 §5(3) ステマ告示 (施行 2023-10-01)
- **rule (EN):** Advertising that a consumer cannot recognize as the
  advertiser's own representation is an unfair representation. Paid
  influencer / endorsement content must be labeled (`#PR` / `広告` / `提供`).
- **✗ prohibited examples:** a paid review with no ad label; `#PR` 표시 누락
- **detection_signal:** `endorsement.paid_undisclosed`, `disclosure.ad_label_present`
- **notes:** This rule has **no KR counterpart** in the current KR bundle — same
  detection signal, JP activates a rule that KR does not.

### R-JP-008 — Medical-professional recommendation
- **category:** `endorsement`
- **severity:** `high`
- **source:** 医薬品等適正広告基準 第4 (医薬関係者等の推薦)
- **rule (EN):** Must not state or imply recommendation / endorsement by doctors,
  pharmacists, or medical institutions.
- **✗ prohibited examples:** `皮膚科医推奨`, `医師が使用`
- **detection_signal:** `endorsement.medical_authority`

### R-JP-009 — Safety / efficacy guarantees & immediacy
- **category:** `exaggeration`
- **severity:** `medium`
- **source:** 医薬品等適正広告基準 第4, JCIA 基本編
- **jcia_ref:** F（保証的表現）
- **rule (EN):** Must not guarantee absolute safety or assert immediate /
  permanent efficacy.
- **✗ prohibited examples:** `肌に絶対安全`, `塗った瞬間に永久密着`
- **detection_signal:** `claim.safety_guarantee`, `claim.absolute_terms`

---

## Detection-signal → rule map

> Identical signal vocabulary to the KR bundle. Note `endorsement.paid_undisclosed`
> resolves to a rule here but is a no-op in KR — the divergence is config, not code.

```yaml
claim.medical_efficacy        -> [R-JP-001]
claim.disease_reference       -> [R-JP-001]
claim.absolute_terms          -> [R-JP-002, R-JP-009]
claim.removal_of_condition    -> [R-JP-002]
claim.anti_wrinkle            -> [R-JP-002]
claim.whitening               -> [R-JP-003]
claim.fine_lines              -> [R-JP-004]
ingredient.active_implication -> [R-JP-005]
claim.superlative             -> [R-JP-006]
claim.ranking                 -> [R-JP-006]
endorsement.paid_undisclosed  -> [R-JP-007]      # KR: no rule bound
disclosure.ad_label_present   -> [R-JP-007]
endorsement.medical_authority -> [R-JP-008]
claim.safety_guarantee        -> [R-JP-009]
content.sexual_suggestive     -> [shared/decency-language-universal]
```

---

## Verdict output schema (per finding)

```json
{
  "jurisdiction": "JP",
  "rule_id": "R-JP-001",
  "category": "drug_misrepresentation",
  "severity": "critical",
  "verdict": "fail",
  "evidence": {
    "modality": "audio_voiceover",
    "timecode": "00:11-00:13",
    "matched_text": "ニキビを治しながらカバー"
  },
  "citation": "薬機法 §66 / 適正広告基準 第4 (JCIA F1.0)",
  "enforcement_note": "措置命令 + 課徴金（景表法: 対象売上額 × 3%）の対象となり得る",
  "explanation": "Implies the foundation treats acne — outside the 56-item cosmetic efficacy range.",
  "remediation": "Drop the treatment claim; '肌を清潔に保つ' stays within cosmetic scope."
}
```

---

## Worked example (MUFE foundation creative — KR ↔ JP contrast)

| creative variant | JP verdict | rule | citation | (KR equivalent) |
|---|---|---|---|---|
| `ニキビを治しながらカバー` | ✗ fail | R-JP-001 | 薬機法 §66 | R-KR-001 (화장품법 §13①) |
| `バリ美白` (non-薬用) | ✗ fail | R-JP-003 | 適正広告基準 第4 | R-KR-002 (기능성 오인) |
| `毛穴が消える` | ✗ fail | R-JP-002 | 効能の範囲 56項目 | R-KR-003 (과대광고) |
| paid review, no `#PR` | ✗ fail | R-JP-007 | 景表法 ステマ告示 | — (no KR rule) |
| `皮膚科医推奨` | ✗ fail | R-JP-008 | 適正広告基準 第4 | R-KR-006 (전문가 추천) |
| `カバー力で明るい印象の仕上がり` | ○ pass | — | within 56-item range | ○ pass |
