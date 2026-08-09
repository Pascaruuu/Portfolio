import type { Component } from 'svelte';
import type { Picture } from '@sveltejs/enhanced-img';

/**
 * A project's detail write-up, compiled by mdsvex from `detail.<lang>.svx`
 * into a real Svelte component. This is the lazy-import function itself
 * (import.meta.glob without `eager`, see loader.ts) — calling it is what
 * actually fetches the chunk, so a project with no detail file for a given
 * language is `null` here rather than a resolved value, letting the panel
 * skip straight to its "no detail" state without ever calling anything.
 */
export type DetailLoader = () => Promise<{ default: Component }>;

/**
 * What the loader returns: metadata (degraded per validation rules) plus the
 * slug and the resolved image. Unlike art, a project shows exactly one
 * image (no lightbox strip), so `image` is a single `Picture`, not an array
 * — see loader.ts.
 */
export interface ProjectItem {
	slug: string;
	title: string | null;
	description: { en: string | null; ja: string | null };
	tags: { en: string[]; ja: string[] };
	url: string | null;
	/**
	 * YYYY-MM-DD, the date of the project's last meaningful commit (not its
	 * creation date). Sort key — see loader.ts. Missing or invalid date
	 * degrades to null and sorts last, same pattern and same validation
	 * rules as art's `date` (src/lib/content/art/validate.ts).
	 */
	date: string | null;
	image: Picture;
	detail: { en: DetailLoader | null; ja: DetailLoader | null };
}
