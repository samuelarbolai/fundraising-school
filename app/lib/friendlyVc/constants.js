const SALES_COACH_MESSAGE = "Sebas here. What's breaking in your sales conversations? Give me the specifics so we can fix the right gate.";

const FRIENDLY_VC_ANALYST_MESSAGE =
  "Friendly VC Analyst online. Drop the startup's deck highlights, traction, and open questions—I'll grade the fit for 30x and surface intros.";

export const AGENT_INITIAL_MESSAGES = {
  'sales-coach': {
    role: 'assistant',
    content: SALES_COACH_MESSAGE,
  },
  'friendly-vc-analyst': {
    role: 'assistant',
    content: FRIENDLY_VC_ANALYST_MESSAGE,
  },
};

export function getInitialAssistantMessage(agentSlug = 'sales-coach') {
  return AGENT_INITIAL_MESSAGES[agentSlug] || AGENT_INITIAL_MESSAGES['sales-coach'];
}
