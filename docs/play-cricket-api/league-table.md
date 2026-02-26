# League Table API

Retrieve a calculated league table for a division. This endpoint triggers server-side calculation before returning results, so may be slower than other endpoints.

## Request

```
GET /api/v2/league_table.json
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `api_token` | string | Yes | API token |
| `division_id` | int | Yes | Division ID (unique per division+season, so no season param needed) |

## Example Request

```
GET https://play-cricket.com/api/v2/league_table.json?division_id=70999&api_token=xxxxx
```

## Response

The response has three sections: column headings, row values, and a key legend.

```json
{
  "league_table": [
    {
      "id": 71768,
      "division_name": "1st XI Premier Division (Time & Overs)",
      "headings": {
        "column_1": "Team",
        "column_2": "p",
        "column_3": "w24",
        "column_4": "w20"
      },
      "values": [
        {
          "position": "1",
          "team_id": "9073",
          "column_1": "Rugby CC",
          "column_2": "22",
          "column_3": "3",
          "column_4": "13"
        },
        {
          "position": "2",
          "team_id": "11558",
          "column_1": "Bedworth CC",
          "column_2": "22",
          "column_3": "2",
          "column_4": "13"
        }
      ],
      "key": "p - Played, w24 - Win 24pts (24), w20 - Win 20pts (20)"
    }
  ]
}
```

## Response Fields

### Table-level

| Field | Type | Description |
|-------|------|-------------|
| `id` | int | Table ID |
| `division_name` | string | Division name with match format |
| `headings` | object | Column definitions (see below) |
| `values` | array | Row data, one per team in position order |
| `key` | string | Legend explaining column abbreviations |

### Headings object

Dynamic keys `column_1`, `column_2`, ... `column_N`. Values are the column heading labels. Only columns with data are included (null-for-all-teams columns are omitted).

### Values array (per team)

| Field | Type | Description |
|-------|------|-------------|
| `position` | string | League position (rank) |
| `team_id` | string | Team ID |
| `column_1` ... `column_N` | string | Values corresponding to the headings |

### Common Column Abbreviations

These vary by league configuration. Common ones from the key:

| Abbreviation | Meaning | Points |
|--------------|---------|--------|
| `p` | Played | - |
| `w24` | Win 24pts | 24 |
| `w20` | Win 20pts | 20 |
| `wd` | Winning draw | - |
| `ld4` | Losing draw >=75% | 4 |
| `ld2` | Losing draw <75% | 2 |
| `t` | Tied | 10 |
| `a` | Abandoned | 4 |
| `l` | Loss | - |
| `BatP` | Batting Bonus Points | - |
| `BowlP` | Bowling Bonus Points | - |
| `Pen` | Penalty Points | - |
| `Pts` | Total Points | - |

## Notes

- The `division_id` is unique per division-season combination, so no `season` parameter is needed.
- Column structure is fully dynamic - different leagues will have different columns depending on their scoring rules.
- The `key` field provides the human-readable legend to decode column abbreviations. Parse this to map column headings to their full descriptions.
- Columns with null values for all teams are excluded from the response.
- Zero values (`"0"`) are included in the response (not treated as null).
