---
title: Product Requirements Brief
category: product
description: A short brief that pins down scope, users, and what is explicitly out.
fields:
  - name: feature
    label: Feature or product
    type: text
  - name: user_problem
    label: The problem it solves
    type: textarea
  - name: success_metric
    label: How you will know it worked
    type: text
  - name: stage
    label: Stage
    type: select
    options: [early concept, scoped and ready to build, refining an existing feature]
---
Write a product requirements brief for {{feature}}.

The user problem: {{user_problem}}

Success will be measured by: {{success_metric}}

This is at the {{stage}} stage, so pitch the detail accordingly.

Cover the problem, the target user, the scope, and an explicit out-of-scope list. State the open questions as questions rather than resolving them with assumptions. Keep it short enough that someone will actually read it.
