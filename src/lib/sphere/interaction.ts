import * as THREE from 'three';
import {
	AUTO_SPEED,
	DRAG_THRESHOLD,
	HOVER_RADIUS_SQ,
	SPHERE_R,
	SENSITIVITY,
	X_CLAMP,
} from './constants.js';
import type { HotspotEntry, WaveState } from './types.js';
import type { SectionId, SphereCallbacks } from '../types.js';

export interface InteractionState {
	isDragging: boolean;
	isPanelOpen: boolean;
	prevX: number;
	prevY: number;
	startX: number;
	startY: number;
	targetQuat:  THREE.Quaternion;
	velQuat:     THREE.Quaternion;
	autoRotate: boolean;
	hintFired: boolean;
	autoRotateTimer: ReturnType<typeof setTimeout> | null;
	waveStates: WaveState[];
	focusedSectionId: SectionId | null;
	flowVelX: number;
	flowVelY: number;
	currentSpeed: number;
	clock: THREE.Clock;
}

export function clampQuatX(q: THREE.Quaternion): void {
	const euler = new THREE.Euler().setFromQuaternion(q, 'YXZ');
	euler.x = Math.max(-X_CLAMP, Math.min(X_CLAMP, euler.x));
	q.setFromEuler(euler);
}

export function createInteraction(config: {
	asciiEl: HTMLElement;
	camera: THREE.Camera;
	scene: THREE.Scene;
	sphereGroup: THREE.Group;
	hotspotEntries: HotspotEntry[];
	clickMeshes: THREE.Mesh[];
	waveSurface: THREE.Mesh;
	callbacks: SphereCallbacks;
	reducedMotion: boolean;
}): {
	onPointerDown: (e: PointerEvent) => void;
	onPointerMove: (e: PointerEvent) => void;
	onPointerUp: (e: PointerEvent) => void;
	onPointerCancel: (e: PointerEvent) => void;
	getState: () => InteractionState;
	beginInteraction: (clientX: number, clientY: number, pointerId: number) => void;
	finishInteraction: (clientX: number, clientY: number) => void;
	scheduleAutoRotate: () => void;
	triggerWave: (id: SectionId) => void;
	triggerWaveFromNormal: (origin: THREE.Vector3) => void;
	focusSection: (id: SectionId | null) => void;
	worldToScreen: (pos: THREE.Vector3) => { x: number; y: number };
	state: InteractionState;
} {
	const {
		asciiEl,
		camera,
		sphereGroup,
		hotspotEntries,
		clickMeshes,
		waveSurface,
		callbacks,
		reducedMotion,
	} = config;
	const { onHotspotClick, onDragStateChange, onFirstDrag } = callbacks;
	const mouse     = new THREE.Vector2();
	const raycaster = new THREE.Raycaster();
	let activePointerId: number | null = null;

	const state: InteractionState = {
		isDragging: false,
		isPanelOpen: false,
		prevX: 0,
		prevY: 0,
		startX: 0,
		startY: 0,
		targetQuat: new THREE.Quaternion().setFromEuler(
			new THREE.Euler(0, -Math.PI / 2, 0)
		),
		velQuat: new THREE.Quaternion(),
		autoRotate: !reducedMotion,
		hintFired: false,
		autoRotateTimer: null,
		waveStates: [],
		focusedSectionId: null,
		flowVelX: 0,
		flowVelY: 0,
		currentSpeed: AUTO_SPEED,
		clock: new THREE.Clock(),
	};

	function scheduleAutoRotate(): void {
		if (reducedMotion) return;
		if (state.autoRotateTimer) clearTimeout(state.autoRotateTimer);
		state.autoRotateTimer = setTimeout(() => {
			if (!state.isPanelOpen) state.autoRotate = true;
		}, 2200);
	}

	function triggerWave(id: SectionId): void {
		const entry = hotspotEntries.find(h => h.id === id);
		if (!entry) return;
		triggerWaveFromNormal(entry.clickMesh.position.clone().normalize());
	}

	function triggerWaveFromNormal(origin: THREE.Vector3): void {
		state.waveStates.push({
			origin: origin.normalize(),
			startTime: state.clock.getElapsedTime(),
		});
		if (state.waveStates.length > 6) state.waveStates = state.waveStates.slice(-6);
	}

	function focusSection(id: SectionId | null): void {
		state.focusedSectionId = id;
		if (!id) return;
		const entry = hotspotEntries.find(h => h.id === id);
		if (!entry) return;

		const localDir = entry.clickMesh.position.clone().normalize();
		const worldDir = localDir.clone().applyQuaternion(state.targetQuat);

		const forward        = new THREE.Vector3(0, 0, 1);
		const correctionQuat = new THREE.Quaternion().setFromUnitVectors(worldDir, forward);

		const targetQ = correctionQuat.multiply(state.targetQuat);
		clampQuatX(targetQ);
		state.targetQuat = targetQ;
		state.velQuat.identity();
	}

	function worldToScreen(pos: THREE.Vector3): { x: number; y: number } {
		const v = pos.clone();
		v.project(camera);
		return {
			x: (v.x * 0.5 + 0.5) * window.innerWidth,
			y: (-v.y * 0.5 + 0.5) * window.innerHeight,
		};
	}

	function beginInteraction(clientX: number, clientY: number, pointerId: number): void {
		state.isDragging = true;
		activePointerId = pointerId;
		state.prevX = state.startX = clientX;
		state.prevY = state.startY = clientY;
		state.velQuat.identity();
		state.autoRotate = false;
		if (state.autoRotateTimer) {
			clearTimeout(state.autoRotateTimer);
			state.autoRotateTimer = null;
		}
		if (!state.hintFired) {
			state.hintFired = true;
			onFirstDrag();
		}
		onDragStateChange(true, false);
		asciiEl.style.cursor = 'grabbing';
	}

	function finishInteraction(clientX: number, clientY: number): void {
		const dist = Math.hypot(clientX - state.startX, clientY - state.startY);
		state.isDragging = false;
		activePointerId = null;
		onDragStateChange(false, false);
		asciiEl.style.cursor = 'grab';

		if (dist < DRAG_THRESHOLD) {
			mouse.x = (clientX / window.innerWidth) * 2 - 1;
			mouse.y = (clientY / window.innerHeight) * -2 + 1;
			raycaster.setFromCamera(mouse, camera);
			const hits = raycaster.intersectObjects(clickMeshes);
			const [hit] = hits;
			if (hit) {
				const id = (hit.object.userData as { hotspotId: SectionId }).hotspotId;
				const entry = hotspotEntries.find(h => h.id === id)!;
				triggerWave(id);
				entry.clickMesh.getWorldPosition(entry.worldPos);
				const sc = worldToScreen(entry.worldPos);
				onHotspotClick(id, sc.x, sc.y);
			} else {
				const sphereHits = raycaster.intersectObject(waveSurface);
				const [sphereHit] = sphereHits;
				if (sphereHit) {
					const localPoint = sphereGroup.worldToLocal(sphereHit.point.clone()).normalize();
					triggerWaveFromNormal(localPoint);
				}
				callbacks.onBackgroundClick?.();
			}
		}

		scheduleAutoRotate();
	}

	const onPointerDown = (e: PointerEvent): void => {
		asciiEl.setPointerCapture(e.pointerId);
		beginInteraction(e.clientX, e.clientY, e.pointerId);
	};

	const onPointerMove = (e: PointerEvent): void => {
		if (state.isDragging) {
			if (activePointerId !== e.pointerId) return;
			const sensitivity = SENSITIVITY;
			const dx = e.clientX - state.prevX;
			const dy = e.clientY - state.prevY;

			const qY = new THREE.Quaternion().setFromAxisAngle(
				new THREE.Vector3(0, 1, 0), dx * sensitivity
			);
			const qX = new THREE.Quaternion().setFromAxisAngle(
				new THREE.Vector3(1, 0, 0), dy * sensitivity
			);

			const newVelQuat = qY.multiply(qX);
			state.velQuat.slerp(newVelQuat, 0.55);

			state.targetQuat.premultiply(state.velQuat);
			clampQuatX(state.targetQuat);

			state.prevX = e.clientX;
			state.prevY = e.clientY;
		} else {
			// Screen-space proximity — more reliable than 3D raycasting
			// against a rotating group; worldPos is kept current by animate()
			let hovering = false;
			for (const h of hotspotEntries) {
				const dot = h.worldPos.z / SPHERE_R;
				if (dot < -0.15) continue; // hotspot is on the back face, invisible
				const dx = e.clientX - h.screenX;
				const dy = e.clientY - h.screenY;
				if (dx * dx + dy * dy < HOVER_RADIUS_SQ) { hovering = true; break; }
			}
			onDragStateChange(false, hovering);
			asciiEl.style.cursor = hovering ? 'pointer' : 'grab';
		}
	};

	const onPointerUp = (e: PointerEvent): void => {
		if (!state.isDragging || activePointerId !== e.pointerId) return;
		finishInteraction(e.clientX, e.clientY);
		if (asciiEl.hasPointerCapture(e.pointerId)) asciiEl.releasePointerCapture(e.pointerId);
	};

	const onPointerCancel = (e: PointerEvent): void => {
		if (!state.isDragging || activePointerId !== e.pointerId) return;
		state.isDragging = false;
		activePointerId = null;
		onDragStateChange(false, false);
		asciiEl.style.cursor = 'grab';
		scheduleAutoRotate();
		if (asciiEl.hasPointerCapture(e.pointerId)) asciiEl.releasePointerCapture(e.pointerId);
	};

	function getState(): InteractionState {
		return state;
	}

	return {
		onPointerDown,
		onPointerMove,
		onPointerUp,
		onPointerCancel,
		getState,
		beginInteraction,
		finishInteraction,
		scheduleAutoRotate,
		triggerWave,
		triggerWaveFromNormal,
		focusSection,
		worldToScreen,
		state,
	};
}
