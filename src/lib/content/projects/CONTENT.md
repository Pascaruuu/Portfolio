# Projects content contract

How to add or edit a project card. Follow this document only — never read
the loader or the panel code to figure out how to add a project.

## Directory layout

One directory per project, under `src/lib/content/projects/`. The directory
name IS the slug — there is no separate slug field anywhere.

```
src/lib/content/projects/
  aurora-drift/
    meta.json
    cover.png
    detail.en.svx
    detail.ja.svx
  ink-study/
    meta.json
    screenshot.jpg
```

To add a project: create a new directory here, drop one image file into it,
and write a `meta.json`. Nothing else. No file outside this directory is
ever touched to add a project. Detail write-ups (below) are optional and
follow the same rule — dropping the two `.svx` files in is the whole task.

### Slug rules

The slug is whatever you name the directory. Use lowercase letters, digits,
and hyphens only (e.g. `aurora-drift`, `study-02`). No spaces, no
underscores, no uppercase — these aren't rejected by any check, but they are
the convention every existing project follows, and departing from it is not
worth the risk.

## meta.json

Every field below, no others. Extra fields are ignored, not rejected.

| Field             | Type                                          | Required |
|-------------------|------------------------------------------------|----------|
| `title`           | string                                          | should be filled — see Failure behavior |
| `description.en`  | string                                          | should be filled — see Failure behavior |
| `description.ja`  | string                                          | should be filled — see Failure behavior |
| `tags.en`         | array of strings                                | should be filled — see Failure behavior |
| `tags.ja`         | array of strings                                | should be filled — see Failure behavior |
| `url`             | string, the repo/demo link the card opens       | should be filled — see Failure behavior |
| `date`            | string, `YYYY-MM-DD` — see `date` section below | should be filled — see Failure behavior |
| `image`           | filename, relative to the project directory     | **required — its absence removes the project, see Failure behavior** |
| `focalPoint`      | `{ x, y }`, 0-100 each — see "Focal point" below | optional, no warning if absent — see "Focal point" below |

`title` is a single string, not bilingual — every existing project's name
is a proper noun (a repo name) that doesn't change between languages.
`description` and `tags` **are** bilingual — checked against the project's
actual content before this contract was written, and both genuinely differ
per language (tags are translated, e.g. `"Computer Vision"` / `"コンピュータ
ビジョン"`, not just repeated). Don't assume either shape without checking
if you're extending this contract later.

### Full example

```json
{
	"title": "Aurora Drift",
	"description": {
		"en": "A layered digital gradient study exploring color drift across a wide canvas.",
		"ja": "広いキャンバスに広がる色彩の変化を探る、レイヤー構成のデジタルグラデーション習作。"
	},
	"tags": {
		"en": ["Generative", "Design"],
		"ja": ["ジェネレーティブ", "デザイン"]
	},
	"url": "https://github.com/Pascaruuu/aurora-drift",
	"image": "cover.png",
	"date": "2026-06-01"
}
```

### `date`

Must be exactly `YYYY-MM-DD` (four-digit year, two-digit month, two-digit
day, zero-padded, hyphen-separated), and must be a real calendar date —
`2026-02-30`, `2026-13-01`, and `2026-04-31` are all rejected even though
they match the shape. Same rule as art's `date` field, checked the same way.

This is the date of the project's **last meaningful commit** on its repo's
default branch — not when the project was created, and not when the card
was added here. It's also the sort key: projects are shown newest first.
Check the actual default branch on GitHub before using its latest commit
date — it isn't always `main`. Missing or invalid `date` doesn't remove the
project — it just sorts after every project that has a valid one (ties,
including two projects both missing `date`, are left in whatever order the
loader happened to encounter them, same as art).

## Images

- Supported file types: **`.png`, `.jpg`, `.jpeg`, `.webp` only.** Any other
  extension (`.svg`, `.gif`, `.avif`, `.bmp`, …) is invisible to the section
  even if the file sits in the project directory and is named in `image` —
  it will be treated as not found.
- Only the filename named in `image` is ever shown as the **card** image.
  Unlike art, a project's card shows exactly one image — there's no strip
  of additional images, so `image` takes a single filename, not a list.
- A file that sits in the project directory but isn't named in `image` is
  not shown on the card, but PHASE 5E made it available to that project's
  own detail write-up as a **body image** — see "Body images" below. It is
  only truly unused if no `.svx` in that project references it.
