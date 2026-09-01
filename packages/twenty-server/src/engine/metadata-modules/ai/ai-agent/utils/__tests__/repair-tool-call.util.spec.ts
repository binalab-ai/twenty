import { NoSuchToolError } from 'ai';

import { repairToolCall } from 'src/engine/metadata-modules/ai/ai-agent/utils/repair-tool-call.util';

const buildNoSuchToolError = (toolName: string) =>
  new NoSuchToolError({
    toolName,
    availableTools: ['learn_tools', 'execute_tool'],
  });

const buildToolCall = (toolName: string, input: string) => ({
  type: 'tool-call' as const,
  toolCallId: 'call-1',
  toolName,
  input,
});

describe('repairToolCall', () => {
  describe('unknown tool name (NoSuchToolError)', () => {
    it('redirects the call through execute_tool with the original name and input', async () => {
      const result = await repairToolCall({
        toolCall: buildToolCall('search_output', '{"query":"acme"}'),
        tools: { execute_tool: {}, learn_tools: {} },
        inputSchema: () => undefined,
        error: buildNoSuchToolError('search_output'),
        model: {} as never,
      });

      expect(result).toEqual({
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'execute_tool',
        input: JSON.stringify({
          toolName: 'search_output',
          arguments: { query: 'acme' },
        }),
      });
    });

    it('falls back to empty arguments when the original input is not an object', async () => {
      const result = await repairToolCall({
        toolCall: buildToolCall('search_output', 'not json'),
        tools: { execute_tool: {} },
        inputSchema: () => undefined,
        error: buildNoSuchToolError('search_output'),
        model: {} as never,
      });

      expect(result).toEqual({
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'execute_tool',
        input: JSON.stringify({ toolName: 'search_output', arguments: {} }),
      });
    });

    it('returns null when execute_tool is not part of the tool set', async () => {
      const result = await repairToolCall({
        toolCall: buildToolCall('search_output', '{}'),
        tools: { learn_tools: {} },
        inputSchema: () => undefined,
        error: buildNoSuchToolError('search_output'),
        model: {} as never,
      });

      expect(result).toBeNull();
    });

    it('returns null when the unknown tool call already targets execute_tool', async () => {
      const result = await repairToolCall({
        toolCall: buildToolCall('execute_tool', '{}'),
        tools: { execute_tool: {} },
        inputSchema: () => undefined,
        error: buildNoSuchToolError('execute_tool'),
        model: {} as never,
      });

      expect(result).toBeNull();
    });
  });
});
