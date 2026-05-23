# Secret Messages Design

## Goal

Make the existing "悄悄话" UI use the private backend so sent notes survive refreshes, sync between the two private users, and enforce simple server-side open rules.

## Scope

This slice covers:

- Listing secret messages for the current couple.
- Sending a message from the current user to the other couple member.
- Opening a received message when the server says it is available.
- Deleting a message for the current couple.
- Keeping mock messages only when the backend has no messages, matching the memory and wish fallback pattern.

This slice does not add media attachments, push notifications, or end-to-end encryption. The database column is named `content` for now; the route/store boundary is small enough to replace it with encrypted content later.

## Product Behavior

`openMode = "now"` messages are available immediately and are created with `openedAt` set.

`openMode = "date"` messages require `openAt` and can be opened once the current date is on or after `openAt`.

`openMode = "anniversary"` messages are stored and shown as locked. Full anniversary-rule unlocking belongs with the reminder/statistics slice, because it needs shared date occurrence calculation.

The frontend maps backend records to the existing `SecretMessage` UI shape:

- `direction` is `sent` when `fromUserId` equals the logged-in user id.
- `direction` is `received` otherwise.
- `from` uses the backend sender display name.
- `isOpened` is true when the backend record has `openedAt`.

Locked received messages show an "打开信封" action. The backend returns a clear error if the message is not ready yet.

## Backend Architecture

Add a `secret_messages` table and store methods beside the existing `memories` and `wishes` slices.

Core routes:

```http
GET    /secrets
POST   /secrets
POST   /secrets/:secretId/open
DELETE /secrets/:secretId
```

The route resolves the current user's couple, finds the other member as the recipient for new messages, and returns messages sorted by newest first.

## Frontend Architecture

Extend `backendApi` with `listSecrets`, `sendSecret`, `openSecret`, and `deleteSecret`.

`App.tsx` stores the logged-in backend user so it can map direction correctly. Auto-login and manual login load secrets together with anniversaries, checkins, memories, and wishes. `submitSecret` sends through the backend and prepends the mapped result.

`SecretsPage` gets an `onOpen` handler and renders a small action for locked received messages. Existing visual design remains unchanged apart from the action.

## Testing

Backend tests cover:

- Sending and listing a now-open message.
- Sending a scheduled date message, rejecting early open, and opening a past-date message.
- Deleting one message without touching the rest.
- Returning the existing structured `couple_not_found` error when a user has no couple.

Frontend verification uses lint/build plus a browser check that a backend-created message appears after login and refresh.
