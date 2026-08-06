export const sectionIds = ['about', 'skills', 'projects', 'experience', 'art', 'contact'] as const;
export type SectionId = typeof sectionIds[number];
export type Lang = 'en' | 'ja';

// ─── Content types ────────────────────────────────────
export interface SkillItem {
	name: string;
	pct: number;
}

export interface ProjectItem {
	title: string;
	desc: string;
	tags: string[];
	img: string;
	url: string;
}

export interface ExperienceItem {
	title: string;
	desc: string;
}

export interface AboutContent {
	label: string;
	heading: string;
	paragraphs: string[];
	social: { label: string; url: string }[];
}

export interface SkillsContent {
	label: string;
	heading: string;
	items: SkillItem[];
}

export interface ProjectsContent {
	label: string;
	heading: string;
	items: ProjectItem[];
	viewAll: string;
}

export interface ExperienceContent {
	label: string;
	heading: string;
	items: ExperienceItem[];
}

export interface ArtContent {
	label: string;
	heading: string;
	body: string;
}

export interface ContactContent {
	label: string;
	heading: string;
	email: string;
	copyLabel: string;
	copiedLabel: string;
	links: { label: string; url: string }[];
}

export interface HeroContent {
	welcomeText: string;
	name: string;
	nameFurigana?: string;
	roleText: string;
	hint: string;
	cvLabel: string;
	cvHref: string;
}

export interface UiContent {
	navAriaLabel: string;
	closePanelLabel: string;
	dragHint: string;
	languageToggleLabel: string;
	profilePhotoAlt: string;
	openSectionLabel: (sectionLabel: string) => string;
	hero: HeroContent;
}

// ─── Sphere / hotspot types ───────────────────────────
export interface HotspotDef {
	id: SectionId;
	lat: number;
	lon: number;
}

/** Live per-frame state pushed from the sphere engine to the UI */
export interface HotspotState {
	id: SectionId;
	x: number;
	y: number;
	opacity: number;
}

export interface SphereCallbacks {
	onHotspotClick: (id: SectionId) => void;
	onFrame: (states: HotspotState[]) => void;
	onDragStateChange: (dragging: boolean, hovering: boolean) => void;
	onFirstDrag: () => void;
	onBackgroundClick?: () => void;
	onProgress?: (n: number) => void;
}

export interface SphereControls {
	dispose:         () => void;
	resize:          () => void;
	setPanelOpen:    (open: boolean) => void;
	focusSection:    (id: SectionId | null) => void;
	setWarpProgress: (p: number) => void;
}
