import type { Component } from 'svelte';
import type { Picture } from '@sveltejs/enhanced-img';
import type { BodyImageLoader, DetailLoader, ProjectItem } from './types.js';
import { checkDetailFiles, detailFilename, validateProjectMeta } from './validate.js';

const metaModules = import.meta.glob<unknown>('./*/meta.json', {
	eager: true,
	import: 'default'
});

// Deliberately NOT eager: this must stay a map of import functions, not
// resolved content, so a detail body never ships in the bundle for a panel
// most visitors don't open. mdsvex (see svelte.config.js) compiles each
// .svx into a real Svelte component; the value type here is that
// component's module shape.
const detailModules = import.meta.glob<{ default: Component }>('./*/detail.*.svx');

// Same reasoning as pfpModules in portfolio-data.ts -- 1x displayed size
// (402px), derived from the 2-column project grid: PANEL_MAX_W 900 minus
// .panel-body's 38px horizontal padding on each side (824), minus
// .project-grid's 20px gap (804), divided by 2 columns (402). Known
// shortfall: below the @container (max-width: 540px) breakpoint the grid
// drops to 1 column, and .panel-body's content width can reach 464px there
// -- so in the panel-body 478-540px width band the image is upscaled from
// its 402px source. Accepted, not overlooked. Value carried forward
// unchanged from portfolio-data.ts -- this phase relocates the glob, it
// does not change any image dimensions.
const imageModules = import.meta.glob<Picture>('./*/*.{png,jpg,jpeg,webp}', {
	eager: true,
	query: { enhanced: true, w: '402', quality: '50' },
	import: 'default'
});

// PHASE 5E, width revised PHASE 5G, SCOPE NARROWED PHASE 7: this glob now
// feeds ProjectItem.detailImage ONLY -- the header strip (.project-detail-
// media), which is still full panel content width with no cap of its own.
// Write-up body images used to share this same glob (PHASE 5G's reasoning
// below still explains why THIS width is right for that full-bleed use
// case) but PHASE 7 gave them their own, much narrower, derivative
// (writeupBodyImageModules, below) once BodyImage.svelte capped at 700px
// and stopped needing anything close to panel-width sharpness -- see that
// glob's own comment for the arithmetic. The name `bodyImageModules`
// predates that split and no longer matches what it does (it doesn't feed
// `bodyImages` anymore, only `detailImage`) -- left as-is rather than
// renamed, since the header image's own derivation (this comment) was
// explicitly not to change, and a rename is a change even at zero
// behavioral cost.
//
// WIDTH ARITHMETIC. The panel has no fixed maximum: PANEL_MAX_W (900px) is
// only the *default* on init (panelGeometry.ts) -- a user can drag it wider,
// and fullscreen (.popup-card.panel-fullscreen, app.css) sets it to 100vw.
// So "the widest this can ever actually render at" is bounded by real
// screen width, not by app code. Taking 1920px as a practical fullscreen
// reference (this codebase's own established one -- see PHASE 5E's history
// on this file for where that number first appeared) and subtracting
// .panel-body's 76px of horizontal padding (38px * 2, app.css) gives 1844px
// of content width -- the derivative width below.
//
// TRADE-OFF, measured with `pnpm build`, not the pixel-area math this
// comment used to guess with ((1844/402)^2 ~= 21x looked like the right
// order of magnitude; the codec's real output wasn't). This glob is NOT
// eager (see below), so its cost is paid once per project a visitor
// actually opens, not by every visitor who sees the card grid --
// .project-img (402px, imageModules above) is completely unchanged and
// still the only image weight the grid itself pays. Best-format (avif/
// webp) output per this codebase's three actual project images, card vs.
// this glob's derivative:
//   aupp_ecampus.png     5.31 KB -> 38.78 KB  (7.3x)
//   jewelry_invoice.png  3.74 KB -> 26.58 KB  (7.1x)
//   train_batch1.jpg    19.97 KB -> 156.98 KB (7.9x)
// ~7-8x per image that actually gets a detail view opened, not 21x --
// quality: 50 compresses proportionally better at the larger size for
// these particular images (flatter regions, screenshots/renders rather
// than high-frequency photographic noise), so the pixel-count ratio
// overstated the real cost. Still the right trade for a single hero image
// shown once, full-width, in a view a visitor deliberately opened -- the
// alternative (a second glob at a smaller fixed width, or a responsive
// srcset) was considered and rejected: a native `sizes` attribute is
// resolved against the *viewport*, but this panel resizes independently of
// the viewport (same reason app.css chose cqi over vw for the measure this
// phase removed) -- srcset would report an oversized image as "correctly
// sized" whenever a visitor drags the panel narrower than their screen,
// which is worse than this glob's actual shortfall below.
//
// KNOWN SHORTFALL, accepted, not overlooked: this derivative is only ever
// as sharp as its source. Checked against this codebase's actual shipped
// project images -- 1865x913, 1378x847, and 1248x835 px -- only the widest
// covers a 1844px-wide render without upscaling; the other two are
// (rounded) 1.34x and 1.48x upscaled at a 1920px fullscreen viewport, and
// more so beyond it. No source-resolution minimum is enforced by
// CONTENT.md or validate.ts -- same "any reasonably-sized source image
// works" policy the write-up's body images already carry, now applied to a
// wider ceiling.
//
// PHASE 6 (header-strip crop) CONFIRMED THE WIDTH UNCHANGED. The detail
// header image (.project-detail-media) went from "shown at full aspect
// ratio, capped to this glob's width" to "cropped to a fixed 200px-tall
// strip at that same width" -- but the WIDTH ceiling this glob generates
// against didn't move: the strip is still full panel content width, so the
// widest it can ever render at is still the same 1844px this comment
// already derives. Cropping happens client-side (CSS object-fit: cover on
// a fixed-height container, app.css), after this derivative is already
// fetched -- it doesn't change what width the browser needs.
// It DOES mean a growing fraction of this derivative's own height is
// fetched and immediately discarded: at 1844px wide and a 200px-tall crop,
// the visible slice is a ~9.2:1 strip, far more letterboxed than any of
// this codebase's actual source images (~1.5-2:1) -- most of the
// downloaded pixel data north and south of the crop band is never painted.
// Not fixed here: imagetools' `aspect`/`fit`/`position` directives could
// crop server-side, but only to ONE fixed aspect ratio per derivative,
// and the strip's rendered aspect isn't fixed -- it runs from ~1.2:1 at
// the 320px MIN_W panel to ~9.2:1 at fullscreen (see app.css's
// .project-detail-media). Matching that properly would need a derivative
// per breakpoint, which reintroduces the viewport-vs-panel `sizes`
// mismatch this same comment already rejected above for width. Left as a
// known, accepted cost of a single fixed-width derivative -- consistent
// with every other shortfall already documented on this file, not a new
// exception -- rather than a redesign this pass didn't ask for.
//
// NOT eager, unlike imageModules -- mirrors detailModules' own reasoning
// (below): the header image shouldn't ship in the bundle any more eagerly
// than the panel most visitors never open. Same glob pattern as
// imageModules on purpose (see collectBuckets: the card image's own
// filename is the only one ever actually looked up from this glob's
// bucket now, PHASE 7 -- matching imageModules' pattern here is just
// "every image file in a project directory," simpler than trying to
// express "only the one filename meta.json names" in the glob pattern
// itself, even though that's the only key this bucket is read by).
const bodyImageModules = import.meta.glob<Picture>('./*/*.{png,jpg,jpeg,webp}', {
	query: { enhanced: true, w: '1844', quality: '50' },
	import: 'default'
});

