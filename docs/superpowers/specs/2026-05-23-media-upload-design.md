# Media Upload Design

## Goal

Let the app upload real images for the timeline memory flow, save them on the server, and render them back in the Animal Island frontend without changing the existing product shape.

## Context

The frontend already models memory photos as `string[]`, but the current add-memory modal submits `photos: []` and the timeline renders decorative placeholders. The backend stores the `photos` array in the `memories` table, but there is no media upload endpoint or storage layer yet. Docker already includes MinIO configuration, although the backend has no S3 client dependency today.

## Options Considered

### Recommended: Direct Upload To Server Storage

The frontend sends small image files to the backend. The backend validates image type and size, writes the bytes to a configured storage directory, stores metadata in PostgreSQL or the in-memory store, and returns URL strings that can be saved in `memories.photos`.

This is the best first slice because it needs no new external dependency, works in memory preview and Docker, and keeps the API shape portable. Later, the storage implementation can move from local disk to MinIO, OSS, COS, or R2 while keeping `/media` and the frontend unchanged.

### Alternative: Browser Uploads Directly To MinIO

The backend would issue presigned upload URLs and the browser would PUT files to object storage. This is a cleaner long-term cloud pattern, but it requires an S3 client, bucket policy work, and more moving parts before we have a stable product flow.

### Alternative: Store Base64 In Database

This is simple for prototypes but bloats PostgreSQL and makes backups heavier. It is rejected for the product path.

## Scope

This slice implements media for timeline memories only. It does not add avatar upload, check-in photos, image editing, compression, multi-device background sync, or direct object-storage presigned uploads.

## Backend API

### `POST /media`

Authenticated JSON upload.

Request:

```json
{
  "filename": "night-market.jpg",
  "contentType": "image/jpeg",
  "dataBase64": "<base64 image bytes>"
}
```

Response:

```json
{
  "asset": {
    "id": "uuid",
    "coupleId": "uuid",
    "ownerUserId": "uuid",
    "filename": "night-market.jpg",
    "contentType": "image/jpeg",
    "byteSize": 123456,
    "url": "/media/<asset-id>/file?token=<unguessable-token>",
    "createdAt": "2026-05-23T00:00:00.000Z"
  }
}
```

Validation:

- The user must be authenticated and belong to a couple.
- `contentType` must be one of `image/jpeg`, `image/png`, `image/webp`, or `image/gif`.
- Decoded file size must be greater than zero and at most `MEDIA_MAX_BYTES`.
- Invalid base64 returns `422 validation_error`.
- Missing couple returns `404 couple_not_found`.

### `GET /media/:assetId/file?token=...`

Returns the binary image bytes for an uploaded asset. The token is an unguessable per-asset read token stored with the asset metadata. This lets browser `<img>` tags render photos without custom authorization headers while keeping URLs private enough for this two-person app.

Response behavior:

- `200` with the stored image and the original content type when the token matches.
- `404 media_not_found` when the id does not exist.
- `403 media_forbidden` when the token is missing or wrong.

## Storage

Add a small `MediaStorage` abstraction:

```ts
interface MediaStorage {
  write(input: { storageKey: string; contentType: string; bytes: Buffer }): Promise<void>
  read(storageKey: string): Promise<Buffer | null>
}
```

The first implementation is `LocalMediaStorage`, backed by `MEDIA_STORAGE_DIR`. In memory preview, default to `.data/uploads` inside the backend workspace. In Docker, mount a named volume to `/app/data/uploads`.

This abstraction keeps migration cheap: MinIO/S3 later implements the same `write/read` contract and the store metadata can keep the same shape.

## Data Model

Add `media_assets`:

```sql
id uuid primary key
couple_id uuid not null references couples(id) on delete cascade
owner_user_id uuid not null references users(id) on delete cascade
filename text not null
content_type text not null
byte_size integer not null
storage_key text not null unique
read_token text not null unique
created_at timestamptz not null default now()
```

The existing `memories.photos jsonb` remains `string[]`. It stores media URLs returned by `/media`, so the frontend does not need another table join for the current memory list.

## Frontend Flow

Add `backendApi.uploadMedia(token, file)`:

1. Read the file with `FileReader`.
2. Strip the `data:*;base64,` prefix.
3. POST `filename`, `contentType`, and `dataBase64` to `/media`.
4. Use returned `asset.url` in `createMemory(... photos)`.

The add-memory modal gets a real file picker and a small preview strip. The timeline and memory detail views render real `<img>` elements when `photos` entries look like URLs, and keep the existing Animal Island placeholder art for older mock photo ids.

## Error Handling

Upload errors show a toast and keep the text form intact. If one selected file fails, the memory is not created; the user can remove or retry files. The UI limits selection to three photos per memory for this first slice, matching the existing carousel layout.

## Testing

Backend tests cover:

- Uploading a valid PNG-like payload creates metadata and returns a URL.
- Reading the returned URL returns the same bytes and content type.
- Wrong read token returns `403 media_forbidden`.
- Unsupported content type returns a validation error.
- A memory created with the returned photo URL appears in `/app/snapshot`.

Frontend verification covers:

- TypeScript build and lint.
- Browser/manual flow: upload a small local image, create a memory, see the image in the timeline and detail modal.

## Migration Notes

Server migration only needs source code, PostgreSQL dump, and the upload directory volume. When switching providers later, keep `media_assets.storage_key` stable and copy files from the local volume to the object bucket.
