import { languageStrings } from './language-strings.js';
import {
	contactEmail,
	skillItems,
	socialLinks
} from './portfolio-data.js';
import type {
	Lang,
	SectionId,
	AboutContent,
	SkillsContent,
	ProjectsContent,
	ExperienceContent,
	ArtContent,
	ContactContent,
	UiContent
} from './types.js';

// ─── Hotspot label lookup ─────────────────────────────
export function getLabel(id: SectionId, lang: Lang): string {
	return languageStrings[lang].sections[id].label;
}

// ─── Header heading lookup ────────────────────────────
export function getHeading(id: SectionId, lang: Lang): string {
	return languageStrings[lang].sections[id].heading;
}

// ─── Typed content getters ────────────────────────────
export function getAbout(lang: Lang): AboutContent {
	const { label, descriptor, blocks } = languageStrings[lang].sections.about;

	return {
		label,
		descriptor,
		blocks,
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
	return languageStrings[lang].sections.projects;
}

export function getExperience(lang: Lang): ExperienceContent {
	return languageStrings[lang].sections.experience;
}

export function getArt(lang: Lang): ArtContent {
	return languageStrings[lang].sections.art;
}

export function getContact(lang: Lang): ContactContent {
	const contact = languageStrings[lang].sections.contact;

	return {
		...contact,
		email: contactEmail,
		links: socialLinks
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
