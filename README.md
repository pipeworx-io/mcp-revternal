# @pipeworx/revternal

Revternal MCP — people and developer intelligence from Revternal (api.revternal.com):
search a live index of ~12M developer profiles, behavioural intel per developer,
and person-level search and enrichment across job titles, companies, and skills.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1476+ live data sources.

## Tools

- `revternal_search_developers(...)` — search developers by role, primary language, location, recency.
- `revternal_developer_intel(github_username)` — behavioural profile: work pattern, collaboration style, professionalism signals.
- `revternal_enrich_developer(github_url)` — full developer profile from a GitHub URL.
- `revternal_people_search(...)` — search any person by job title, seniority, location (ISO-3 countries + cities), current company domain, skills, or stealth-founder status; cursor pagination.
- `revternal_enrich_person(linkedin_url, fetch_live?)` — full person profile from a LinkedIn `/in/` URL: experience, education, skills, certifications, photo. `fetch_live: false` (default) reads Revternal's existing record (`found: false` if none); `fetch_live: true` requests a fresh fetch.
- `revternal_index_stats()` — index size and processing status.

## Auth

Platform-keyed — works out of the box through the gateway. You may also pass
your own Revternal key as `_apiKey` (sent as `x-api-key`).

## Data sources

- https://api.revternal.com (docs: https://revternal.com/docs)

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

Both URLs reach the same gateway and the same 1476+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

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
