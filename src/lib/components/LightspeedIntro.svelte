<script lang="ts">
	import * as THREE from 'three';
	import type { EffectComposer } from 'postprocessing';
	import { onMount, tick, createEventDispatcher } from 'svelte';
	import { createAsciiRenderer } from '$lib/sphere/ascii.js';
	import { createLightspeedStreaks, type LightspeedStreaks } from '$lib/lightspeed/streaks.js';
	import { viewport } from '$lib/viewport.svelte.js';

	type Phase = 'wake' | 'accelerate' | 'peak' | 'exiting' | 'done';
	type ProgressMode = 'sprint' | 'stall';

	let { progress, visible = true }: { progress: number; visible?: boolean } = $props();

	const dispatch = createEventDispatcher<{ done: void; exit: void }>();

	const WAKE_MS = 800;
	const ACCELERATE_MS = 2500;
	const MIN_PEAK_MS = 5000;
	const PLANET_ZOOM_MS = 800;
	const EXIT_TOTAL_MS = PLANET_ZOOM_MS;
	const WAKE_SPEED = 30;
	const PEAK_SPEED = 480;

	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let phase = $state<Phase>('wake');
	let overlayOpacity = $state(0);
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

	let renderer: THREE.WebGLRenderer | undefined;
	let camera: THREE.PerspectiveCamera | undefined;
	let composer: EffectComposer | undefined;
	let disposeComposer: (() => void) | undefined;
	let streaks: LightspeedStreaks | undefined;
	let disposed = false;

	const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
	const easeOutQuart = (value: number): number => 1 - Math.pow(1 - value, 4);
	const easeOutCubic = (value: number): number => 1 - Math.pow(1 - value, 3);
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
		if (elapsed >= 4500) {
			const finalT = easeOutQuart(clamp01((elapsed - 4500) / 500));
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
		if (phase === 'exiting') return 0;
		return PEAK_SPEED;
	}

	function planetZoomStyle(): string {
		const p = clamp01(exitT / PLANET_ZOOM_MS);
		const eased = easeOutCubic(p);
		const halo = 1 - Math.abs(p - 0.5) / 0.5;
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
			streaks?.setSpeed(0);

			if (exitT >= EXIT_TOTAL_MS) {
				phase = 'done';
				if (!doneEmitted) {
					doneEmitted = true;
					dispatch('done');
				}
			}
			return;
		}

		const accelerateT = clamp01((elapsed - WAKE_MS) / (ACCELERATE_MS - WAKE_MS));
		updateDisplayedProgress(elapsed, deltaMs);

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
				dispatch('exit');
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

		renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: false });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(viewport.vw, viewport.vh);

		const css = getComputedStyle(document.documentElement);
		const bgHex = css.getPropertyValue('--bg').trim() || css.getPropertyValue('--portfolio-bg').trim() || '#080b14';
		renderer.setClearColor(new THREE.Color(bgHex), 1);

		const scene = new THREE.Scene();
		camera = new THREE.PerspectiveCamera(65, viewport.vw / Math.max(1, viewport.vh), 1, 2000);
		camera.position.set(0, 0, 0);

		streaks = createLightspeedStreaks(scene);

		// TEMP DEBUG — remove before commit
		{
			const FAR_SPAWN_Z = -1408; // mirrors streaks.ts's private FAR_SPAWN_Z constant
			const aOffsetAttr = streaks.mesh.geometry.getAttribute('aOffset') as THREE.InstancedBufferAttribute;
			const arr = aOffsetAttr.array as Float32Array;
			const count = aOffsetAttr.count;
			const positiveY: number[] = [];
			const negativeY: number[] = [];
			for (let i = 0; i < count && (positiveY.length < 2 || negativeY.length < 2); i++) {
				const y = arr[i * 3 + 1]!;
				if (y > 0 && positiveY.length < 2) positiveY.push(i);
				if (y < 0 && negativeY.length < 2) negativeY.push(i);
			}
			camera.updateMatrixWorld();
			for (const i of [...positiveY, ...negativeY]) {
				const x = arr[i * 3]!;
				const y = arr[i * 3 + 1]!;
				const v = new THREE.Vector3(x, y, FAR_SPAWN_Z);
				v.project(camera);
				console.log(`[lightspeed debug] instance ${i} raw(x=${x}, y=${y}, z=${FAR_SPAWN_Z}) -> NDC(x=${v.x}, y=${v.y})`);
			}
		}
		// END TEMP DEBUG

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
			streaks?.update(delta);
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
	style:pointer-events={!visible ? 'none' : 'auto'}
	aria-hidden="true"
>
	<canvas bind:this={canvasEl} class="lightspeed-canvas"></canvas>

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
	.lightspeed-intro {
		position: fixed;
		inset: 0;
		z-index: 9999;
		overflow: hidden;
		background: var(--portfolio-bg);
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
