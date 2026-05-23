# App Snapshot Design

## Goal

Provide one authenticated backend endpoint that returns the current island's backend-backed state for app startup.

## Scope

This slice covers:

- `GET /app/snapshot`
- Returning the authenticated user and current couple summary.
- Returning anniversaries, checkin completions, memories, wishes, secret messages, and settings in one response.
- Updating the frontend startup/login flow to use this one endpoint instead of issuing many separate list requests.

This slice does not replace mock weather, mock homepage stats, or the frontend's static checklist catalogue. Those remain frontend-side until their own slices exist.

## Backend Behavior

The endpoint requires auth. If the user has no couple, it returns:

```json
{
  "error": {
    "code": "couple_not_found",
    "message": "还没有可以同步的小岛"
  }
}
```

On success it returns:

```ts
interface AppSnapshotResponse {
  user: PublicUser
  couple: CoupleSummary
  anniversaries: AnniversaryRecord[]
  checkinCompletions: CheckinCompletionRecord[]
  memories: MemoryRecord[]
  wishes: WishRecord[]
  secrets: SecretMessageView[]
  settings: AppSettingsRecord
}
```

Secret message content follows the same visibility rule as `/secrets`: sent messages can be read by the sender, opened messages can be read by the recipient, and locked received messages return empty content.

## Frontend Behavior

`backendApi.getSnapshot(token)` becomes the authenticated app bootstrap call. The frontend still starts from mock data so the visual shell, weather, stats, and static checklist catalogue are always available.

After login or auto-login, the snapshot response updates:

- current user
- anniversaries
- checkin completion state merged into the static checklist catalogue
- memories, when backend list is non-empty
- wishes, when backend list is non-empty
- secrets, when backend list is non-empty
- settings

Empty backend memories/wishes/secrets keep the current mock preview data, matching existing behavior.

## Testing

Backend tests cover:

- Snapshot includes the private user, couple, seeded anniversaries, and default settings.
- Snapshot aggregates records created through existing feature routes.
- Snapshot returns structured `couple_not_found` for an authenticated user without a couple.

Frontend verification uses lint/build and a browser smoke check that authenticated startup still lands on the home page and settings remain loaded.
