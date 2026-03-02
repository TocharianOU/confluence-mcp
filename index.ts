#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { ConfluenceConfig } from './src/types.js';
import { registerConfluenceTools } from './confluence-tools.js';

const SERVER_NAME = 'confluence-mcp';
const SERVER_VERSION = '1.0.0';

function buildConfig(): ConfluenceConfig {
  return {
    host: process.env.CONFLUENCE_HOST,
    email: process.env.CONFLUENCE_EMAIL,
    token: process.env.CONFLUENCE_TOKEN,
    apiVersion: (process.env.CONFLUENCE_API_VERSION as 'v1' | 'v2') ?? 'v2',
    verifySsl: process.env.CONFLUENCE_VERIFY_SSL !== 'false',
    timeout: process.env.CONFLUENCE_TIMEOUT ? Number(process.env.CONFLUENCE_TIMEOUT) : 30000,
  };
}

async function main() {
  const config = buildConfig();
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerConfluenceTools(server, config);

  const transport = process.env.MCP_TRANSPORT ?? 'stdio';

  if (transport === 'http') {
    const port = Number(process.env.MCP_HTTP_PORT ?? 3010);
    const app = express();
    app.use(express.json());
    const httpTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => `session-${Date.now()}`,
    });
    app.all('/mcp', async (req, res) => { await httpTransport.handleRequest(req, res); });
    await server.connect(httpTransport);
    app.listen(port, () => {
      process.stderr.write(`[confluence-mcp] HTTP transport listening on port ${port}\n`);
    });
  } else {
    const stdioTransport = new StdioServerTransport();
    await server.connect(stdioTransport);
    process.stderr.write(`[confluence-mcp] stdio transport ready\n`);
  }
}

main().catch((err) => {
  process.stderr.write(`[confluence-mcp] Fatal: ${err}\n`);
  process.exit(1);
});
