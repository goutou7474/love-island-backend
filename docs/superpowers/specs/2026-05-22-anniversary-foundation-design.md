# Anniversary Foundation Design

## Goal

Persist the most important couple dates and expose them through authenticated APIs so the Animal Island anniversary page can move away from mock data.

## Product Scope

The first version stores and returns anniversary records for a couple. It seeds three private defaults:

- 恋爱纪念日: `2026-05-28`, solar date, main event.
- 羊羊生日: lunar `2003-04-03`, highlighted birthday.
- 言言生日: lunar `2003-02-25`, highlighted birthday.

The API also supports adding future dates such as proposal, engagement, wedding anniversary, and custom dates.

## Date Model

Each anniversary has a display date and metadata:

- `name`: display title.
- `date`: ISO `YYYY-MM-DD` anchor date used by the current app for sorting.
- `calendar`: `solar` or `lunar`.
- `lunarDate`: optional `YYYY-MM-DD` display value for lunar birthdays.
- `repeat`: `none` or `yearly`.
- `kind`: `love`, `birthday`, `wedding`, `proposal`, `engagement`, or `custom`.
- `owner`: `owner`, `partner`, or `both`.
- `icon`, `color`, `isMain`, and `note` for frontend presentation.

This version stores lunar information but does not calculate lunar-to-solar yearly occurrences. The current UI can still show the lunar date and use the anchor date for preview countdowns. A dedicated calendar conversion service can be added later without changing the API shape.

## API

- `GET /anniversaries`: list current couple anniversaries ordered by importance and date.
- `POST /anniversaries`: create one anniversary for the current couple.

Both routes require `Authorization: Bearer <token>`. A user without a couple receives `404 couple_not_found`.

## Bootstrap

`bootstrapPrivateCouple` ensures the three default anniversaries exist for the private couple. It is idempotent and updates names, dates, and metadata if run again.

## Testing

Route tests cover listing seeded anniversaries, creating a wedding anniversary, unauthenticated rejection through existing auth handling, and missing couple rejection. Bootstrap tests cover default anniversary seeding and idempotency.

