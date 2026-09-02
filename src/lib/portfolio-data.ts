import type { Picture } from '@sveltejs/enhanced-img';
import { sectionIds } from './types.js';

export const navItems = sectionIds;

export const socialLinks = [
	{ label: 'GitHub',    url: 'https://github.com/Pascaruuu' },
	{ label: 'LinkedIn',  url: 'https://www.linkedin.com/in/pascal-tuy-07bb3b200/' },
	{ label: 'Instagram', url: 'https://www.instagram.com/pascaruuuu' },
	{ label: 'Facebook',  url: 'https://www.facebook.com/pascal.tuy/' },
	{ label: 'Telegram',  url: 'https://telegram.me/pascaruuu' }
];

export const skillItems = [
	{ name: 'Sveltekit',  pct: 90 },
	{ name: 'Typescript', pct: 90 },
	{ name: 'Figma',      pct: 85 },
	{ name: 'Python',     pct: 75 },
	{ name: 'JavaScript', pct: 80 },
	{ name: 'PHP',        pct: 50 }
];

// Rail portrait (.about-photo, app.css) -- single width at 540, the ceiling
// of the two contexts it renders at: 220 for the fixed desktop rail, up to
// 540 for the collapsed full-width layout below .panel-body's 540px
// @container threshold. Comfortably under the 853x854 source -- no
// upscaling. No `sizes`: per the HTML default (sizes absent -> 100vw),
// every real browser resolves to the largest candidate regardless of which
// layout is showing (same reasoning as content/projects/loader.ts's
// writeupBodyImageModules), so a second, narrower candidate would just be
// dead weight -- one width is both simplest and correct here. This also
// keeps a single width per format, which matters for the preload block in
// +page.svelte: imagetools only emits a fallback-format entry in `.sources`
// when a format has more than one width (see that block's own comment) --
// a second width here would put jpeg back into `.sources` and duplicate
// the href-based fallback preload.
// quality raised from 50 (chosen for the old 76px avatar, where
// compression artifacts were invisible) to 75: this is now a prominent,
// always-visible personal photo shown up to 540px wide.
const pfpModules = import.meta.glob<Picture>('./assets/pfp.jpg', {
	eager: true,
	query: { enhanced: true, w: '540', quality: '75' },
	import: 'default'
});
export const pfpImage = Object.values(pfpModules)[0]!;

export const contactEmail = 'tuypascal012@gmail.com';

// Same Picture object About renders, exposed for +page.svelte's
// unconditional page-load preload. Projects' own preload list is derived
// the same way but sourced from its own loader — see
// src/lib/content/projects/loader.ts and its use in +page.svelte.
export const aboutPreloadImages: Picture[] = [pfpImage];
