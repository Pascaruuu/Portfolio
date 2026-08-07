# Art content contract

How to add or edit a piece in the art gallery. Follow this document only —
never read the loader or the panel code to figure out how to add a piece.

## Directory layout

One directory per piece, under `src/lib/content/art/`. The directory name
IS the slug — there is no separate slug field anywhere.

```
src/lib/content/art/
  aurora-drift/
    meta.json
    gradient.png
  ink-study/
    meta.json
    photo.jpg
```

To add a piece: create a new directory here, drop image files into it, and
write a `meta.json`. Nothing else. No file outside this directory is ever
touched to add a piece.

### Slug rules

The slug is whatever you name the directory. Use lowercase letters, digits,
and hyphens only (e.g. `aurora-drift`, `study-02`). No spaces, no
underscores, no uppercase — these aren't rejected by any check, but they are
the convention every existing piece follows, and departing from it is not
worth the risk.

## meta.json

Every field below, no others. Extra fields are ignored, not rejected.

| Field                | Type                        | Required |
|-----------------------|-----------------------------|----------|
| `title.en`             | string                       | should be filled — see Failure behavior |
| `title.ja`             | string                       | should be filled — see Failure behavior |
| `description.en`       | string                       | should be filled — see Failure behavior |
| `description.ja`       | string                       | should be filled — see Failure behavior |
| `category`             | `"hand-drawn"` or `"digital"` (verbatim, exactly these two strings) | should be filled — see Failure behavior |
| `date`                 | string, `YYYY-MM-DD`, the piece's creation date | should be filled — see Failure behavior |
| `images`               | array of filenames, relative to the piece directory, in display order | **required — its absence removes the piece, see Failure behavior** |

### Full example

```json
{
	"title": { "en": "Aurora Drift", "ja": "オーロラ・ドリフト" },
	"description": {
		"en": "A layered digital gradient study exploring color drift across a wide canvas.",
		"ja": "広いキャンバスに広がる色彩の変化を探る、レイヤー構成のデジタルグラデーション習作。"
	},
	"category": "digital",
	"date": "2026-03-12",
	"images": ["gradient.png"]
}
```

### `date`

Must be exactly `YYYY-MM-DD` (four-digit year, two-digit month, two-digit
day, zero-padded, hyphen-separated), and must be a real calendar date —
`2026-02-30`, `2026-13-01`, and `2026-04-31` are all rejected even though
they match the shape. This is the date the piece was created, not the date
it was added to the gallery. It also determines gallery order — pieces are
sorted newest first.

### `category`

Must be exactly one of these two strings — no other spelling, casing, or
value is accepted:

- `hand-drawn`
- `digital`

## Images

- Supported file types: **`.png`, `.jpg`, `.jpeg`, `.webp` only.** Any other
  extension (`.svg`, `.gif`, `.avif`, `.bmp`, …) is invisible to the
  gallery even if the file sits in the piece directory and is listed in
  `images` — it will be treated as not found.
- Only filenames listed in `images` are ever shown. A file that sits in the
  piece directory but isn't listed in `images` is silently ignored — it
  never appears anywhere.
- **The first entry in `images` is the grid thumbnail.** Order the rest as
  you want them to appear when the piece is opened.
- A filename listed in `images` after the first that doesn't resolve (typo,
  missing file, unsupported extension) is dropped from the piece and
  `pnpm validate:art` warns about it by slug and filename — but the piece
  still ships with fewer images than you listed, so don't rely on the
  warning catching it for you if you don't run the check.

## Failure behavior

Three tiers. Know which one a mistake falls into before you ship it.

**Piece disappears entirely (skipped, no trace in the gallery):**

- `meta.json` is missing, unreadable, or not valid JSON.
- `images` is missing, empty, or contains no valid filenames.
- The **first** filename in `images` doesn't resolve to an actual image
  file in the directory (missing, or wrong/unsupported extension).

**Piece still appears, one field shows a dash (never a placeholder string,
never a fallback to the other language):**

- `title.en` and/or `title.ja` missing.
- `description.en` and/or `description.ja` missing.
- `category` missing or not one of the two valid values.
- `date` missing, not `YYYY-MM-DD`, or not a real calendar date.

**Piece still appears, but with fewer images than you listed (warned, not
silent):**

- Any filename in `images` after the first that doesn't resolve.

If you want to confirm exactly what breaks before you find out the hard
way, run `pnpm validate:art` — it prints the same warnings the app would
log, per piece, by slug.

## Before opening a PR

Run:

```
pnpm validate:art
```

It must exit successfully (no piece reported as skipped). Warnings about
missing fields (dashes) are fine to ship; a skipped piece is not — fix it
first.

## What never changes

Adding or editing a piece never requires touching any `.svelte`, `.ts`, or
`.css` file. If you find yourself about to edit one to add a piece, stop —
that's not how this works. Content lives entirely under
`src/lib/content/art/`.
