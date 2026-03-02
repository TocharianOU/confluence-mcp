// SPDX-License-Identifier: Apache-2.0
import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { ConfluenceConfig, ConfluenceConnectionParams } from '../types.js';

export function buildConnectionParams(config: ConfluenceConfig): ConfluenceConnectionParams {
  const host = config.host ?? process.env.CONFLUENCE_HOST ?? '';
  if (!host) throw new Error('CONFLUENCE_HOST is required. Set it in env or pass as config.host.');

  const email = config.email ?? process.env.CONFLUENCE_EMAIL ?? '';
  const token = config.token ?? process.env.CONFLUENCE_TOKEN ?? '';
  if (!token) throw new Error('CONFLUENCE_TOKEN is required. Set it in env or pass as config.token.');

  const authHeader = email
    ? `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`
    : `Bearer ${token}`;

  const apiVersion = config.apiVersion ?? (process.env.CONFLUENCE_API_VERSION as 'v1' | 'v2' | undefined) ?? 'v2';
  const verifySsl = config.verifySsl ?? (process.env.CONFLUENCE_VERIFY_SSL !== 'false');
  const timeout = config.timeout ?? Number(process.env.CONFLUENCE_TIMEOUT ?? 30000);

  const baseUrl = host.replace(/\/$/, '');

  return { baseUrl, authHeader, apiVersion, verifySsl, timeout };
}

export function createConfluenceClient(params: ConfluenceConnectionParams): AxiosInstance {
  // v2 = /wiki/api/v2, v1 = /wiki/rest/api
  const basePath = params.apiVersion === 'v2' ? '/wiki/api/v2' : '/wiki/rest/api';
  return axios.create({
    baseURL: `${params.baseUrl}${basePath}`,
    timeout: params.timeout,
    headers: {
      Authorization: params.authHeader,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    httpsAgent: new https.Agent({ rejectUnauthorized: params.verifySsl }),
    validateStatus: () => true,
  });
}

export function assertOk(status: number, data: unknown, operation: string): void {
  if (status < 200 || status >= 300) {
    const errorMsg =
      (data as Record<string, unknown>)?.message ||
      (data as Record<string, unknown>)?.statusMessage ||
      (data as Record<string, unknown>)?.errors;
    throw new Error(`${operation} failed (HTTP ${status}): ${JSON.stringify(errorMsg ?? data)}`);
  }
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
