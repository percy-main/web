# Teams API

List teams belonging to a site (club or CCB).

> **Access:** This endpoint may not be accessible with all API tokens. Our club token returns **HTTP 401** for this endpoint. Team names can alternatively be obtained from [Match Detail](./match-detail.md) responses (`home_team_name` / `away_team_name`).

## Request

```
GET /api/v2/sites/{site_id}/teams.json
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `api_token` | string | Yes | API token |
| `site_id` | int | Yes | Play-Cricket site ID (path parameter) |
| `site_type` | string | No | `"club"` or `"CCB"` |
| `from_entry_date` | string | No | `dd/mm/yyyy` - records updated on or after this date |
| `end_entry_date` | string | No | `dd/mm/yyyy` - records updated on or before this date |

## Example Request

```
GET https://play-cricket.com/api/v2/sites/1234/teams.json?api_token=xxxxx
```

## Response

```json
{
  "teams": [
    {
      "id": "",
      "status": "",
      "last_updated": "",
      "site_id": "",
      "team_name": "",
      "other_team_name": "",
      "nickname": "",
      "team_captain": ""
    }
  ]
}
```

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | int | Team ID |
| `status` | string | `"New"` or `"Deleted"` |
| `last_updated` | string | Date of last update |
| `site_id` | int | Parent site ID |
| `team_name` | string | Official team name (e.g. `"1st XI"`) |
| `other_team_name` | string | Alternative team name |
| `nickname` | string | Team nickname |
| `team_captain` | string | Captain name |