/* PHASE 7 (body-image float + wrap): write-up body images (<BodyImage>,
   src/lib/components/content/BodyImage.svelte) no longer bleed to the
   write-up's own full column width -- they float left, capped at 700px
   (app.css's .body-image), with prose wrapping their right side. Reusing
   bodyImageModules' 1844px derivative for a 700px-displayed image would
   be needlessly oversized, so this is a separate, narrower glob -- see
   below for why a third width earns its own glob instead of rounding up
   to an existing one.

   WIDTH ARITHMETIC, this codebase's existing "1x, no retina multiplier"
   convention (imageModules' own comment, above: derivative width = exact
   max CSS display width, relying on quality:50 + avif/webp negotiation
   for crispness rather than pixel-doubling). The float's own cap is
   700px, but that's not this image's true ceiling: below app.css's
   .body-image container-query threshold (850px content width, derived in
   the PHASE 7 report from the minimum readable wrapped-text column), the
   float drops out entirely and the image becomes a full-width block --
   rendering at up to just under 850px, WIDER than the 700px float cap.
   850px (the threshold itself) is therefore the actual widest this image
   can ever render at, in either layout mode, and the value below.

   THIRD GLOB vs. REUSE, weighed: reusing bodyImageModules (1844px) would
   avoid one more import.meta.glob call, but at 850px-vs-1844px the pixel
   area ratio is (1844/850)^2 ~= 4.7x -- a real, avoidable cost for
   something that is now, by design, a small capped element, not a
   full-bleed one. A third glob costs one more bucket Map and one more
   per-project lookup loop (collectBuckets/loadProjects, below) -- the
   same shape already used three times over in this file for card image /
   header image / detail write-up, so it's more of this file's own
   established pattern, not new architecture. Chose the third glob.

   NOT eager, same non-eager reasoning as bodyImageModules above -- a
   write-up's images shouldn't ship any more eagerly than the write-up
   itself. Same glob pattern (every image file in a project directory) as
   both other image globs, for the same "one pattern, filter downstream"
   reasoning as bodyImageModules' own comment. */
const writeupBodyImageModules = import.meta.glob<Picture>('./*/*.{png,jpg,jpeg,webp}', {
	query: { enhanced: true, w: '850', quality: '50' },
	import: 'default'
});

function pathParts(path: string): { slug: string; filename: string } {
	const segments = path.split('/');
	return {
		filename: segments[segments.length - 1]!,
		slug: segments[segments.length - 2]!
	};
}

