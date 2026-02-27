# Result Summary API

Returns matches that have a result attached (including "match in progress"). More detailed than Match Summary but only includes completed/in-progress matches. Includes innings totals and points.

## Request

```
GET /api/v2/result_summary.json
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `api_token` | string | Yes | API token |
| `site_id` | int | Yes | Play-Cricket site ID |
| `season` | string | Yes | Season year (e.g. `"2024"`) |
| `division_id` | int | No | Filter to a specific division |
| `cup_id` | int | No | Filter to a specific cup |
| `team_id` | int | No | Filter to a specific team |
| `competition_type` | string | No | `"League"`, `"Cup"`, or `"Friendly"` |
| `from_match_date` | string | No | `dd/mm/yyyy` - matches on or after this date |
| `end_match_date` | string | No | `dd/mm/yyyy` - matches on or before this date |
| `from_entry_date` | string | No | `dd/mm/yyyy` - records updated on or after |
| `end_entry_date` | string | No | `dd/mm/yyyy` - records updated on or before |

## Example Request

```
GET https://play-cricket.com/api/v2/result_summary.json?site_id=1234&season=2024&api_token=xxxxx
```

## Response

```json
{
  "result_summary": [
    {
      "id": 3048818,
      "status": "New",
      "published": "Yes",
      "last_updated": "17/09/2024",
      "league_name": "Derbyshire County Cricket League",
      "league_id": "296",
      "competition_name": "ECB Premier Division",
      "competition_id": "69547",
      "competition_type": "League",
      "match_type": "Limited Overs",
      "game_type": "Standard",
      "match_date": "16/09/2024",
      "match_time": "12:00",
      "ground_name": "Raygar Arena",
      "ground_id": "12682",
      "home_team_name": "1st XI",
      "home_team_id": "7960",
      "home_club_name": "Alvaston & Boulton CC",
      "home_club_id": "690",
      "away_team_name": "1st XI",
      "away_team_id": "50478",
      "away_club_name": "Cutthorpe CC",
      "away_club_id": "143",
      "umpire_1_name": "Peter Gibson",
      "umpire_1_id": "3218559",
      "umpire_2_name": "Adam Hitchcock",
      "umpire_2_id": "12683",
      "umpire_3_id": "",
      "referee_id": "",
      "scorer_1_id": "",
      "scorer_2_id": "",
      "toss_won_by_team_id": "50478",
      "toss": "Cutthorpe CC - 1st XI won the toss and elected to bat",
      "batted_first": "50478",
      "no_of_overs": "",
      "no_of_innings": "1",
      "result": "W",
      "result_description": "Alvaston & Boulton CC - 1st XI - Won bat second 27",
      "result_applied_to": "7960",
      "match_notes": "<br><b>Cutthorpe innings:</b> ...",
      "points": [
        {
          "team_id": 7960,
          "game_points": "27",
          "penalty_points": "0.0",
          "bonus_points_together": "",
          "bonus_points_batting": "0.0",
          "bonus_points_bowling": "0.0",
          "bonus_points_2nd_innings_together": ""
        },
        {
          "team_id": 50478,
          "game_points": "0",
          "penalty_points": "0.0",
          "bonus_points_together": "",
          "bonus_points_batting": "5.0",
          "bonus_points_bowling": "1.0",
          "bonus_points_2nd_innings_together": ""
        }
      ],
      "innings": [
        {
          "team_batting_id": "50478",
          "innings_number": 1,
          "extra_byes": "1",
          "extra_leg_byes": "10",
          "extra_wides": "9",
          "extra_no_balls": "7",
          "extra_penalty_runs": "0",
          "penalties_runs_awarded_in_other_innings": "0",
          "total_extras": "27",
          "runs": "287",
          "wickets": "7",
          "overs": "50.0",
          "declared": false,
          "revised_target_runs": "",
          "revised_target_overs": ""
        }
      ]
    }
  ]
}
```

## Response Fields

### Match-level fields

| Field | Type | Always present? | Description |
|-------|------|-----------------|-------------|
| `id` | int | Yes | Match ID |
| `status` | string | Yes | `"New"` or `"Deleted"` |
| `published` | string | Yes | `"Yes"` or `"No"` |
| `last_updated` | string | Yes | `dd/mm/yyyy` |
| `league_name` | string | **No** | League name |
| `league_id` | string | **No** | League ID |
| `competition_name` | string | **No** | Division/cup name |
| `competition_id` | string | **No** | Division/cup ID |
| `competition_type` | string | **No** | `"League"`, `"Cup"`, or `"Friendly"` |
| `match_type` | string | **No** | e.g. `"Limited Overs"`, `"Declaration"` |
| `game_type` | string | **No** | e.g. `"Standard"` |
| `match_date` | string | Yes | `dd/mm/yyyy` |
| `match_time` | string | Yes | `HH:MM` |
| `ground_name` | string | **No** | Ground name |
| `ground_id` | string | **No** | Ground ID |
| `home_team_name` | string | Yes | Home team name |
| `home_team_id` | string | Yes | Home team ID |
| `home_club_name` | string | Yes | Home club name |
| `home_club_id` | string | Yes | Home club ID |
| `away_team_name` | string | Yes | Away team name |
| `away_team_id` | string | Yes | Away team ID |
| `away_club_name` | string | Yes | Away club name |
| `away_club_id` | string | Yes | Away club ID |
| `umpire_1_name` | string | **No** | First umpire name |
| `umpire_1_id` | string | **No** | First umpire ID |
| `umpire_2_name` | string | **No** | Second umpire name |
| `umpire_2_id` | string | **No** | Second umpire ID |
| `umpire_3_id` | string | **No** | Third umpire ID |
| `referee_id` | string | **No** | Referee ID |
| `scorer_1_id` | string | **No** | First scorer ID |
| `scorer_2_id` | string | **No** | Second scorer ID |
| `toss_won_by_team_id` | string | **No** | Team ID that won the toss |
| `toss` | string | **No** | Toss description text |
| `batted_first` | string | **No** | Team ID that batted first |
| `no_of_overs` | string | **No** | Number of overs (if applicable) |
| `no_of_innings` | string | **No** | Number of innings per side |
| `result` | string | Yes | Result code (e.g. `"W"`) |
| `result_description` | string | **No** | Human-readable result |
| `result_applied_to` | string | **No** | Team ID the result applies to |
| `match_notes` | string | **No** | Free-text notes (may contain HTML) |

### Points object

| Field | Type | Description |
|-------|------|-------------|
| `team_id` | int | Team ID |
| `game_points` | string | Points awarded for the game result |
| `penalty_points` | string | Penalty points deducted |
| `bonus_points_together` | string | Combined bonus points (if league uses single bonus) |
| `bonus_points_batting` | string | Batting bonus points |
| `bonus_points_bowling` | string | Bowling bonus points |
| `bonus_points_2nd_innings_together` | string | 2nd innings combined bonus (multi-innings matches) |

### Innings object

| Field | Type | Description |
|-------|------|-------------|
| `team_batting_id` | string | Team ID of the batting side |
| `innings_number` | int | Innings number (1, 2, etc.) |
| `extra_byes` | string | Byes |
| `extra_leg_byes` | string | Leg byes |
| `extra_wides` | string | Wides |
| `extra_no_balls` | string | No balls |
| `extra_penalty_runs` | string | Penalty runs |
| `penalties_runs_awarded_in_other_innings` | string | Penalty runs from other innings |
| `total_extras` | string | Total extras |
| `runs` | string | Total runs scored |
| `wickets` | string | Wickets lost |
| `overs` | string | Overs faced (e.g. `"50.0"`, `"46.3"`) |
| `declared` | boolean | Whether the innings was declared |
| `revised_target_runs` | string | D/L revised target runs |
| `revised_target_overs` | string | D/L revised target overs |

## Notes

- Unlike Match Summary, this endpoint **requires** the `season` parameter.
- Does not include individual batting/bowling figures - use [Match Detail](./match-detail.md) for full scorecards.
- `match_notes` may contain HTML (e.g. `<br>`, `<b>` tags).
- **Many fields are optional** for historical/older matches. League, competition, ground, umpire/scorer, toss, and result description fields may be absent. Always treat these as optional when parsing.
