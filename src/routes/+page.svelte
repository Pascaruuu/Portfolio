<script lang="ts">
	import { onMount } from 'svelte';
	import { initSphere, HOTSPOT_DEFS } from '$lib/sphere.js';
	import {
		getLabel,
		getAbout,
		getSkills,
		getProjects,
		getExperience,
		getContact,
		preloadImages,
	} from '$lib/content.js';
	import type { SectionId, Lang, HotspotState } from '$lib/types.js';

	// ── State ──────────────────────────────────────────────
	let lang           = $state<Lang>('en');
	let currentSection = $state<SectionId | null>(null);
	let panelOpen      = $state(false);
	let hintDismissed  = $state(false);
	let isDragging     = $state(false);
	let isHovering     = $state(false);
	let hotspotStates  = $state<HotspotState[]>([]);
	let skillsAnimated = $state(false);
	let vw             = $state(0);
	let vh             = $state(0);

	let canvasEl  = $state<HTMLCanvasElement | null>(null);
	let sphereCtl = $state<{
		setPanelOpen: (o: boolean) => void;
		triggerWave: (id: SectionId) => void;
		focusSection: (id: SectionId | null) => void;
	} | null>(null);

	// ── Derived ────────────────────────────────────────────
	const roleText = $derived(
		lang === 'en' ? 'Full-Stack Dev & Designer' : 'フルスタック開発者 & デザイナー'
	);

	const welcomeText = $derived(lang === 'en' ? 'Welcome' : 'ようこそ');

	// ── Sphere init ────────────────────────────────────────
	onMount(() => {
		vw = window.innerWidth;
		vh = window.innerHeight;

		if (!canvasEl) return;

		const controls = initSphere(canvasEl, {
			onHotspotClick:    (id) => openPanel(id, false),
			onFrame:           (states) => { hotspotStates = states; },
			onDragStateChange: (drag, hover) => { isDragging = drag; isHovering = hover; },
			onFirstDrag:       () => { hintDismissed = true; },
			onBackgroundClick: () => { if (panelOpen) closePanel(); },
		});
		sphereCtl = controls;

		const handleResize = (): void => {
			controls.resize();
			vw = window.innerWidth;
			vh = window.innerHeight;
		};
		window.addEventListener('resize', handleResize);

		return () => {
			controls.dispose();
			window.removeEventListener('resize', handleResize);
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
	function openPanel(id: SectionId, react = true): void {
		if (react) sphereCtl?.triggerWave(id);
		sphereCtl?.focusSection(id);
		currentSection = id;
		panelOpen      = true;
	}

	function closePanel(): void {
		sphereCtl?.focusSection(null);
		panelOpen      = false;
		currentSection = null;
	}

	// ── Language ───────────────────────────────────────────
	function toggleLang(): void {
		lang = lang === 'en' ? 'jp' : 'en';
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
	{#each preloadImages as src}
		<link rel="preload" as="image" href={src} />
	{/each}
</svelte:head>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape' && panelOpen) closePanel(); }} />

<!-- ── WebGL canvas ──────────────────────────────────── -->
<canvas
	bind:this={canvasEl}
	class="sphere-canvas"
	class:dragging={isDragging}
	class:hovering={isHovering && !isDragging}
></canvas>

<!-- ── Welcome block (left) ─────────────────────────── -->
<div class="welcome-block">
	<p class="welcome-greeting">{welcomeText}</p>
	<h1 class="welcome-name">TUY Pascal</h1>
	<p class="welcome-role">{roleText}</p>
	<p class="welcome-hint">
		{lang === 'en' ? 'Drag & click to explore' : 'ドラッグして探索'}
	</p>
	<a class="ctrl-btn welcome-cv" href="/assets/20260422_バスカル_履歴書.pdf" download>Download CV</a>
</div>

<!-- ── Controls (top-right) ─────────────────────────── -->
<div class="controls">
	<button class="ctrl-btn" onclick={toggleLang}>
		{lang === 'en' ? 'EN / JP' : 'JP / EN'}
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
		aria-label="Open {getLabel(hs.id, lang)} section"
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
	<span>drag to explore</span>
</div>

<!-- ── Connector line (SVG overlay) ─────────────────── -->
{#if panelOpen && vw > 0}
	{@const activeHs = hotspotStates.find(h => h.id === currentSection)}
	{@const x1 = activeHs?.x ?? vw / 2}
	{@const y1 = activeHs?.y ?? vh / 2}
	{@const popupW = Math.min(400, vw - 96)}
	{@const x2 = vw - 48 - popupW}
	{@const y2 = vh / 2}
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
	<div class="popup-card" aria-modal="true" role="dialog">
		<div class="popup-header">
			<button class="panel-close" onclick={closePanel} aria-label="Close panel">
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
				<p class="panel-eyebrow">about</p>
				<h2 class="panel-heading">{c.heading}</h2>
				<img src="/images/pfp.jpg" alt="TUY Pascal" class="about-photo" />
				<div class="about-body">
					{#each c.paragraphs as para}
						<p>{para}</p>
					{/each}
				</div>
				<div class="about-social">
					{#each c.social as link}
						<a href={link.url} target="_blank" rel="noopener noreferrer" class="pill">
							{link.label}
						</a>
					{/each}
				</div>

			<!-- ── Skills ────────────────────────────────── -->
			{:else if currentSection === 'skills'}
				{@const c = getSkills(lang)}
				<p class="panel-eyebrow">skills</p>
				<h2 class="panel-heading">{c.heading}</h2>
				{#each c.items as skill}
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
				<p class="panel-eyebrow">projects</p>
				<h2 class="panel-heading">{c.heading}</h2>
				{#each c.items as project}
					<a
						href={project.url}
						target="_blank"
						rel="noopener noreferrer"
						class="project-card"
					>
						<img src={project.img} alt={project.title} class="project-img" loading="lazy" />
						<div class="project-body">
							<div class="project-title">{project.title}</div>
							<p class="project-desc">{project.desc}</p>
							<div class="project-tags">
								{#each project.tags as tag}
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
				<p class="panel-eyebrow">experience</p>
				<h2 class="panel-heading">{c.heading}</h2>
				{#each c.items as item}
					<div class="exp-item">
						<div class="exp-title">{item.title}</div>
						<p class="exp-desc">{item.desc}</p>
					</div>
				{/each}

			<!-- ── Contact ───────────────────────────────── -->
			{:else if currentSection === 'contact'}
				{@const c = getContact(lang)}
				<p class="panel-eyebrow">contact</p>
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
					{#each c.links as link}
						<a href={link.url} target="_blank" rel="noopener noreferrer" class="pill">
							{link.label}
						</a>
					{/each}
				</div>
			{/if}

		</div>
	</div>
{/if}
