# Play-Cricket API Documentation

Structured reference for the [Play-Cricket](https://play-cricket.com) API v2, maintained by the ECB.

## Base URL

```
https://play-cricket.com/api/v2
```

> The official docs use `http://` in examples but `https://` should be used in practice.

## Authentication

All endpoints require an `api_token` query parameter. Tokens are issued per-club/league site.

```
?api_token=YOUR_TOKEN
```

## Endpoints

| Endpoint | Description | Doc |
|----------|-------------|-----|
| [Teams](./teams.md) | List teams for a site | `GET /sites/{site_id}/teams.json` |
| [Players](./players.md) | List players for a site | `GET /sites/{site_id}/players` |
| [Competitions](./competitions.md) | List divisions/cups for a league & season | `GET /competitions.json` |
| [Teams in Division](./teams-in-division.md) | List teams in a division/cup | `GET /competition_teams.json` |
| [Match Summary](./match-summary.md) | List fixtures & matches (lightweight) | `GET /matches.json` |
| [Result Summary](./result-summary.md) | Matches with results (includes innings totals) | `GET /result_summary.json` |
| [Match Detail](./match-detail.md) | Full scorecard for a single match | `GET /match_detail.json` |
| [League Table](./league-table.md) | Calculated league table for a division | `GET /league_table.json` |

## Common Patterns

### Date parameters

Date strings use `dd/mm/yyyy` format throughout (UK-style).

Two date-range patterns appear across endpoints:

- **`from_entry_date` / `end_entry_date`** - filter by when the record was last updated in Play-Cricket (useful for incremental sync)
- **`from_match_date` / `end_match_date`** - filter by the actual match date

### Status field

Many responses include a `status` field with values:
- `"New"` - active/current record
- `"Deleted"` - soft-deleted record

### Published field

Match-related responses include `published` (`"Yes"` / `"No"`). Unpublished fixtures are created in league sites but not yet visible on club sites.

### Empty strings

The API returns empty strings `""` for null/missing values rather than `null`.

## Access Policy

The API is primarily for clubs and leagues to extract their own data. Commercial/non-profit partners require ECB onboarding. The ECB recommends smaller projects allow clubs to provide their own API tokens.

See: [Play-Cricket API Access](https://play-cricket.ecb.co.uk/hc/en-us/articles/24640412683037)
