import * as THREE from 'three';
import type { HotspotState, SphereCallbacks, SphereControls } from '../types.js';
import {
	ACCENT,
	AUTO_SPEED,
	HOVER_RADIUS_SQ,
	INERTIA,
	MOBILE_VERTICAL_SHIFT_RATIO,
	PANEL_SHIFT_RATIO,
	ROTATION_LERP,
	SPHERE_R,
} from './constants.js';
import { createAsciiRenderer } from './ascii.js';
import { buildAsciiStars } from './helpers.js';
import { buildHotspots } from './hotspots.js';
import { clampQuatX, createInteraction } from './interaction.js';
import { createParticleSystem } from './particles.js';
import { bakeTerrainTexture } from './terrain-bake.js';
import { viewport } from '../viewport.svelte.js';
import { prefersReducedMotion } from '../utils/prefersReducedMotion.js';

export { HOTSPOT_DEFS } from './constants.js';

const WARP_SCALE_START = 0.004;

export async function initSphere(
	canvas:    HTMLCanvasElement,
	callbacks: SphereCallbacks
): Promise<SphereControls> {
	const { onFrame } = callbacks;
	const getCameraProfile = () => {
		const mobile = !viewport.isDesktop;
		const compact = mobile && viewport.isCompact;

		return {
			baseZ: compact ? 620 : mobile ? 575 : 470,
			focusZ: compact ? 565 : mobile ? 520 : 392,
			focusX: mobile ? 38 : 64,
			focusY: mobile ? 34 : 56,
			focusPull: mobile ? 12 : 26,
		};
	};
	let cameraProfile = getCameraProfile();

	const css = getComputedStyle(document.documentElement);
	const bgHex = css.getPropertyValue('--bg').trim() || css.getPropertyValue('--portfolio-bg').trim() || '#080b14';

	const clearColor = new THREE.Color(bgHex);

	// ── Renderer ────────────────────────────────────────
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.setSize(viewport.vw, viewport.vh);
	renderer.setClearColor(clearColor, 1);
	const terrainMap = await bakeTerrainTexture(renderer);
	const asciiStarsBg = buildAsciiStars(document.body);

	const scene  = new THREE.Scene();
	scene.fog = new THREE.FogExp2(clearColor, 0.00028);
	const camera = new THREE.PerspectiveCamera(
		55,
		viewport.vw / viewport.vh,
		0.1,
		4000
	);
	camera.layers.enable(1);
	camera.position.set(0, 0, cameraProfile.baseZ);
	camera.lookAt(0, 0, 0);
	const { composer, dispose: disposeComposer, setSphereScreenPos, setSphereScale, setWorldState, setViewOffset } = createAsciiRenderer(renderer, scene, camera, true);
	const baseCameraPos = new THREE.Vector3(0, 0, cameraProfile.baseZ);
	const targetCameraPos = baseCameraPos.clone();
	const currentLookAt = new THREE.Vector3();
	const targetLookAt = new THREE.Vector3();
	let currentViewOffsetX = 0; // pixels, current lerped value
	let targetViewOffsetX  = 0; // pixels, set by setPanelOpen
	let currentViewOffsetY = 0; // pixels, current lerped value
	let targetViewOffsetY  = 0; // pixels, set by setPanelOpen
	const projectedSphereCenter = new THREE.Vector3();
	const projectedSphereEdge = new THREE.Vector3();
	const sphereCenterView = new THREE.Vector3();
	const cameraRotMatrix = new THREE.Matrix4();
	const sphereInvRotMatrix = new THREE.Matrix4();
	const viewToSphereObject = new THREE.Matrix4();
	const autoRotateAxisY = new THREE.Vector3(0, 1, 0);
	const autoRotateQuat = new THREE.Quaternion();
	const identityQuat = new THREE.Quaternion();
	const focusDir = new THREE.Vector3();
	const sphereWorldScale = new THREE.Vector3();

	// Owns the arrival warp scale. A future second object will be a sibling
	// of sphereGroup under this group, so it isn't named sphere-specifically.
	const warpGroup = new THREE.Group();
	warpGroup.scale.setScalar(WARP_SCALE_START);
	scene.add(warpGroup);

	const sphereGroup = new THREE.Group();
	warpGroup.add(sphereGroup);

	const ambientLight = new THREE.AmbientLight(ACCENT, 1.1);
	scene.add(ambientLight);

	const keyLight = new THREE.PointLight(ACCENT, 1.15, 3000, 1);
	keyLight.position.set(280, 120, 360);
	scene.add(keyLight);

	const fillLight = new THREE.PointLight(ACCENT, 0.55, 3000, 1);
	fillLight.position.set(-360, -180, 240);
	scene.add(fillLight);

	const fillLight2 = new THREE.PointLight(ACCENT, 0.45, 2800, 1);
	fillLight2.position.set(-320, -180, 200);
	scene.add(fillLight2);


	// ── Fibonacci particle sphere ────────────────────────
	const particleCount = viewport.isDesktop ? 28000 : 14000;
	const particleSystem = createParticleSystem(sphereGroup, particleCount, terrainMap);

	// ── Hotspot nodes ────────────────────────────────────
	const { hotspotEntries, clickMeshes } = buildHotspots(sphereGroup, terrainMap);
	const hotspotById = new Map(hotspotEntries.map((entry) => [entry.id, entry]));
	callbacks.onProgress?.(0.3);
	callbacks.onProgress?.(0.6);

	// ── Interaction ──────────────────────────────────────
	const reducedMotion = prefersReducedMotion();
	const interaction = createInteraction({
		asciiEl: renderer.domElement,
		camera,
		hotspotEntries,
		hotspotById,
		clickMeshes,
		callbacks,
		reducedMotion,
	});
	const {
		onPointerDown,
		onPointerMove,
		onPointerUp,
		onPointerCancel,
		focusSection,
		worldToScreen,
		state,
	} = interaction;
	sphereGroup.quaternion.copy(state.targetQuat);

	renderer.domElement.addEventListener('pointerdown',  onPointerDown);
	window.addEventListener('pointermove',  onPointerMove);
	window.addEventListener('pointerup',    onPointerUp);
	window.addEventListener('pointercancel', onPointerCancel);

	// ── Animation loop ───────────────────────────────────
	let pulse        = 0;
	let animId       = 0;
	let asciiFrame = 0;

	function setWarpProgress(p: number): void {
		const clamped = THREE.MathUtils.clamp(p, 0, 1);
		if (clamped >= 1) {
			warpGroup.scale.setScalar(1);
			return;
		}
		const scale = WARP_SCALE_START * Math.pow(1 / WARP_SCALE_START, clamped);
		warpGroup.scale.setScalar(scale);
	}

	function animate(): void {
		if (asciiFrame === 0) {
			callbacks.onProgress?.(1.0);
		}
		animId = requestAnimationFrame(animate);
		const dt = state.clock.getDelta();
		if (!reducedMotion) pulse += dt;

		// Lerp camera viewport offset (sphere shift when panel open)
		const lerpSpeed = 1 - Math.pow(0.01, dt);
		currentViewOffsetX += (targetViewOffsetX - currentViewOffsetX) * lerpSpeed;
		currentViewOffsetY += (targetViewOffsetY - currentViewOffsetY) * lerpSpeed;
		const W = renderer.domElement.width  / window.devicePixelRatio;
		const H = renderer.domElement.height / window.devicePixelRatio;
		if (Math.abs(currentViewOffsetX) > 0.5 || targetViewOffsetX !== 0 ||
			Math.abs(currentViewOffsetY) > 0.5 || targetViewOffsetY !== 0) {
			// Sign flip: screen-space Y is down-positive, but GL/NDC-space Y is
			// up-positive. currentViewOffsetY is set (below, and in resize() /
			// setPanelOpen()) using the GL convention -- e.g. a negative value
			// shifts the visible sphere up on mobile to clear the panel. But
			// camera.setViewOffset()'s second offset argument is a screen-space
			// pixel offset (down-positive), so it must be negated here to
			// convert GL-convention to screen-convention. Drop this negation
			// and the view window shifts the wrong way vertically -- e.g. the
			// sphere would slide further under the panel instead of away from
			// it.
			//
			// Two other negations encode this same screen-Y/GL-Y flip: the NDC
			// offset derivation just below (ndcOffsetY), and the mobile
			// vertical view-offset assignments (targetViewOffsetY) in resize()
			// and setPanelOpen().
			camera.setViewOffset(W, H, currentViewOffsetX, -currentViewOffsetY, W, H);
		} else {
			camera.clearViewOffset();
		}

		// Sync ASCII shader ray reconstruction with camera view offset
		const ndcOffsetX = -(currentViewOffsetX / W) * 2.0;
		// screen-Y vs GL-Y flip -- see setViewOffset block above
		const ndcOffsetY = -(currentViewOffsetY / H) * 2.0;
		setViewOffset(ndcOffsetX, ndcOffsetY);

		// Rotation with auto-rotate / inertia
		if (!state.isDragging && !state.isPanelOpen) {
			if (state.autoRotate) {
				const targetSpeed = AUTO_SPEED;
				state.currentSpeed += (targetSpeed - state.currentSpeed) * 0.05;
				autoRotateQuat.setFromAxisAngle(autoRotateAxisY, state.currentSpeed);
				state.targetQuat.premultiply(autoRotateQuat);
			} else {
				state.velQuat.slerp(identityQuat, 1 - INERTIA);
				if (state.velQuat.w < 0.9999) {
					state.targetQuat.premultiply(state.velQuat);
					clampQuatX(state.targetQuat);
				} else {
					state.velQuat.identity();
				}
			}
		}

		sphereGroup.quaternion.slerp(state.targetQuat, ROTATION_LERP);

		keyLight.position.x = Math.cos(pulse * 0.38) * 320;
		keyLight.position.y = 120 + Math.sin(pulse * 0.42) * 70;
		keyLight.position.z = 290 + Math.cos(pulse * 0.26) * 90;
		fillLight.position.x = -320 + Math.sin(pulse * 0.3) * 80;
		particleSystem.particleMaterial.size = 3.63 + Math.sin(pulse * 1.15) * 0.12;
		particleSystem.particleMaterial.uniforms.uTime.value = pulse;

		if (state.focusedSectionId) {
			const entry = hotspotById.get(state.focusedSectionId);
			if (entry) {
				entry.clickMesh.getWorldPosition(entry.worldPos);
				focusDir.copy(entry.worldPos).normalize();
				targetCameraPos.set(
					focusDir.x * cameraProfile.focusX,
					focusDir.y * cameraProfile.focusY,
					cameraProfile.focusZ - Math.max(0, focusDir.z) * cameraProfile.focusPull
				);
				targetLookAt.copy(focusDir).multiplyScalar(58);
			}
		} else {
			targetCameraPos.copy(baseCameraPos);
			targetLookAt.set(0, 0, 0);
		}

		camera.position.lerp(targetCameraPos, 0.085);
		currentLookAt.lerp(targetLookAt, 0.1);
		camera.lookAt(currentLookAt);
		camera.updateMatrixWorld();

		// World scale, not local -- the warp scale now lives on warpGroup
		// (sphereGroup's parent), so sphereGroup's own .scale stays at its
		// default and would silently read wrong here.
		sphereGroup.getWorldScale(sphereWorldScale);
		projectedSphereCenter.set(0, 0, 0).project(camera);
		projectedSphereEdge.set(SPHERE_R * sphereWorldScale.x, 0, 0).project(camera);
		const screenCenterX = (projectedSphereCenter.x * 0.5 + 0.5) * viewport.vw;
		const screenCenterY = (-projectedSphereCenter.y * 0.5 + 0.5) * viewport.vh;
		const screenEdgeX = (projectedSphereEdge.x * 0.5 + 0.5) * viewport.vw;
		const screenEdgeY = (-projectedSphereEdge.y * 0.5 + 0.5) * viewport.vh;
		const projectedRadius = Math.hypot(screenEdgeX - screenCenterX, screenEdgeY - screenCenterY);
		setSphereScreenPos(
			screenCenterX / viewport.vw,
			1 - screenCenterY / viewport.vh,
			projectedRadius / viewport.vh
		);
		setSphereScale(sphereWorldScale.x);
		asciiStarsBg.style.setProperty('--sphere-x', `${screenCenterX}px`);
		asciiStarsBg.style.setProperty('--sphere-y', `${screenCenterY}px`);
		asciiStarsBg.style.setProperty('--sphere-r', `${projectedRadius * 1.05}px`);
		camera.updateMatrixWorld();
		sphereGroup.updateMatrixWorld();
		sphereCenterView.set(0, 0, 0).applyMatrix4(camera.matrixWorldInverse).divideScalar(SPHERE_R);
		cameraRotMatrix.extractRotation(camera.matrixWorld);
		sphereInvRotMatrix.extractRotation(sphereGroup.matrixWorld).invert();
		viewToSphereObject.multiplyMatrices(sphereInvRotMatrix, cameraRotMatrix);
		setWorldState(viewToSphereObject, sphereCenterView);

		// Build per-frame hotspot states for the UI
		const states: HotspotState[] = hotspotEntries.map((h, i) => {
			h.clickMesh.getWorldPosition(h.worldPos);

			// Camera sits on +Z axis; dot product with (0,0,1) = worldPos.z / h.radius
			const dot     = h.worldPos.z / h.radius;
			const opacity = dot > 0.1
				? THREE.MathUtils.clamp((dot - 0.1) / 0.2, 0, 1)
				: 0;

			const sc = worldToScreen(h.worldPos);
			h.screenX = sc.x;
			h.screenY = sc.y;
			const pointerDx = state.prevX - sc.x;
			const pointerDy = state.prevY - sc.y;
			const pointerDistSq = pointerDx * pointerDx + pointerDy * pointerDy;
			const targetHoverMix = !state.isDragging && opacity > 0.18 && pointerDistSq < HOVER_RADIUS_SQ ? 1 : 0;
			h.hoverMix += (targetHoverMix - h.hoverMix) * 0.16;

			h.core.scale.setScalar(11 + h.hoverMix * 6 + Math.sin(pulse * 2.2 + i) * 0.8);
			h.core.material.opacity = opacity * (0.75 + h.hoverMix * 0.45);

			return { id: h.id, x: sc.x, y: sc.y, opacity };
		});

		if (asciiFrame % 2 === 0) {
			onFrame(states);
		}
		asciiFrame++;
		if (asciiFrame % 3 === 0) {
			camera.layers.set(0);
			composer.render();
			camera.layers.set(0);
			camera.layers.enable(1);
			renderer.autoClear = false;
			renderer.render(scene, camera);
			renderer.autoClear = true;
		}
	}

	animate();

	// ── Public API ───────────────────────────────────────
	return {
		dispose() {
			cancelAnimationFrame(animId);
			if (state.autoRotateTimer) clearTimeout(state.autoRotateTimer);
			renderer.domElement.removeEventListener('pointerdown',  onPointerDown);
			window.removeEventListener('pointermove',  onPointerMove);
			window.removeEventListener('pointerup',    onPointerUp);
			window.removeEventListener('pointercancel', onPointerCancel);
			asciiStarsBg.parentElement?.removeChild(asciiStarsBg);
			disposeComposer();
			renderer.dispose();
			terrainMap.dispose();
		},
		resize() {
			cameraProfile = getCameraProfile();
			baseCameraPos.set(0, 0, cameraProfile.baseZ);
			if (!state.focusedSectionId) targetCameraPos.copy(baseCameraPos);
			camera.aspect = viewport.vw / viewport.vh;
			camera.updateProjectionMatrix();
			renderer.setSize(viewport.vw, viewport.vh);
			composer.setSize(viewport.vw, viewport.vh);

			// Re-apply view offset target with updated dimensions; the per-frame
			// lerp in animate() carries current toward it smoothly, same as
			// setPanelOpen() below -- do not snap here.
			const isDesktop = viewport.isDesktop;
			targetViewOffsetX = isDesktop && state.isPanelOpen
				? viewport.vw * PANEL_SHIFT_RATIO
				: 0;
			// screen-Y vs GL-Y flip -- see setViewOffset block in animate()
			targetViewOffsetY = !isDesktop && state.isPanelOpen
				? -viewport.vh * MOBILE_VERTICAL_SHIFT_RATIO
				: 0;
		},
		setPanelOpen(open: boolean) {
			state.isPanelOpen = open;
			if (open) {
				state.autoRotate = false;
				if (state.autoRotateTimer) { clearTimeout(state.autoRotateTimer); state.autoRotateTimer = null; }
			} else {
				state.autoRotate = true;
			}
			if (viewport.isDesktop) {
				targetViewOffsetX = open ? viewport.vw * PANEL_SHIFT_RATIO : 0;
				targetViewOffsetY = 0;
			} else {
				targetViewOffsetX = 0;
				// screen-Y vs GL-Y flip -- see setViewOffset block in animate()
				targetViewOffsetY = open ? -viewport.vh * MOBILE_VERTICAL_SHIFT_RATIO : 0;
			}
		},
		focusSection,
		setWarpProgress,
	};
}
