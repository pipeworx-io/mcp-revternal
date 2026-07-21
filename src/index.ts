interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Revternal MCP — wraps the Revternal Developer Intelligence API
 * (api.revternal.com). Multi-source developer enrichment + search over an
 * index of ~11.7M developer profiles (GitHub-centric), plus LinkedIn person
 * enrichment.
 *
 * Auth: `x-api-key` header. Platform-keyed — the gateway injects the shared
 * key as `_apiKey` (PLATFORM_REVTERNAL_KEY); callers may also pass their own
 * `_apiKey`. Vendor-approved for resale.
 *
 * Tools:
 * - revternal_search_developers  — GET /developer/search (filter by role, language, location, recency)
 * - revternal_developer_intel    — GET /developer/intel (work pattern / behaviour by GitHub username)
 * - revternal_enrich_developer   — POST /developer/enrich (full profile from a GitHub URL)
 * - revternal_enrich_person      — POST /enrich/people (profile from a LinkedIn URL)
 * - revternal_index_stats        — GET /developer/stats (index size / freshness)
 */


const BASE_URL = 'https://api.revternal.com';

const tools: McpToolExport['tools'] = [
  {
    name: 'revternal_search_developers',
    description:
      'Search a live index of ~11.7M developers (GitHub-centric) by role, primary programming language, location, and recent activity — for recruiting, GTM/lead-gen, and developer-audience research. Returns matching GitHub usernames with role, primary language, location, and last-active timestamp. Filters: role (e.g. "backend engineer", "ai/ml engineer"), primary_language (e.g. "Python", "Rust"), location, active_within_days (only devs active in the last N days), sort_by (default last_active). Paginate with limit + offset. Example: revternal_search_developers({ primary_language: "Rust", active_within_days: 30, limit: 20 }).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        role: { type: 'string', description: 'Developer role filter, e.g. "backend engineer", "ai/ml engineer", "frontend engineer".' },
        primary_language: { type: 'string', description: 'Primary programming language, e.g. "Python", "Rust", "TypeScript".' },
        location: { type: 'string', description: 'Location filter, e.g. "Berlin", "United States".' },
        active_within_days: { type: 'number', description: 'Only developers active within the last N days (>=1).' },
        sort_by: { type: 'string', description: 'Sort field. Default "last_active".' },
        limit: { type: 'number', description: 'Results per page, 1-100 (default 20).' },
        offset: { type: 'number', description: 'Pagination offset (default 0).' },
        _apiKey: { type: 'string', description: 'Revternal API key (x-api-key). Injected from the platform key when omitted.' },
      },
      required: [],
    },
  },
  {
    name: 'revternal_developer_intel',
    description:
      'Get behavioural intelligence for one developer by GitHub username — how they actually work, not just their bio. Returns work pattern (chronotype, peak hours, work rhythm, activity trend, velocity change), collaboration style (solo vs team, external PR ratio, reviews given), professionalism signals (commit quality, conventional commits, primary work type), and activity recency. Use to assess engagement, seniority signals, and outreach timing. Example: revternal_developer_intel({ github_username: "torvalds" }).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        github_username: { type: 'string', description: 'GitHub username (login), e.g. "torvalds".' },
        _apiKey: { type: 'string', description: 'Revternal API key (x-api-key). Injected from the platform key when omitted.' },
      },
      required: ['github_username'],
    },
  },
  {
    name: 'revternal_enrich_developer',
    description:
      'Enrich a developer from their GitHub profile URL — full firmographic + technical profile. Returns name, location, company, followers, years active, seniority estimate, and a ranked skills breakdown (languages by repo share). Use to enrich a lead or candidate you already have a GitHub URL for. Example: revternal_enrich_developer({ github_url: "https://github.com/torvalds" }).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        github_url: { type: 'string', description: 'Full GitHub profile URL, e.g. "https://github.com/torvalds".' },
        _apiKey: { type: 'string', description: 'Revternal API key (x-api-key). Injected from the platform key when omitted.' },
      },
      required: ['github_url'],
    },
  },
  {
    name: 'revternal_enrich_person',
    description:
      'Enrich a person from their LinkedIn profile URL. Returns the enriched profile record for recruiting / GTM / contact intelligence. Example: revternal_enrich_person({ linkedin_url: "https://www.linkedin.com/in/example" }).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        linkedin_url: { type: 'string', description: 'Full LinkedIn profile URL.' },
        _apiKey: { type: 'string', description: 'Revternal API key (x-api-key). Injected from the platform key when omitted.' },
      },
      required: ['linkedin_url'],
    },
  },
  {
    name: 'revternal_index_stats',
    description:
      'Index statistics for the Revternal developer-intelligence dataset — total profiles indexed and processing status. Use to gauge coverage and freshness before relying on search results. Example: revternal_index_stats({}).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        _apiKey: { type: 'string', description: 'Revternal API key (x-api-key). Injected from the platform key when omitted.' },
      },
      required: [],
    },
  },
];

