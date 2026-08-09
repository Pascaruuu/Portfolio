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

// Same reasoning as pfpModules -- 1x displayed size (402px), derived from the
// 2-column project grid: PANEL_MAX_W 900 minus .panel-body's 38px horizontal
// padding on each side (824), minus .project-grid's 20px gap (804), divided
// by 2 columns (402). Known shortfall: below the @container (max-width: 540px)
// breakpoint the grid drops to 1 column, and .panel-body's content width can
// reach 464px there -- so in the panel-body 478-540px width band the image is
// upscaled from its 402px source. Accepted, not overlooked.
const projectImageModules = import.meta.glob<Picture>(
	'./assets/{train_batch1.jpg,jewelry_invoice.png,aupp_ecampus.png}',
	{ eager: true, query: { enhanced: true, w: '402', quality: '50' }, import: 'default' }
);

export const projects = [
	{
		title: 'TrashDnC-YOLOv8',
		img: projectImageModules['./assets/train_batch1.jpg']!,
		url: 'https://github.com/Pascaruuu/TrashDnC-YOLOv8'
	},
	{
		title: 'Jewelry-Invoice',
		img: projectImageModules['./assets/jewelry_invoice.png']!,
		url: 'https://github.com/Pascaruuu/Jewelry-Invoice'
	},
	{
		title: 'AUPP-eCampus',
		img: projectImageModules['./assets/aupp_ecampus.png']!,
		url: 'https://github.com/Pascaruuu/AUPP-eCampus'
	}
];

export const contactEmail = 'tuypascal012@gmail.com';

// Same Picture objects About/Projects render, exposed for +page.svelte's
// unconditional page-load preload.
export const aboutPreloadImages: Picture[] = [pfpImage];
export const projectPreloadImages: Picture[] = projects.map((project) => project.img);
