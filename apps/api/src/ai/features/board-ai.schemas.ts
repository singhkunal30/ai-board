import { z } from 'zod';

export const generatePromptSchema = z.object({
  prompt: z.string().trim().min(3).max(2000),
});
export type GeneratePromptInput = z.infer<typeof generatePromptSchema>;

export const boardChatSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(8000),
      }),
    )
    .max(20)
    .optional(),
});
export type BoardChatInput = z.infer<typeof boardChatSchema>;

export const meetingSchema = z.object({
  notes: z.string().trim().min(10).max(50_000),
});
export type MeetingInput = z.infer<typeof meetingSchema>;

export const agentSchema = z.object({
  prompt: z.string().trim().min(3).max(4000),
});
export type AgentInput = z.infer<typeof agentSchema>;

export const commandSchema = z.object({
  instruction: z.string().trim().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(8000),
      }),
    )
    .max(20)
    .optional(),
});
export type CommandInput = z.infer<typeof commandSchema>;