function revternalError(status: number, tool: string): Error {
  if (status === 401 || status === 403) {
    return new Error(
      `Revternal: auth failed (HTTP ${status}). The platform key is missing or invalid — pass your own key via _apiKey, or contact the operator about platform credentials.`,
    );
  }
  if (status === 429) {
    return new Error('Revternal: rate-limited (HTTP 429). The platform quota is momentarily exhausted; retry shortly or pass your own _apiKey.');
  }
  return new Error(`Revternal ${tool}: HTTP ${status}.`);
}

async function revFetch(path: string, apiKey: string, init?: RequestInit): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        'x-api-key': apiKey,
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    });
    if (!res.ok) throw revternalError(res.status, path);
    return res.json();
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Revternal: request timed out after 25s (enrichment can be slow). Retry shortly.');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function clampInt(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(Math.max(Math.trunc(n), lo), hi);
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const apiKey = typeof args._apiKey === 'string' ? args._apiKey : '';
  if (!apiKey) {
    return {
      error: 'Revternal API key required.',
      retry_hint: 'Pass an x-api-key value as _apiKey, or the operator can set PLATFORM_REVTERNAL_KEY so it is injected automatically.',
    };
  }

  try {
    switch (name) {
      case 'revternal_search_developers': {
        const qs = new URLSearchParams();
        if (typeof args.role === 'string' && args.role.trim()) qs.set('role', args.role.trim());
        if (typeof args.primary_language === 'string' && args.primary_language.trim()) qs.set('primary_language', args.primary_language.trim());
        if (typeof args.location === 'string' && args.location.trim()) qs.set('location', args.location.trim());
        if (args.active_within_days !== undefined && String(args.active_within_days).trim() !== '') {
          qs.set('active_within_days', String(clampInt(args.active_within_days, 1, 3650, 30)));
        }
        if (typeof args.sort_by === 'string' && args.sort_by.trim()) qs.set('sort_by', args.sort_by.trim());
        qs.set('limit', String(clampInt(args.limit, 1, 100, 20)));
        qs.set('offset', String(clampInt(args.offset, 0, 1_000_000, 0)));
        return await revFetch(`/developer/search?${qs.toString()}`, apiKey);
      }
      case 'revternal_developer_intel': {
        const u = typeof args.github_username === 'string' ? args.github_username.trim() : '';
        if (!u) return { error: 'github_username is required', retry_hint: 'Pass a GitHub login, e.g. {"github_username":"torvalds"}.' };
        return await revFetch(`/developer/intel?github_username=${encodeURIComponent(u)}`, apiKey);
      }
      case 'revternal_enrich_developer': {
        const url = typeof args.github_url === 'string' ? args.github_url.trim() : '';
        if (!url) return { error: 'github_url is required', retry_hint: 'Pass a full GitHub profile URL, e.g. {"github_url":"https://github.com/torvalds"}.' };
        return await revFetch('/developer/enrich', apiKey, { method: 'POST', body: JSON.stringify({ github_url: url }) });
      }
      case 'revternal_enrich_person': {
        const url = typeof args.linkedin_url === 'string' ? args.linkedin_url.trim() : '';
        if (!url) return { error: 'linkedin_url is required', retry_hint: 'Pass a full LinkedIn profile URL.' };
        return await revFetch('/enrich/people', apiKey, { method: 'POST', body: JSON.stringify({ linkedin_url: url }) });
      }
      case 'revternal_index_stats':
        return await revFetch('/developer/stats', apiKey);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : String(e),
      retry_hint: 'Transient Revternal failures are common on enrichment; retry once.',
    };
  }
}

export default { tools, callTool, meter: { credits: 5 } } satisfies McpToolExport;
