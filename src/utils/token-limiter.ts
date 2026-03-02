// SPDX-License-Identifier: Apache-2.0
import { encoding_for_model, TiktokenModel } from 'tiktoken';

export function calculateTokens(text: string, model: TiktokenModel = 'gpt-4'): number {
  const enc = encoding_for_model(model);
  try {
    return enc.encode(text).length;
  } finally {
    enc.free();
  }
}

export function checkTokenLimit(
  result: unknown,
  maxTokens: number,
  breakRule = false
): { allowed: boolean; tokens: number; error?: string } {
  if (breakRule) return { allowed: true, tokens: 0 };
  const text = typeof result === 'string' ? result : JSON.stringify(result);
  const tokens = calculateTokens(text);
  if (tokens > maxTokens) {
    return {
      allowed: false,
      tokens,
      error:
        `Token limit exceeded: result contains ${tokens} tokens (limit: ${maxTokens}). ` +
        `To reduce: use search_content with narrower queries, reduce limit, use excerpt_only, ` +
        `or set break_token_rule: true to bypass.`,
    };
  }
  return { allowed: true, tokens };
}
