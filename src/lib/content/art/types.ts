import type { Picture } from '@sveltejs/enhanced-img';

export type ArtCategory = 'hand-drawn' | 'digital';

/**
 * What the loader returns: metadata (degraded per validation rules) plus the
 * slug and resolved images. `images` is full-size (for the lightbox);
 * `thumbnails` is grid-sized (for the art grid) — same files, same order,
 * joined by directory name from two separate globs (see loader.ts).
 */
export interface ArtPiece {
	slug: string;
	title: { en: string | null; ja: string | null };
	description: { en: string | null; ja: string | null };
	category: ArtCategory | null;
	date: string | null;
	images: Picture[];
	thumbnails: Picture[];
}
