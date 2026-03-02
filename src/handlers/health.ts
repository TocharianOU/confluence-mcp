// SPDX-License-Identifier: Apache-2.0
import { ConfluenceConfig } from '../types.js';
import { buildConnectionParams, createConfluenceClient } from '../utils/api.js';
import axios from 'axios';
import https from 'https';

export async function handleHealthCheck(config: ConfluenceConfig): Promise<string> {
  const params = buildConnectionParams(config);
  const client = createConfluenceClient(params);
  const lines: string[] = [];

  lines.push('Confluence Connection Health');
  lines.push(`Host:        ${params.baseUrl}`);
  lines.push(`API Version: ${params.apiVersion}`);
  lines.push('');

  // Test via /wiki/rest/api/user/current (works for both v1 and v2 auth)
  const meClient = axios.create({
    baseURL: `${params.baseUrl}/wiki/rest/api`,
    timeout: params.timeout,
    headers: {
      Authorization: params.authHeader,
      Accept: 'application/json',
    },
    httpsAgent: new https.Agent({ rejectUnauthorized: params.verifySsl }),
    validateStatus: () => true,
  });

  const meResp = await meClient.get('/user/current');
  if (meResp.status !== 200) {
    lines.push(`❌ Connection FAILED (HTTP ${meResp.status})`);
    const err = meResp.data as Record<string, unknown>;
    if (err?.message) lines.push(`Error: ${err.message}`);
    lines.push('');
    lines.push('Troubleshooting:');
    lines.push('  • Verify CONFLUENCE_HOST (e.g. https://yourorg.atlassian.net)');
    lines.push('  • For Cloud: CONFLUENCE_EMAIL + CONFLUENCE_TOKEN (API token from id.atlassian.com)');
    lines.push('  • For Server/DC: CONFLUENCE_TOKEN (Personal Access Token), leave CONFLUENCE_EMAIL empty');
    lines.push('  • For self-signed certs: set CONFLUENCE_VERIFY_SSL=false');
    return lines.join('\n');
  }

  const me = meResp.data as Record<string, unknown>;
  lines.push('✅ Connection successful');
  lines.push('');
  lines.push(`Account:      ${me['displayName'] ?? 'unknown'}`);
  lines.push(`Email:        ${(me['email'] as string) ?? 'N/A'}`);
  lines.push(`Account ID:   ${me['accountId'] ?? me['username'] ?? 'N/A'}`);
  lines.push(`Account Type: ${me['accountType'] ?? 'N/A'}`);
  lines.push('');

  // Try to get space count
  const spacesResp = await client.get('/spaces', { params: { limit: 1 } });
  if (spacesResp.status === 200) {
    const data = spacesResp.data as Record<string, unknown>;
    const total =
      (data._links as Record<string, unknown>)?.next !== undefined
        ? 'many'
        : String((data.results as unknown[])?.length ?? 0);
    lines.push(`Accessible Spaces: ${total}`);
  }

  lines.push('');
  lines.push('Use list_spaces to discover available spaces, search_content to find pages.');
  return lines.join('\n');
}
