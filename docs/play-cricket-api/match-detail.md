# Match Detail API

Full scorecard for a single match, including team sheets, batting, bowling, and fall of wickets.

## Request

```
GET /api/v2/match_detail.json
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `api_token` | string | Yes | API token |
| `match_id` | int | Yes | Match ID (from Match Summary or Result Summary) |

## Example Request

```
GET https://play-cricket.com/api/v2/match_detail.json?match_id=123456&api_token=xxxxx
```

## Response

The response is a single-element array containing the full match object.

```json
{
  "match_details": [
    {
      "id": 123456,
      "status": "New",
      "published": "Yes",
      "last_updated": "01/02/2024",
      "league_name": "Anything But Collies League",
      "league_id": "14792",
      "competition_name": "Division 1",
      "competition_id": "71400",
      "competition_type": "League",
      "match_type": "Declaration",
      "game_type": "Standard",
      "match_id": "1234567",
      "match_date": "10/06/2024",
      "match_time": "10:45",
      "ground_name": "Peter May Sports Centre",
      "ground_id": "13909",
      "home_team_name": "3rd XI",
      "home_team_id": "12640",
      "home_club_name": "Chingford CC",
      "home_club_id": "1835",
      "away_team_name": "2nd XI",
      "away_team_id": "208057",
      "away_club_name": "Chingford Quackers CC",
      "away_club_id": "14793",
      "umpire_1_name": "...",
      "umpire_1_id": "...",
      "umpire_2_name": "...",
      "umpire_2_id": "...",
      "umpire_3_id": "",
      "referee_id": "",
      "scorer_1_name": "...",
      "scorer_1_id": "...",
      "scorer_2_name": "...",
      "scorer_2_id": "...",
      "toss_won_by_team_id": "12640",
      "toss": "Chingford CC - 3rd XI won the toss and elected to bat",
      "batted_first": "12640",
      "no_of_overs": "",
      "no_of_innings": "1",
      "no_of_days": "",
      "no_of_players": "",
      "no_of_reserves": "",
      "result": "W",
      "result_description": "Chingford Quackers CC - 2nd XI - Won",
      "result_applied_to": "208057",
      "match_notes": "What a match!",
      "points": [],
      "match_result_types": [],
      "players": [],
      "innings": []
    }
  ]
}
```

## Match-Level Fields

Same as [Result Summary](./result-summary.md) plus:

| Field | Type | Description |
|-------|------|-------------|
| `match_id` | string | Match ID (also appears as top-level `id`) |
| `ground_name` | string | Ground name |
| `ground_id` | string | Ground ID |
| `scorer_1_name` | string | First scorer name |
| `scorer_1_id` | string | First scorer ID |
| `scorer_2_name` | string | Second scorer name |
| `scorer_2_id` | string | Second scorer ID |
| `no_of_days` | string | Number of days (multi-day matches) |
| `no_of_players` | string | Players per side |
| `no_of_reserves` | string | Reserves per side |

## Points Array

Per-team points breakdown (two entries, one per team):

```json
{
  "team_id": "12640",
  "game_points": "0",
  "penalty_points": "1",
  "bonus_points_together": "",
  "bonus_points_batting": "3",
  "bonus_points_bowling": "0",
  "bonus_points_2nd_innings_together": "",
  "bonus_points_2nd_innings_batting": "",
  "bonus_points_2nd_innings_bowling": ""
}
```

| Field | Type | Description |
|-------|------|-------------|
| `team_id` | string | Team ID |
| `game_points` | string | Points for the game result |
| `penalty_points` | string | Penalty points |
| `bonus_points_together` | string | Combined bonus (if league uses single bonus) |
| `bonus_points_batting` | string | Batting bonus points |
| `bonus_points_bowling` | string | Bowling bonus points |
| `bonus_points_2nd_innings_together` | string | 2nd innings combined bonus |
| `bonus_points_2nd_innings_batting` | string | 2nd innings batting bonus |
| `bonus_points_2nd_innings_bowling` | string | 2nd innings bowling bonus |

## Match Result Types Array

Available result options for this match. Each entry is a tuple:

```json
[
  ["Chingford CC - 3rd XI - Won", "582111#12640"],
  ["Chingford Quackers CC - 2nd XI - Won", "582111#208057"],
  ["Tied", 582117],
  ["Cancelled", 582113],
  ["Abandoned", 582114],
  ["Chingford CC - 3rd XI - Conceded", "582115#208057"],
  ["Chingford Quackers CC - 2nd XI - Conceded", "582116#12640"],
  ["Match In Progress", 14]
]
```

Format: `[description, result_code]` where team-specific results use `"code#team_id"`.

## Players Array

Team sheets with two entries: `home_team` and `away_team`.

```json
{
  "players": [
    {
      "home_team": [
        {
          "position": 1,
          "player_name": "Chew Leonard",
          "player_id": 3778631,
          "captain": false,
          "wicket_keeper": false
        }
      ]
    },
    {
      "away_team": [
        {
          "position": 1,
          "player_name": "Amber Duck",
          "player_id": 3778926,
          "captain": true,
          "wicket_keeper": false
        }
      ]
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `position` | int | Batting order position |
| `player_name` | string | Player name |
| `player_id` | int | Player (member) ID |
| `captain` | boolean | Is team captain |
| `wicket_keeper` | boolean | Is wicket keeper |

## Innings Array

One entry per innings bowled. Each contains batting (`bat`), fall of wickets (`fow`), and bowling (`bowl`).

### Innings-Level Fields

| Field | Type | Description |
|-------|------|-------------|
| `team_batting_name` | string | Batting team name |
| `team_batting_id` | string | Batting team ID |
| `innings_number` | int | Innings number |
| `extra_byes` | string | Byes |
| `extra_leg_byes` | string | Leg byes |
| `extra_wides` | string | Wides |
| `extra_no_balls` | string | No balls |
| `extra_penalty_runs` | string | Penalty runs |
| `penalties_runs_awarded_in_other_innings` | string | Penalty runs from other innings |
| `total_extras` | string | Total extras |
| `runs` | string | Total runs |
| `wickets` | string | Wickets lost |
| `overs` | string | Overs faced (e.g. `"10"`, `"9.5"`) |
| `declared` | boolean / null | Whether the innings was declared. Can be `null` for historical matches. |
| `revised_target_runs` | string | D/L revised target runs |
| `revised_target_overs` | string | D/L revised target overs |

### Batting (`bat`) Array

```json
{
  "position": "1",
  "batsman_name": "Chew Leonard",
  "batsman_id": "3778631",
  "how_out": "b",
  "fielder_name": "",
  "fielder_id": "",
  "bowler_name": "Amber Duck",
  "bowler_id": "3778926",
  "runs": "30",
  "fours": "2",
  "sixes": "1",
  "balls": "21"
}
```

| Field | Type | Nullable? | Description |
|-------|------|-----------|-------------|
| `position` | string | No | Batting order position |
| `batsman_name` | string | No | Batsman name |
| `batsman_id` | string | No | Batsman ID |
| `how_out` | string | **Yes** | Dismissal mode (see below). Can be `null` for some historical matches. |
| `fielder_name` | string | **Yes** | Fielder involved (if applicable). Can be `null` or `""`. |
| `fielder_id` | string | **Yes** | Fielder ID. Can be `null` or `""`. |
| `bowler_name` | string | **Yes** | Bowler who took the wicket. Can be `null` or `""`. |
| `bowler_id` | string | **Yes** | Bowler ID. Can be `null` or `""`. |
| `runs` | string | No | Runs scored |
| `fours` | string | No | Number of fours |
| `sixes` | string | No | Number of sixes |
| `balls` | string | No | Balls faced |

#### Dismissal Modes (`how_out`)

| Code | Meaning |
|------|---------|
| `"b"` | Bowled |
| `"ct"` | Caught |
| `"no"` | Not out |
| `"lbw"` | Leg before wicket |
| `"ro"` | Run out |
| `"st"` | Stumped |
| `"hw"` | Hit wicket |
| `"rtd"` | Retired |
| `"dnb"` | Did not bat |

> The full set of dismissal codes is not documented by the ECB. The above are observed values.

> **Note:** `how_out` can be `null` (not just an empty string or code) for some historical matches. When parsing, treat `null` as "did not bat" — the player appears in the team sheet but has no batting record.

### Fall of Wickets (`fow`) Array

```json
{
  "runs": "40",
  "wickets": 1,
  "batsman_out_name": "Chew Leonard",
  "batsman_out_id": "3778631",
  "batsman_in_name": "Mars Leonard",
  "batsman_in_id": "3778630",
  "batsman_in_runs": "10"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `runs` | string | Team total when wicket fell |
| `wickets` | int | Wicket number (1st, 2nd, etc.) |
| `batsman_out_name` | string | Dismissed batsman |
| `batsman_out_id` | string | Dismissed batsman ID |
| `batsman_in_name` | string | Non-striker at time of dismissal |
| `batsman_in_id` | string | Non-striker ID |
| `batsman_in_runs` | string | Non-striker's score at time of dismissal |

### Bowling (`bowl`) Array

```json
{
  "bowler_name": "Amber Duck",
  "bowler_id": "3778926",
  "overs": "5",
  "maidens": "2",
  "runs": "50",
  "wides": "0",
  "wickets": "1",
  "no_balls": "0"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `bowler_name` | string | Bowler name |
| `bowler_id` | string | Bowler ID |
| `overs` | string | Overs bowled |
| `maidens` | string | Maiden overs |
| `runs` | string | Runs conceded |
| `wides` | string | Wides bowled |
| `wickets` | string | Wickets taken |
| `no_balls` | string | No balls bowled |

## Validation Notes

- **Historical data is less complete.** Matches from older seasons (particularly pre-2010) may have `null` values in fields that are normally strings (e.g. `how_out`, `fielder_name`, `bowler_name`). Always handle `null` for these fields.
- Match-level fields like `home_club_id` and `away_club_id` are optional and may be missing or empty for older matches.
- The `competition_type`, `match_type`, and `season` fields at the match level are also optional.
