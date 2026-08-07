import type { Lang } from './types.js';

interface ProjectStrings {
	desc: string;
	tags: string[];
}

interface ExperienceStrings {
	title: string;
	desc: string;
}

interface LanguageStrings {
	sections: {
		about: {
			label: string;
			heading: string;
			paragraphs: string[];
		};
		skills: {
			label: string;
			heading: string;
		};
		projects: {
			label: string;
			heading: string;
			items: ProjectStrings[];
			viewAll: string;
		};
		experience: {
			label: string;
			heading: string;
			items: ExperienceStrings[];
		};
		art: {
			label: string;
			heading: string;
			filterLabel: string;
			filters: {
				all: string;
				handDrawn: string;
				digital: string;
			};
			emptyAll: string;
			emptyFiltered: string;
		};
		contact: {
			label: string;
			heading: string;
			copyLabel: string;
			copiedLabel: string;
		};
	};
	ui: {
		navAriaLabel: string;
		closePanelLabel: string;
		dragHint: string;
		languageToggleLabel: string;
		profilePhotoAlt: string;
		openSectionTemplate: string;
		hero: {
			welcomeText: string;
			name: string;
			nameFurigana?: string;
			roleText: string;
			hint: string;
			cvLabel: string;
			cvHref: string;
		};
	};
}

export const languageStrings: Record<Lang, LanguageStrings> = {
	en: {
		sections: {
			about: {
				label: 'About',
				heading: 'Who I Am',
				paragraphs: [
					"I'm TUY Pascal, an IT student with a passion for web development and digital creation. I build small applications and systems to understand how technology works in practice.",
					"I'm drawn to the intersection of design and code: creating things that are both functional and visually considered. I also explore computer vision, cybersecurity, and automation.",
					'Currently improving my technical foundations through personal and academic projects, always focused on steady, practical progress.'
				]
			},
			skills: {
				label: 'Skills',
				heading: 'What I Know'
			},
			projects: {
				label: 'Projects',
				heading: 'My Work',
				items: [
					{
						desc: 'Trash detection and classification system using YOLOv8 for automated waste management.',
						tags: ['YOLOv8', 'Computer Vision', 'Python']
					},
					{
						desc: 'Invoice management system for jewelry businesses with inventory tracking.',
						tags: ['Invoice', 'Business', 'PHP']
					},
					{
						desc: 'Campus management platform with student portal and administrative features.',
						tags: ['Education', 'Web App', 'PHP']
					}
				],
				viewAll: 'View all repositories →'
			},
			experience: {
				label: 'Experience',
				heading: 'Background',
				items: [
					{
						title: 'Cybersecurity Events',
						desc: 'Participated in CTF competitions and cybersecurity challenges, building expertise in network security and vulnerability assessment.'
					},
					{
						title: 'Design & Illustration',
						desc: 'Created digital artwork and UI designs using Figma, developing an eye for visual systems and interface clarity.'
					},
					{
						title: 'Web Development',
						desc: 'Built web applications and full-stack systems for academic and personal projects, focusing on clean architecture and user experience.'
					}
				]
			},
			art: {
				label: 'ART',
				heading: 'Art',
				filterLabel: 'Filter by category',
				filters: {
					all: 'All',
					handDrawn: 'Hand-drawn',
					digital: 'Digital'
				},
				emptyAll: 'No pieces yet.',
				emptyFiltered: 'No pieces match this filter.'
			},
			contact: {
				label: 'Contact',
				heading: 'Get In Touch',
				copyLabel: 'Copy email',
				copiedLabel: 'Copied!'
			}
		},
		ui: {
			navAriaLabel: 'Portfolio sections',
			closePanelLabel: 'Close panel',
			dragHint: 'drag to explore',
			languageToggleLabel: 'EN / JP',
			profilePhotoAlt: 'TUY Pascal',
			openSectionTemplate: 'Open {sectionLabel} section',
			hero: {
				welcomeText: 'Welcome',
				name: 'TUY Pascal',
				roleText: 'Full-Stack Dev & Designer',
				hint: 'Drag & click to explore',
				cvLabel: 'Download CV',
				cvHref: '/assets/TUY_Pascal-CV.pdf'
			}
		}
	},
	ja: {
		sections: {
			about: {
				label: '私について',
				heading: '自己紹介',
				paragraphs: [
					'TUY Pascalといいます。ウェブ開発とデジタルクリエーションに情熱を持つITの学生です。技術がどのように機能するかを理解するため、小さなアプリケーションやシステムを構築しています。',
					'デザインとコードの交差点に特に惹かれており、機能的で視覚的に洗練されたものを作ることが好きです。コンピュータビジョン、サイバーセキュリティ、自動化も探求しています。',
					'個人的および学術的なプロジェクトを通じて技術的な基礎を向上させており、常に着実で実践的な進歩に集中しています。'
				]
			},
			skills: {
				label: 'スキル',
				heading: 'スキルセット'
			},
			projects: {
				label: 'プロジェクト',
				heading: '制作物',
				items: [
					{
						desc: 'YOLOv8を使用した自動廃棄物管理のためのゴミ検出・分類システム。',
						tags: ['YOLOv8', 'コンピュータビジョン', 'Python']
					},
					{
						desc: '在庫追跡機能を備えたジュエリービジネス向けの請求書管理システム。',
						tags: ['請求書', 'ビジネス', 'PHP']
					},
					{
						desc: '学生ポータルと管理機能を備えたキャンパス管理プラットフォーム。',
						tags: ['教育', 'Webアプリ', 'PHP']
					}
				],
				viewAll: 'すべてのリポジトリを見る →'
			},
			experience: {
				label: '経験',
				heading: '経歴',
				items: [
					{
						title: 'サイバーセキュリティイベント',
						desc: 'CTF競技やサイバーセキュリティチャレンジに参加し、ネットワークセキュリティと脆弱性評価の専門知識を培いました。'
					},
					{
						title: 'デザイン・イラスト',
						desc: 'Figmaを使用してデジタルアートワークやUIデザインを作成し、ビジュアルシステムとインターフェースの明確さへの感覚を磨きました。'
					},
					{
						title: 'ウェブ開発',
						desc: '学術的・個人的なプロジェクトのためにWebアプリケーションやフルスタックシステムを構築し、クリーンなアーキテクチャとUXに注力しました。'
					}
				]
			},
			art: {
				label: 'アート',
				heading: 'アート',
				filterLabel: 'カテゴリーで絞り込む',
				filters: {
					all: 'すべて',
					handDrawn: '手描き',
					digital: 'デジタル'
				},
				emptyAll: 'まだ作品がありません。',
				emptyFiltered: 'この条件に一致する作品はありません。'
			},
			contact: {
				label: '連絡',
				heading: 'お問い合わせ',
				copyLabel: 'メールをコピー',
				copiedLabel: 'コピー済み！'
			}
		},
		ui: {
			navAriaLabel: 'ポートフォリオのセクション',
			closePanelLabel: 'パネルを閉じる',
			dragHint: 'ドラッグして探索',
			languageToggleLabel: 'JP / EN',
			profilePhotoAlt: 'トゥイ・パスカル',
			openSectionTemplate: '{sectionLabel}セクションを開く',
			hero: {
				welcomeText: 'ようこそ',
				name: 'トゥイ・パスカル',
				nameFurigana: 'TUY Pascal',
				roleText: 'フルスタック開発者 & デザイナー',
				hint: 'ドラッグして探索',
				cvLabel: '履歴書をダウンロード',
				cvHref: '/assets/20260427_バスカル_履歴書.pdf'
			}
		}
	}
};
