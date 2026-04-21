import type {
	Lang,
	SectionId,
	AboutContent,
	SkillsContent,
	ProjectsContent,
	ExperienceContent,
	ContactContent
} from './types.js';

// ─── About ────────────────────────────────────────────
const about: Record<Lang, AboutContent> = {
	en: {
		label: 'About',
		heading: 'Who I Am',
		paragraphs: [
			"I'm TUY Pascal, an IT student with a passion for web development and digital creation. I build small applications and systems to understand how technology works in practice.",
			"I'm drawn to the intersection of design and code — creating things that are both functional and visually considered. I also explore computer vision, cybersecurity, and automation.",
			'Currently improving my technical foundations through personal and academic projects, always focused on steady, practical progress.'
		],
		social: [
			{ label: 'GitHub',   url: 'https://github.com/Pascaruuu' },
			{ label: 'LinkedIn', url: 'https://www.linkedin.com/in/pascal-tuy-07bb3b200/' },
			{ label: 'Linktree', url: 'https://linktr.ee/pascaruuu' }
		]
	},
	jp: {
		label: '私について',
		heading: '自己紹介',
		paragraphs: [
			'TUY Pascalといいます。ウェブ開発とデジタルクリエーションに情熱を持つITの学生です。技術がどのように機能するかを理解するため、小さなアプリケーションやシステムを構築しています。',
			'デザインとコードの交差点に特に惹かれており、機能的で視覚的に洗練されたものを作ることが好きです。コンピュータビジョン、サイバーセキュリティ、自動化も探求しています。',
			'個人的および学術的なプロジェクトを通じて技術的な基礎を向上させており、常に着実で実践的な進歩に集中しています。'
		],
		social: [
			{ label: 'GitHub',   url: 'https://github.com/Pascaruuu' },
			{ label: 'LinkedIn', url: 'https://www.linkedin.com/in/pascal-tuy-07bb3b200/' },
			{ label: 'Linktree', url: 'https://linktr.ee/pascaruuu' }
		]
	}
};

// ─── Skills ───────────────────────────────────────────
const skills: Record<Lang, SkillsContent> = {
	en: {
		label: 'Skills',
		heading: 'What I Know',
		items: [
			{ name: 'Sveltekit',  pct: 90 },
			{ name: 'Typescript', pct: 90 },
			{ name: 'Figma',      pct: 85 },
			{ name: 'Python',     pct: 75 },
			{ name: 'JavaScript', pct: 80 },
			{ name: 'PHP',        pct: 50 }
		]
	},
	jp: {
		label: 'スキル',
		heading: 'スキルセット',
		items: [
			{ name: 'Sveltekit',  pct: 90 },
			{ name: 'Typescript', pct: 90 },
			{ name: 'Figma',      pct: 85 },
			{ name: 'Python',     pct: 75 },
			{ name: 'JavaScript', pct: 80 },
			{ name: 'PHP',        pct: 50 }
		]
	}
};

// ─── Projects ─────────────────────────────────────────
const projects: Record<Lang, ProjectsContent> = {
	en: {
		label: 'Projects',
		heading: 'My Work',
		items: [
			{
				title: 'TrashDnC-YOLOv8',
				desc:  'Trash detection and classification system using YOLOv8 for automated waste management.',
				tags:  ['YOLOv8', 'Computer Vision', 'Python'],
				img:   '/images/train_batch1.jpg',
				url:   'https://github.com/Pascaruuu/TrashDnC-YOLOv8'
			},
			{
				title: 'Jewelry-Invoice',
				desc:  'Invoice management system for jewelry businesses with inventory tracking.',
				tags:  ['Invoice', 'Business', 'PHP'],
				img:   '/images/jewelry_invoice.png',
				url:   'https://github.com/Pascaruuu/Jewelry-Invoice'
			},
			{
				title: 'AUPP-eCampus',
				desc:  'Campus management platform with student portal and administrative features.',
				tags:  ['Education', 'Web App', 'PHP'],
				img:   '/images/aupp_ecampus.png',
				url:   'https://github.com/Pascaruuu/AUPP-eCampus'
			}
		],
		viewAll: 'View all repositories →'
	},
	jp: {
		label: 'プロジェクト',
		heading: '制作物',
		items: [
			{
				title: 'TrashDnC-YOLOv8',
				desc:  'YOLOv8を使用した自動廃棄物管理のためのゴミ検出・分類システム。',
				tags:  ['YOLOv8', 'コンピュータビジョン', 'Python'],
				img:   '/images/train_batch1.jpg',
				url:   'https://github.com/Pascaruuu/TrashDnC-YOLOv8'
			},
			{
				title: 'Jewelry-Invoice',
				desc:  '在庫追跡機能を備えたジュエリービジネス向けの請求書管理システム。',
				tags:  ['請求書', 'ビジネス', 'PHP'],
				img:   '/images/jewelry_invoice.png',
				url:   'https://github.com/Pascaruuu/Jewelry-Invoice'
			},
			{
				title: 'AUPP-eCampus',
				desc:  '学生ポータルと管理機能を備えたキャンパス管理プラットフォーム。',
				tags:  ['教育', 'Webアプリ', 'PHP'],
				img:   '/images/aupp_ecampus.png',
				url:   'https://github.com/Pascaruuu/AUPP-eCampus'
			}
		],
		viewAll: 'すべてのリポジトリを見る →'
	}
};

