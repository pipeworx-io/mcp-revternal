interface McpToolDefinition {
  name: string;
  description: string;
  /** Human-facing one-liner (fleet #1967). Optional; consumers fall back to
   *  description. Kept in step with shared/src/types.ts — scripts/lib/
   *  check-inlined-types.mjs reports drift at publish time. */
  summary?: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    anyOf?: Array<{ required: string[] }>;
    oneOf?: Array<{ required: string[] }>;
    allOf?: Array<{ required: string[] }>;
  };
  outputSchema?: Record<string, unknown>;
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Revternal MCP — wraps Revternal's people/developer intelligence API
 * (api.revternal.com), rebuilt 2026-10-13 onto Revternal's CURRENT product
 * (fleet #3009 — their CEO flagged the previous build as the old product).
 *
 * Every route now carries the `/v1` prefix the current docs
 * (https://revternal.com/docs/) require. The pack's first cut (2026-07-21)
 * called the unprefixed `/developer/*` paths, which the vendor has since
 * moved on from — `api.revternal.com/openapi.json` 404s, and those unprefixed
 * paths are absent from the current docs entirely. The `/v1/people/*` routes
 * (added 2026-08-12) already used the right prefix and are unchanged here.
 *
 * Auth: `x-api-key` header, BYOK only. The prior platform key
 * (PLATFORM_REVTERNAL_KEY) returned HTTP 402 ("organization does not have
 * enough credits" — Revternal's own documented meaning for that status) on
 * every metered route tested live through the gateway on 2026-10-13, so
 * `platformKeyEnv` has been removed from the pack manifest: callers must
 * supply their own key as `_apiKey`. Bruce is sourcing a replacement platform
 * key from Revternal; when it lands it goes into the PLATFORM_KEYS_JSON shim,
 * not back into this binding.
 *
 * Tools:
 * - revternal_search_developers  — developer search by role, language, location, recency
 * - revternal_developer_intel    — work pattern / behaviour by GitHub username
 * - revternal_enrich_developer   — full developer profile from a GitHub URL
 * - revternal_people_search      — any person, by title/seniority/location/company/skills
 * - revternal_enrich_person      — full person profile from a LinkedIn URL
 * - revternal_credit_balance     — the calling key's credit balance/plan (free; does not consume credits)
 *
 * People Search requires at least one filter and answers 422 for enum/format
 * mistakes; person enrichment with fetchLive=false answers 404 when Revternal
 * has no existing record for that URL — both are caller-shaped outcomes, not
 * outages, and are mapped to user_error / found:false below.
 */


const BASE_URL = 'https://api.revternal.com';

const tools: McpToolExport['tools'] = [
  {
    name: 'revternal_search_developers',
    description:
      'Search a live index of ~12M developers (GitHub-centric) by role, primary programming language, location, and recent activity — for recruiting, GTM/lead-gen, and developer-audience research. Each result is a matching GitHub username, display name, and profile URL; your search filters are echoed back on the response rather than repeated per result. Filters: role (e.g. "backend engineer", "ai/ml engineer" — spaces/punctuation are normalized to underscores), primary_language (e.g. "Python", "Rust"), location, active_within_days (only devs active in the last N days), sort_by ("last_active", "commit_quality", or "external_contribution_ratio"; default last_active). Paginate with limit + offset — each requested slot costs 1 credit. Requires your own Revternal API key (BYOK) — pass it as _apiKey. Example: revternal_search_developers({ primary_language: "Rust", active_within_days: 30, limit: 20, _apiKey: "..." }).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        role: { type: 'string', description: 'Developer role filter, e.g. "backend engineer", "ai/ml engineer", "frontend engineer".' },
        primary_language: { type: 'string', description: 'Primary programming language, e.g. "Python", "Rust", "TypeScript".' },
        location: { type: 'string', description: 'Location filter, e.g. "Berlin", "United States".' },
        active_within_days: { type: 'number', description: 'Only developers active within the last N days (>=1).' },
        sort_by: { type: 'string', description: 'Sort field: "last_active" (default), "commit_quality", or "external_contribution_ratio".' },
        limit: { type: 'number', description: 'Results per page, 1-100 (default 20). Each requested slot costs 1 credit.' },
        offset: { type: 'number', description: 'Pagination offset (default 0).' },
        _apiKey: { type: 'string', description: 'Your Revternal API key (sent as x-api-key). Required — Pipeworx has no platform key for this pack right now.' },
      },
      required: [],
    },
  },
  {
    name: 'revternal_developer_intel',
    description:
      'Get behavioural intelligence for one developer by GitHub username — how they actually work, not just their bio. Returns work pattern (chronotype, peak hours, work rhythm, activity trend, velocity change), collaboration style (solo vs team, external PR ratio, reviews given), professionalism signals (commit quality, conventional commits, primary work type), and activity recency. Flat 1 credit per successful lookup; a username not yet in Revternal\'s index answers 404. Requires your own Revternal API key (BYOK) — pass it as _apiKey. Example: revternal_developer_intel({ github_username: "torvalds", _apiKey: "..." }).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        github_username: { type: 'string', description: 'GitHub username (login), e.g. "torvalds".' },
        _apiKey: { type: 'string', description: 'Your Revternal API key (sent as x-api-key). Required — Pipeworx has no platform key for this pack right now.' },
      },
      required: ['github_username'],
    },
  },
  {
    name: 'revternal_enrich_developer',
    description:
      'Enrich a developer from their GitHub profile URL — full firmographic + technical profile, computed in real time (cached server-side after the first call). Returns name, location, company, bio, followers/following, repo and gist counts, years active, seniority estimate, a ranked skills breakdown (languages by repo share), top repos, 90-day activity counts, and composite scores (seniority, activity, language diversity, influence, profile completeness). Flat 2 credits per successful call. Use to enrich a lead or candidate you already have a GitHub URL for. Requires your own Revternal API key (BYOK) — pass it as _apiKey. Example: revternal_enrich_developer({ github_url: "https://github.com/torvalds", _apiKey: "..." }).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        github_url: { type: 'string', description: 'Full GitHub profile URL, e.g. "https://github.com/torvalds".' },
        _apiKey: { type: 'string', description: 'Your Revternal API key (sent as x-api-key). Required — Pipeworx has no platform key for this pack right now.' },
      },
      required: ['github_url'],
    },
  },
  {
    name: 'revternal_people_search',
    description:
      'Search Revternal\'s people-intelligence index for any person — not just developers — by job title, seniority, location, current company domain, or skills. Returns matching people with name, headline, and profile fields, plus an opaque cursor for the next page. At least one filter is required. Seniority values: entry, senior, manager, director, vp, c_suite, owner, partner. Countries use 3-letter ISO codes (USA, GBR, IND). Use for recruiting, GTM prospecting, and lead research when you have criteria rather than a specific profile. Example: revternal_people_search({ job_titles: ["Software Engineer"], countries: ["USA"], page_size: 5 }).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        job_titles: { type: 'array', items: { type: 'string' }, description: 'Current job titles to match, e.g. ["Software Engineer", "CTO"]. A single string is also accepted.' },
        seniority: { type: 'array', items: { type: 'string', enum: ['entry', 'senior', 'manager', 'director', 'vp', 'c_suite', 'owner', 'partner'] }, description: 'Seniority levels to match: entry, senior, manager, director, vp, c_suite, owner, partner.' },
        countries: { type: 'array', items: { type: 'string' }, description: '3-letter ISO country codes, e.g. ["USA", "GBR"]. Common 2-letter codes are auto-converted.' },
        cities: { type: 'array', items: { type: 'string' }, description: 'City names to match, e.g. ["San Francisco"].' },
        company_domains: { type: 'array', items: { type: 'string' }, description: 'Current-company website domains, e.g. ["openai.com"].' },
        skills: { type: 'array', items: { type: 'string' }, description: 'Skills or keywords matched across profile fields, e.g. ["Python", "FastAPI"].' },
        stealth_founder: { type: 'boolean', description: 'When true, limit results to stealth founders.' },
        page_size: { type: 'number', description: 'Results per page, 1-100 (default 5).' },
        cursor: { type: 'string', description: 'Opaque cursor from the previous response (next_cursor) — pass back unmodified to paginate.' },
        _apiKey: { type: 'string', description: 'Your Revternal API key (sent as x-api-key). Required — Pipeworx has no platform key for this pack right now.' },
      },
      required: [],
    },
  },
  {
    name: 'revternal_enrich_person',
    description:
      'Enrich one person from their LinkedIn profile URL via Revternal — full normalized profile: name, headline, current company and title, past work experience, education, skills, certifications, and profile picture. Default (fetch_live: false) reads Revternal\'s existing record for that URL and returns found:false if there is none; set fetch_live: true to have Revternal fetch a fresh profile (slower, higher vendor cost). Use to enrich a lead, candidate, or contact you already have a LinkedIn URL for. Example: revternal_enrich_person({ linkedin_url: "https://www.linkedin.com/in/vishalv06" }).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        linkedin_url: { type: 'string', description: 'Personal LinkedIn profile URL containing /in/, e.g. "https://www.linkedin.com/in/vishalv06". A bare username is also accepted.' },
        fetch_live: { type: 'boolean', description: 'false (default): return Revternal\'s existing profile record, found:false if none (1 credit if found). true: Revternal fetches fresh profile data (5 credits, slower, higher vendor cost).' },
        _apiKey: { type: 'string', description: 'Your Revternal API key (sent as x-api-key). Required — Pipeworx has no platform key for this pack right now.' },
      },
      required: ['linkedin_url'],
    },
  },
  {
    name: 'revternal_credit_balance',
    description:
      'Check the credit balance, plan, and status for a Revternal API key — free, does not consume credits. Use before a bulk search/enrichment run to confirm you have credits, or to diagnose a "HTTP 402 Payment Required" error from another revternal_* tool. Requires your own Revternal API key (BYOK) — pass it as _apiKey. Example: revternal_credit_balance({ _apiKey: "..." }).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        _apiKey: { type: 'string', description: 'Your Revternal API key (sent as x-api-key). Required — Pipeworx has no platform key for this pack right now.' },
      },
      required: [],
    },
  },
];

