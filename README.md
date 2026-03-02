# Confluence MCP Server

[![npm version](https://img.shields.io/npm/v/@tocharianou/confluence-mcp)](https://www.npmjs.com/package/@tocharianou/confluence-mcp)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for Confluence — CQL-powered page search, read, create, update, comment, and space/page listing. Purpose-built for security knowledge base management and IR runbook access during investigations.

## Quick Start

### Claude Desktop (stdio)

Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "confluence": {
      "command": "npx",
      "args": ["-y", "@tocharianou/confluence-mcp"],
      "env": {
        "CONFLUENCE_HOST": "https://yourorg.atlassian.net",
        "CONFLUENCE_EMAIL": "you@company.com",
        "CONFLUENCE_TOKEN": "<your-api-token>"
      }
    }
  }
}
```

Get your Atlassian API token at [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens).

### HTTP / Streamable mode

```bash
MCP_TRANSPORT=http MCP_HTTP_PORT=3003 CONFLUENCE_HOST=https://yourorg.atlassian.net CONFLUENCE_EMAIL=you@company.com CONFLUENCE_TOKEN=<token> npx @tocharianou/confluence-mcp
```

Then point your MCP client at `http://localhost:3003/mcp`.

## Features

- **CQL search** — full-text search across pages and blog posts with space filtering
- **Page read/write** — read runbooks, create post-mortems, update IR documentation
- **Comment management** — add investigation notes directly to Confluence pages
- **Space discovery** — list and explore all accessible Confluence spaces
- **Token limiting** — built-in `MAX_TOKEN_CALL` guard prevents context overflow

## Configuration

| Environment variable | Required | Description |
|---|---|---|
| `CONFLUENCE_HOST` | ✓ | Confluence Cloud: `https://yourorg.atlassian.net` / Server: `https://wiki.company.com` |
| `CONFLUENCE_EMAIL` | ✓* | Atlassian account email (Cloud only; leave empty for Server/DC) |
| `CONFLUENCE_TOKEN` | ✓ | API token (Cloud) or Personal Access Token (Server/Data Center) |
| `CONFLUENCE_API_VERSION` | – | `v2` for Cloud (default), `v1` for Server/Data Center |
| `CONFLUENCE_VERIFY_SSL` | – | `true`/`false` (default: `true`) |
| `MAX_TOKEN_CALL` | – | Token limit per tool response (default: `20000`) |
| `MCP_TRANSPORT` | – | `stdio` (default) or `http` |
| `MCP_HTTP_PORT` | – | HTTP server port (default: `3003`) |
| `MCP_HTTP_HOST` | – | HTTP server host (default: `localhost`) |

\* `CONFLUENCE_EMAIL` is required for Confluence Cloud. Leave empty for Confluence Server / Data Center (use PAT only).

## Available Tools

| Tool | Description |
|------|-------------|
| `confluence_health_check` | Test connection, verify account info and accessible space count |
| `search_content` | CQL full-text search across pages and blog posts with excerpt preview |
| `get_page` | Read full content of a specific page by ID or title |
| `create_page` | Create a new page in a space (post-mortems, IR notes, findings) |
| `update_page` | Update an existing page's content or title |
| `add_comment` | Add an inline comment to a page to record investigation notes |
| `list_spaces` | List all accessible Confluence spaces with keys and descriptions |
| `list_pages_in_space` | List pages in a specific space, optionally filtered by parent page |

## Example Queries

- *"Search Confluence for our IR playbook for ransomware incidents"*
- *"Find the runbook for AWS key compromise in the SEC space"*
- *"Get the full content of the page 'Incident Response Procedures'"*
- *"Create a post-mortem page in the SEC space summarizing my investigation findings"*
- *"Add a comment to the SIEM alerting page with the false positive pattern I found"*

## Debugging

Use the MCP Inspector to test and debug:

```bash
npm run inspector
```

Server logs are written to **stderr** so they do not interfere with the MCP JSON-RPC stream on stdout.

## Troubleshooting

| Symptom | Likely cause |
|---------|-------------|
| `401 Unauthorized` | Invalid `CONFLUENCE_TOKEN` or wrong `CONFLUENCE_EMAIL` |
| `403 Forbidden` | Insufficient permissions on the space or page |
| `404 Not Found` | Page ID or space key does not exist |
| `ECONNREFUSED` | Wrong `CONFLUENCE_HOST` or Confluence server not reachable |
| SSL errors | Set `CONFLUENCE_VERIFY_SSL=false` for self-signed certs (Server/DC only) |
| Token limit exceeded | Set `excerpt_only: true` or use `break_token_rule: true` |

## Development

```bash
git clone https://github.com/TocharianOU/confluence-mcp.git
cd confluence-mcp
npm install --ignore-scripts
npm run build
cp .env.example .env   # fill in your credentials
npm start
```

## Release

See [RELEASE.md](RELEASE.md) for the full release process.

## License

Apache 2.0 — Copyright © 2024 TocharianOU Contributors
