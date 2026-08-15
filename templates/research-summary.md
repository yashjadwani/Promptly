---
title: Research Summary
category: research
description: A structured summary of a topic, with depth and audience set by you.
allowSearch: true
fields:
  - name: topic
    label: Topic
    type: textarea
  - name: audience
    label: Who the summary is for
    type: text
  - name: depth
    label: Depth
    type: select
    options: [overview, working knowledge, deep dive]
  - name: focus
    label: Angle to focus on
    type: text
    required: false
---
Summarise the current state of {{topic}} for {{audience}}.

Depth required: {{depth}}. Angle to focus on: {{focus}}

Separate what is well established from what is contested or still moving. Attribute specific claims to their source. Where the evidence is thin, say so rather than smoothing it over. End with what someone should read next to go deeper.
