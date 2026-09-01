export const AGENT_CONFIG = {
  MAX_STEPS: 300,
  REASONING_BUDGET_TOKENS: 12000,
  // Upper bound for a single completion. Without an explicit maxOutputTokens
  // the SDK falls back to the provider default (4k on Anthropic), which
  // truncates long plans and documents mid-sentence. Bounded so a runaway
  // completion cannot burn an unbounded amount of output tokens; the
  // effective limit is min(this, the model's own maxOutputTokens).
  MAX_OUTPUT_TOKENS: 32_000,
};
