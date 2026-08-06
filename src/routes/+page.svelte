<script lang="ts">
	import { onMount } from 'svelte';
	import { asset } from '$app/paths';
	import LightspeedIntro from '$lib/components/LightspeedIntro.svelte';
	import { navItems } from '$lib/portfolio-data.js';
	import { initSphere, HOTSPOT_DEFS } from '$lib/sphere.js';
	import { viewport } from '$lib/viewport.svelte.js';
	import { timeline } from '$lib/timeline.svelte.js';
	import { PANEL_GUTTER, PANEL_MAX_W, PANEL_H_GUTTER } from '$lib/panelGeometry.js';
	import { createDraggablePanel, RESIZE_DIRS } from '$lib/createDraggablePanel.svelte.js';
	import {
		getLabel,
		getAbout,
		getSkills,
		getProjects,
		getExperience,
		getArt,
		getContact,
		getUi,
		preloadImages,
	} from '$lib/content.js';
	import type { SectionId, Lang, HotspotState } from '$lib/types.js';

	// ── State ──────────────────────────────────────────────
	let lang           = $state<Lang>('ja');
	let currentSection = $state<SectionId | null>(null);
	let panelOpen      = $state(false);
	let panelFullscreen = $state(false);
	let hintDismissed  = $state(false);
	let isDragging     = $state(false);
	let isHovering     = $state(false);
	let hotspotStates  = $state<HotspotState[]>([]);
	let skillsAnimated = $state(false);
	let loadProgress   = $state(0);
	let loadingDone    = $state(false);
	let loadingVisible = $state(true);

	// ── Panel rect (desktop drag/resize) ──────────────────
	const panel = createDraggablePanel();

	let canvasEl  = $state<HTMLCanvasElement | null>(null);
	let sphereCtl = $state<{
		setPanelOpen: (o: boolean) => void;
		focusSection: (id: SectionId | null) => void;
		setWarpProgress: (p: number) => void;
	} | null>(null);

	// ── Derived ────────────────────────────────────────────
	const ui = $derived(getUi(lang));

	$effect(() => {
		document.documentElement.lang = lang;
	});

	// ── Sphere init ────────────────────────────────────────
	onMount(() => {
		viewport.init();

		if (!canvasEl) return;

		// loadingDone is page state (drives .main-content fade-in), so it's
		// a beat here, not intro-local logic. Fires the instant the intro
		// starts exiting (was on:exit).
		const disposeExitBeat = timeline.after('exit', 0, 'exit-side-effect', () => {
			loadingDone = true;
		});

		// Page becomes interactive 1400ms after exit begins, matching the
		// intro's own TOTAL_EXIT_MS (was on:done).
		const disposeDoneBeat = timeline.after('exit', 1400, 'intro-done', () => {
			setTimeout(() => {
				loadingVisible = false;
			}, 400);
		});

		let controls: Awaited<ReturnType<typeof initSphere>> | undefined;
		const initTimer = setTimeout(async () => {
			if (!canvasEl) return;

			controls = await initSphere(canvasEl, {
				onHotspotClick:    (id) => openPanel(id),
				onFrame:           (states) => { hotspotStates = states; },
				onDragStateChange: (drag, hover) => { isDragging = drag; isHovering = hover; },
				onFirstDrag:       () => { hintDismissed = true; },
				onBackgroundClick: () => { if (panelOpen) closePanel(); },
				onProgress:        (n) => { loadProgress = n; },
			});
			sphereCtl = controls;
		}, 2000);

		const handleResize = (): void => {
			controls?.resize();
			panel.onViewportResize();
		};
		window.addEventListener('resize', handleResize);

		return () => {
			clearTimeout(initTimer);
			controls?.dispose();
			window.removeEventListener('resize', handleResize);
			viewport.teardown();
			disposeExitBeat();
			disposeDoneBeat();
		};
	});

	// ── Sync panel state to sphere ────────────────────────
	$effect(() => { sphereCtl?.setPanelOpen(panelOpen); });

	// ── Skill bar animation ────────────────────────────────
	$effect(() => {
		if (currentSection === 'skills' && panelOpen) {
			skillsAnimated = false;
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					skillsAnimated = true;
				});
			});
		} else if (!panelOpen) {
			skillsAnimated = false;
		}
	});

	// ── Panel ──────────────────────────────────────────────
	function openPanel(id: SectionId): void {
		sphereCtl?.focusSection(id);
		currentSection = id;
		panelOpen      = true;
	}

	function closePanel(): void {
		sphereCtl?.focusSection(null);
		panelOpen      = false;
		currentSection = null;
		panelFullscreen = false;
	}

	$effect(() => {
		if (panelOpen && !panel.initialized) panel.init();
	});

	// ── Language ───────────────────────────────────────────
	function toggleLang(): void {
		lang = lang === 'en' ? 'ja' : 'en';
	}

	// ── Contact email copy ─────────────────────────────────
	let emailCopied = $state(false);
	function copyEmail(email: string): void {
		navigator.clipboard.writeText(email).then(() => {
			emailCopied = true;
			setTimeout(() => { emailCopied = false; }, 2000);
		});
	}
