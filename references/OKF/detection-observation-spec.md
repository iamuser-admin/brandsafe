---
id: detection-observation-spec
type: detection-spec
role: "TwelveLabs Pegasus — jurisdiction-agnostic observation layer"
version: 1.0
last_reviewed: 2026-06-27
feeds: cosmetics-ad-compliance-okf      # resolver maps observations -> signals -> market rules
principle: >
  Pegasus reports WHAT IS PRESENT, never whether it is allowed. The field set is
  the union of all detection signals across US/KR/JP/SG bundles; the prompt fills
  only observed values. All jurisdiction judgement happens downstream.
---

# Detection Observation Spec (Pegasus)

## Why it's built this way

1. **Back-derive the fields from the signal union.** Every observable below maps
   to one or more detection signals used by the four market bundles. The
   detection layer is the *superset*; no market-specific logic lives here.
2. **Observe, don't judge.** Pegasus emits observations (claim text, evidence,
   location, confidence). The resolver attaches the loaded market bundle and
   decides verdicts. Pegasus never sees a country or a rule.
3. **Verbatim, original-language.** Claims are captured word-for-word in the
   source language so the resolver can match against the bundles' native ○/×
   example phrases (화장품법 / JCIA / ASEAN), with an English gloss for review.

---

## The observation field set (controlled vocabulary)

> Each value ties back to the signal(s) it feeds. This table is the contract.

### `claims[].claim_type`
| observed value | feeds signal(s) |
|---|---|
| `disease_or_treatment` | claim.medical_efficacy · claim.disease_reference |
| `physiological_change` | claim.physiological_modification |
| `whitening_pigment` | claim.whitening |
| `wrinkle_reduction` | claim.anti_wrinkle |
| `fine_lines_dryness` | claim.fine_lines |
| `absolute_or_permanent` | claim.absolute_terms |
| `removes_condition` | claim.removal_of_condition |
| `general_efficacy` | claim.efficacy_general |
| `superlative_or_ranking` | claim.superlative · claim.ranking |
| `competitor_disparagement` | claim.comparative_negative |
| `natural_clean_descriptor` | claim.natural_organic |
| `safety_or_immediacy` | claim.safety_guarantee |

### `ingredients[]` / `product`
| observed field | feeds signal(s) |
|---|---|
| `ingredients[].framed_as_active`, `.purpose_stated` | ingredient.active_implication |
| `product.type_cues` (e.g. "functional", "薬用/医薬部外品", "drug") | product.category · product.registration_status |

### `endorsement` / `disclosure`
| observed field | feeds signal(s) |
|---|---|
| `endorsement.type = medical_professional` | endorsement.medical_authority |
| `endorsement.paid_indicators[]` | endorsement.paid_undisclosed |
| `disclosure.ad_label_present`, `.ad_label_text` | disclosure.ad_label_present |
| `endorsement.type = consumer_testimonial` | endorsement.testimonial |
| `endorsement.before_after_demo` | content.before_after |
| `endorsement.synthetic_indicators[]` | endorsement.fake_review |

### `content_flags[].type`
| observed value | feeds signal(s) |
|---|---|
| `sexual_or_suggestive` | content.sexual_suggestive · content.nudity_explicit |
| `profanity_or_vulgar` | content.vulgar_language |
| `offensive_imagery` | content.offensive_imagery |
| `demeaning_protected_group` | content.hate_discrimination |
| `violence_or_gore` | content.violence_gore |
| `unsafe_behavior` | content.unsafe_behavior |

### `off_topic`
| observed field | feeds signal |
|---|---|
| `off_topic.observed`, `.dominant_unrelated_content` | content.off_topic |

---

## The Pegasus prompt (copy-paste)

