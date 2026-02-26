# Teams in Division API

List teams in a specific division or cup competition.

## Request

```
GET /api/v2/competition_teams.json
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `api_token` | string | Yes | API token |
| `id` | int | Yes | Competition (division/cup) ID |

## Example Request

```
GET https://play-cricket.com/api/v2/competition_teams.json?id=12345&api_token=xxxxx
```

## Response

```json
{
  "competition_teams": [
    {
      "club_id": "1234",
      "club_name": "Chingford CC",
      "team_id": "10001",
      "team_name": "2nd XI"
    },
    {
      "club_id": "5566",
      "club_name": "Chingford Quackers CC",
      "team_id": "23232",
      "team_name": "2nd XI"
    }
  ]
}
```

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `club_id` | string | Club ID |
| `club_name` | string | Club name |
| `team_id` | string | Team ID |
| `team_name` | string | Team name (e.g. `"2nd XI"`) |
