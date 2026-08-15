---
title: Brainstorm Ideas
category: ideation
description: A spread of options against a real constraint, not a list of safe guesses.
fields:
  - name: challenge
    label: The problem or opportunity
    type: textarea
  - name: constraints
    label: Real constraints (budget, time, team, tech)
    type: text
  - name: quantity
    label: How many ideas
    type: select
    options: ["5", "10", "15"]
  - name: risk_appetite
    label: Risk appetite
    type: select
    options: [safe and proven, balanced, ambitious, deliberately contrarian]
---
Generate {{quantity}} distinct ideas for this: {{challenge}}

Work within these constraints: {{constraints}}

Aim for a {{risk_appetite}} spread.

Make the ideas genuinely different from each other rather than variations on one theme. For each, give a one-line description, the main reason it could work, and the main reason it could fail. Do not rank them; leave the judgement to me.
