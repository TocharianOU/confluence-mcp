// SPDX-License-Identifier: Apache-2.0
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ConfluenceConfig } from './src/types.js';
import { handleHealthCheck } from './src/handlers/health.js';
import {
  handleSearchContent,
  handleGetPage,
  handleCreatePage,
  handleUpdatePage,
  handleListSpaces,
  handleListPagesInSpace,
  handleAddComment,
} from './src/handlers/pages.js';
import { checkTokenLimit } from './src/utils/token-limiter.js';

const DEFAULT_MAX_TOKENS = Number(process.env.MAX_TOKEN_CALL ?? 20000);

export function registerConfluenceTools(server: McpServer, config: ConfluenceConfig) {
  // ── confluence_health_check ───────────────────────────────────────────────
  server.tool(
    'confluence_health_check',
    'Test the Confluence connection. Returns authenticated account info (display name, email, account ID) and a count of accessible spaces. Run first to verify credentials and connectivity.',
    {
      max_tokens: z.number().optional().describe(`Max output tokens. Default: ${DEFAULT_MAX_TOKENS}.`),
      break_token_rule: z.boolean().optional().describe('Bypass token limit check.'),
    },
    async ({ max_tokens, break_token_rule }) => {
      try {
        const result = await handleHealthCheck(config);
        const check = checkTokenLimit(result, max_tokens ?? DEFAULT_MAX_TOKENS, break_token_rule);
        if (!check.allowed) return { content: [{ type: 'text', text: check.error! }], isError: true };
        return { content: [{ type: 'text', text: result }] };
      } catch (err: unknown) {
        return { content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    }
  );

  // ── search_content ────────────────────────────────────────────────────────
  server.tool(
    'search_content',
    'Search Confluence pages and blog posts using CQL (Confluence Query Language) full-text search. Returns titles, space keys, URLs, and excerpts. Use to find runbooks, post-mortems, IR playbooks, architecture docs, or any knowledge base articles relevant to an investigation.',
    {
      query: z.string().describe('Full-text search query. Examples: "incident response playbook", "AWS key rotation", "LDAP authentication bypass".'),
      space_key: z.string().optional().describe('Limit search to a specific space key (e.g. "SEC", "OPS"). Use list_spaces to find keys.'),
      limit: z.number().optional().describe('Maximum results to return (default: 20, max: 50). Reduce if token limit hit.'),
      excerpt_only: z.boolean().optional().describe('Return only excerpts without full content (default: true). Set false to include body.'),
      max_tokens: z.number().optional().describe(`Max output tokens. Default: ${DEFAULT_MAX_TOKENS}.`),
      break_token_rule: z.boolean().optional().describe('Bypass token limit check.'),
    },
    async ({ query, space_key, limit, excerpt_only = true, max_tokens, break_token_rule }) => {
      try {
        const result = await handleSearchContent(config, { query, spaceKey: space_key, limit, excerptOnly: excerpt_only });
        const check = checkTokenLimit(result, max_tokens ?? DEFAULT_MAX_TOKENS, break_token_rule);
        if (!check.allowed) return { content: [{ type: 'text', text: check.error! }], isError: true };
        return { content: [{ type: 'text', text: result }] };
      } catch (err: unknown) {
        return { content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    }
  );

  // ── get_page ──────────────────────────────────────────────────────────────
  server.tool(
    'get_page',
    'Get the full content of a Confluence page by ID. Returns title, space, version history, URL, and the page body as plain text (HTML stripped). Use after search_content to read a specific runbook, playbook, or post-mortem in full.',
    {
      page_id: z.string().describe('Confluence page ID (numeric, found in search_content results or page URL).'),
      excerpt_only: z.boolean().optional().describe('Return only metadata without body content. Default: false.'),
      max_length: z.number().optional().describe('Maximum characters of body content to return (default: 3000). Increase if content is truncated.'),
      max_tokens: z.number().optional().describe(`Max output tokens. Default: ${DEFAULT_MAX_TOKENS}.`),
      break_token_rule: z.boolean().optional().describe('Bypass token limit check.'),
    },
    async ({ page_id, excerpt_only, max_length, max_tokens, break_token_rule }) => {
      try {
        const result = await handleGetPage(config, { pageId: page_id, excerptOnly: excerpt_only, maxLength: max_length });
        const check = checkTokenLimit(result, max_tokens ?? DEFAULT_MAX_TOKENS, break_token_rule);
        if (!check.allowed) return { content: [{ type: 'text', text: check.error! }], isError: true };
        return { content: [{ type: 'text', text: result }] };
      } catch (err: unknown) {
        return { content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    }
  );

  // ── create_page ───────────────────────────────────────────────────────────
  server.tool(
    'create_page',
    'Create a new Confluence page. Use to publish incident post-mortems, investigation reports, or security runbooks. Content should be in Confluence Storage Format (XHTML-like). Returns the new page ID and URL.',
    {
      space_key: z.string().describe('Target space key where the page will be created (e.g. "SEC", "OPS").'),
      title: z.string().describe('Page title.'),
      content: z.string().describe('Page content in Confluence Storage Format. For plain text use: "<p>Your text here.</p>". For sections use <h2>, <ul><li>…</li></ul>, <ac:structured-macro> for code blocks.'),
      parent_id: z.string().optional().describe('Parent page ID. If set, the new page will be created as a child. Use list_pages_in_space to find parent IDs.'),
    },
    async ({ space_key, title, content, parent_id }) => {
      try {
        const result = await handleCreatePage(config, { spaceKey: space_key, title, content, parentId: parent_id });
        return { content: [{ type: 'text', text: result }] };
      } catch (err: unknown) {
        return { content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    }
  );

  // ── update_page ───────────────────────────────────────────────────────────
  server.tool(
    'update_page',
    'Update an existing Confluence page with new content. Automatically increments version number. Use to append investigation findings to a running post-mortem or update a runbook. The content field replaces the entire page body.',
    {
      page_id: z.string().describe('Confluence page ID to update.'),
      content: z.string().describe('New full page content in Confluence Storage Format. Replaces current body entirely.'),
      title: z.string().optional().describe('New page title. If omitted, keeps existing title.'),
      version_comment: z.string().optional().describe('Version comment describing what changed (e.g. "Added IOC list from investigation").'),
    },
    async ({ page_id, content, title, version_comment }) => {
      try {
        const result = await handleUpdatePage(config, { pageId: page_id, content, title, versionComment: version_comment });
        return { content: [{ type: 'text', text: result }] };
      } catch (err: unknown) {
        return { content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    }
  );

  // ── list_spaces ───────────────────────────────────────────────────────────
  server.tool(
    'list_spaces',
    'List all accessible Confluence spaces with their keys, names, and types (global, personal). Use to find the correct space key before creating pages or scoping searches.',
    {
      limit: z.number().optional().describe('Maximum spaces to return (default: 50, max: 100).'),
      type: z.string().optional().describe('Filter by space type: "global" or "personal". Leave empty for all.'),
      max_tokens: z.number().optional().describe(`Max output tokens. Default: ${DEFAULT_MAX_TOKENS}.`),
      break_token_rule: z.boolean().optional().describe('Bypass token limit check.'),
    },
    async ({ limit, type, max_tokens, break_token_rule }) => {
      try {
        const result = await handleListSpaces(config, { limit, type });
        const check = checkTokenLimit(result, max_tokens ?? DEFAULT_MAX_TOKENS, break_token_rule);
        if (!check.allowed) return { content: [{ type: 'text', text: check.error! }], isError: true };
        return { content: [{ type: 'text', text: result }] };
      } catch (err: unknown) {
        return { content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    }
  );

  // ── list_pages_in_space ───────────────────────────────────────────────────
  server.tool(
    'list_pages_in_space',
    'List pages within a specific Confluence space. Returns page IDs, titles, versions, and URLs. Use to browse the structure of a space (e.g. find parent page IDs before creating a child page, or discover all IR playbooks in the SEC space).',
    {
      space_key: z.string().describe('Space key to list pages from (e.g. "SEC", "OPS").'),
      limit: z.number().optional().describe('Maximum pages to return (default: 50, max: 100).'),
      title: z.string().optional().describe('Filter pages by title substring.'),
      max_tokens: z.number().optional().describe(`Max output tokens. Default: ${DEFAULT_MAX_TOKENS}.`),
      break_token_rule: z.boolean().optional().describe('Bypass token limit check.'),
    },
    async ({ space_key, limit, title, max_tokens, break_token_rule }) => {
      try {
        const result = await handleListPagesInSpace(config, { spaceKey: space_key, limit, title });
        const check = checkTokenLimit(result, max_tokens ?? DEFAULT_MAX_TOKENS, break_token_rule);
        if (!check.allowed) return { content: [{ type: 'text', text: check.error! }], isError: true };
        return { content: [{ type: 'text', text: result }] };
      } catch (err: unknown) {
        return { content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    }
  );

  // ── add_page_comment ──────────────────────────────────────────────────────
  server.tool(
    'add_page_comment',
    'Add an inline comment to a Confluence page. Use to annotate post-mortems or runbooks with investigation notes without modifying the main page content.',
    {
      page_id: z.string().describe('Confluence page ID to comment on.'),
      comment: z.string().describe('Comment text. Plain text; newlines are converted to <br/>.'),
    },
    async ({ page_id, comment }) => {
      try {
        const result = await handleAddComment(config, { pageId: page_id, comment });
        return { content: [{ type: 'text', text: result }] };
      } catch (err: unknown) {
        return { content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    }
  );
}
