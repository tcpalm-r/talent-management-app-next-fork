---
name: survey-response-helper
description: Improve the 360 feedback survey response prompt to reduce hallucination. Use when working on lib/prompts/generate-survey-response.ts or debugging invented details in AI responses.
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
---

# Survey Response Helper Skill

## Purpose
Iteratively improve the survey response generation prompt to eliminate hallucination (AI adding invented details not present in user input).

## Key Files
- `lib/prompts/generate-survey-response.ts` - Core prompt to iterate on
- `app/api/ai/generate-survey-response/route.ts` - API endpoint for testing
- `components/SurveyAIAssistant.tsx` - UI component (regeneration logic)

## Current Problem
Despite guardrails, Claude still adds invented details like:
- Project names not mentioned by user
- Percentages/metrics/statistics
- Stakeholder or client names
- Specific scenarios or timeframes

## Iteration Workflow

### 1. Test Current Prompt
Run the dev server and test with curl:
```bash
curl -X POST http://localhost:3004/api/ai/generate-survey-response \
  -H "Content-Type: application/json" \
  -d '{
    "questionText": "Describe their communication style",
    "userThoughts": "good at explaining things, responds to emails quickly, sometimes talks too fast",
    "subjectName": "Sarah"
  }'
```

### 2. Check for Hallucination
Look for these red flags in output:
- Project names (Q3 initiative, website redesign) not in input
- Metrics (20% improvement, 95% satisfaction)
- Stakeholder/client mentions
- Scenarios or contexts not provided by user
- Time periods not mentioned (quarterly, last month, recently)

### 3. Anti-Hallucination Techniques
When the prompt still hallucinates, try these techniques:

1. **Explicit forbidden list** - Enumerate specific content types to avoid
2. **Citation requirement** - "Every claim must trace to input phrase"
3. **Lower temperature** - Try 0.1-0.2 instead of current setting
4. **Proportional output** - Shorter output for vague input
5. **Internal validation step** - Ask model to verify before outputting

### 4. Test Cases
Use `fixtures/test-cases.json` for structured testing:
- TC001: Vague positive feedback - should NOT embellish
- TC002: Specific example provided - preserve only what's given
- TC003: Constructive criticism - don't catastrophize

### 5. Validate Changes
After each prompt edit:
1. Run all test cases
2. Check mustNotInclude patterns aren't present
3. Verify mustInclude patterns are preserved
4. Confirm word count is 50-100

## Checklist Before Declaring Success
- [ ] All test cases pass without hallucination
- [ ] Vague inputs produce appropriately vague outputs
- [ ] Specific inputs preserve those specifics (no additions)
- [ ] Word count stays 50-100
- [ ] Tone remains professional but warm
- [ ] Regeneration mode still works correctly
