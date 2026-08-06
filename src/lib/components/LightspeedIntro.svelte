<script lang="ts">
	import * as THREE from 'three';
	import type { EffectComposer } from 'postprocessing';
	import { onMount, tick } from 'svelte';
	import { createAsciiRenderer } from '$lib/sphere/ascii.js';
	import { createLightspeedStreaks, type LightspeedStreaks } from '$lib/lightspeed/streaks.js';
	import { viewport } from '$lib/viewport.svelte.js';
	import { timeline } from '$lib/timeline.svelte.js';

	type Phase = 'wake' | 'accelerate' | 'peak' | 'exiting' | 'done';
	type ProgressMode = 'sprint' | 'stall';

	let { progress, visible = true, sphereCtl = null }: {
		progress: number;
		visible?: boolean;
		sphereCtl?: {
			setWarpProgress: (p: number) => void;
		} | null;
	} = $props();

	const WAKE_MS = 800;
	const ACCELERATE_MS = 2500;
	const MIN_PEAK_MS = 4000;
	const BAR_FILL_DONE_MS = MIN_PEAK_MS - 1200;  // bar reaches 100% here (2800)
	const BAR_HIDE_MS = MIN_PEAK_MS - 1000;       // bar fully hidden here (3000)
	const BAR_EASE_MS = 500;                      // final ease window duration
	const WARP_MS = 500;          // sphere grows dot→full over this window
	const BG_FADE_MS = 700;       // background clears to transparent over this
	const TOTAL_EXIT_MS = 1400;   // full exit window (unchanged)
	const WAKE_SPEED = 30;
	const PEAK_SPEED = 480;

	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let phase = $state<Phase>('wake');
	let overlayOpacity = $state(0);
	let backgroundOpacity = $state(1);
	let exitT = $state(0);
	let displayedProgress = $state(0);
	let barRetired = $state(false);

	let frameId = 0;
	let startedAt = 0;
	let exitStartedAt = 0;
	let exitEmitted = false;
	let progressMode: ProgressMode = 'sprint';
	let progressSegmentUntil = 0;
	let progressStep = 0;

	let renderer: THREE.WebGLRenderer | undefined;
	let camera: THREE.PerspectiveCamera | undefined;
	let composer: EffectComposer | undefined;
	let disposeComposer: (() => void) | undefined;
	let streaks: LightspeedStreaks | undefined;
	let disposed = false;

	const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
	const easeOutQuart = (value: number): number => 1 - Math.pow(1 - value, 4);
	const randomBetween = (min: number, max: number): number => min + Math.random() * (max - min);

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
		const easeStartMs = BAR_FILL_DONE_MS - BAR_EASE_MS;
		if (elapsed >= easeStartMs) {
			const finalT = easeOutQuart(clamp01((elapsed - easeStartMs) / BAR_EASE_MS));
			displayedProgress = Math.min(1, Math.max(displayedProgress, 0.92 + finalT * 0.08));
			return;
		}

		if (elapsed >= progressSegmentUntil) chooseProgressSegment(elapsed);

		const frameScale = deltaMs / 16.67;
		displayedProgress = Math.min(0.92, displayedProgress + progressStep * frameScale);
	}

	function getStreakSpeed(accelerateT: number): number {
		if (phase === 'wake') return WAKE_SPEED;
		if (phase === 'accelerate') return WAKE_SPEED + (PEAK_SPEED - WAKE_SPEED) * easeOutQuart(accelerateT);
		return PEAK_SPEED;
	}

	function updatePhase(elapsed: number, deltaMs: number): void {
		if (phase === 'done') return;

		if (phase === 'exiting') {
			exitT = performance.now() - exitStartedAt;

			// warp progress: linear 0→1 over WARP_MS, sphere maps to its own curve
			const warpP = clamp01(exitT / WARP_MS);
			sphereCtl?.setWarpProgress(warpP);
			streaks?.setSpeed(PEAK_SPEED * (1 - warpP * warpP * warpP));

			// background fade: clears over BG_FADE_MS
			backgroundOpacity = clamp01(1 - exitT / BG_FADE_MS);

			if (exitT >= TOTAL_EXIT_MS) {
				phase = 'done';
			}
			return;
		}

		const accelerateT = clamp01((elapsed - WAKE_MS) / (ACCELERATE_MS - WAKE_MS));
		updateDisplayedProgress(elapsed, deltaMs);

		if (!barRetired && elapsed >= BAR_HIDE_MS) {
			barRetired = true;
		}

		if (elapsed < WAKE_MS) {
			phase = 'wake';
		} else if (elapsed < ACCELERATE_MS) {
			phase = 'accelerate';
		} else {
			phase = 'peak';
		}

		streaks?.setSpeed(getStreakSpeed(accelerateT));

		if (progress >= 1 && elapsed >= MIN_PEAK_MS) {
			phase = 'exiting';
			if (!exitEmitted) {
				exitEmitted = true;
				timeline.mark('exit', elapsed);
			}
			exitStartedAt = performance.now();
			exitT = 0;
		}
	}

	function disposeAll(): void {
		if (disposed) return;
		disposed = true;
		disposeComposer?.();
		streaks?.dispose();
		renderer?.dispose();
		renderer = undefined;
		camera = undefined;
		composer = undefined;
		disposeComposer = undefined;
		streaks = undefined;
	}

	onMount(() => {
		// This component can mount before +page.svelte's own onMount (which
		// calls viewport.init()) runs, since Svelte mounts children before
		// parent onMount callbacks fire. init() is idempotent, so calling it
		// here too guarantees vw/vh are populated before first render.
		viewport.init();

		if (!canvasEl) return;

		renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(viewport.vw, viewport.vh);

		const css = getComputedStyle(document.documentElement);
		const bgHex = css.getPropertyValue('--bg').trim() || css.getPropertyValue('--portfolio-bg').trim() || '#080b14';
		renderer.setClearColor(new THREE.Color(bgHex), 1);

		const scene = new THREE.Scene();
		camera = new THREE.PerspectiveCamera(65, viewport.vw / Math.max(1, viewport.vh), 1, 2000);
		camera.position.set(0, 0, 0);

		streaks = createLightspeedStreaks(scene);

		const ascii = createAsciiRenderer(renderer, scene, camera, false);
		composer = ascii.composer;
		disposeComposer = ascii.dispose;

		startedAt = performance.now();
		progressSegmentUntil = randomBetween(80, 400);
		progressStep = randomBetween(0.015, 0.04);
		let lastFrame = startedAt;

		const animateFrame = (now: number): void => {
			const elapsed = now - startedAt;
			const delta = now - lastFrame;
			lastFrame = now;

			updatePhase(elapsed, delta);
			timeline.tick(elapsed);
			streaks?.update(delta);
			renderer?.setClearAlpha(backgroundOpacity);
			composer?.render();

			if (phase !== 'done') frameId = requestAnimationFrame(animateFrame);
		};

		tick().then(() => {
			overlayOpacity = 1;
		});
		frameId = requestAnimationFrame(animateFrame);

		return () => {
			cancelAnimationFrame(frameId);
			disposeAll();
		};
	});

	$effect(() => {
		if (!visible) {
			cancelAnimationFrame(frameId);
			disposeAll();
		}
	});

	$effect(() => {
		const vw = viewport.vw;
		const vh = viewport.vh;
		if (!renderer || !composer || !camera) return;
		renderer.setSize(vw, vh);
		composer.setSize(vw, vh);
		camera.aspect = vw / Math.max(1, vh);
		camera.updateProjectionMatrix();
	});
</script>

<div
	class="lightspeed-intro"
	style:opacity={!visible ? 0 : overlayOpacity}
	style:--bg-alpha={backgroundOpacity}
	style:pointer-events={phase === 'done' ? 'none' : 'auto'}
	aria-hidden="true"
>
	<canvas bind:this={canvasEl} class="lightspeed-canvas"></canvas>

	<div class="progress-bar" style:opacity={barRetired || phase === 'exiting' || phase === 'done' ? 0 : 1}>
		<div class="progress-track"></div>
		<div class="progress-fill" style:width="{displayedProgress * 100}%"></div>
		<div class="progress-tip" style:left="{displayedProgress * 100}%">▶</div>
	</div>

</div>

<style>
	.lightspeed-intro {
		position: fixed;
		inset: 0;
		z-index: 9999;
		overflow: hidden;
		background: rgb(var(--portfolio-bg-rgb) / var(--bg-alpha, 1));
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
		pointer-events: auto;
		transition: opacity 0.6s ease;
	}

	.lightspeed-canvas {
		position: absolute;
		inset: 0;
		display: block;
	}

	.progress-bar {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 24px;
		height: 15px;
		font-family: inherit;
		pointer-events: none;
		transition: opacity 0.18s ease;
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

</style>
