---
title: Data Analysis
category: research
description: Turn a data question into a rigorous analysis prompt.
fields:
  - name: question
    label: Question to answer
    type: textarea
  - name: data
    label: Data or columns available
    type: textarea
  - name: audience
    label: Who will use the result
    type: text
  - name: output
    label: Preferred output
    type: select
    options: [Summary, Table, Step-by-step analysis, Recommendations]
---
Analyze the provided data to answer {{question}}. The available data is {{data}} and the audience is {{audience}}. Return the result as a {{output}}. State assumptions, identify data quality issues, show the reasoning behind conclusions, and distinguish facts from interpretation.
