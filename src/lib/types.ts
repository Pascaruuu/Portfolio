export type SectionId = 'about' | 'skills' | 'projects' | 'experience' | 'contact';
export type Lang = 'en' | 'jp';

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

export interface ContactContent {
	label: string;
	heading: string;
	email: string;
	copyLabel: string;
	copiedLabel: string;
	links: { label: string; url: string }[];
}

export type SectionContent =
	| { type: 'about'; data: AboutContent }
	| { type: 'skills'; data: SkillsContent }
	| { type: 'projects'; data: ProjectsContent }
	| { type: 'experience'; data: ExperienceContent }
	| { type: 'contact'; data: ContactContent };

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
	onHotspotClick: (id: SectionId, screenX: number, screenY: number) => void;
	onFrame: (states: HotspotState[]) => void;
	onDragStateChange: (dragging: boolean, hovering: boolean) => void;
	onFirstDrag: () => void;
	onBackgroundClick?: () => void;
}

export interface SphereControls {
	dispose:       () => void;
	resize:        () => void;
	setPanelOpen:  (open: boolean) => void;
}
