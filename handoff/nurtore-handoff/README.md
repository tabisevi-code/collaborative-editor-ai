# Nurtore Handoff Pack

This handoff pack is for **future work Nurtore should implement and commit himself** if he wants clean GitHub evidence tied to his own authorship.

It intentionally does **not** include code patches authored by someone else for him to commit.

## Recommended Areas He Can Still Own

1. AI provider quality and evaluation
- improve LM Studio prompt presets for rewrite, summarize, and translate
- compare multiple local models for Chinese/Japanese translation quality
- document recommended model settings and tradeoffs

2. AI prompt tuning and presets
- add reusable prompt presets such as academic, concise, formal, plain-language, executive summary
- expose these as user-visible AI modes

3. AI quality benchmarking
- create a repeatable evaluation set for:
  - rewrite quality
  - summary fidelity
  - multilingual translation quality
- save benchmark prompts/expected outputs for regression testing

4. AI docs and diagrams
- update diagrams or report sections focused specifically on AI provider flow, prompt construction, and evaluation process

## Suggested Files For Him To Work In

- `backend_fastapi/app/ai/prompts.py`
- `backend_fastapi/app/ai/providers.py`
- `backend_fastapi/app/routers/ai.py`
- `backend_fastapi/tests/test_ai.py`
- `frontend/src/components/AiPanel.tsx`
- `docs/assignment2-report-addendum.md`
- `docs/assignment2-current-state.md`

## Good Self-Owned Commit Ideas

1. `improve(ai): add prompt presets for rewrite summarize and translate`
2. `test(ai): add evaluation fixtures for multilingual translation quality`
3. `docs(ai): document lm studio model guidance and prompt tuning`
4. `refactor(ai): separate model presets from request construction`
5. `feat(ai): expose quality presets in the ai panel`

## Useful Commands

```bash
npm run test:all
cd frontend && AI_STREAM_PROVIDER=stub npm run test:e2e
cd frontend && AI_STREAM_PROVIDER=lmstudio npm run test:e2e
cd backend_fastapi && pytest -q
```

## What He Should Show In Commits

- changed prompt or provider logic
- tests proving the new behavior
- updated docs explaining the change
- screenshots or benchmark notes if he is comparing local models
