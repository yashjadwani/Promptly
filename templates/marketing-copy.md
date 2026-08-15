---
title: Marketing Copy
category: marketing
description: Persuasive copy for a product or service, aimed at a specific audience.
fields:
  - name: product
    label: Product or service
    type: text
  - name: audience
    label: Target audience
    type: text
  - name: tone
    label: Tone
    type: select
    options: [professional, playful, bold, minimal, warm]
  - name: key_benefit
    label: Main benefit to lead with
    type: text
  - name: format
    label: Format
    type: select
    options: [landing page section, email, ad copy, product description]
---
Write marketing copy for {{product}}, aimed at {{audience}}.

Lead with this benefit: {{key_benefit}}.

Use a {{tone}} tone and produce it as {{format}}. Favour concrete benefits over feature lists, keep sentences short, avoid superlatives that cannot be substantiated, and close with a single clear call to action.
