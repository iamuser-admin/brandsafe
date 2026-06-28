---
id: shared-decency-language-universal
scope: shared                 # not a jurisdiction; composed into every market bundle
applies_to: [US, KR, JP, SG]
domain: advertising-compliance
version: 1.0
status: active
last_reviewed: 2026-06-27
purpose: >
  Single source of truth for the (near-)universal violation categories —
  decency, language, off-topic, violence/gore. Detection is jurisdiction-
  agnostic; each market bundle overlays only the delta (threshold, authority
  class, citation, severity).
consumed_by:
  - us-cosmetics-ad-compliance
  - kr-cosmetics-ad-compliance
  - jp-cosmetics-ad-compliance
  - sg-cosmetics-ad-compliance
---

# Shared — Decency / Language / Off-topic (Universal)

> This layer is **composed with** a jurisdiction bundle at evaluation time, not
> loaded alone. It owns the signal vocabulary and the base rule bodies; each
> market supplies an `overlay` (below) that sets its threshold + citation.

## Why this is shared

Across all four markets these categories are constrained *everywhere* — only the
**threshold** and the **authority class** differ (statute vs self-reg vs
platform policy). The claims/efficacy rules, by contrast, genuinely diverge by
market and stay inside each bundle.

---

## Universal detection-signal vocabulary

> The canonical signal names. Every market bundle's signal→rule map references
> these; they are defined **once** here to prevent per-bundle drift.

```yaml
content.sexual_suggestive    # sexualised / suggestive framing
content.nudity_explicit      # explicit nudity
content.vulgar_language      # profanity / crude language (audio or on-screen)
content.offensive_imagery    # offensive / repugnant visuals
content.hate_discrimination  # demeaning by protected attribute
content.violence_gore        # graphic violence / gore
content.unsafe_behavior      # depicted dangerous acts presented approvingly
content.off_topic            # creative unrelated to the advertised product
```

---

## Base rules (jurisdiction-agnostic bodies)

### S-DEC-001 — Sexual / suggestive content
- **base_severity:** `medium`
- **rule (EN):** Sexualised, suggestive, or explicit content beyond the market's
  decency threshold is a violation. Threshold + authority come from the overlay.
- **detection_signal:** `content.sexual_suggestive`, `content.nudity_explicit`

### S-DEC-002 — Vulgar / offensive language & imagery
- **base_severity:** `medium`
- **rule (EN):** Profanity, crude language, or offensive/repugnant imagery beyond
  threshold is a violation.
- **detection_signal:** `content.vulgar_language`, `content.offensive_imagery`

### S-DEC-003 — Hate / discrimination
- **base_severity:** `high`
- **rule (EN):** Content that demeans or stereotypes by a protected attribute is
  a violation in all markets (threshold near-zero).
- **detection_signal:** `content.hate_discrimination`

### S-DEC-004 — Violence / gore / unsafe behavior
- **base_severity:** `medium`
- **rule (EN):** Graphic violence, gore, or approving depiction of unsafe acts
  beyond threshold is a violation.
- **detection_signal:** `content.violence_gore`, `content.unsafe_behavior`

### S-TOP-001 — Off-topic / product mismatch
- **base_severity:** `low`
- **rule (EN):** Creative whose dominant content is unrelated to the advertised
  product (topic drift) is flagged. Threshold is largely market-independent.
- **detection_signal:** `content.off_topic`

---

## Jurisdiction overlay contract

> Each market bundle declares an `overlays:` block. The resolver merges
> `base_severity` ← overlay `severity`, and attaches the overlay `citation` +
> `authority_class` to any finding from the base rules above. Markets may also
> set `threshold` (strict | standard | permissive) and route to platform policy.

```yaml
# in kr-cosmetics-ad-compliance.md
overlays:
  S-DEC-001: { severity: medium, threshold: strict,     authority_class: statute,         citation: "화장품법 시행규칙 별표5 (저속·혐오)" }
  S-DEC-002: { severity: medium, threshold: strict,     authority_class: statute,         citation: "화장품법 시행규칙 별표5" }

# in us-cosmetics-ad-compliance.md
overlays:
  S-DEC-001: { severity: contextual, threshold: permissive, authority_class: platform_policy, citation: "Meta/TikTok/Google ad policy" }
  S-DEC-002: { severity: contextual, threshold: permissive, authority_class: platform_policy, citation: "platform ad policy" }

# in jp-cosmetics-ad-compliance.md
overlays:
  S-DEC-001: { severity: medium, threshold: standard,   authority_class: public_order,    citation: "公序良俗 / JARO" }

# in sg-cosmetics-ad-compliance.md
overlays:
  S-DEC-001: { severity: medium, threshold: standard,   authority_class: self_regulation, citation: "SCAP clause 2.1" }
  S-DEC-002: { severity: medium, threshold: standard,   authority_class: self_regulation, citation: "SCAP clause 2.1" }
```

---

## Adoption: how each bundle changes when this layer is extracted

**Before (current state — rule body lives inside each bundle):**

```markdown
### R-KR-004 — Vulgar or offensive expression (저속·혐오)
- category: decency
- severity: medium
- source: 화장품법 시행규칙 별표5 ...
- rule (EN): Must not use vulgar, offensive, or repugnant expressions ...
- detection_signal: content.sexual_suggestive, content.vulgar_language, content.offensive_imagery
- notes: defer to shared layer for base signal ...
```

**After (rule body moves here; bundle keeps only the delta):**

```yaml
# kr bundle no longer defines R-KR-004; it declares:
overlays:
  S-DEC-001: { severity: medium, threshold: strict, authority_class: statute, citation: "화장품법 별표5" }
  S-DEC-002: { severity: medium, threshold: strict, authority_class: statute, citation: "화장품법 별표5" }
```

### What changes in bundle shape
1. **Decency/language/off-topic rule bodies disappear** from each bundle
   (`R-KR-004`, `R-SG-004`, `R-US-008`, the JP 公序良俗 handling) → replaced by a
   few-line `overlays:` block. Bundles shrink and become **claims-focused** —
   which is the part that genuinely differs by market.
2. **The signal vocabulary is no longer redefined per bundle.** Each bundle's
   signal→rule map references shared signals; the canonical list lives here once
   (no drift, no four-way copy of `content.sexual_suggestive`).
3. **A new section appears** in each bundle: `overlays:` (threshold + authority +
   citation deltas only).
4. **Claims rules are untouched** (R-*-001/002/003 …). They stay fully inside
   each bundle because they do not share a base.

### Net effect
- ➕ Add a 5th market = write its claims rules + a tiny decency overlay (not a
  re-derivation of the universal layer).
- ➕ Edit the universal decency definition once → propagates to all four.
- ➖ A finding now composes **two** sources (shared base + overlay); the loader
  must merge them, so a bundle is no longer fully self-contained for these
  categories. At eval time you load `shared/decency-language-universal` **plus**
  the market bundle.

> Trade-off summary: extracting the layer trades **self-containment** for
> **DRY + single-source governance**. For 4 markets growing toward APJ-wide, the
> governance win dominates; the cost is one extra compose step in the resolver.
