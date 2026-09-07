import { z } from "zod";
import { VoiceBoundaryError } from "../../domain/errors.js";
import { VOICE_ERROR_CODES } from "../../domain/voice.js";
import type { ChannelToolCallRequest } from "../../application/execute-channel-tool-invocation.js";
import { INBOUND_BODY_LIMIT_BYTES } from "./inbound.js";

export const VOICE_TOOLS_PATH = "/adapters/voice/tools";
export const TOOLS_BODY_LIMIT_BYTES = INBOUND_BODY_LIMIT_BYTES;

const toolCallSchema = z
  .object({
    id: z.string().min(1).max(128),
    name: z.string().min(1).max(128),
    parameters: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

const messageSchema = z
  .object({
    type: z.literal("tool-calls"),
    toolCallList: z.array(toolCallSchema).min(1).max(8),
    call: z
      .object({
        id: z.string().min(1).max(128).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const bodySchema = z
  .object({
    message: messageSchema,
  })
  .passthrough();

export type MappedVoiceToolRequest = {
  calls: ChannelToolCallRequest[];
  externalChannelId?: string;
};

export function mapVapiToolCallsBody(body: unknown): MappedVoiceToolRequest {
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    throw new VoiceBoundaryError(VOICE_ERROR_CODES.PAYLOAD_INVALID, "Voice tool payload is invalid");
  }

  const calls: ChannelToolCallRequest[] = parsed.data.message.toolCallList.map((item) => ({
    toolCallId: item.id,
    toolName: item.name,
    arguments: (item.parameters ?? {}) as Record<string, unknown>,
  }));

  const callId = parsed.data.message.call?.id;
  return {
    calls,
    ...(callId === undefined || callId === "" ? {} : { externalChannelId: callId }),
  };
}

export function mapChannelToolOutcomesToVapi(outcomes: Array<{ toolCallId: string; ok: boolean; result: unknown }>): {
  results: Array<{ toolCallId: string; result: string }>;
} {
  return {
    results: outcomes.map((outcome) => ({
      toolCallId: outcome.toolCallId,
      result:
        typeof outcome.result === "string"
          ? outcome.result
          : JSON.stringify(outcome.result ?? (outcome.ok ? {} : { error: "tool_failed" })),
    })),
  };
}
