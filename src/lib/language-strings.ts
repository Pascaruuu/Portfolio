import type { Lang } from './types.js';

interface ExperienceStrings {
	title: string;
	desc: string;
}

interface LanguageStrings {
	sections: {
		about: {
			label: string;
			heading: string;
			descriptor: string;
			blocks: { label?: string; paragraphs: string[] }[];
		};
		skills: {
			label: string;
			heading: string;
		};
		projects: {
			label: string;
			heading: string;
			viewAll: string;
			viewRepo: string;
			backLabel: string;
			loadingDetail: string;
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
			lightboxCloseLabel: string;
			imageStripLabel: string;
			imageLabelTemplate: string;
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
				descriptor: 'Full-stack engineer',
				blocks: [
					{
						paragraphs: [
							"I finished my IT studies and now work as an intern at NextMake, building web applications. I work full-stack — front and back end both, handling design, implementation, testing, and deployment end to end on my own."
						]
					},
					{
						label: 'What I build',
						paragraphs: [
							"I've built AI into production systems — most recently one that reads purchase order contents automatically, with the goal of cutting manual entry work. Getting it to genuinely usable accuracy meant comparing several models and testing them against real documents."
						]
					},
					{
						label: 'How I work',
						paragraphs: [
							'I lead the intern team — dividing up work, keeping the process organised, and reporting progress to the client in Japanese every week. Written reports and day-to-day communication in Japanese are both part of the job.'
						]
					},
					{
						label: 'Goal',
						paragraphs: [
							"My goal is to work as a software engineer connecting Japan and Cambodia. First by working in Japan, learning how things are done here and how people work. Then using that experience on both sides — contributing to Japan's continued growth, and helping improve technology, infrastructure, and quality of life in Cambodia."
						]
					},
					{
						label: 'Philosophy',
						paragraphs: [
							"I'm the kind of person who's always asking whether something could be less tedious. Finding the waste in a process and solving it structurally is what I'm good at. The other half of that is not stopping when it gets difficult — most things worth building are unpleasant somewhere in the middle, and the way out is through."
						]
					}
				]
			},
			skills: {
				label: 'Skills',
				heading: 'What I Know'
			},
			projects: {
				label: 'Projects',
				heading: 'My Work',
				viewAll: 'View all repositories →',
				viewRepo: 'View repository',
				backLabel: 'Back to projects',
				loadingDetail: 'Loading details…'
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
				emptyFiltered: 'No pieces match this filter.',
				lightboxCloseLabel: 'Close',
				imageStripLabel: 'More images',
				imageLabelTemplate: 'Image {n}'
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
				descriptor: 'フルスタックエンジニア',
				blocks: [
					{
						paragraphs: [
							'ITの学業を終え、現在はNextMake株式会社でインターンとしてWebアプリケーションの開発に携わっています。フルスタックエンジニアとして画面側とサーバー側の両方を一人で担当し、設計から実装、テスト、導入までを一貫して進めています。'
						]
					},
					{
						label: '作っているもの',
						paragraphs: [
							'業務システムにAIを組み込む開発の経験があります。注文書の内容を自動で読み取るシステムの開発に携わり、手入力の作業を減らすことを目指して取り組みました。いくつかのAIモデルを比較しながら試し、実際に使えるレベルの精度に近づけていきました。'
						]
					},
					{
						label: '働き方',
						paragraphs: [
							'チームでの開発にも取り組んでいます。インターンチームのとりまとめを行い、作業の分担や進め方を整理しながら、毎週日本語でクライアントへ進捗を報告しています。日本語での報告書作成やコミュニケーションにも対応しています。'
						]
					},
					{
						label: '目標',
						paragraphs: [
							'私の目標は、ソフトウェアエンジニアとして日本とカンボジアをつなぐことです。まずは日本で働き、日本の文化や仕事の進め方を学びたいと考えています。そこで得た経験を活かして、日本のこれからの成長に貢献するとともに、カンボジアの技術やインフラ、生活の質の向上にも力を尽くしたいです。'
						]
					},
					{
						label: '考え方',
						paragraphs: [
							'普段から「もっと便利にできないか」と考える性格で、業務の無駄を見つけ、仕組みで解決することを得意としています。同時に、途中でしんどくなっても手を止めないことを大切にしています。価値のあるものは必ずどこかで大変になりますが、逃げずに向き合った先に結果があると思っています。'
						]
					}
				]
			},
			skills: {
				label: 'スキル',
				heading: 'スキルセット'
			},
			projects: {
				label: 'プロジェクト',
				heading: '制作物',
				viewAll: 'すべてのリポジトリを見る →',
				viewRepo: 'リポジトリを見る',
				backLabel: 'プロジェクト一覧に戻る',
				loadingDetail: '詳細を読み込み中…'
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
				emptyFiltered: 'この条件に一致する作品はありません。',
				lightboxCloseLabel: '閉じる',
				imageStripLabel: 'その他の画像',
				imageLabelTemplate: '画像{n}'
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