// ─── Experience ───────────────────────────────────────
const experience: Record<Lang, ExperienceContent> = {
	en: {
		label: 'Experience',
		heading: 'Background',
		items: [
			{
				title: 'Cybersecurity Events',
				desc:  'Participated in CTF competitions and cybersecurity challenges, building expertise in network security and vulnerability assessment.'
			},
			{
				title: 'Design & Illustration',
				desc:  'Created digital artwork and UI designs using Figma, developing an eye for visual systems and interface clarity.'
			},
			{
				title: 'Web Development',
				desc:  'Built web applications and full-stack systems for academic and personal projects, focusing on clean architecture and user experience.'
			}
		]
	},
	jp: {
		label: '経験',
		heading: '経歴',
		items: [
			{
				title: 'サイバーセキュリティイベント',
				desc:  'CTF競技やサイバーセキュリティチャレンジに参加し、ネットワークセキュリティと脆弱性評価の専門知識を培いました。'
			},
			{
				title: 'デザイン・イラスト',
				desc:  'Figmaを使用してデジタルアートワークやUIデザインを作成し、ビジュアルシステムとインターフェースの明確さへの感覚を磨きました。'
			},
			{
				title: 'ウェブ開発',
				desc:  '学術的・個人的なプロジェクトのためにWebアプリケーションやフルスタックシステムを構築し、クリーンなアーキテクチャとUXに注力しました。'
			}
		]
	}
};

// ─── Contact ──────────────────────────────────────────
const contact: Record<Lang, ContactContent> = {
	en: {
		label: 'Contact',
		heading: 'Get In Touch',
		email: 'tuypascal012@gmail.com',
		copyLabel: 'Copy email',
		copiedLabel: 'Copied!',
		links: [
			{ label: 'GitHub',   url: 'https://github.com/Pascaruuu' },
			{ label: 'LinkedIn', url: 'https://www.linkedin.com/in/pascal-tuy-07bb3b200/' },
			{ label: 'Linktree', url: 'https://linktr.ee/pascaruuu' }
		]
	},
	jp: {
		label: '連絡',
		heading: 'お問い合わせ',
		email: 'tuypascal012@gmail.com',
		copyLabel: 'メールをコピー',
		copiedLabel: 'コピー済み！',
		links: [
			{ label: 'GitHub',   url: 'https://github.com/Pascaruuu' },
			{ label: 'LinkedIn', url: 'https://www.linkedin.com/in/pascal-tuy-07bb3b200/' },
			{ label: 'Linktree', url: 'https://linktr.ee/pascaruuu' }
		]
	}
};

// ─── Image preload list ───────────────────────────────
export const preloadImages: string[] = [
	'/images/pfp.jpg',
	'/images/train_batch1.jpg',
	'/images/jewelry_invoice.png',
	'/images/aupp_ecampus.png',
];

// ─── Hotspot label lookup ─────────────────────────────
export function getLabel(id: SectionId, lang: Lang): string {
	const map: Record<SectionId, Record<Lang, string>> = {
		about:      { en: about.en.label,      jp: about.jp.label      },
		skills:     { en: skills.en.label,     jp: skills.jp.label     },
		projects:   { en: projects.en.label,   jp: projects.jp.label   },
		experience: { en: experience.en.label, jp: experience.jp.label },
		contact:    { en: contact.en.label,    jp: contact.jp.label    }
	};
	return map[id][lang];
}

// ─── Typed content getters ────────────────────────────
export function getAbout(lang: Lang):      AboutContent      { return about[lang];      }
export function getSkills(lang: Lang):     SkillsContent     { return skills[lang];     }
export function getProjects(lang: Lang):   ProjectsContent   { return projects[lang];   }
export function getExperience(lang: Lang): ExperienceContent { return experience[lang]; }
export function getContact(lang: Lang):    ContactContent    { return contact[lang];    }