```text
You are a neutral video OBSERVATION engine for advertising creatives. Watch the
ENTIRE video across every modality: spoken audio (transcribe), on-screen text and
captions (read/OCR), hashtags and labels, and the visual scene.

YOUR ONLY JOB is to report WHAT IS PRESENT as structured observations.
You do NOT decide whether anything is allowed, legal, compliant, deceptive, or a
violation. You do NOT consider any country, regulation, platform, or audience.
Never output the words "violation", "compliant", "illegal", "allowed", or a verdict.

RULES
- Report only what you actually observe. If something is absent, omit it (or set
  observed:false). Do not infer or invent.
- Capture every product CLAIM verbatim in its ORIGINAL language; add an English
  gloss. Tag each claim with one claim_type from the allowed list. Mark whether it
  is explicit (stated) or implied, and give a 0.0–1.0 confidence.
- For each observation give: modality (audio | on_screen_text | caption | visual),
  timecode (mm:ss-mm:ss), verbatim text or a short factual description.
- Detect any ad/sponsorship labels (e.g. #ad, #PR, Sponsored, 광고, 提供) and report
  their exact text and whether one is present.
- For content_flags, describe factually and rate intensity (mild|moderate|strong);
  do not moralize.
- Use ONLY the allowed values. Output STRICT JSON matching the schema. No prose
  outside the JSON.

ALLOWED claim_type:
  disease_or_treatment | physiological_change | whitening_pigment |
  wrinkle_reduction | fine_lines_dryness | absolute_or_permanent |
  removes_condition | general_efficacy | superlative_or_ranking |
  competitor_disparagement | natural_clean_descriptor | safety_or_immediacy

ALLOWED content_flags.type:
  sexual_or_suggestive | profanity_or_vulgar | offensive_imagery |
  demeaning_protected_group | violence_or_gore | unsafe_behavior

ALLOWED endorsement.type (array): consumer_testimonial | medical_professional |
  influencer | celebrity | none

Output JSON ONLY, exactly this shape:
{
  "video_summary": "<=2 neutral sentences",
  "language_primary": "ko|ja|en|...",
  "product": { "name": "string|null", "type_cues": ["string"] },
  "claims": [
    { "claim_type": "<enum>", "verbatim": "string", "gloss_en": "string",
      "modality": "<enum>", "timecode": "mm:ss-mm:ss",
      "explicit": true, "confidence": 0.0 }
  ],
  "ingredients": [
    { "name": "string", "framed_as_active": false, "purpose_stated": false,
      "verbatim": "string", "timecode": "mm:ss-mm:ss" }
  ],
  "endorsement": {
    "present": false,
    "type": ["none"],
    "paid_indicators": ["string"],
    "before_after_demo": false,
    "synthetic_indicators": ["string"]
  },
  "disclosure": { "ad_label_present": false, "ad_label_text": "string|null" },
  "content_flags": [
    { "type": "<enum>", "modality": "<enum>", "timecode": "mm:ss-mm:ss",
      "description": "string", "intensity": "mild|moderate|strong", "confidence": 0.0 }
  ],
  "off_topic": { "observed": false, "dominant_unrelated_content": "string|null", "confidence": 0.0 }
}
```

---

## Example output (MUFE foundation creative)

> Input: a clip where the voiceover says it treats acne, on-screen text says
> "#1 coverage", a creator review has no ad label, and one frame is suggestive.
> Note: observations only — no market, no verdict.

```json
{
  "video_summary": "A creator applies a foundation and describes its coverage and skin benefits in a short social clip.",
  "language_primary": "en",
  "product": { "name": "MUFE foundation", "type_cues": [] },
  "claims": [
    { "claim_type": "disease_or_treatment", "verbatim": "treats acne while you wear it",
      "gloss_en": "treats acne while you wear it", "modality": "audio",
      "timecode": "00:07-00:09", "explicit": true, "confidence": 0.93 },
    { "claim_type": "superlative_or_ranking", "verbatim": "#1 coverage",
      "gloss_en": "#1 coverage", "modality": "on_screen_text",
      "timecode": "00:03-00:05", "explicit": true, "confidence": 0.88 }
  ],
  "ingredients": [],
  "endorsement": {
    "present": true, "type": ["consumer_testimonial", "influencer"],
    "paid_indicators": ["gifted product mention"],
    "before_after_demo": false, "synthetic_indicators": []
  },
  "disclosure": { "ad_label_present": false, "ad_label_text": null },
  "content_flags": [
    { "type": "sexual_or_suggestive", "modality": "visual", "timecode": "00:12-00:14",
      "description": "close framing with suggestive pose", "intensity": "moderate", "confidence": 0.7 }
  ],
  "off_topic": { "observed": false, "dominant_unrelated_content": null, "confidence": 0.95 }
}
```

---

## How it wires into the resolver

```
Pegasus(observation JSON)              # this spec — jurisdiction-agnostic
   │  map each observed field -> signal(s)   (tables above)
   ▼
signals = { claim.medical_efficacy, claim.superlative, claim.ranking,
            endorsement.paid_undisclosed, disclosure.ad_label_present(false),
            content.sexual_suggestive, ... }
   │  load market bundle + shared layer (target_market)
   ▼
for signal -> rules (bundle.map ∪ shared.map); merge S-DEC overlays
   ▼
verdicts  # {rule_id, citation, severity} per market — decided HERE, not in Pegasus
```

The same observation JSON is replayed against US / KR / JP / SG bundles to produce
the per-market contrast — one detection pass, four verdict sets.

---

## Pegasus practical notes

- **JSON discipline:** Pegasus can drift into prose. Keep "Output JSON ONLY" and the
  exact shape; strip any pre/post text before parsing; reject + retry on parse fail.
- **Low temperature** for extraction; this is observation, not generation.
- **Long videos:** chunk by scene/segment and merge `claims[]`/`content_flags[]`
  (timecodes keep them ordered).
- **Original language matters:** verbatim ko/ja capture is what lets the resolver
  match 화장품법 / JCIA / ASEAN example phrases — do not let it translate-in-place.
- **Confidence + explicit/implied** are the knobs the resolver thresholds on
  (e.g., a market overlay can require explicit=true for a critical finding).
- **Keep the field set in sync:** if a bundle adds a signal, add the matching
  observation field here first — detection is the superset, bundles are subsets.
```
