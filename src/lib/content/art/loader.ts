import type { Picture } from '@sveltejs/enhanced-img';
import type { ArtPiece } from './types.js';
import { validatePieceMeta } from './validate.js';

const metaModules = import.meta.glob<unknown>('./*/meta.json', {
	eager: true,
	import: 'default'
});

// Two globs feed two different consumers. This one stays full-size and feeds
// the lightbox, which renders one image at a time at its own intrinsic size.
// No `imgSizes`/`w` directive is passed, so enhanced-img emits x-descriptor
// (pixel-density) srcset here — density-only variants are all a single
// full-bleed image needs.
const imageModules = import.meta.glob<Picture>('./*/*.{png,jpg,jpeg,webp}', {
	eager: true,
	query: { enhanced: true },
	import: 'default'
});

// This one feeds the art grid, which renders many cells at a known, fixed
// size, so it carries an explicit `w` directive — that's what makes
// enhanced-img emit w-descriptor srcset instead of x-descriptor, which in
// turn is what makes a `sizes` attribute on the grid's <enhanced:img>
// meaningful (browsers only consult `sizes` for w-descriptor srcset).
// 222px is the largest cell the grid ever renders (the single-column tier
// at the 320px panel floor — see the .art-grid container queries below);
// the other tiers (180, 179, 150px) are all smaller, so 222/444 covers
// every tier at 1x/2x device pixel ratio without generating a width per tier.
const thumbnailModules = import.meta.glob<Picture>('./*/*.{png,jpg,jpeg,webp}', {
	eager: true,
	query: { enhanced: true, w: '222;444' },
	import: 'default'
});

// Single source of truth for the grid cell width computed above. Consumed by
// the grid's own `sizes` attribute (Art.svelte) and by the thumbnail
// preload's `imagesizes` attribute (+page.svelte) — both must read this
// constant rather than each hardcoding "222px", or the two can silently
// drift apart and the preload stops being a cache hit.
export const ART_GRID_THUMB_SIZES = '222px';

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
	thumbnails: Map<string, Picture>;
}

function collectBuckets(): Map<string, Bucket> {
	const buckets = new Map<string, Bucket>();

	const bucketFor = (slug: string): Bucket => {
		let bucket = buckets.get(slug);
		if (!bucket) {
			bucket = { meta: null, files: new Map(), thumbnails: new Map() };
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

	for (const [path, picture] of Object.entries(thumbnailModules)) {
		const { slug, filename } = pathParts(path);
		bucketFor(slug).thumbnails.set(filename, picture);
	}

	return buckets;
}

function loadArtPieces(): ArtPiece[] {
	let pieces: ArtPiece[];

	try {
		const buckets = collectBuckets();
		pieces = [];

		for (const [slug, bucket] of buckets) {
			const result = validatePieceMeta(slug, bucket.meta, [...bucket.files.keys()]);

			for (const warning of result.warnings) console.warn(warning);
			if (result.skip) continue;

			const images = result.meta.images
				.map((filename) => bucket.files.get(filename))
				.filter((picture): picture is Picture => picture !== undefined);

			const thumbnails = result.meta.images
				.map((filename) => bucket.thumbnails.get(filename))
				.filter((picture): picture is Picture => picture !== undefined);

			pieces.push({
				slug,
				title: result.meta.title,
				description: result.meta.description,
				category: result.meta.category,
				date: result.meta.date,
				images,
				thumbnails
			});
		}
	} catch (error) {
		console.warn(`art: failed to load content — ${error instanceof Error ? error.message : String(error)}`);
		return [];
	}

	pieces.sort((a, b) => {
		if (a.date === null && b.date === null) return 0;
		if (a.date === null) return 1;
		if (b.date === null) return -1;
		return b.date.localeCompare(a.date);
	});

	return pieces;
}

export const artPieces: ArtPiece[] = loadArtPieces();
