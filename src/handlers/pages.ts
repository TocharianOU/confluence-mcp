// SPDX-License-Identifier: Apache-2.0
import { ConfluenceConfig } from '../types.js';
import { buildConnectionParams, createConfluenceClient, assertOk, stripHtml } from '../utils/api.js';

export interface SearchContentArgs {
  query: string;
  spaceKey?: string;
  limit?: number;
  excerptOnly?: boolean;
}

export interface GetPageArgs {
  pageId: string;
  excerptOnly?: boolean;
  maxLength?: number;
}

export interface CreatePageArgs {
  spaceKey: string;
  title: string;
  content: string;
  parentId?: string;
}

export interface UpdatePageArgs {
  pageId: string;
  title?: string;
  content: string;
  versionComment?: string;
}

export interface ListSpacesArgs {
  limit?: number;
  type?: string;
}

export interface ListPagesInSpaceArgs {
  spaceKey: string;
  limit?: number;
  title?: string;
}

export interface AddCommentArgs {
  pageId: string;
  comment: string;
}

function wikiToText(content: string): string {
  // Confluence storage format is XHTML-based
  return stripHtml(content)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function handleSearchContent(config: ConfluenceConfig, args: SearchContentArgs): Promise<string> {
  const params = buildConnectionParams(config);

  // Use v1 CQL search (works across both Cloud and Server)
  const { createConfluenceClient: _, ...rest } = await import('../utils/api.js');
  void rest;

  const { default: axios } = await import('axios');
  const { default: https } = await import('https');
  const searchClient = axios.create({
    baseURL: `${params.baseUrl}/wiki/rest/api`,
    timeout: params.timeout,
    headers: { Authorization: params.authHeader, Accept: 'application/json' },
    httpsAgent: new https.Agent({ rejectUnauthorized: params.verifySsl }),
    validateStatus: () => true,
  });

  let cql = `text ~ "${args.query.replace(/"/g, '\\"')}"`;
  if (args.spaceKey) cql += ` AND space.key = "${args.spaceKey}"`;
  cql += ' ORDER BY lastModified DESC';

  const limit = Math.min(args.limit ?? 20, 50);

  const resp = await searchClient.get('/search', {
    params: {
      cql,
      limit,
      expand: args.excerptOnly ? 'excerpt' : 'excerpt,body.storage',
    },
  });
  assertOk(resp.status, resp.data, 'Search content');

  const data = resp.data as Record<string, unknown>;
  const results = (data.results as Record<string, unknown>[]) ?? [];
  const total = data.totalSize as number ?? results.length;

  const lines: string[] = [];
  lines.push(`Confluence Search`);
  lines.push(`Query:  ${args.query}`);
  if (args.spaceKey) lines.push(`Space:  ${args.spaceKey}`);
  lines.push(`Total:  ${total} (showing ${results.length})`);
  lines.push('');

  if (results.length === 0) {
    lines.push('No results found. Try a broader search term or different space.');
    return lines.join('\n');
  }

  for (const r of results) {
    const content = r.content as Record<string, unknown> ?? r;
    const space = (content.space as Record<string, unknown>)?.key ?? 'N/A';
    lines.push('─'.repeat(60));
    lines.push(`ID:      ${content.id}`);
    lines.push(`Title:   ${content.title}`);
    lines.push(`Space:   ${space}`);
    lines.push(`Type:    ${content.type}`);
    lines.push(`Updated: ${(content.history as Record<string, unknown>)?.lastUpdated ? JSON.stringify((content.history as Record<string, unknown>).lastUpdated) : 'N/A'}`);
    lines.push(`URL:     ${params.baseUrl}/wiki${(content._links as Record<string, unknown>)?.webui ?? ''}`);

    const excerpt = (r.excerpt as string ?? '').trim();
    if (excerpt) {
      lines.push('Excerpt:');
      lines.push(`  ${stripHtml(excerpt).substring(0, 300)}`);
    }
  }

  return lines.join('\n');
}

export async function handleGetPage(config: ConfluenceConfig, args: GetPageArgs): Promise<string> {
  const params = buildConnectionParams(config);
  const client = createConfluenceClient(params);

  const expand = args.excerptOnly ? 'version,space,ancestors' : 'body.storage,version,space,ancestors,children.comment.body.storage';
  const resp = await client.get(`/pages/${args.pageId}`, { params: { 'body-format': 'storage' } });

  // v2 uses /pages/:id, v1 uses /content/:id
  let pageResp = resp;
  if (resp.status === 404 && params.apiVersion === 'v2') {
    // fallback to v1
    const { default: axios } = await import('axios');
    const { default: https } = await import('https');
    const v1Client = axios.create({
      baseURL: `${params.baseUrl}/wiki/rest/api`,
      timeout: params.timeout,
      headers: { Authorization: params.authHeader, Accept: 'application/json' },
      httpsAgent: new https.Agent({ rejectUnauthorized: params.verifySsl }),
      validateStatus: () => true,
    });
    pageResp = await v1Client.get(`/content/${args.pageId}`, { params: { expand } });
  }
  assertOk(pageResp.status, pageResp.data, `Get page ${args.pageId}`);

  const page = pageResp.data as Record<string, unknown>;
  const maxLength = args.maxLength ?? 3000;

  const lines: string[] = [];
  lines.push(`Page: ${page.title}`);
  lines.push(`ID:   ${page.id}`);

  // Space
  const spaceKey = (page.spaceId as string) ?? (page.space as Record<string, unknown>)?.key;
  if (spaceKey) lines.push(`Space: ${spaceKey}`);

  // Version
  const version = page.version as Record<string, unknown>;
  if (version) lines.push(`Version: ${version.number} — ${version.createdAt ?? version.when ?? ''}`);

  // URL
  const links = page._links as Record<string, unknown>;
  if (links?.webui) lines.push(`URL:  ${params.baseUrl}/wiki${links.webui}`);

  lines.push('');

  if (!args.excerptOnly) {
    // body
    const bodyStorage = ((page.body as Record<string, unknown>)?.storage as Record<string, unknown>)?.value as string;
    if (bodyStorage) {
      const text = wikiToText(bodyStorage);
      const truncated = text.length > maxLength ? text.substring(0, maxLength) + `\n…[truncated, ${text.length - maxLength} more chars]` : text;
      lines.push('Content:');
      lines.push(truncated);
    }
  }

  return lines.join('\n');
}

export async function handleCreatePage(config: ConfluenceConfig, args: CreatePageArgs): Promise<string> {
  const params = buildConnectionParams(config);

  const { default: axios } = await import('axios');
  const { default: https } = await import('https');
  const client = axios.create({
    baseURL: `${params.baseUrl}/wiki/rest/api`,
    timeout: params.timeout,
    headers: { Authorization: params.authHeader, 'Content-Type': 'application/json', Accept: 'application/json' },
    httpsAgent: new https.Agent({ rejectUnauthorized: params.verifySsl }),
    validateStatus: () => true,
  });

  const body: Record<string, unknown> = {
    type: 'page',
    title: args.title,
    space: { key: args.spaceKey },
    body: {
      storage: {
        value: args.content,
        representation: 'storage',
      },
    },
  };

  if (args.parentId) {
    body.ancestors = [{ id: args.parentId }];
  }

  const resp = await client.post('/content', body);
  assertOk(resp.status, resp.data, 'Create page');

  const page = resp.data as Record<string, unknown>;
  const links = page._links as Record<string, unknown>;
  const lines: string[] = [];
  lines.push('✅ Page created successfully');
  lines.push('');
  lines.push(`ID:    ${page.id}`);
  lines.push(`Title: ${page.title}`);
  lines.push(`URL:   ${params.baseUrl}/wiki${links?.webui ?? ''}`);

  return lines.join('\n');
}

export async function handleUpdatePage(config: ConfluenceConfig, args: UpdatePageArgs): Promise<string> {
  const params = buildConnectionParams(config);

  const { default: axios } = await import('axios');
  const { default: https } = await import('https');
  const client = axios.create({
    baseURL: `${params.baseUrl}/wiki/rest/api`,
    timeout: params.timeout,
    headers: { Authorization: params.authHeader, 'Content-Type': 'application/json', Accept: 'application/json' },
    httpsAgent: new https.Agent({ rejectUnauthorized: params.verifySsl }),
    validateStatus: () => true,
  });

  // Get current version
  const current = await client.get(`/content/${args.pageId}`, { params: { expand: 'version' } });
  assertOk(current.status, current.data, `Get current version of ${args.pageId}`);
  const currentPage = current.data as Record<string, unknown>;
  const currentVersion = (currentPage.version as Record<string, unknown>)?.number as number;

  const body: Record<string, unknown> = {
    type: 'page',
    title: args.title ?? currentPage.title,
    version: {
      number: currentVersion + 1,
      message: args.versionComment ?? '',
    },
    body: {
      storage: {
        value: args.content,
        representation: 'storage',
      },
    },
  };

  const resp = await client.put(`/content/${args.pageId}`, body);
  assertOk(resp.status, resp.data, `Update page ${args.pageId}`);

  const updated = resp.data as Record<string, unknown>;
  const links = updated._links as Record<string, unknown>;
  return `✅ Page ${args.pageId} updated to version ${currentVersion + 1}.\nURL: ${params.baseUrl}/wiki${links?.webui ?? ''}`;
}

export async function handleListSpaces(config: ConfluenceConfig, args: ListSpacesArgs): Promise<string> {
  const params = buildConnectionParams(config);
  const client = createConfluenceClient(params);

  const limit = Math.min(args.limit ?? 50, 100);
  const queryParams: Record<string, unknown> = { limit };
  if (args.type) queryParams.type = args.type;

  const resp = await client.get('/spaces', { params: queryParams });
  assertOk(resp.status, resp.data, 'List spaces');

  const data = resp.data as Record<string, unknown>;
  const spaces = (data.results as Record<string, unknown>[]) ?? [];

  const lines: string[] = [];
  lines.push('Confluence Spaces');
  lines.push(`Showing: ${spaces.length}`);
  lines.push('');

  if (spaces.length === 0) {
    lines.push('No spaces found (check permissions).');
    return lines.join('\n');
  }

  for (const s of spaces) {
    const key = (s.key as string) ?? (s.spaceKey as string) ?? 'N/A';
    const name = (s.name as string) ?? 'N/A';
    const type = (s.type as string) ?? 'N/A';
    lines.push(`${key.padEnd(20)} ${name}  [${type}]`);
  }

  return lines.join('\n');
}

export async function handleListPagesInSpace(config: ConfluenceConfig, args: ListPagesInSpaceArgs): Promise<string> {
  const params = buildConnectionParams(config);

  const { default: axios } = await import('axios');
  const { default: https } = await import('https');
  const client = axios.create({
    baseURL: `${params.baseUrl}/wiki/rest/api`,
    timeout: params.timeout,
    headers: { Authorization: params.authHeader, Accept: 'application/json' },
    httpsAgent: new https.Agent({ rejectUnauthorized: params.verifySsl }),
    validateStatus: () => true,
  });

  const queryParams: Record<string, unknown> = {
    spaceKey: args.spaceKey,
    limit: Math.min(args.limit ?? 50, 100),
    expand: 'version,ancestors',
    type: 'page',
  };
  if (args.title) queryParams.title = args.title;

  const resp = await client.get('/content', { params: queryParams });
  assertOk(resp.status, resp.data, `List pages in ${args.spaceKey}`);

  const data = resp.data as Record<string, unknown>;
  const pages = (data.results as Record<string, unknown>[]) ?? [];

  const lines: string[] = [];
  lines.push(`Pages in Space: ${args.spaceKey}`);
  lines.push(`Showing: ${pages.length} of ${data.size ?? pages.length}`);
  lines.push('');

  if (pages.length === 0) {
    lines.push('No pages found.');
    return lines.join('\n');
  }

  for (const p of pages) {
    const version = (p.version as Record<string, unknown>)?.number;
    const links = p._links as Record<string, unknown>;
    lines.push(`${p.id}  ${p.title}  [v${version}]`);
    if (links?.webui) lines.push(`       ${params.baseUrl}/wiki${links.webui}`);
  }

  return lines.join('\n');
}

export async function handleAddComment(config: ConfluenceConfig, args: AddCommentArgs): Promise<string> {
  const params = buildConnectionParams(config);

  const { default: axios } = await import('axios');
  const { default: https } = await import('https');
  const client = axios.create({
    baseURL: `${params.baseUrl}/wiki/rest/api`,
    timeout: params.timeout,
    headers: { Authorization: params.authHeader, 'Content-Type': 'application/json', Accept: 'application/json' },
    httpsAgent: new https.Agent({ rejectUnauthorized: params.verifySsl }),
    validateStatus: () => true,
  });

  const body = {
    type: 'comment',
    container: { id: args.pageId, type: 'page' },
    body: {
      storage: {
        value: `<p>${args.comment.replace(/\n/g, '<br/>')}</p>`,
        representation: 'storage',
      },
    },
  };

  const resp = await client.post('/content', body);
  assertOk(resp.status, resp.data, `Add comment to page ${args.pageId}`);

  const comment = resp.data as Record<string, unknown>;
  return `✅ Comment added to page ${args.pageId}\nComment ID: ${comment.id}`;
}