- **The detail view crops this same image to a 200px-tall strip** (narrower
  panels shrink that to 120px — see `app.css`'s `.project-detail-media`),
  full width, cover-cropped, with the title overlaid at its lower-left over
  a gradient scrim. On a wide image this crop discards most of the frame,
  not just the edges — see "Focal point" below for steering which part
  survives. The card itself is unaffected: it still shows this image at its
  own smaller size and aspect, uncropped by this rule.

### Focal point

Optional. Cover-cropping a 200px-tall strip out of a normal screenshot or
photo can throw away the part that actually matters — a tall UI screenshot
cropped to a thin strip by default shows whatever's in the vertical middle,
which for most screenshots is empty space, not the header or the content
that identifies it.

```json
"focalPoint": { "x": 50, "y": 0 }
```

`x` and `y` are each 0-100, the point in the source image that should stay
in frame after the crop — `0` is the image's own left/top edge, `100` is
its right/bottom edge, `50` is the middle. Maps directly to CSS
`object-position` percentages. Omit the field entirely for a centered crop
(`50, 50`) — this is the default and needs no field at all; most images
crop fine centered, and this should stay the exception, not something every
project sets out of habit.

Only worth setting when the meaningful content sits far enough off-center
that a centered crop would miss it — a full-page screenshot where the
header/hero is what identifies the project (bias `y` toward `0`, its top
edge) is the clearest case. An image with content spread evenly across the
whole frame (a photo, a mosaic, a diagram with no single focal subject)
doesn't need one; leave it out.

Invalid shapes (missing `x` or `y`, a value outside 0-100, wrong type)
degrade to a centered crop with a warning from `pnpm validate:projects` —
same failure tier as a malformed `tags` array, not a skip.

## Detail file (optional)

Each project's detail view (opened from the card) can show an expanded
write-up below the title/description/tags/link that already come from
`meta.json`. This is entirely optional — a project with no detail file
still has a complete detail view, just without the extra write-up.

### Naming convention

`detail.en.svx` and `detail.ja.svx`, sitting next to `meta.json` in the
project directory. Fixed filenames, not a `meta.json` field — same
"directory is the contract" pattern as the slug itself. There is no way to
name these files anything else and have them picked up.

### Format

`.svx` is Markdown, processed by [mdsvex](https://mdsvex.pngwn.io/). Supported:
headings, paragraphs, lists, links, inline code, fenced code blocks, and
blockquotes. No syntax highlighting is applied to code blocks — they render
in the same body font as everything else (DESIGN.md's Single Voice Rule:
monospace is reserved for ASCII-grid rendering elsewhere in the app, never
panel copy), set apart only by the background chip.

The first plain paragraph in a `.svx` file automatically renders as a lead
paragraph (larger, brighter than the rest of the body copy) — no markup
needed. This only fires when the file's very first element is a paragraph;
opening with a heading or one of the components below opts out silently.

PHASE 5A: `<script>` import blocks are now permitted, but scoped to one
purpose only — importing the content components below. Nothing else about
"don't embed Svelte components" has changed; this is not a general green
light to import arbitrary components into a `.svx`.

PHASE 5E: the script block may also declare `let { images } = $props();` —
but only if the write-up uses `BodyImage` (below), which is the one
component that needs it. Nothing else may be declared there.

#### Content components

Four components live at `src/lib/components/content/` and are meant to be
imported and used directly in a `.svx` file, in place of folding the same
information into prose:

- **`StatBlock`** — reported numbers (metrics, results). Props: `items`, an
  array of `{ value: string; label: string }`.
- **`SpecList`** — dense key/value facts (model, image size, epochs, stack).
  Props: `items`, an array of `{ key: string; value: string }`.
- **`Callout`** — an aside, caveat, or honest limitation. Optional `label`
  prop (defaults to `"Note"`; try `"Caveat"` or `"Limitation"` where it
  fits). Body content goes between the opening and closing tags as normal
  markdown — mdsvex only parses that inner content as markdown if there's a
  blank line after the opening tag and before the closing one.
- **`BodyImage`** (PHASE 5E) — an image inside the write-up itself, distinct
  from the one card image `meta.json` already points at. See "Body images"
  below — it needs one extra line in the script block that the other three
  don't.

Example:

```
<script>
	import StatBlock from '$lib/components/content/StatBlock.svelte';
	import SpecList from '$lib/components/content/SpecList.svelte';
	import Callout from '$lib/components/content/Callout.svelte';
</script>

<StatBlock items={[
	{ value: '0.94', label: 'mAP@50' },
	{ value: '50', label: 'Epochs' }
]} />

<SpecList items={[
	{ key: 'Model', value: 'YOLOv8n' },
	{ key: 'Image size', value: '416x416' }
]} />

<Callout label="Limitation">

The model struggles with low-light frames — the training set had almost
none.

</Callout>
```

#### Body images

A write-up can include images beyond the one card image — a diagram, a
screenshot, a chart — placed directly in the flow of the prose via
`BodyImage`.

**Where the file goes:** in the project's own directory, next to
`meta.json`, same as the card image. **Same supported types too:** `.png`,
`.jpg`, `.jpeg`, `.webp` only — anything else is invisible to `BodyImage`
the same way an unsupported card `image` extension is invisible to the
card.

**How a body image is told apart from the card image:** by name, and only
by name. Whichever filename `meta.json`'s `image` field names is the card
image and is never available as a body image. Every *other* supported image
file sitting in the project directory is a body-image candidate,
automatically, with no separate field to list them — drop the file in and
reference it by filename. (This means a file can't do double duty as both
the card and a body image; if you need the same picture in both places,
duplicate the file under two names.)

**Using it:**

```
<script>
	import BodyImage from '$lib/components/content/BodyImage.svelte';

	let { images } = $props();
</script>

<BodyImage
	image={images['confusion_matrix.png']}
	alt="Confusion matrix across the six waste categories"
	caption="Per-class recall on the held-out validation set."
/>
```

`images` is supplied automatically by the detail panel — it is not
something you build or import yourself, just destructure it with
`let { images } = $props();` and index into it by filename. `alt` is plain
accessible alt text (required in spirit, though nothing enforces it).
`caption` is optional — omit it for an uncaptioned image.

**Sizing:** handled entirely by the pipeline. A body image floats left,
capped at 700px, with the surrounding prose (paragraphs, lists,
blockquotes) wrapping down its right side instead of the image sitting
alone with empty space beside it. Headings and the other three content
components below (StatBlock, SpecList, Callout) — plus a second body
image, if there is one — always start below any floated image instead of
squeezing into that wrap column; a heading pulled up beside an image
would read as belonging to it, not to the section it's actually
introducing.

On a narrower panel where a 700px float plus a readable strip of wrapped
text won't both fit, the image drops the float entirely and becomes a
full-width block instead, same as before this floating behavior existed.
This is a panel-width threshold, not a fixed viewport breakpoint — a
panel dragged narrower (or a narrow phone) triggers it exactly the same
way, and the panel's own default width already sits just under this
threshold, so widening the panel (or going fullscreen) is what reveals
the float.

Served at a fixed 850px derivative (the widest a floated-or-fallback body
image can ever actually render at — see `loader.ts`'s
`writeupBodyImageModules`, a different, narrower glob than the one
feeding the header strip), downscaled by the browser at narrower widths
and upscaled past its own source resolution if the source itself is
narrower than that — so don't hand-pick dimensions or crop for a specific
layout, but a source narrower than roughly 850px will look a little soft
at its own float width.

**Failure behavior:** a body image is the third tier — neither "skips the
project" nor "shows a dash." A typo'd filename, a filename that doesn't
resolve to a supported image on disk, or the filename of the project's own
card image (deliberately excluded, see above) all produce the same
result: `images['whatever']` is `undefined`, `BodyImage` renders nothing at
that spot, and the rest of the write-up is completely unaffected. There is
no broken-image icon and no error text — this is a silent degrade by
design, the same tier as a missing `detail.<lang>.svx` file. `pnpm
validate:projects` does not check body image references — they live inside
`.svx` markup, which the validator doesn't parse (it only checks
`meta.json` and on-disk file existence, same scope as always) — check the
rendered panel yourself if you add one.

**No click-to-enlarge.** A body image is not a lightbox trigger — that's
the art gallery's own pattern (`src/lib/content/art/`), not this one.

### Loading and failure behavior

Detail files are lazy-loaded — the write-up for a project is only fetched
once that project's detail view is actually opened, not when the page
loads. While it's in flight, the detail view shows a brief loading line
below the repo link.

A missing `detail.en.svx` or `detail.ja.svx` is a **warning, not a
skip** — degrades to no extra write-up, never removes the project or
breaks the rest of the detail view (title, image, description, tags, and
link all still render). The same applies if the file exists but fails to
load for any other reason. Run `pnpm validate:projects` to see which
projects are missing a detail file for which language.

## Failure behavior

Two tiers. Know which one a mistake falls into before you ship it.

**Project disappears entirely (skipped, no trace in the section):**

- `meta.json` is missing, unreadable, or not valid JSON.
- `image` is missing from `meta.json`.
- `image` doesn't resolve to an actual image file in the directory
  (missing, or wrong/unsupported extension).

**Project still appears, one field shows a dash (never a placeholder
string, never a fallback to the other language) or sorts last:**

- `title` missing.
- `description.en` and/or `description.ja` missing.
- `tags.en` and/or `tags.ja` missing or not an array — degrades to an empty
  tag list for that language, not a dash.
- `url` missing — the card renders without a link.
- `date` missing, not `YYYY-MM-DD`, or not a real calendar date — the
  project sorts after every project that has a valid `date`.

If you want to confirm exactly what breaks before you find out the hard
way, run `pnpm validate:projects` — it prints the same warnings the app
would log, per project, by slug.

## Before opening a PR

Run:

```
pnpm validate:projects
```

It must exit successfully (no project reported as skipped). Warnings about
missing fields (dashes, empty tag lists, missing date) or a missing detail
file are fine to ship; a skipped project is not — fix it first.

## Known dev-server caveat

The image is loaded through an eager `import.meta.glob` (see loader.ts),
which Vite resolves once at server start / module graph analysis, the same
mechanism the art gallery uses. Adding a brand-new project directory (or a
brand-new image file) while `pnpm dev` is already running has, in practice
elsewhere in this codebase, sometimes needed a dev server restart before
the new file shows up — the glob's own file list isn't always guaranteed to
pick up files that didn't exist when the dev server started. If a newly
added project isn't appearing and `pnpm validate:projects` says it's fine,
restart `pnpm dev` before assuming something else is wrong.

## What never changes

Adding or editing a project never requires touching any `.svelte`, `.ts`,
or `.css` file. If you find yourself about to edit one to add a project,
stop — that's not how this works. Content lives entirely under
`src/lib/content/projects/`.
