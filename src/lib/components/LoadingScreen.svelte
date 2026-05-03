<script lang="ts">
	import { createEventDispatcher, onMount, tick } from 'svelte';

	type Phase = 'wake' | 'accelerate' | 'peak' | 'exiting' | 'done';
	type ProgressMode = 'sprint' | 'stall';

	interface TrailPoint {
		x: number;
		y: number;
	}

	interface TrailGlyph {
		char: string;
		opacity: number;
	}

	interface Star {
		id: number;
		x: number;
		y: number;
		z: number;
		pz: number;
		fadeOpacity: number;
		fadeDuration: number;
		history: TrailPoint[];
	}

	let { progress, visible = true }: { progress: number; visible?: boolean } = $props();

	const dispatch = createEventDispatcher<{ done: void; exit: void }>();

	const STAR_COUNT = 80;
	const WAKE_MS = 800;
	const ACCELERATE_MS = 2500;
	const MIN_PEAK_MS = 5000;
	const TRAIL_DECAY_MS = 600;
	const TRAIL_FADE_MS = 150;
	const PLANET_ZOOM_MS = 800;
	const EXIT_TOTAL_MS = PLANET_ZOOM_MS;
	const Z_FAR = 800;
	const FOCAL_LENGTH = 300;
	const STAR_SPREAD = 1.45;
	const TRAIL_LENGTH = 6;
	const TRAIL_GLYPHS: TrailGlyph[] = [
		{ char: '·', opacity: 0.15 },
		{ char: '·', opacity: 0.25 },
		{ char: '∗', opacity: 0.45 },
		{ char: '∗', opacity: 0.65 },
		{ char: '×', opacity: 0.85 },
		{ char: '×', opacity: 1 },
	];
	let stars = $state<Star[]>([]);
	let phase = $state<Phase>('wake');
	let overlayOpacity = $state(0);
	let wakeT = $state(0);
	let accelerateT = $state(0);
	let exitT = $state(0);
	let displayedProgress = $state(0);

	let frameId = 0;
	let startedAt = 0;
	let exitStartedAt = 0;
	let doneEmitted = false;
	let exitEmitted = false;
	let progressMode: ProgressMode = 'sprint';
	let progressSegmentUntil = 0;
	let progressStep = 0;

	const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
	const easeOutQuart = (value: number): number => 1 - Math.pow(1 - value, 4);
	const easeOutCubic = (value: number): number => 1 - Math.pow(1 - value, 3);
	const randomBetween = (min: number, max: number): number => min + Math.random() * (max - min);

	function getViewport(): { width: number; height: number; cx: number; cy: number } {
		const width = window.innerWidth;
		const height = window.innerHeight;

		return {
			width,
			height,
			cx: width / 2,
			cy: height / 2,
		};
	}

	function project(x: number, y: number, z: number): TrailPoint {
		const { cx, cy } = getViewport();
		const safeZ = Math.max(z, 0.001);

		return {
			x: (x / safeZ) * FOCAL_LENGTH + cx,
			y: (y / safeZ) * FOCAL_LENGTH + cy,
		};
	}

	function randomStarXY(): { x: number; y: number } {
		const { width, height } = getViewport();

		return {
			x: randomBetween(-width / 2, width / 2) * STAR_SPREAD,
			y: randomBetween(-height / 2, height / 2) * STAR_SPREAD,
		};
	}

	function makeHistory(point: TrailPoint): TrailPoint[] {
		return Array.from({ length: TRAIL_LENGTH }, () => ({ ...point }));
	}

	function makeStar(id: number, z: number, fadeIn = false): Star {
		const { x, y } = randomStarXY();
		const point = project(x, y, z);

		return {
			id,
			x,
			y,
			z,
			pz: z,
			fadeOpacity: fadeIn ? 0 : 1,
			fadeDuration: randomBetween(400, 700),
			history: makeHistory(point),
		};
	}

	function respawnStar(star: Star): Star {
		return makeStar(star.id, Z_FAR, true);
	}

	function chooseProgressSegment(elapsed: number): void {
		progressMode = progressMode === 'sprint' ? 'stall' : 'sprint';
		progressSegmentUntil = elapsed + (
			progressMode === 'sprint'
				? randomBetween(80, 400)
				: randomBetween(200, 800)
		);
		progressStep = progressMode === 'sprint'
			? randomBetween(0.015, 0.04)
			: (Math.random() > 0.55 ? 0.001 : 0);
	}

	function updateDisplayedProgress(elapsed: number, deltaMs: number): void {
		if (elapsed >= 4500) {
			const finalT = easeOutQuart(clamp01((elapsed - 4500) / 500));
			displayedProgress = Math.min(1, Math.max(displayedProgress, 0.92 + finalT * 0.08));
			return;
		}

		if (elapsed >= progressSegmentUntil) chooseProgressSegment(elapsed);

		const frameScale = deltaMs / 16.67;
		displayedProgress = Math.min(0.92, displayedProgress + progressStep * frameScale);
	}

	function getStarSpeed(): number {
		if (phase === 'wake') return 0.5;
		if (phase === 'accelerate') return 0.5 + (8 - 0.5) * easeOutQuart(accelerateT);
		if (phase === 'exiting') return 0;
		return 8;
	}

	function isTrailPointVisible(point: TrailPoint): boolean {
		const { width, height } = getViewport();
		return point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height;
	}

	function isStarVisible(star: Star): boolean {
		const point = project(star.x, star.y, star.z);
		const { width, height } = getViewport();
		return point.x >= -50 && point.x <= width + 50 && point.y >= -50 && point.y <= height + 50;
	}

	function getTrailGlyph(index: number): TrailGlyph {
		return TRAIL_GLYPHS[index] ?? { char: '×', opacity: 1 };
	}

	function trailPointStyle(star: Star, point: TrailPoint, index: number): string {
		const opacity = getTrailGlyph(index).opacity * star.fadeOpacity * getTrailDecayOpacity(index);
		return `left:${point.x}px;top:${point.y}px;opacity:${opacity};`;
	}

	function getTrailDecayOpacity(index: number): number {
		if (phase !== 'exiting' && phase !== 'done') return 1;
		if (index >= TRAIL_LENGTH - 1) return 1;

		const finalTrailIndex = TRAIL_LENGTH - 2;
		const stagger = finalTrailIndex === 0 ? 0 : (TRAIL_DECAY_MS - TRAIL_FADE_MS) / finalTrailIndex;
		const fadeStart = index * stagger;
		const fadeProgress = clamp01((exitT - fadeStart) / TRAIL_FADE_MS);
		return 1 - fadeProgress;
	}

	function planetZoomStyle(): string {
		const progress = clamp01(exitT / PLANET_ZOOM_MS);
		const eased = easeOutCubic(progress);
		const halo = 1 - Math.abs(progress - 0.5) / 0.5;
		const haloOpacity = Math.max(0, halo) * 0.15;
		const blur = Math.max(0, halo) * 60;
		const spread = Math.max(0, halo) * 20;

		return [
			`width:calc(${(4 * (1 - eased)).toFixed(3)}px + ${(300 * eased).toFixed(3)}vmax)`,
			`height:calc(${(4 * (1 - eased)).toFixed(3)}px + ${(300 * eased).toFixed(3)}vmax)`,
			`box-shadow:0 0 ${blur.toFixed(2)}px ${spread.toFixed(2)}px rgba(var(--portfolio-text-rgb),${haloOpacity.toFixed(3)})`,
		].join(';');
	}

	function updatePhase(elapsed: number, deltaMs: number): void {
		if (phase === 'done') return;

		if (phase === 'exiting') {
			exitT = performance.now() - exitStartedAt;
			overlayOpacity = 1 - easeOutCubic(clamp01(exitT / EXIT_TOTAL_MS));

			if (exitT >= EXIT_TOTAL_MS) {
				phase = 'done';
				if (!doneEmitted) {
					doneEmitted = true;
					dispatch('done');
				}
			}
			return;
		}

		wakeT = clamp01(elapsed / WAKE_MS);
		accelerateT = clamp01((elapsed - WAKE_MS) / (ACCELERATE_MS - WAKE_MS));
		updateDisplayedProgress(elapsed, deltaMs);

		if (elapsed < WAKE_MS) {
			phase = 'wake';
		} else if (elapsed < ACCELERATE_MS) {
			phase = 'accelerate';
		} else {
			phase = 'peak';
		}

		if (progress >= 1 && elapsed >= MIN_PEAK_MS) {
			phase = 'exiting';
			if (!exitEmitted) {
				exitEmitted = true;
				dispatch('exit');
			}
			exitStartedAt = performance.now();
			exitT = 0;
		}
	}

	function advanceStars(deltaMs: number): void {
		if (phase === 'exiting' || phase === 'done') return;

		stars = stars.map((star) => {
			const speed = getStarSpeed();
			const pz = star.z;
			const z = star.z - speed * (deltaMs / 16.67);

			if (z <= 0) {
				return respawnStar(star);
			}

			const previousProjected = project(star.x, star.y, pz);
			const projected = project(star.x, star.y, z);
			const nextHistory = [...star.history.slice(1, TRAIL_LENGTH - 1), previousProjected, projected];
			const nextStar = {
				...star,
				pz,
				z,
				fadeOpacity: Math.min(1, star.fadeOpacity + deltaMs / star.fadeDuration),
				history: nextHistory,
			};

			return nextStar;
		});
	}

	onMount(() => {
		stars = Array.from({ length: STAR_COUNT }, (_, index) => {
			const z = Z_FAR - (index / STAR_COUNT) * (Z_FAR - 1);
			return makeStar(index, z);
		});
		startedAt = performance.now();
		progressSegmentUntil = randomBetween(80, 400);
		progressStep = randomBetween(0.015, 0.04);
		let lastFrame = startedAt;

		const animateFrame = (now: number): void => {
			const elapsed = now - startedAt;
			const delta = now - lastFrame;
			lastFrame = now;

			updatePhase(elapsed, delta);
			advanceStars(delta);

			if (phase !== 'done') frameId = requestAnimationFrame(animateFrame);
		};

		tick().then(() => {
			overlayOpacity = 1;
		});
		frameId = requestAnimationFrame(animateFrame);

		return () => {
			cancelAnimationFrame(frameId);
		};
	});