interface Bucket {
	meta: unknown;
	files: Map<string, Picture>;
	detail: Map<string, DetailLoader>;
	/** From bodyImageModules (1844px) -- feeds ProjectItem.detailImage only, PHASE 7. */
	headerImages: Map<string, BodyImageLoader>;
	/** From writeupBodyImageModules (850px) -- feeds ProjectItem.bodyImages, PHASE 7. */
	writeupImages: Map<string, BodyImageLoader>;
}

function collectBuckets(): Map<string, Bucket> {
	const buckets = new Map<string, Bucket>();

	const bucketFor = (slug: string): Bucket => {
		let bucket = buckets.get(slug);
		if (!bucket) {
			bucket = {
				meta: null,
				files: new Map(),
				detail: new Map(),
				headerImages: new Map(),
				writeupImages: new Map()
			};
			buckets.set(slug, bucket);
		}
		return bucket;
	};

	for (const [path, meta] of Object.entries(metaModules)) {
		bucketFor(pathParts(path).slug).meta = meta;
	}

	for (const [path, picture] of Object.entries(imageModules)) {
		const { slug, filename } = pathParts(path);
		bucketFor(slug).files.set(filename, picture);
	}

	for (const [path, load] of Object.entries(detailModules)) {
		const { slug, filename } = pathParts(path);
		bucketFor(slug).detail.set(filename, load);
	}

	for (const [path, load] of Object.entries(bodyImageModules)) {
		const { slug, filename } = pathParts(path);
		bucketFor(slug).headerImages.set(filename, load);
	}

	for (const [path, load] of Object.entries(writeupBodyImageModules)) {
		const { slug, filename } = pathParts(path);
		bucketFor(slug).writeupImages.set(filename, load);
	}

	return buckets;
}

function loadProjects(): ProjectItem[] {
	let items: ProjectItem[];

	try {
		const buckets = collectBuckets();
		items = [];

		for (const [slug, bucket] of buckets) {
			const filesInDir = [...bucket.files.keys(), ...bucket.detail.keys()];
			const result = validateProjectMeta(slug, bucket.meta, filesInDir);

			for (const warning of result.warnings) console.warn(warning);
			if (result.skip) continue;

			const image = bucket.files.get(result.meta.image);
			if (!image) continue;

			for (const warning of checkDetailFiles(slug, filesInDir)) console.warn(warning);

			// PHASE 5E, split PHASE 7: every image in the directory is a
			// body-image candidate except the one meta.json already claimed as
			// the card (result.meta.image) -- this is the whole rule, see
			// CONTENT.md's "Body images" section. Not filtered at the
			// glob/bucket level (writeupBodyImageModules matches the same files
			// as imageModules) because the card filename is only known here,
			// after validation -- filtering earlier would mean duplicating
			// validateProjectMeta's own logic for figuring out which file is the
			// card. Reads from writeupImages (850px, PHASE 7), not headerImages
			// (1844px) -- a write-up body image is now a 700px-capped float, not
			// a full-bleed image, so it draws from the narrower of the two.
			const bodyImages: ProjectItem['bodyImages'] = {};
			for (const [filename, load] of bucket.writeupImages) {
				if (filename === result.meta.image) continue;
				bodyImages[filename] = load;
			}

			// PHASE 5G: the detail view's own (wide) derivative of the card image
			// itself, looked up from headerImages (bodyImageModules, 1844px) --
			// deliberately the WIDER of the two buckets, since this is the
			// full-bleed header strip, not a capped write-up image. Left
			// undefined, not skipped or defaulted, if somehow absent -- same
			// silent-degrade tier as a body image lookup miss (see
			// BodyImage.svelte); it can't currently happen (imageModules and
			// bodyImageModules share one glob pattern over the same directory,
			// so every filename in one is in the other), but nothing here
			// depends on that guarantee holding.
			const detailImage = bucket.headerImages.get(result.meta.image);

			items.push({
				slug,
				title: result.meta.title,
				description: result.meta.description,
				tags: result.meta.tags,
				url: result.meta.url,
				date: result.meta.date,
				image,
				focalPoint: result.meta.focalPoint,
				detailImage,
				detail: {
					en: bucket.detail.get(detailFilename('en')) ?? null,
					ja: bucket.detail.get(detailFilename('ja')) ?? null
				},
				bodyImages
			});
		}
	} catch (error) {
		console.warn(`projects: failed to load content — ${error instanceof Error ? error.message : String(error)}`);
		return [];
	}

	// Identical comparator to art/loader.ts's date sort (newest first, null
	// last, no secondary tiebreak) -- copied rather than shared, same
	// reasoning as isValidDate in validate.ts.
	items.sort((a, b) => {
		if (a.date === null && b.date === null) return 0;
		if (a.date === null) return 1;
		if (b.date === null) return -1;
		return b.date.localeCompare(a.date);
	});

	return items;
}

export const projectItems: ProjectItem[] = loadProjects();
