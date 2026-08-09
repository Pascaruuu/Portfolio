<script lang="ts">
	import { onMount } from 'svelte';
	import { asset } from '$app/paths';
	import LightspeedIntro from '$lib/components/LightspeedIntro.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl.svelte';
	import About from '$lib/components/sections/About.svelte';
	import Skills from '$lib/components/sections/Skills.svelte';
	import Projects from '$lib/components/sections/Projects.svelte';
	import Experience from '$lib/components/sections/Experience.svelte';
	import Art from '$lib/components/sections/Art.svelte';
	import Contact from '$lib/components/sections/Contact.svelte';
	import ArtLightbox from '$lib/components/ArtLightbox.svelte';
	import { lightbox } from '$lib/lightbox.svelte.js';
	import { navItems, aboutPreloadImages, projectPreloadImages } from '$lib/portfolio-data.js';
	import { initSphere, HOTSPOT_DEFS } from '$lib/sphere.js';
	import { viewport } from '$lib/viewport.svelte.js';
	import { timeline } from '$lib/timeline.svelte.js';
	import { PANEL_GUTTER, PANEL_MAX_W, PANEL_H_GUTTER } from '$lib/panelGeometry.js';
	import { createDraggablePanel, RESIZE_DIRS } from '$lib/createDraggablePanel.svelte.js';
	import { getLabel, getHeading, getArt, getUi } from '$lib/content.js';
	import { artPieces } from '$lib/content/art/loader.js';
	import { artFilter, type ArtFilter } from '$lib/artFilter.svelte.js';
	import { panelScrollFade } from '$lib/actions/panelScrollFade.js';
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
	const artContent = $derived(getArt(lang));

	// ── Art filter (header control; Art.svelte reads the result) ──
	const artFilterOptions: ArtFilter[] = ['all', 'hand-drawn', 'digital'];

	function artFilterLabel(filter: ArtFilter): string {
		if (filter === 'all') return artContent.filters.all;
		if (filter === 'hand-drawn') return artContent.filters.handDrawn;
		return artContent.filters.digital;
	}

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
</script>

<svelte:head>
	<!-- About/Projects images preload unconditionally: single derivative per format
	     (see portfolio-data.ts), so one <link> per format present in .sources covers
	     the avif/webp candidates the <picture> would pick. imagetools omits a fallback
	     <source> when a format has only one width (redundant with the plain <img> tag),
	     so .sources never includes the original jpeg/png here -- the extra href-based
	     link below preloads that exact fallback (picture.img.src) so a browser without
	     avif or webp support still gets a preload hit instead of an unhinted fetch. -->
	{#each aboutPreloadImages as picture (picture.img.src)}
		{#each Object.entries(picture.sources) as [format, srcset] (format)}
			<link rel="preload" as="image" imagesrcset={srcset} type={`image/${format}`} />
		{/each}
		<link rel="preload" as="image" href={picture.img.src} />
	{/each}

	{#each projectPreloadImages as picture (picture.img.src)}
		{#each Object.entries(picture.sources) as [format, srcset] (format)}
			<link rel="preload" as="image" imagesrcset={srcset} type={`image/${format}`} />
		{/each}
		<link rel="preload" as="image" href={picture.img.src} />
	{/each}

	<!-- Art grid thumbnails: full-size images stay lazy (ArtLightbox only mounts
	     its <enhanced:img> once a piece is opened, see lightbox.svelte.ts) -- only
	     the grid's own cell image preloads here, same pattern as above. -->
	{#each artPieces as piece (piece.slug)}
		{@const [thumbnail] = piece.thumbnails}
		{#if thumbnail}
			{#each Object.entries(thumbnail.sources) as [format, srcset] (format)}
				<link rel="preload" as="image" imagesrcset={srcset} type={`image/${format}`} />
			{/each}
			<link rel="preload" as="image" href={thumbnail.img.src} />
		{/if}
	{/each}
</svelte:head>

<svelte:window onkeydown={(e) => {
	if (e.key !== 'Escape') return;
	if (lightbox.piece) { lightbox.close(); return; }
	if (panelOpen) closePanel();
}} />

<LightspeedIntro
	progress={loadProgress}
	visible={loadingVisible}
	sphereCtl={sphereCtl}
/>

<div class="main-content" class:loaded={loadingDone}>
<!-- ── Section nav ──────────────────────────────────── -->
<nav class="section-nav segmented-control" aria-label={ui.navAriaLabel}>
	<SegmentedControl
		items={navItems}
		itemKey={(item) => item}
		itemLabel={(item) => (lang === 'en' ? getLabel(item, lang).toUpperCase() : getLabel(item, lang))}
		activeItem={currentSection}
		onSelect={openPanel}
		ariaCurrentOnActive={true}
	/>
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

{#snippet artFilterIcon(filter: ArtFilter)}
	{#if filter === 'all'}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
			stroke-linecap="round" stroke-linejoin="round">
			<rect x="3" y="3" width="7" height="7" />
			<rect x="14" y="3" width="7" height="7" />
			<rect x="14" y="14" width="7" height="7" />
			<rect x="3" y="14" width="7" height="7" />
		</svg>
	{:else if filter === 'hand-drawn'}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
			stroke-linecap="round" stroke-linejoin="round">
			<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
		</svg>
	{:else}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
			stroke-linecap="round" stroke-linejoin="round">
			<rect x="4" y="2" width="16" height="20" rx="2" />
			<line x1="12" y1="18" x2="12.01" y2="18" />
		</svg>
	{/if}
{/snippet}

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
			<div class="popup-header-row">
				{#if currentSection}
					<div class="panel-heading-block">
						<p class="panel-eyebrow">{getLabel(currentSection, lang)}</p>
						<h2 class="panel-heading">{getHeading(currentSection, lang)}</h2>
					</div>
				{/if}
				<button class="panel-close" onclick={closePanel} aria-label={ui.closePanelLabel}>
					<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor"
						fill="none" stroke-width="2" stroke-linecap="round">
						<line x1="18" y1="6"  x2="6"  y2="18" />
						<line x1="6"  y1="6"  x2="18" y2="18" />
					</svg>
				</button>
			</div>
			{#if currentSection === 'art' && artPieces.length > 0}
				<div class="art-filter segmented-control" role="group" aria-label={artContent.filterLabel}>
					<SegmentedControl
						items={artFilterOptions}
						itemKey={(item) => item}
						itemLabel={artFilterLabel}
						itemIcon={artFilterIcon}
						activeItem={artFilter.selected}
						onSelect={(item) => artFilter.select(item)}
					/>
				</div>
			{/if}
		</div>

		<div class="panel-body" use:panelScrollFade>
			<div class="panel-body-content">

				{#if currentSection === 'about'}
					<About lang={lang} />
				{:else if currentSection === 'skills'}
					<Skills lang={lang} />
				{:else if currentSection === 'projects'}
					<Projects lang={lang} />
				{:else if currentSection === 'experience'}
					<Experience lang={lang} />
				{:else if currentSection === 'art'}
					<Art lang={lang} />
				{:else if currentSection === 'contact'}
					<Contact lang={lang} />
				{/if}

			</div>
		</div>
	</div>
{/if}

<!-- ── Art lightbox ──────────────────────────────────── -->
<!-- Sibling of .popup-card, not a descendant: .panel-body has
     container-type: inline-size, which implies layout containment and
     makes it a containing block for position: fixed descendants (per the
     CSS containment spec). A lightbox mounted inside Art.svelte would be
     pinned to the panel's box and clipped by .popup-card's overflow
     instead of covering the viewport — see PHASE 8 report. -->
<ArtLightbox lang={lang} />
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
</style>
