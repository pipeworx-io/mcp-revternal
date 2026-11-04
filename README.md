# @pipeworx/revternal

Revternal MCP — people and developer intelligence from Revternal:
search a live index of ~12M developer profiles, behavioural intel per developer,
and person-level search and enrichment across job titles, companies, and skills.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1866+ live data sources. This is an independent, unofficial integration — not affiliated with, endorsed by, or published by the upstream provider.

## Tools

- `revternal_search_developers(...)` — search developers by role, primary language, location, recency.
- `revternal_developer_intel(github_username)` — behavioural profile: work pattern, collaboration style, professionalism signals.
- `revternal_enrich_developer(github_url)` — full developer profile from a GitHub URL.
- `revternal_people_search(...)` — search any person by job title, seniority, location (ISO-3 countries + cities), current company domain, skills, or stealth-founder status; cursor pagination.
- `revternal_enrich_person(linkedin_url, fetch_live?)` — full person profile from a LinkedIn `/in/` URL: experience, education, skills, certifications, photo. `fetch_live: false` (default) reads Revternal's existing record (`found: false` if none); `fetch_live: true` requests a fresh fetch.
- `revternal_credit_balance()` — the calling key's credit balance, plan, and status. Free; does not consume credits.

## Auth

BYOK only — bring your own Revternal API key. Get one at
https://revternal.com/signup and pass it as `_apiKey` (sent as `x-api-key`).
Pipeworx has no platform key for this pack, so a call without `_apiKey` is
refused with "Revternal requires an API key" before anything reaches Revternal.
Searches and enrichments spend your key's Revternal credits; check them with
`revternal_credit_balance` (free). An HTTP 402 from any tool means the key's
organization is out of credits.

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

Both URLs reach the same gateway and the same 1866+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## No MCP client? Call it over HTTP

This pack takes your own API key (`_apiKey`) — we don't front one for it, so there's no curl here that would run without it. Inspect any tool: `GET https://gateway.pipeworx.io/v1/tools/revternal_search_developers`. Find one: `POST https://gateway.pipeworx.io/v1/tools/search_packs` with `{"query":"..."}`.

## Run it from npm

`@pipeworx/mcp-revternal` is a local stdio bridge to the Pipeworx gateway: your MCP client
starts it with `npx`, and it forwards every call to the same
`https://gateway.pipeworx.io/revternal/mcp` endpoint shown above. It needs network access;
there is no offline mode.

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

Without a key it calls anonymously, capped at 50 calls a day. A free account
raises that to 200 a day: get a key at https://pipeworx.io/signup and add
`"env": { "PIPEWORX_API_KEY": "<your key>" }` to the server entry.
The key is sent as a Bearer token, the same way a hosted connection sends it,
so calls are metered and billed exactly as they are there.

It lists **only** this pack's tools by default. Set `PIPEWORX_META_TOOLS=1` to
also list `ask_pipeworx` and the other gateway-wide tools.

Behind an HTTPS proxy: Node's built-in `fetch` does not read `HTTPS_PROXY` by
default. Newer Node releases honour it when `NODE_USE_ENV_PROXY=1` is set; check
your Node version's documentation.

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
