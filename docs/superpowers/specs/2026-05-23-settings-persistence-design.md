# Settings Persistence Design

## Goal

Persist the settings page toggles per private user and couple, so notification and privacy preferences survive refreshes and work separately for the two accounts.

## Scope

This slice covers:

- Reading settings for the current authenticated user and couple.
- Creating default settings automatically when no row exists.
- Updating one or more settings fields.
- Connecting the current frontend settings toggles to the backend.

This slice does not implement real push notification delivery, app lock authentication, or theme switching. It stores the preferences that those future features will consume.

## Product Behavior

Default settings match the current mock:

- `anniversaryReminder`: `true`
- `dailyMessagePush`: `true`
- `partnerActivityNotify`: `true`
- `appLock`: `false`
- `softTheme`: `true`

Settings belong to both a `userId` and `coupleId`. This lets 言言 and 羊羊 choose different notification behavior inside the same couple island.

When the user toggles a setting in the frontend, the UI updates optimistically and saves through the backend. If saving fails, the frontend rolls back to the previous local value and shows the existing toast error.

## Backend Architecture

Add `app_settings` table and store methods beside other user/couple scoped features.

Routes:

```http
GET   /settings
PATCH /settings
```

Both routes require an authenticated user and a couple. `GET /settings` returns defaults by creating or upserting a row. `PATCH /settings` accepts a partial body and returns the full updated settings object.

## Frontend Architecture

Extend `backendApi` with `getSettings` and `updateSettings`.

On auto-login and manual login, load settings with the other backend-backed data. Keep mock settings only before login or when no token exists.

`toggleSetting` calls `backendApi.updateSettings` instead of `mockLoveAppApi.updateSettings`.

## Testing

Backend tests cover:

- Returning default settings for a newly bootstrapped private couple.
- Updating a subset of settings and preserving other values.
- Keeping settings separate between owner and partner.
- Returning structured `couple_not_found` for a registered user without a couple.

Frontend verification uses lint/build and a browser check that toggling a setting persists after reload.
