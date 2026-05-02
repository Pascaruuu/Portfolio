import * as THREE from 'three';
import type { HotspotState, SphereCallbacks, SphereControls } from '../types.js';
import {
	ACCENT,
	AUTO_SPEED,
	FLOW_DAMPING,
	FLOW_MAX,
	FLOW_RESPONSE,
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
import { createParticleSystem, updateParticles } from './particles.js';

export { HOTSPOT_DEFS } from './constants.js';

export function initSphere(
	canvas:    HTMLCanvasElement,
	callbacks: SphereCallbacks
): SphereControls {
	const { onFrame } = callbacks;

	const css = getComputedStyle(document.documentElement);
	const bgHex = css.getPropertyValue('--bg').trim() || '#1c1c1a';

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
	camera.position.set(0, 0, 470);
	camera.lookAt(0, 0, 0);
	const { composer, dispose: disposeComposer, setSphereScreenPos, setWorldState } = createAsciiRenderer(renderer, scene, camera);
	const baseCameraPos = new THREE.Vector3(0, 0, 470);
	const targetCameraPos = baseCameraPos.clone();
	const currentLookAt = new THREE.Vector3();
	const targetLookAt = new THREE.Vector3();
	const projectedSphereCenter = new THREE.Vector3();
	const projectedSphereEdge = new THREE.Vector3();

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

	// ── Interaction ──────────────────────────────────────
	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const interaction = createInteraction({
		asciiEl: renderer.domElement,
		camera,
		scene,
		sphereGroup,
		hotspotEntries,
		clickMeshes,
		waveSurface: particleSystem.waveSurface,
		callbacks,
		reducedMotion,
	});
	const {
		onPointerDown,
		onPointerMove,
		onPointerUp,
		onPointerCancel,
		triggerWave,
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
		animId = requestAnimationFrame(animate);
		const dt = state.clock.getDelta();
		if (!reducedMotion) pulse += dt;

		// Rotation with auto-rotate / inertia
		if (!state.isDragging && !state.isPanelOpen) {
			if (state.autoRotate) {
				const targetSpeed = AUTO_SPEED;
				state.currentSpeed += (targetSpeed - state.currentSpeed) * 0.05;
				const qAutoY = new THREE.Quaternion().setFromAxisAngle(
					new THREE.Vector3(0, 1, 0), state.currentSpeed
				);
				state.targetQuat.premultiply(qAutoY);
			} else {
				state.velQuat.slerp(new THREE.Quaternion(), 1 - INERTIA);
				if (state.velQuat.w < 0.9999) {
					state.targetQuat.premultiply(state.velQuat);
					clampQuatX(state.targetQuat);
				} else {
					state.velQuat.identity();
				}
			}
		}

		const velEuler = new THREE.Euler().setFromQuaternion(state.velQuat, 'YXZ');
		state.flowVelX = THREE.MathUtils.clamp(state.flowVelX * FLOW_DAMPING + velEuler.y * FLOW_RESPONSE, -FLOW_MAX, FLOW_MAX);
		state.flowVelY = THREE.MathUtils.clamp(state.flowVelY * FLOW_DAMPING + velEuler.x * FLOW_RESPONSE, -FLOW_MAX, FLOW_MAX);

		sphereGroup.quaternion.slerp(state.targetQuat, ROTATION_LERP);

		keyLight.position.x = Math.cos(pulse * 0.38) * 320;
		keyLight.position.y = 120 + Math.sin(pulse * 0.42) * 70;
		keyLight.position.z = 290 + Math.cos(pulse * 0.26) * 90;
		fillLight.position.x = -320 + Math.sin(pulse * 0.3) * 80;
		particleSystem.particleMaterial.size = 3.63 + Math.sin(pulse * 1.15) * 0.12;

		const now = state.clock.getElapsedTime();
		updateParticles({
			pulse,
			flowVelX: state.flowVelX,
			flowVelY: state.flowVelY,
			waveStates: state.waveStates,
			now,
			...particleSystem,
		});

		if (state.focusedSectionId) {
			const entry = hotspotEntries.find(h => h.id === state.focusedSectionId);
			if (entry) {
				entry.clickMesh.getWorldPosition(entry.worldPos);
				const dir = entry.worldPos.clone().normalize();
				targetCameraPos.set(
					dir.x * 64,
					dir.y * 56,
					392 - Math.max(0, dir.z) * 26
				);
				targetLookAt.copy(dir.clone().multiplyScalar(58));
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
		// Extract pure rotation inverse from sphereGroup
		const rotMatrix = new THREE.Matrix4().extractRotation(sphereGroup.matrixWorld);
		const invRotMatrix = rotMatrix.clone().invert();
		// Pass camera distance normalized by SPHERE_R
		const camNorm = camera.position.clone().divideScalar(SPHERE_R);
		setWorldState(invRotMatrix, camNorm);
		if (asciiFrame === 0) {
			// Sample terrain FBM at each hotspot surface point in object space
			// surfacePoint in unit-sphere space = hotspot world pos normalized by SPHERE_R
			// then inverse-rotated by sphereGroup
			const invRot = new THREE.Matrix4().extractRotation(sphereGroup.matrixWorld).invert();
			hotspotEntries.forEach(h => {
				h.clickMesh.getWorldPosition(h.worldPos);
				const unitPos = h.worldPos.clone().divideScalar(SPHERE_R);
				const objPos = unitPos.clone().applyMatrix4(invRot);
				console.log(`[terrain-debug] ${h.id}: objPos=(${objPos.x.toFixed(3)}, ${objPos.y.toFixed(3)}, ${objPos.z.toFixed(3)})`);
			});
		}

		// Build per-frame hotspot states for the UI
		const states: HotspotState[] = hotspotEntries.map((h, i) => {
			h.clickMesh.getWorldPosition(h.worldPos);

			// Camera sits on +Z axis; dot product with (0,0,1) = worldPos.z / SPHERE_R
			const dot     = h.worldPos.z / SPHERE_R;
			const opacity = dot > 0.1
				? THREE.MathUtils.clamp((dot - 0.1) / 0.2, 0, 1)
				: 0;

			// Pulsing scale on sprite
			const sc = worldToScreen(h.worldPos);
			h.screenX = sc.x;
			h.screenY = sc.y;
			const pointerDx = state.prevX - sc.x;
			const pointerDy = state.prevY - sc.y;
			const pointerDistSq = pointerDx * pointerDx + pointerDy * pointerDy;
			const targetHoverMix = !state.isDragging && opacity > 0.18 && pointerDistSq < HOVER_RADIUS_SQ ? 1 : 0;
			h.hoverMix += (targetHoverMix - h.hoverMix) * 0.16;

			const pulseScale = 1 + Math.sin(pulse * 1.8 + i * 1.3) * 0.1;
			const hoverBoost = 1 + h.hoverMix * 0.38;
			const s = 44 * pulseScale * hoverBoost;
			h.sprite.scale.set(s, s, 1);
			h.sprite.material.opacity = opacity * (0.72 + h.hoverMix * 0.28);
			h.core.scale.setScalar(11 + h.hoverMix * 6 + Math.sin(pulse * 2.2 + i) * 0.8);
			h.core.material.opacity = opacity * (0.75 + h.hoverMix * 0.45);

			return { id: h.id, x: sc.x, y: sc.y, opacity };
		});

		onFrame(states);
		asciiFrame++;
		if (asciiFrame % 3 === 0) {
			composer.render();
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
		triggerWave,
		focusSection,
	};
}
