// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod';

export const ConfluenceConfigSchema = z.object({
  host: z.string().optional().describe('Confluence Cloud base URL (e.g. https://yourorg.atlassian.net) or Server URL. Overrides CONFLUENCE_HOST env var.'),
  email: z.string().optional().describe('Atlassian account email for Cloud Basic Auth. Overrides CONFLUENCE_EMAIL env var.'),
  token: z.string().optional().describe('Atlassian API token (Cloud) or Personal Access Token (Server/DC). Overrides CONFLUENCE_TOKEN env var.'),
  apiVersion: z.enum(['v1', 'v2']).optional().describe('Confluence REST API version. "v2" for Cloud modern API (default), "v1" for older Cloud/Server/DC.'),
  verifySsl: z.boolean().optional().describe('Verify SSL certificate (default: true). Set false for self-signed certs.'),
  timeout: z.number().optional().describe('HTTP request timeout in ms (default: 30000).'),
});

export type ConfluenceConfig = z.infer<typeof ConfluenceConfigSchema>;

export interface ConfluenceConnectionParams {
  baseUrl: string;
  authHeader: string;
  apiVersion: 'v1' | 'v2';
  verifySsl: boolean;
  timeout: number;
}
