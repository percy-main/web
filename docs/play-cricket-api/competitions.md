# Competitions API (Divisions & Cups)

List divisions or cups for a league in a given season.

## Request

```
GET /api/v2/competitions.json
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `api_token` | string | Yes | API token |
| `league_id` | int | Yes | League ID |
| `season` | string | Yes | Season year (e.g. `"2024"`) |
| `competition_type` | string | Yes | `"divisions"` or `"cups"` |

## Example Request

```
GET https://play-cricket.com/api/v2/competitions.json?league_id=296&season=2024&competition_type=divisions&api_token=xxxxx
```

## Response

```json
{
  "competitions": [
    {
      "id": 69548,
      "name": "Division 1"
    },
    {
      "id": 69563,
      "name": "Division 10 North"
    }
  ]
}
```

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | int | Competition (division/cup) ID - unique per season |
| `name` | string | Competition name |

## Notes

- The returned `id` is unique per division-season combination. The same division in different seasons will have different IDs.
- Use the returned `id` as `division_id` or `cup_id` in other endpoints (Match Summary, League Table, etc).
