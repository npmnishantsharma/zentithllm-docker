'use server';
/**
 * @fileOverview An AI assistant that analyzes ongoing chat conversations
 * and suggests contextually relevant replies, common developer commands,
 * or useful code snippets to enhance communication efficiency.
 *
 * - aiMessageContextAssistant - A function that provides context-aware suggestions.
 * - AiMessageContextAssistantInput - The input type for the aiMessageContextAssistant function.
 * - AiMessageContextAssistantOutput - The return type for the aiMessageContextAssistant function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']).describe('The role of the sender.'),
  content: z.string().describe('The message content.'),
});

const AiMessageContextAssistantInputSchema = z.object({
  chatHistory: z.array(ChatMessageSchema).describe('The current chat history for context.'),
});
export type AiMessageContextAssistantInput = z.infer<typeof AiMessageContextAssistantInputSchema>;

const AiMessageContextAssistantOutputSchema = z.object({
  suggestedReplies: z.array(z.string()).describe('A list of suggested conversational replies.'),
  suggestedCommands: z.array(z.string()).describe('A list of suggested developer commands.'),
  suggestedCodeSnippets: z.array(z.string()).describe('A list of suggested code snippets relevant to the context.'),
});
export type AiMessageContextAssistantOutput = z.infer<typeof AiMessageContextAssistantOutputSchema>;

export async function aiMessageContextAssistant(input: AiMessageContextAssistantInput): Promise<AiMessageContextAssistantOutput> {
  return aiMessageContextAssistantFlow(input);
}

const aiMessageContextAssistantPrompt = ai.definePrompt({
  name: 'aiMessageContextAssistantPrompt',
  input: { schema: AiMessageContextAssistantInputSchema },
  output: { schema: AiMessageContextAssistantOutputSchema },
  prompt: `You are an AI assistant designed to help developers communicate more efficiently in chat by suggesting contextually relevant replies, common developer commands, and useful code snippets based on the ongoing conversation.

Analyze the following chat history. Provide up to 3 suggestions for each category: suggestedReplies, suggestedCommands, and suggestedCodeSnippets. If no relevant suggestions can be made for a category, return an empty array for that category.

Chat History:
{{#each chatHistory}}
{{role}}: {{{content}}}
{{/each}}`,
});

const aiMessageContextAssistantFlow = ai.defineFlow(
  {
    name: 'aiMessageContextAssistantFlow',
    inputSchema: AiMessageContextAssistantInputSchema,
    outputSchema: AiMessageContextAssistantOutputSchema,
  },
  async (input) => {
    const { output } = await aiMessageContextAssistantPrompt(input);
    return output!;
  }
);