function revternalError(status: number, tool: string): Error {
  if (status === 401 || status === 403) {
    return new Error(`Revternal: auth failed (HTTP ${status}). Your _apiKey is missing, invalid, or blocked — pass a valid Revternal API key via _apiKey.`);
  }
  if (status === 402) {
    return new Error(
      `Revternal: the API key's organization does not have enough credits (HTTP 402). Call revternal_credit_balance to check the balance, or use a key with credits.`,
    );
  }
  if (status === 429) {
    return new Error('Revternal: rate-limited (HTTP 429). Retry shortly.');
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

/**
 * POST to a /v1 people endpoint, returning status + parsed body instead of
 * throwing on !ok — the people endpoints answer 404/422 for caller-shaped
 * outcomes that must map to found:false / user_error, not a thrown "HTTP 4xx".
 */
async function revPost(
  path: string,
  apiKey: string,
  payload: unknown,
  timeoutMs = 25_000,
): Promise<{ status: number; body: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Revternal: request timed out (live enrichment can be slow). Retry shortly.');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** FastAPI-style error bodies carry `detail` as a string or a validation array. */
function detailOf(body: any): string {
  const d = body?.detail ?? body?.message ?? body?.error;
  if (typeof d === 'string') return d;
  return d ? JSON.stringify(d) : 'invalid request';
}

/** Accept a string as a one-element (or comma-separated) list — agents pass both. */
function asList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string' && v.trim()) return v.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

// People Search requires 3-letter ISO country codes; agents habitually pass
// 2-letter codes, so convert the common ones instead of bouncing the call.
const ISO2_TO_ISO3: Record<string, string> = {
  US: 'USA', GB: 'GBR', UK: 'GBR', IN: 'IND', DE: 'DEU', FR: 'FRA', CA: 'CAN',
  AU: 'AUS', JP: 'JPN', CN: 'CHN', BR: 'BRA', NL: 'NLD', ES: 'ESP', IT: 'ITA',
  SE: 'SWE', CH: 'CHE', SG: 'SGP', IL: 'ISR', MX: 'MEX', KR: 'KOR', PL: 'POL',
  AT: 'AUT', BE: 'BEL', DK: 'DNK', FI: 'FIN', NO: 'NOR', PT: 'PRT', IE: 'IRL',
  NZ: 'NZL', ZA: 'ZAF', AE: 'ARE', AR: 'ARG', CL: 'CHL', CO: 'COL', ID: 'IDN',
  MY: 'MYS', PH: 'PHL', TH: 'THA', TR: 'TUR', UA: 'UKR', VN: 'VNM', TW: 'TWN',
  HK: 'HKG', CZ: 'CZE', GR: 'GRC', HU: 'HUN', RO: 'ROU', RU: 'RUS', SA: 'SAU',
  EG: 'EGY', NG: 'NGA', KE: 'KEN', PK: 'PAK', BD: 'BGD', LK: 'LKA', EE: 'EST',
};

function clampInt(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(Math.max(Math.trunc(n), lo), hi);
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const apiKey = typeof args._apiKey === 'string' ? args._apiKey : '';
  if (!apiKey) {
    return {
      error: 'Revternal requires an API key: pass your x-api-key value as the _apiKey argument.',
      retry_hint: 'Pass your Revternal x-api-key value as the _apiKey argument.',
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
        return await revFetch(`/v1/developer/search?${qs.toString()}`, apiKey);
      }
      case 'revternal_developer_intel': {
        const u = typeof args.github_username === 'string' ? args.github_username.trim() : '';
        if (!u) return { error: 'github_username is required', retry_hint: 'Pass a GitHub login, e.g. {"github_username":"torvalds"}.' };
        return await revFetch(`/v1/developer/intel?github_username=${encodeURIComponent(u)}`, apiKey);
      }
      case 'revternal_enrich_developer': {
        const url = typeof args.github_url === 'string' ? args.github_url.trim() : '';
        if (!url) return { error: 'github_url is required', retry_hint: 'Pass a full GitHub profile URL, e.g. {"github_url":"https://github.com/torvalds"}.' };
        return await revFetch('/v1/developer/enrich', apiKey, { method: 'POST', body: JSON.stringify({ github_url: url }) });
      }
      case 'revternal_people_search': {
        const jobTitles = asList(args.job_titles);
        const seniority = asList(args.seniority).map((s) => s.toLowerCase().replace(/[- ]/g, '_'));
        const countries = asList(args.countries).map((c) => {
          const u = c.toUpperCase();
          return ISO2_TO_ISO3[u] ?? u;
        });
        const cities = asList(args.cities);
        const domains = asList(args.company_domains);
        const skills = asList(args.skills);
        const body: Record<string, unknown> = {};
        if (jobTitles.length) body.job_titles = jobTitles;
        if (seniority.length) body.seniority = seniority;
        if (countries.length || cities.length) body.location = { countries, cities };
        if (domains.length) body.current_company = { domains };
        if (skills.length) body.skills = skills;
        if (args.stealth_founder === true) body.stealth_founder = true;
        if (Object.keys(body).length === 0) {
          return {
            error: 'user_error: at least one of job_titles, seniority, countries, cities, company_domains, skills, or stealth_founder must be provided.',
            retry_hint: 'Add a search filter, e.g. {"job_titles":["Software Engineer"],"countries":["USA"]}.',
          };
        }
        body.page_size = clampInt(args.page_size, 1, 100, 5);
        if (typeof args.cursor === 'string' && args.cursor.trim()) body.cursor = args.cursor.trim();
        const { status, body: resBody } = await revPost('/v1/people/search', apiKey, body);
        if (status === 422) {
          return {
            error: `user_error: Revternal rejected the search filters: ${detailOf(resBody)}`,
            retry_hint: 'seniority must be one of entry|senior|manager|director|vp|c_suite|owner|partner; countries must be 3-letter ISO codes like USA or GBR; company_domains must be bare domains like "openai.com"; page_size 1-100.',
          };
        }
        if (status >= 400) throw revternalError(status, 'people/search');
        return resBody;
      }
      case 'revternal_enrich_person': {
        const raw = typeof args.linkedin_url === 'string' ? args.linkedin_url.trim() : '';
        if (!raw) {
          return {
            error: 'user_error: linkedin_url is required',
            retry_hint: 'Pass a LinkedIn /in/ profile URL, e.g. {"linkedin_url":"https://www.linkedin.com/in/vishalv06"}.',
          };
        }
        // Forgiving input: full URL, schemeless linkedin.com/in/x, or a bare username.
        let linkedinUrl = raw;
        if (!/linkedin\.com/i.test(raw)) {
          if (/^[\w.-]+$/.test(raw)) linkedinUrl = `https://www.linkedin.com/in/${raw}`;
        } else if (!raw.includes('://')) {
          linkedinUrl = `https://${raw}`;
        }
        if (!/linkedin\.com\/in\/[^/]+/i.test(linkedinUrl)) {
          return {
            error: `user_error: "${raw}" is not a personal LinkedIn profile URL — it must contain /in/<username>.`,
            retry_hint: 'Pass a personal profile URL like "https://www.linkedin.com/in/vishalv06" (company pages are not supported), or just the username.',
          };
        }
        const fetchLive = args.fetch_live === true;
        const { status, body: resBody } = await revPost(
          '/v1/person/enrich',
          apiKey,
          { linkedin_url: linkedinUrl, fetchLive },
          fetchLive ? 45_000 : 25_000,
        );
        if (status === 404) {
          return fetchLive
            ? {
                found: false,
                reason: 'profile_not_found',
                hint: `Revternal could not find a profile at ${linkedinUrl}. Check the username spelling.`,
              }
            : {
                found: false,
                reason: 'no_existing_profile',
                hint: 'Revternal has no existing record for this URL. Retry with fetch_live: true to fetch a fresh profile (higher vendor cost), or check the username.',
              };
        }
        if (status === 422) {
          return {
            error: `user_error: Revternal rejected the request: ${detailOf(resBody)}`,
            retry_hint: 'linkedin_url must be a personal /in/ profile URL; fetch_live must be a boolean.',
          };
        }
        if (status >= 400) throw revternalError(status, 'person/enrich');
        return resBody;
      }
      case 'revternal_credit_balance':
        return await revFetch('/v1/credit-balance', apiKey);
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