</script>

<div
	class="loading-screen"
	style:opacity={!visible ? 0 : overlayOpacity}
	style:pointer-events={!visible ? 'none' : 'auto'}
	aria-hidden="true"
>
	<div class="starfield">
		{#each stars as star (star.id)}
			{#if isStarVisible(star)}
				<div class="star">
					{#each star.history as point, index}
						{#if isTrailPointVisible(point)}
							<span class="star-point" style={trailPointStyle(star, point, index)}>
								{getTrailGlyph(index).char}
							</span>
						{/if}
					{/each}
				</div>
			{/if}
		{/each}
	</div>

	<div class="progress-bar">
		<div class="progress-track"></div>
		<div class="progress-fill" style:width="{displayedProgress * 100}%"></div>
		<div class="progress-tip" style:left="{displayedProgress * 100}%">▶</div>
	</div>

	{#if phase === 'exiting' || phase === 'done'}
		<div class="planet-zoom" style={planetZoomStyle()}></div>
	{/if}

</div>

<style>
	.loading-screen {
		position: fixed;
		inset: 0;
		z-index: 9999;
		overflow: hidden;
		background: var(--portfolio-bg);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
		pointer-events: auto;
		transition: opacity 0.6s ease;
	}

	.starfield {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}

	.star {
		display: contents;
	}

	.star-point {
		position: absolute;
		color: var(--portfolio-text-soft);
		font-size: 12px;
		line-height: 1;
		white-space: pre;
		display: block;
		font-family: inherit;
		font-weight: 400;
		letter-spacing: 0;
		text-shadow: 0 0 8px rgba(var(--portfolio-text-rgb), 0.14);
		transform: translate(-50%, -50%);
		will-change: left, top, opacity;
	}

	.progress-bar {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 24px;
		height: 15px;
		font-family: inherit;
		pointer-events: none;
	}

	.progress-track,
	.progress-fill {
		position: absolute;
		left: 0;
		top: 7px;
		height: 1px;
	}

	.progress-track {
		width: 100%;
		background: rgba(var(--portfolio-text-rgb), 0.2);
	}

	.progress-fill {
		background: var(--portfolio-text-soft);
	}

	.progress-tip {
		position: absolute;
		top: 50%;
		color: var(--accent);
		font-size: 12px;
		line-height: 1;
		transform: translate(-50%, -50%);
	}

	.planet-zoom {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: var(--portfolio-bg);
		pointer-events: none;
		transform: translate(-50%, -50%);
	}

</style>
