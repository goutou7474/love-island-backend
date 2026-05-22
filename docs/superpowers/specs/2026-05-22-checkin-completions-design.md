# Checkin Completions Design

## Goal

Persist checklist completion state so the existing full frontend checklist catalogue can become real couple data.

## Scope

The frontend keeps `checkin-items.ts` as the catalogue of all available tasks. The backend stores only per-couple completion records:

- item id
- category id
- title snapshot
- completed date
- completed by user
- location
- note

This avoids duplicating hundreds of catalogue items into the backend while still making progress, homepage stats, and item details persistent.

## API

- `GET /checkins/completions`: list all completion records for the current couple.
- `PUT /checkins/completions/:itemId`: create or update a completion record.

Both routes require bearer auth and a current couple. A missing couple returns `404 couple_not_found`.

## Future Path

If the checklist catalogue becomes server-managed later, the existing completion table can stay as-is. We can add `checklist_categories` and `checklist_items` tables without changing completed item history.

