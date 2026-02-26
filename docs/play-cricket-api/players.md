# Players API

List players (members) for a club site.

## Request

```
GET /api/v2/sites/{site_id}/players
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `api_token` | string | Yes | API token |
| `site_id` | int | Yes | Play-Cricket site ID (path parameter) |
| `include_everyone` | string | No | Set to `"yes"` to include all members with any active role (not just squad members) |
| `include_historic` | string | No | Set to `"yes"` to also include members with historic squad roles |

## Default Behaviour

Without optional parameters, returns only members with an **active squad role** at the club.

## Example Request

```
GET https://play-cricket.com/api/v2/sites/1234/players?api_token=xxxxx&include_everyone=yes
```

## Response

```json
{
  "players": [
    {
      "member_id": 12345,
      "name": "Bugs Bunny"
    },
    {
      "member_id": 224466,
      "name": "Roger Rabbit"
    }
  ]
}
```

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `member_id` | int | Unique member ID |
| `name` | string | Full name |

## Filter Behaviour

| Parameters | Members returned |
|------------|-----------------|
| _(none)_ | Active squad role only |
| `include_everyone=yes` | Any active role at the club |
| `include_historic=yes` | Active squad + historic squad roles |
| Both | Any active role + historic squad roles |
