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

export const projects = [
	{
		title: 'TrashDnC-YOLOv8',
		img: '/images/train_batch1.jpg',
		url: 'https://github.com/Pascaruuu/TrashDnC-YOLOv8'
	},
	{
		title: 'Jewelry-Invoice',
		img: '/images/jewelry_invoice.png',
		url: 'https://github.com/Pascaruuu/Jewelry-Invoice'
	},
	{
		title: 'AUPP-eCampus',
		img: '/images/aupp_ecampus.png',
		url: 'https://github.com/Pascaruuu/AUPP-eCampus'
	}
];

export const contactEmail = 'tuypascal012@gmail.com';

export const preloadImages = [
	'/images/pfp.jpg',
	...projects.map((project) => project.img)
];
