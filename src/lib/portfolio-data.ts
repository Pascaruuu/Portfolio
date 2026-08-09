import type { Picture } from '@sveltejs/enhanced-img';
import { sectionIds } from './types.js';

export const navItems = sectionIds;

export const socialLinks = [
	{ label: 'GitHub',   url: 'https://github.com/Pascaruuu' },
	{ label: 'LinkedIn', url: 'https://www.linkedin.com/in/pascal-tuy-07bb3b200/' },
	{ label: 'Linktree', url: 'https://linktr.ee/pascaruuu' }
];

export const skillItems = [
	{ name: 'Sveltekit',  pct: 90 },
	{ name: 'Typescript', pct: 90 },
	{ name: 'Figma',      pct: 85 },
	{ name: 'Python',     pct: 75 },
	{ name: 'JavaScript', pct: 80 },
	{ name: 'PHP',        pct: 50 }
];

// Card images, not gallery pieces -- retina sharpness isn't worth the bytes, so one
// candidate at the 1x displayed size (76x76, .about-photo). quality:50 matches
// sharp's own avif default (verified empirically: avif output is byte-identical
// with and without the directive), so avif -- what most browsers actually fetch --
// doesn't regress, while webp/jpeg drop from their 80 default to the same 50.
const pfpModules = import.meta.glob<Picture>('./assets/pfp.jpg', {
	eager: true,
	query: { enhanced: true, w: '76', quality: '50' },
	import: 'default'
});
export const pfpImage = Object.values(pfpModules)[0]!;

export const contactEmail = 'tuypascal012@gmail.com';

// Same Picture object About renders, exposed for +page.svelte's
// unconditional page-load preload. Projects' own preload list is derived
// the same way but sourced from its own loader — see
// src/lib/content/projects/loader.ts and its use in +page.svelte.
export const aboutPreloadImages: Picture[] = [pfpImage];
