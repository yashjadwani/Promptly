---
title: Technical Explainer
category: engineering
description: A concept explained at a chosen level, with the analogy budget under control.
fields:
  - name: concept
    label: Concept to explain
    type: text
  - name: audience
    label: Explain it to
    type: select
    options: [a complete beginner, a developer new to the area, an experienced engineer, a non-technical stakeholder]
  - name: why_asking
    label: What they need it for
    type: textarea
  - name: length
    label: Length
    type: select
    options: [a few paragraphs, a page, as long as it takes]
---
Explain {{concept}} to {{audience}}.

They need it for: {{why_asking}}

Target length: {{length}}.

Build from what the reader already knows toward what they do not. Use at most one analogy, and state plainly where that analogy breaks down. Name the common misconception people hold about this. Prefer a concrete worked example over an abstract description.
