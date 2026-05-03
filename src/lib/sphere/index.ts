import * as THREE from 'three';
import type { HotspotState, SphereCallbacks, SphereControls } from '../types.js';
import {
	ACCENT,
	AUTO_SPEED,
	HOTSPOT_DEFS,
	HOVER_RADIUS_SQ,
	INERTIA,
	ROTATION_LERP,
	SPHERE_R,
} from './constants.js';
import { createAsciiRenderer } from './ascii.js';
import { buildAsciiStars } from './helpers.js';
import { buildHotspots } from './hotspots.js';
import { clampQuatX, createInteraction } from './interaction.js';
import { createParticleSystem } from './particles.js';

export { HOTSPOT_DEFS } from './constants.js';

export function initSphere(
	canvas:    HTMLCanvasElement,
	callbacks: SphereCallbacks
): SphereControls {
	const { onFrame } = callbacks;
	const getCameraProfile = () => {
		const mobile = window.innerWidth < 760;
		const compact = mobile && window.innerHeight < 680;

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
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setClearColor(clearColor, 1);
	const asciiStarsBg = buildAsciiStars(document.body);

	const scene  = new THREE.Scene();
	scene.fog = new THREE.FogExp2(clearColor, 0.00028);
	const camera = new THREE.PerspectiveCamera(
		55,
		window.innerWidth / window.innerHeight,
		0.1,
		4000
	);
	camera.layers.enable(1);
	camera.position.set(0, 0, cameraProfile.baseZ);
	camera.lookAt(0, 0, 0);
	const { composer, dispose: disposeComposer, setSphereScreenPos, setWorldState } = createAsciiRenderer(renderer, scene, camera);
	const baseCameraPos = new THREE.Vector3(0, 0, cameraProfile.baseZ);
	const targetCameraPos = baseCameraPos.clone();
	const currentLookAt = new THREE.Vector3();
	const targetLookAt = new THREE.Vector3();
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

	const sphereGroup = new THREE.Group();
	scene.add(sphereGroup);

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
	const particleCount = window.innerWidth < 768 ? 14000 : 28000;
	const particleSystem = createParticleSystem(sphereGroup, particleCount);

	// ── Hotspot nodes ────────────────────────────────────
	const { hotspotEntries, clickMeshes } = buildHotspots(sphereGroup);
	const hotspotById = new Map(hotspotEntries.map((entry) => [entry.id, entry]));
	callbacks.onProgress?.(0.3);
	callbacks.onProgress?.(0.6);

	// ── Interaction ──────────────────────────────────────
	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const interaction = createInteraction({
		asciiEl: renderer.domElement,
		camera,
		sphereGroup,
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

	function animate(): void {
		if (asciiFrame === 0) {
			callbacks.onProgress?.(1.0);
		}
		animId = requestAnimationFrame(animate);
		const dt = state.clock.getDelta();
		if (!reducedMotion) pulse += dt;

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

		projectedSphereCenter.set(0, 0, 0).project(camera);
		projectedSphereEdge.set(SPHERE_R, 0, 0).project(camera);
		const screenCenterX = (projectedSphereCenter.x * 0.5 + 0.5) * window.innerWidth;
		const screenCenterY = (-projectedSphereCenter.y * 0.5 + 0.5) * window.innerHeight;
		const screenEdgeX = (projectedSphereEdge.x * 0.5 + 0.5) * window.innerWidth;
		const screenEdgeY = (-projectedSphereEdge.y * 0.5 + 0.5) * window.innerHeight;
		const projectedRadius = Math.hypot(screenEdgeX - screenCenterX, screenEdgeY - screenCenterY);
		setSphereScreenPos(
			screenCenterX / window.innerWidth,
			1 - screenCenterY / window.innerHeight,
			projectedRadius / window.innerHeight
		);
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

			// Camera sits on +Z axis; dot product with (0,0,1) = worldPos.z / SPHERE_R
			const dot     = h.worldPos.z / SPHERE_R;
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

		onFrame(states);
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
		},
		resize() {
			cameraProfile = getCameraProfile();
			baseCameraPos.set(0, 0, cameraProfile.baseZ);
			if (!state.focusedSectionId) targetCameraPos.copy(baseCameraPos);
			camera.aspect = window.innerWidth / window.innerHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(window.innerWidth, window.innerHeight);
			composer.setSize(window.innerWidth, window.innerHeight);
		},
		setPanelOpen(open: boolean) {
			state.isPanelOpen = open;
			if (open) {
				state.autoRotate = false;
				if (state.autoRotateTimer) { clearTimeout(state.autoRotateTimer); state.autoRotateTimer = null; }
			} else {
				state.autoRotate = true;
			}
		},
		focusSection,
	};
}
