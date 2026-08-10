import type { Component } from 'svelte';
import type { Picture } from '@sveltejs/enhanced-img';

/**
 * A body image's lazy import, PHASE 5E — same reasoning as `DetailLoader`
 * below: a write-up's images should ship in the bundle no more eagerly than
 * the write-up itself does, so this stays a map of import functions, not
 * resolved `Picture`s. Calling it is what actually fetches the derivative.
 */
export type BodyImageLoader = () => Promise<Picture>;

/**
 * A project's detail write-up, compiled by mdsvex from `detail.<lang>.svx`
 * into a real Svelte component. This is the lazy-import function itself
 * (import.meta.glob without `eager`, see loader.ts) — calling it is what
 * actually fetches the chunk, so a project with no detail file for a given
 * language is `null` here rather than a resolved value, letting the panel
 * skip straight to its "no detail" state without ever calling anything.
 * `images` (PHASE 5E) is declared here, not left as an untyped `Component`,
 * because ProjectDetail.svelte always passes it (see below) regardless of
 * whether a given .svx actually reads it — a write-up with no `<BodyImage>`
 * usage just leaves the prop unread, same as an unused function argument.
 */
export type DetailLoader = () => Promise<{
	default: Component<{ images: Record<string, BodyImageLoader> }>;
}>;

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
	/**
	 * PHASE 6 (header-strip crop) — where the header strip's cover-crop
	 * should anchor, as CSS `object-position` percentages (0 = top/left edge
	 * of the source, 100 = bottom/right edge, 50 = centered — the default
	 * when this is `null`). Optional: most images crop fine centered; this
	 * only needs setting when the meaningful content sits off-center enough
	 * that a 200px-tall strip would otherwise crop past it — see
	 * CONTENT.md's "Focal point" section for guidance on picking a value.
	 */
	focalPoint: { x: number; y: number } | null;
	/**
	 * PHASE 5G — the same card image, at the wider derivative the detail
	 * view's now-uncapped header image needs (loader.ts's bodyImageModules,
	 * looked up by `image`'s own filename). A lazy loader like
	 * `BodyImageLoader`, not a resolved `Picture` like `image` above,
	 * because unlike the card grid's `image` this is only ever needed once
	 * a visitor opens this specific project's detail view — see
	 * ProjectDetail.svelte. `undefined` degrades to "no detail image
	 * shown," the same silent tier as a body image lookup miss; in
	 * practice it's always present (see loader.ts), just not typed as a
	 * guarantee.
	 */
	detailImage: BodyImageLoader | undefined;
	detail: { en: DetailLoader | null; ja: DetailLoader | null };
	/**
	 * PHASE 5E — every other image file in this project's directory,
	 * keyed by filename, for `<BodyImage>` to look up from inside a .svx
	 * write-up (passed to the detail component as the `images` prop, see
	 * ProjectDetail.svelte). Deliberately excludes whichever filename
	 * `meta.json`'s `image` field names — that file already has its own
	 * pipeline and resolution (see loader.ts) and its own meaning (the
	 * card image); a write-up referencing a filename that isn't in this
	 * map (a typo, or the card image's own filename) gets `undefined` back
	 * from the lookup, which `<BodyImage>` treats the same as "no image
	 * supplied" — see CONTENT.md's "Body images" section.
	 */
	bodyImages: Record<string, BodyImageLoader>;
}
