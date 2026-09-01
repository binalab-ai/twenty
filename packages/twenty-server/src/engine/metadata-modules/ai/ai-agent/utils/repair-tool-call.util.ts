import {
  type LanguageModel,
  type LanguageModelUsage,
  NoSuchToolError,
  Output,
  type StepResult,
  type ToolSet,
  generateText,
} from 'ai';
import { type z } from 'zod';

import { EXECUTE_TOOL_TOOL_NAME } from 'src/engine/core-modules/tool-provider/tools/execute-tool.tool';
import { UsageOperationType } from 'src/engine/core-modules/usage/enums/usage-operation-type.enum';
import { AiBillingService } from 'src/engine/metadata-modules/ai/ai-billing/services/ai-billing.service';
import { extractCacheCreationTokensFromSteps } from 'src/engine/metadata-modules/ai/ai-billing/utils/extract-cache-creation-tokens.util';
import { buildAiTelemetry } from 'src/engine/metadata-modules/ai/ai-models/utils/build-ai-telemetry.util';

type ToolCall = {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  input: string;
};

const redirectUnknownToolCallToExecuteTool = ({
  toolCall,
  tools,
}: {
  toolCall: ToolCall;
  tools: Record<string, unknown>;
}): ToolCall | null => {
  const canRedirect =
    EXECUTE_TOOL_TOOL_NAME in tools &&
    toolCall.toolName !== EXECUTE_TOOL_TOOL_NAME;

  if (!canRedirect) {
    return null;
  }

  let parsedInput: unknown;

  try {
    parsedInput =
      typeof toolCall.input === 'string'
        ? JSON.parse(toolCall.input)
        : toolCall.input;
  } catch {
    parsedInput = undefined;
  }

  const isPlainObject =
    typeof parsedInput === 'object' &&
    parsedInput !== null &&
    !Array.isArray(parsedInput);

  return {
    type: 'tool-call',
    toolCallId: toolCall.toolCallId,
    toolName: EXECUTE_TOOL_TOOL_NAME,
    input: JSON.stringify({
      toolName: toolCall.toolName,
      arguments: isPlainObject ? parsedInput : {},
    }),
  };
};

type RepairToolCallBillingContext = {
  aiBillingService: AiBillingService;
  modelId: string;
  workspaceId: string;
  userWorkspaceId: string | null;
  operationType: UsageOperationType;
};

export const repairToolCall = async ({
  toolCall,
  tools,
  inputSchema,
  error,
  model,
  billingContext,
}: {
  toolCall: ToolCall;
  tools: Record<string, unknown>;
  inputSchema: (toolCall: { toolName: string }) => unknown;
  error: Error;
  model: LanguageModel;
  billingContext?: RepairToolCallBillingContext;
}): Promise<ToolCall | null> => {
  // A hallucinated tool name must not kill the stream (returning null
  // rethrows and fails the whole turn). Route the call through the
  // execute_tool meta-tool instead: a learnable tool called as if it were
  // top-level just runs, and a truly unknown name comes back to the model as
  // a graceful "not found, did you mean ..." tool result it can recover from.
  if (NoSuchToolError.isInstance(error)) {
    return redirectUnknownToolCallToExecuteTool({ toolCall, tools });
  }

  const tool = tools[toolCall.toolName];

  if (!tool || typeof tool !== 'object' || !('inputSchema' in tool)) {
    return null;
  }

  const schema = inputSchema(toolCall);

  if (!schema || typeof schema !== 'object') {
    return null;
  }

  let usage: LanguageModelUsage | undefined;
  let steps: StepResult<ToolSet>[] | undefined;

  try {
    const result = await generateText({
      model,
      output: Output.object({ schema: schema as z.ZodTypeAny }),
      prompt: [
        `The AI model attempted to call the tool "${toolCall.toolName}" with invalid input.`,
        ``,
        `Input provided:`,
        JSON.stringify(toolCall.input, null, 2),
        ``,
        `Error encountered:`,
        error.message,
        ``,
        `Please fix the input to exactly match the required schema.`,
        `Pay special attention to:`,
        `- Enum values must match exactly (e.g., "DescNullsLast" not "desc")`,
        `- Object structures must match the schema shape`,
        `- Array items must follow the specified format`,
      ].join('\n'),
      experimental_telemetry: buildAiTelemetry({
        functionId: 'repair-tool-call',
        workspaceId: billingContext?.workspaceId,
        userWorkspaceId: billingContext?.userWorkspaceId,
      }),
    });

    usage = result.usage;
    steps = result.steps;

    const repairedInput = result.output;

    if (repairedInput == null) {
      return null;
    }

    return {
      type: 'tool-call',
      toolCallId: toolCall.toolCallId,
      toolName: toolCall.toolName,
      input: JSON.stringify(repairedInput),
    };
  } catch {
    return null;
  } finally {
    if (billingContext && usage) {
      const cacheCreationTokens = steps
        ? extractCacheCreationTokensFromSteps(steps)
        : 0;

      void billingContext.aiBillingService.calculateAndBillUsage(
        billingContext.modelId,
        { usage, cacheCreationTokens },
        billingContext.workspaceId,
        billingContext.operationType,
        null,
        billingContext.userWorkspaceId,
      );
    }
  }
};