</script>

<svelte:head>
	{#each preloadImages as src (src)}
		<link rel="preload" as="image" href={src} />
	{/each}
</svelte:head>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape' && panelOpen) closePanel(); }} />

<LightspeedIntro
	progress={loadProgress}
	visible={loadingVisible}
	sphereCtl={sphereCtl}
/>

<div class="main-content" class:loaded={loadingDone}>
<!-- ── Section nav ──────────────────────────────────── -->
<nav class="section-nav" aria-label={ui.navAriaLabel}>
	{#each navItems as item (item)}
		<button
			class="section-nav-btn"
			class:active={currentSection === item}
			aria-current={currentSection === item ? 'page' : undefined}
			onclick={() => openPanel(item)}
		>
			{lang === 'en' ? getLabel(item, lang).toUpperCase() : getLabel(item, lang)}
		</button>
	{/each}
</nav>

<!-- ── WebGL canvas ──────────────────────────────────── -->
<canvas
	bind:this={canvasEl}
	class="sphere-canvas"
	class:dragging={isDragging}
	class:hovering={isHovering && !isDragging}
></canvas>

<!-- ── Welcome block (left) ─────────────────────────── -->
{#key lang}
	<div
		class="welcome-block"
		class:panel-open={panelOpen}
	>
		<p class="welcome-greeting">{ui.hero.welcomeText}</p>
		{#if lang === 'ja'}
			<p class="welcome-name-furigana">{ui.hero.nameFurigana}</p>
		{/if}
		<h1 class="welcome-name">{ui.hero.name}</h1>
		<p class="welcome-role">{ui.hero.roleText}</p>
		<p class="welcome-hint">
			{ui.hero.hint}
		</p>
		<a class="ctrl-btn welcome-cv" href={asset(ui.hero.cvHref)} download>{ui.hero.cvLabel}</a>
	</div>
{/key}

<!-- ── Controls (top-right) ─────────────────────────── -->
<div class="controls">
	<button class="ctrl-btn" onclick={toggleLang}>
		{ui.languageToggleLabel}
	</button>
</div>

<!-- ── Hotspot labels ────────────────────────────────── -->
{#each hotspotStates as hs (hs.id)}
	{@const idx = HOTSPOT_DEFS.findIndex(h => h.id === hs.id)}
	<button
		class="hs-label"
		style:left="{hs.x}px"
		style:top="{hs.y}px"
		style:opacity={hs.opacity}
		style:pointer-events={hs.opacity > 0.5 ? 'auto' : 'none'}
		onclick={() => openPanel(hs.id)}
		aria-label={ui.openSectionLabel(getLabel(hs.id, lang))}
	>
		<div class="hs-dot" style:--delay="{idx * 0.48}s"></div>
		<span class="hs-text">{getLabel(hs.id, lang)}</span>
	</button>
{/each}

<!-- ── Drag hint ─────────────────────────────────────── -->
<div class="drag-hint" class:hidden={hintDismissed} aria-hidden="true">
	<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none"
		stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
		<path d="M15 7c0-1.657-1.343-3-3-3S9 5.343 9 7v7" />
		<path d="M9 10c0-1.105.895-2 2-2h2c1.105 0 2 .895 2 2v4" />
		<path d="M5 15v-2a7 7 0 0 1 14 0v2l1 4H4l1-4z" />
	</svg>
	<span>{ui.dragHint}</span>
</div>

<!-- ── Connector line (SVG overlay) ─────────────────── -->
{#if panelOpen && viewport.isDesktop}
	{@const activeHs = hotspotStates.find(h => h.id === currentSection)}
	{@const x1 = activeHs?.x ?? viewport.vw / 2}
	{@const y1 = activeHs?.y ?? viewport.vh / 2}
	{@const x2 = panel.initialized ? panel.x : viewport.vw - PANEL_GUTTER - Math.min(PANEL_MAX_W, viewport.vw - PANEL_H_GUTTER)}
	{@const y2 = panel.initialized ? panel.y + panel.h / 2 : viewport.vh / 2}
	{@const tang = Math.abs(x2 - x1) * 0.42 + 50}
	{@const pathD = `M ${x1} ${y1} C ${x1 + tang} ${y1} ${x2 - tang} ${y2} ${x2} ${y2}`}
	{@const lineAlpha = activeHs ? activeHs.opacity : 0}
	<svg class="connector-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
		<g opacity={lineAlpha}>
			<circle cx={x1} cy={y1} r="5" fill="var(--accent)" opacity="0.75" />
			<path d={pathD} stroke="var(--accent)" stroke-width="1.5" fill="none"
				stroke-dasharray="6 4" opacity="0.55" />
			<circle cx={x2} cy={y2} r="4" fill="var(--accent)" opacity="0.75" />
		</g>
	</svg>
{/if}

<!-- ── Popup card ─────────────────────────────────────── -->
{#if panelOpen}
	<div
		bind:this={panel.el}
		class="popup-card"
		class:panel-fullscreen={panelFullscreen}
		class:js-positioned={panel.initialized && viewport.isDesktop}
		style={panel.initialized && viewport.isDesktop
			? `left:${panel.x}px; top:${panel.y}px; width:${panel.w}px;${panel.h ? ` height:${panel.h}px;` : ''} right:auto; transform:none;`
			: ''}
		aria-modal="true"
		role="dialog"
	>
		<div
			class="panel-drag-handle"
			onpointerdown={panel.onDragStart}
			aria-label="Drag panel"
			role="button"
			tabindex="-1"
		>
			<svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
				<circle cx="2" cy="2" r="1.5" />
				<circle cx="8" cy="2" r="1.5" />
				<circle cx="2" cy="8" r="1.5" />
				<circle cx="8" cy="8" r="1.5" />
				<circle cx="2" cy="14" r="1.5" />
				<circle cx="8" cy="14" r="1.5" />
			</svg>
		</div>

		{#each RESIZE_DIRS as dir (dir)}
			<div class="resize-handle resize-{dir}" role="presentation" onpointerdown={(e) => panel.onResizeStart(e, dir)}></div>
		{/each}

		<div class="popup-header">
			<button class="panel-fs-btn" onclick={() => panelFullscreen = !panelFullscreen} aria-label="Toggle full screen">
				<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor"
					fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					{#if panelFullscreen}
						<polyline points="6 9 12 15 18 9" />
					{:else}
						<polyline points="18 15 12 9 6 15" />
					{/if}
				</svg>
			</button>
			<button class="panel-close" onclick={closePanel} aria-label={ui.closePanelLabel}>
				<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor"
					fill="none" stroke-width="2" stroke-linecap="round">
					<line x1="18" y1="6"  x2="6"  y2="18" />
					<line x1="6"  y1="6"  x2="18" y2="18" />
				</svg>
			</button>
		</div>

		<div class="panel-body">

			<!-- ── About ─────────────────────────────────── -->
			{#if currentSection === 'about'}
				{@const c = getAbout(lang)}
				<p class="panel-eyebrow">{c.label}</p>
				<h2 class="panel-heading">{c.heading}</h2>
				<img src="/images/pfp.jpg" alt={ui.profilePhotoAlt} class="about-photo" />
				<div class="about-body">
					{#each c.paragraphs as para, i (i)}
						<p>{para}</p>
					{/each}
				</div>
				<div class="about-social">
					{#each c.social as link (link.url)}
						<a href={link.url} target="_blank" rel="external noopener noreferrer" class="pill">
							{link.label}
						</a>
					{/each}
				</div>

			<!-- ── Skills ────────────────────────────────── -->
			{:else if currentSection === 'skills'}
				{@const c = getSkills(lang)}
				<p class="panel-eyebrow">{c.label}</p>
				<h2 class="panel-heading">{c.heading}</h2>
				{#each c.items as skill (skill.name)}
					<div class="skill-row">
						<div class="skill-row-header">
							<span class="skill-name">{skill.name}</span>
							<span class="skill-pct">{skill.pct}%</span>
						</div>
						<div class="skill-track">
							<div
								class="skill-fill"
								style:width={skillsAnimated ? `${skill.pct}%` : '0%'}
							></div>
						</div>
					</div>
				{/each}

			<!-- ── Projects ──────────────────────────────── -->
			{:else if currentSection === 'projects'}
				{@const c = getProjects(lang)}
				<p class="panel-eyebrow">{c.label}</p>
				<h2 class="panel-heading">{c.heading}</h2>
				{#each c.items as project (project.url)}
					<a
						href={project.url}
						target="_blank"
						rel="external noopener noreferrer"
						class="project-card"
					>
						<img src={project.img} alt={project.title} class="project-img" loading="lazy" />
						<div class="project-body">
							<div class="project-title">{project.title}</div>
							<p class="project-desc">{project.desc}</p>
							<div class="project-tags">
								{#each project.tags as tag, i (i)}
									<span class="tag">{tag}</span>
								{/each}
							</div>
						</div>
					</a>
				{/each}
				<a
					href="https://github.com/Pascaruuu?tab=repositories"
					target="_blank"
					rel="noopener noreferrer"
					class="view-all"
				>
					{c.viewAll}
				</a>

			<!-- ── Experience ────────────────────────────── -->
			{:else if currentSection === 'experience'}
				{@const c = getExperience(lang)}
				<p class="panel-eyebrow">{c.label}</p>
				<h2 class="panel-heading">{c.heading}</h2>
				{#each c.items as item (item.title)}
					<div class="exp-item">
						<div class="exp-title">{item.title}</div>
						<p class="exp-desc">{item.desc}</p>
					</div>
				{/each}

			<!-- ── Art ───────────────────────────────────── -->
			{:else if currentSection === 'art'}
				{@const c = getArt(lang)}
				<p class="panel-eyebrow">{c.label}</p>
				<h2 class="panel-heading">{c.heading}</h2>
				<p class="exp-desc">{c.body}</p>

			<!-- ── Contact ───────────────────────────────── -->
			{:else if currentSection === 'contact'}
				{@const c = getContact(lang)}
				<p class="panel-eyebrow">{c.label}</p>
				<h2 class="panel-heading">{c.heading}</h2>
				<button
					class="email-copy"
					onclick={() => copyEmail(c.email)}
					aria-label={c.copyLabel}
				>
					<span class="email-address">{c.email}</span>
					<span class="email-copy-label">{emailCopied ? c.copiedLabel : c.copyLabel}</span>
				</button>
				<div class="contact-links">
					{#each c.links as link (link.url)}
						<a href={link.url} target="_blank" rel="external noopener noreferrer" class="pill">
							{link.label}
						</a>
					{/each}
				</div>
			{/if}

		</div>
	</div>
{/if}
</div>

<style>
	.main-content {
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.4s ease;
		min-height: 100dvh;
	}

	.main-content.loaded {
		opacity: 1;
		pointer-events: auto;
	}

	.section-nav {
		position: fixed;
		top: 22px;
		left: 50%;
		z-index: 40;
		display: flex;
		align-items: center;
		gap: 2px;
		max-width: calc(100vw - 32px);
		padding: 5px;
		overflow-x: auto;
		background: var(--nav-bg);
		border: 1px solid var(--nav-border);
		border-radius: 999px;
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		transform: translateX(-50%);
	}

	.section-nav-btn {
		flex: 0 0 auto;
		min-height: 36px;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--muted);
		cursor: pointer;
		font: inherit;
		font-size: 0.7rem;
		font-weight: 500;
		letter-spacing: 0.12em;
		line-height: 1;
		padding: 11px 14px;
		transition:
			background 0.2s,
			color 0.2s;
	}

	.section-nav-btn:hover,
	.section-nav-btn.active {
		background: var(--nav-active-bg);
		color: var(--text);
	}

	.section-nav-btn:focus-visible {
		outline: 1px solid var(--accent);
		outline-offset: 2px;
	}

	.welcome-name-furigana {
		font-size: 0.95rem;
		letter-spacing: 0.16em;
		color: var(--muted);
		margin: 0 0 4px 0;
		font-weight: 400;
		padding-left: 0.08em;
	}

	.welcome-name {
		white-space: nowrap;
	}

	@media (max-width: 640px) {
		.section-nav {
			top: auto;
			bottom: max(12px, env(safe-area-inset-bottom));
			width: calc(100vw - 24px);
			justify-content: flex-start;
			z-index: 45;
			scrollbar-width: none;
		}

		.section-nav::-webkit-scrollbar {
			display: none;
		}

		.section-nav-btn {
			font-size: 0.62rem;
			min-height: 44px;
			padding: 0 13px;
		}
	}
</style>
