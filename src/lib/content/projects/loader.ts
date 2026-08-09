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

// PHASE 5E: every image in every project directory, at the width a body
// image can ever actually render at -- .project-detail-markdown's
// --prose-measure (app.css) tops out at 67ch, which is 564px at this
// element's 0.82rem/13.12px font-size (67 * 8.41px/ch = 563.5px, rounded up
// so the derivative is never a hair narrower than its one possible display
// width). Same "one fixed size, not a responsive srcset" choice as
// imageModules above, for the same reason: a body image's rendered width has
// a hard ceiling, so there's no smaller breakpoint worth a second derivative.
// NOT eager, unlike imageModules -- mirrors detailModules' own reasoning
// (below): a write-up's images shouldn't ship in the bundle any more eagerly
// than the write-up itself does, for a panel most visitors never open. Same
// glob pattern as imageModules on purpose (see collectBuckets: the card
// image's own filename is filtered back out per-project below, not excluded
// here) -- keeping one pattern for "every image file in a project directory"
// is simpler than trying to express "every image file except this other
// glob's match" in the glob pattern itself.
const bodyImageModules = import.meta.glob<Picture>('./*/*.{png,jpg,jpeg,webp}', {
	query: { enhanced: true, w: '564', quality: '50' },
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
	bodyImages: Map<string, BodyImageLoader>;
}

function collectBuckets(): Map<string, Bucket> {
	const buckets = new Map<string, Bucket>();

	const bucketFor = (slug: string): Bucket => {
		let bucket = buckets.get(slug);
		if (!bucket) {
			bucket = { meta: null, files: new Map(), detail: new Map(), bodyImages: new Map() };
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
		bucketFor(slug).bodyImages.set(filename, load);
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

			// PHASE 5E: every image in the directory is a body-image candidate
			// except the one meta.json already claimed as the card (result.meta.image)
			// -- this is the whole rule, see CONTENT.md's "Body images" section. Not
			// filtered at the glob/bucket level (bodyImageModules matches the same
			// files as imageModules) because the card filename is only known here,
			// after validation -- filtering earlier would mean duplicating
			// validateProjectMeta's own logic for figuring out which file is the card.
			const bodyImages: ProjectItem['bodyImages'] = {};
			for (const [filename, load] of bucket.bodyImages) {
				if (filename === result.meta.image) continue;
				bodyImages[filename] = load;
			}

			items.push({
				slug,
				title: result.meta.title,
				description: result.meta.description,
				tags: result.meta.tags,
				url: result.meta.url,
				date: result.meta.date,
				image,
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
