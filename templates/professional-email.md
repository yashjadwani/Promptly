---
title: Professional Email
category: communication
description: A clear, appropriately-pitched email for a specific recipient and outcome.
fields:
  - name: recipient
    label: Who is receiving it
    type: text
  - name: purpose
    label: What you need to happen
    type: textarea
  - name: tone
    label: Tone
    type: select
    options: [formal, friendly-professional, direct, apologetic, persuasive]
  - name: constraints
    label: Anything to include or avoid
    type: text
    required: false
---
Write an email to {{recipient}}.

The outcome it needs to achieve: {{purpose}}

Use a {{tone}} tone. Keep it to the point, put the ask in the first two sentences rather than burying it, and give the recipient a clear next step. Include a subject line.

Additional constraints: {{constraints}}
