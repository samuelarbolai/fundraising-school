import { friendlyVcEvaluationPrompt } from './evaluatorPrompt';
import { chatCompletion } from './openaiClient';

const DEFAULT_MODEL = process.env.OPENAI_FRIENDLY_VC_EVAL_MODEL || process.env.OPENAI_FRIENDLY_VC_MODEL || 'gpt-4o-mini';

function buildTranscript(messages) {
  return messages
    .map(message => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");
}

export async function evaluateFriendlyAnalystSummary({ conversationMessages, promptOverride }) {
  const transcript = buildTranscript(conversationMessages);
  const systemInstruction = promptOverride && promptOverride.trim().length > 0
    ? promptOverride.trim()
    : friendlyVcEvaluationPrompt;

  const payload = {
    model: DEFAULT_MODEL,
    messages: [
      { role: 'system', content: systemInstruction },
      {
        role: 'user',
        content: `Conversation transcript:\n\n${transcript}\n\nReturn valid JSON now.`,
      },
    ],
    temperature: 0.2,
  };

  const { content: text } = await chatCompletion({
    model: DEFAULT_MODEL,
    messages: payload.messages,
    temperature: 0.2,
    maxTokens: 700,
  });
  if (!text) {
    throw new Error('Evaluation prompt produced no output.');
  }
  try {
    const parsed = JSON.parse(text);
    return parsed;
  } catch (error) {
    throw new Error(`Failed to parse evaluation JSON: ${error.message}`);
  }
}
