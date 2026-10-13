# @pipeworx/revternal

Revternal MCP — people and developer intelligence from Revternal:
search a live index of ~12M developer profiles, behavioural intel per developer,
and person-level search and enrichment across job titles, companies, and skills.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1784+ live data sources. This is an independent, unofficial integration — not affiliated with, endorsed by, or published by the upstream provider.

## Tools

- `revternal_search_developers(...)` — search developers by role, primary language, location, recency.
- `revternal_developer_intel(github_username)` — behavioural profile: work pattern, collaboration style, professionalism signals.
- `revternal_enrich_developer(github_url)` — full developer profile from a GitHub URL.
- `revternal_people_search(...)` — search any person by job title, seniority, location (ISO-3 countries + cities), current company domain, skills, or stealth-founder status; cursor pagination.
- `revternal_enrich_person(linkedin_url, fetch_live?)` — full person profile from a LinkedIn `/in/` URL: experience, education, skills, certifications, photo. `fetch_live: false` (default) reads Revternal's existing record (`found: false` if none); `fetch_live: true` requests a fresh fetch.
- `revternal_credit_balance()` — the calling key's credit balance, plan, and status. Free; does not consume credits.

## Auth

BYOK only — pass your own Revternal key as `_apiKey` (sent as `x-api-key`).
There is currently no Pipeworx-funded platform key for this pack.

## Data sources

- Revternal, people and developer intelligence API (docs: https://revternal.com/docs)

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "revternal": {
      "url": "https://gateway.pipeworx.io/revternal/mcp"
    }
  }
}
```

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/revternal/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1784+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## No MCP client? Call it over HTTP

This pack takes your own API key (`_apiKey`) — we don't front one for it, so there's no curl here that would run without it. Inspect any tool: `GET https://gateway.pipeworx.io/v1/tools/revternal_search_developers`. Find one: `POST https://gateway.pipeworx.io/v1/tools/search_packs` with `{"query":"..."}`.

## Standalone (no gateway account)

This package also runs as a local stdio MCP server — no Pipeworx account, no
gateway round-trip:

```json
{
  "mcpServers": {
    "revternal": {
      "command": "npx",
      "args": ["-y", "@pipeworx/mcp-revternal"]
    }
  }
}
```

Or run it directly to confirm it starts:

```bash
npx -y @pipeworx/mcp-revternal
```

It speaks MCP over stdin/stdout and answers `initialize`/`tools/list`/`tools/call`
for **only** this pack's tools — none of the shared meta-tools the gateway
connection above adds. Same source, same tools, no ask_pipeworx routing.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Revternal data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
