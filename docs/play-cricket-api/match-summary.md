# Match Summary API

List fixtures (upcoming) and matches (with results). Lightweight - use for discovering match IDs, then fetch full details via [Match Detail](./match-detail.md).

## Request

```
GET /api/v2/matches.json
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `api_token` | string | Yes | API token |
| `site_id` | int | Yes | Play-Cricket site ID |
| `season` | string | No | Season year (e.g. `"2024"`) |
| `division_id` | int | No | Filter to a specific division |
| `cup_id` | int | No | Filter to a specific cup |
| `team_id` | int | No | Filter to a specific team |
| `competition_type` | string | No | `"League"`, `"Cup"`, or `"Friendly"` |
| `from_entry_date` | string | No | `dd/mm/yyyy` - records updated on or after |
| `end_entry_date` | string | No | `dd/mm/yyyy` - records updated on or before |
| `include_unpublished` | string | No | `"yes"` to include unpublished fixtures |

## Typical Usage

1. At season start: fetch all fixtures for the season
2. Periodically: use `from_entry_date` to pick up additions, amendments, and deletions since last sync

## Example Request

```
GET https://play-cricket.com/api/v2/matches.json?site_id=1234&season=2024&api_token=xxxxx
```

## Response

```json
{
  "matches": [
    {
      "id": 100007,
      "status": "New",
      "published": "Yes",
      "last_updated": "01/02/2024",
      "season": "2024",
      "match_date": "31/08/2024",
      "match_time": "11:00",
      "home_club_name": "Chingford Quackers CC",
      "home_team_name": "1st XI",
      "home_club_id": "2220",
      "home_team_id": 161463,
      "away_club_name": "Old Loughts CC",
      "away_team_name": "1st XI",
      "away_club_id": 6908,
      "away_team_id": 157998,
      "division_id": "90909"
    }
  ]
}
```

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | int | Match ID (use with Match Detail API) |
| `status` | string | `"New"` or `"Deleted"` |
| `published` | string | `"Yes"` or `"No"` |
| `last_updated` | string | Date last modified (`dd/mm/yyyy`) |
| `season` | string | Season year |
| `match_date` | string | Date of match (`dd/mm/yyyy`) |
| `match_time` | string | Start time (`HH:MM`) |
| `home_club_name` | string | Home club name |
| `home_team_name` | string | Home team name |
| `home_club_id` | string | Home club ID |
| `home_team_id` | int | Home team ID |
| `away_club_name` | string | Away club name |
| `away_team_name` | string | Away team name |
| `away_club_id` | int | Away club ID |
| `away_team_id` | int | Away team ID |
| `division_id` | string | Division ID (if applicable) |

## Notes

- Unpublished matches are fixtures created in league sites but not yet published to the front end or club sites. Most consumers will not need these.
- The `status: "Deleted"` value indicates a soft-deleted record. Use `from_entry_date` to detect deletions during incremental sync.
