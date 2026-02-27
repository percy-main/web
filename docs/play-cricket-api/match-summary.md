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

| Field | Type | Always present? | Description |
|-------|------|-----------------|-------------|
| `id` | int | Yes | Match ID (use with Match Detail API) |
| `status` | string | Yes | `"New"` or `"Deleted"` |
| `published` | string | Yes | `"Yes"` or `"No"` |
| `last_updated` | string | Yes | Date last modified (`dd/mm/yyyy`) |
| `season` | string | Yes | Season year |
| `match_date` | string | Yes | Date of match (`dd/mm/yyyy`) |
| `match_time` | string | **No** | Start time (`HH:MM`) |
| `home_club_name` | string | Yes | Home club name |
| `home_team_name` | string | Yes | Home team name |
| `home_club_id` | string | Yes | Home club ID |
| `home_team_id` | string | Yes | Home team ID |
| `away_club_name` | string | Yes | Away club name |
| `away_team_name` | string | Yes | Away team name |
| `away_club_id` | string | Yes | Away club ID |
| `away_team_id` | string | Yes | Away team ID |
| `league_name` | string | **No** | League name |
| `league_id` | string | **No** | League ID |
| `competition_name` | string | **No** | Division/cup name |
| `competition_id` | string | **No** | Division/cup ID |
| `competition_type` | string | **No** | `"League"`, `"Cup"`, or `"Friendly"` |
| `match_type` | string | **No** | e.g. `"Limited Overs"`, `"Declaration"` |
| `game_type` | string | **No** | e.g. `"Standard"` |
| `ground_name` | string | **No** | Ground name |
| `ground_id` | string | **No** | Ground ID |
| `ground_latitude` | string | **No** | Ground latitude |
| `ground_longitude` | string | **No** | Ground longitude |
| `umpire_1_name` | string | **No** | First umpire name |
| `umpire_1_id` | string | **No** | First umpire ID |
| `umpire_2_name` | string | **No** | Second umpire name |
| `umpire_2_id` | string | **No** | Second umpire ID |
| `umpire_3_name` | string | **No** | Third umpire name |
| `umpire_3_id` | string | **No** | Third umpire ID |
| `referee_name` | string | **No** | Referee name |
| `referee_id` | string | **No** | Referee ID |
| `scorer_1_name` | string | **No** | First scorer name |
| `scorer_1_id` | string | **No** | First scorer ID |
| `scorer_2_name` | string | **No** | Second scorer name |
| `scorer_2_id` | string | **No** | Second scorer ID |

## Notes

- Unpublished matches are fixtures created in league sites but not yet published to the front end or club sites. Most consumers will not need these.
- The `status: "Deleted"` value indicates a soft-deleted record. Use `from_entry_date` to detect deletions during incremental sync.
- **All matches have `status: "New"`** regardless of whether they have been played. Do not use the status field to filter for completed matches. Instead, fetch the [Match Detail](./match-detail.md) and check for innings with batting data.
- **Many fields are optional**, especially for historical/older matches (pre-2010 in particular). Fields like `league_name`, `competition_type`, `match_time`, ground details, and umpire/scorer details may be missing entirely from the response. Always treat these as optional when parsing.
