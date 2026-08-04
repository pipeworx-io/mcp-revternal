# mcp-revternal

Revternal MCP — wraps the Revternal Developer Intelligence API

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `revternal_search_developers` | Search a live index of ~11.7M developers (GitHub-centric) by role, primary programming language, location, and recent activity — for recruiting, GTM/lead-gen, and developer-audience research. Returns matching GitHub usernames with role, primary language, location, and last-active timestamp. Filters: role (e.g. "backend engineer", "ai/ml engineer"), primary_language (e.g. "Python", "Rust"), location, active_within_days (only devs active in the last N days), sort_by (default last_active). Paginate with limit + offset. Example: revternal_search_developers({ primary_language: "Rust", active_within_days: 30, limit: 20 }). |
| `revternal_developer_intel` | Get behavioural intelligence for one developer by GitHub username — how they actually work, not just their bio. Returns work pattern (chronotype, peak hours, work rhythm, activity trend, velocity change), collaboration style (solo vs team, external PR ratio, reviews given), professionalism signals (commit quality, conventional commits, primary work type), and activity recency. Use to assess engagement, seniority signals, and outreach timing. Example: revternal_developer_intel({ github_username: "torvalds" }). |
| `revternal_enrich_developer` | Enrich a developer from their GitHub profile URL — full firmographic + technical profile. Returns name, location, company, followers, years active, seniority estimate, and a ranked skills breakdown (languages by repo share). Use to enrich a lead or candidate you already have a GitHub URL for. Example: revternal_enrich_developer({ github_url: "https://github.com/torvalds" }). |
| `revternal_index_stats` | Index statistics for the Revternal developer-intelligence dataset — total profiles indexed and processing status. Use to gauge coverage and freshness before relying on search results. Example: revternal_index_stats({}). |

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

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Revternal data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
