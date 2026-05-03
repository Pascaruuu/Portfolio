import { languageStrings } from './language-strings.js';
import type {
	Lang,
	SectionId,
	AboutContent,
	SkillsContent,
	ProjectsContent,
	ExperienceContent,
	ContactContent,
	UiContent
} from './types.js';

const socialLinks = [
	{ label: 'GitHub',   url: 'https://github.com/Pascaruuu' },
	{ label: 'LinkedIn', url: 'https://www.linkedin.com/in/pascal-tuy-07bb3b200/' },
	{ label: 'Linktree', url: 'https://linktr.ee/pascaruuu' }
];

const skillItems = [
	{ name: 'Sveltekit',  pct: 90 },
	{ name: 'Typescript', pct: 90 },
	{ name: 'Figma',      pct: 85 },
	{ name: 'Python',     pct: 75 },
	{ name: 'JavaScript', pct: 80 },
	{ name: 'PHP',        pct: 50 }
];

const projectMeta = [
	{
		img: '/images/train_batch1.jpg',
		url: 'https://github.com/Pascaruuu/TrashDnC-YOLOv8'
	},
	{
		img: '/images/jewelry_invoice.png',
		url: 'https://github.com/Pascaruuu/Jewelry-Invoice'
	},
	{
		img: '/images/aupp_ecampus.png',
		url: 'https://github.com/Pascaruuu/AUPP-eCampus'
	}
];

const contactLinks = socialLinks;
const contactEmail = 'tuypascal012@gmail.com';

// ─── Image preload list ───────────────────────────────
export const preloadImages: string[] = [
	'/images/pfp.jpg',
	'/images/train_batch1.jpg',
	'/images/jewelry_invoice.png',
	'/images/aupp_ecampus.png',
];

// ─── Hotspot label lookup ─────────────────────────────
export function getLabel(id: SectionId, lang: Lang): string {
	return languageStrings[lang].sections[id].label;
}

// ─── Typed content getters ────────────────────────────
export function getAbout(lang: Lang): AboutContent {
	const about = languageStrings[lang].sections.about;

	return {
		...about,
		social: socialLinks
	};
}

export function getSkills(lang: Lang): SkillsContent {
	const skills = languageStrings[lang].sections.skills;

	return {
		...skills,
		items: skillItems
	};
}

export function getProjects(lang: Lang): ProjectsContent {
	const projects = languageStrings[lang].sections.projects;

	return {
		label: projects.label,
		heading: projects.heading,
		items: projects.items.map((project, index) => ({
			...project,
			img: projectMeta[index]?.img ?? '',
			url: projectMeta[index]?.url ?? ''
		})),
		viewAll: projects.viewAll
	};
}

export function getExperience(lang: Lang): ExperienceContent {
	return languageStrings[lang].sections.experience;
}

export function getContact(lang: Lang): ContactContent {
	const contact = languageStrings[lang].sections.contact;

	return {
		...contact,
		email: contactEmail,
		links: contactLinks
	};
}

export function getUi(lang: Lang): UiContent {
	const ui = languageStrings[lang].ui;

	return {
		...ui,
		openSectionLabel: (sectionLabel) =>
			ui.openSectionTemplate.replace('{sectionLabel}', sectionLabel)
	};
}
