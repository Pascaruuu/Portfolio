import type { Picture } from '@sveltejs/enhanced-img';
import type { ArtPiece } from './types.js';
import { validatePieceMeta } from './validate.js';

const metaModules = import.meta.glob<unknown>('./*/meta.json', {
	eager: true,
	import: 'default'
});

const imageModules = import.meta.glob<Picture>('./*/*.{png,jpg,jpeg,webp}', {
	eager: true,
	query: { enhanced: true },
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
}

function collectBuckets(): Map<string, Bucket> {
	const buckets = new Map<string, Bucket>();

	const bucketFor = (slug: string): Bucket => {
		let bucket = buckets.get(slug);
		if (!bucket) {
			bucket = { meta: null, files: new Map() };
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

			pieces.push({
				slug,
				title: result.meta.title,
				description: result.meta.description,
				category: result.meta.category,
				date: result.meta.date,
				images
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
