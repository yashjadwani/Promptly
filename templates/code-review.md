---
title: Code Review
category: engineering
description: A focused review pass over a snippet or file, with a stated priority.
fields:
  - name: language
    label: Language or stack
    type: text
  - name: code_context
    label: What this code does
    type: textarea
  - name: priority
    label: Review priority
    type: select
    options: [correctness, security, performance, readability, over-engineering]
  - name: experience_level
    label: Pitch feedback for
    type: select
    options: [junior developer, mid-level developer, senior developer]
---
Review the {{language}} code I will paste after this prompt.

What the code is meant to do: {{code_context}}

Prioritise {{priority}} above other concerns. Pitch the feedback for a {{experience_level}}.

For each finding, give the location, what is wrong, why it matters, and a concrete fix. Separate real defects from preferences, and say explicitly when something is fine as written rather than inventing issues to fill the review.
