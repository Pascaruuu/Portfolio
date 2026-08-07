import type { Picture } from '@sveltejs/enhanced-img';

export type ArtCategory = 'hand-drawn' | 'digital';

/** Mirrors meta.json exactly — one per piece directory. */
export interface ArtPieceMeta {
	title: { en: string; ja: string };
	description: { en: string; ja: string };
	category: ArtCategory;
	date: string;
	images: string[];
}

/** What the loader returns: metadata (degraded per validation rules) plus the slug and resolved images. */
export interface ArtPiece {
	slug: string;
	title: { en: string | null; ja: string | null };
	description: { en: string | null; ja: string | null };
	category: ArtCategory | null;
	date: string | null;
	images: Picture[];
}
