import * as THREE from 'three';
import {
	AUTO_SPEED,
	DRAG_THRESHOLD,
	HOVER_RADIUS_SQ,
	SPHERE_R,
	SENSITIVITY,
	X_CLAMP,
} from './constants.js';
import type { HotspotEntry } from './types.js';
import type { SectionId, SphereCallbacks } from '../types.js';

interface InteractionState {
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
	focusedSectionId: SectionId | null;
	currentSpeed: number;
	clock: THREE.Clock;
}

const clampEulerScratch = new THREE.Euler();

export function clampQuatX(q: THREE.Quaternion): void {
	clampEulerScratch.setFromQuaternion(q, 'YXZ');
	clampEulerScratch.x = Math.max(-X_CLAMP, Math.min(X_CLAMP, clampEulerScratch.x));
	q.setFromEuler(clampEulerScratch);
}

export function createInteraction(config: {
	asciiEl: HTMLElement;
	camera: THREE.Camera;
	sphereGroup: THREE.Group;
	hotspotEntries: HotspotEntry[];
	hotspotById: Map<SectionId, HotspotEntry>;
	clickMeshes: THREE.Mesh[];
	callbacks: SphereCallbacks;
	reducedMotion: boolean;
}): {
	onPointerDown: (e: PointerEvent) => void;
	onPointerMove: (e: PointerEvent) => void;
	onPointerUp: (e: PointerEvent) => void;
	onPointerCancel: (e: PointerEvent) => void;
	focusSection: (id: SectionId | null) => void;
	worldToScreen: (pos: THREE.Vector3) => { x: number; y: number };
	state: InteractionState;
} {
	const {
		asciiEl,
		camera,
		sphereGroup,
		hotspotEntries,
		hotspotById,
		clickMeshes,
		callbacks,
		reducedMotion,
	} = config;
	const { onHotspotClick, onDragStateChange, onFirstDrag } = callbacks;
	const mouse     = new THREE.Vector2();
	const raycaster = new THREE.Raycaster();
	const axisX = new THREE.Vector3(1, 0, 0);
	const axisY = new THREE.Vector3(0, 1, 0);
	const forward = new THREE.Vector3(0, 0, 1);
	const clampEuler = new THREE.Euler();
	const localDir = new THREE.Vector3();
	const worldDir = new THREE.Vector3();
	const correctionQuat = new THREE.Quaternion();
	const dragQuatX = new THREE.Quaternion();
	const dragQuatY = new THREE.Quaternion();
	const dragVelQuat = new THREE.Quaternion();
	const screenProjector = new THREE.Vector3();
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
		focusedSectionId: null,
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

	function clampStateTargetQuat(): void {
		clampEuler.setFromQuaternion(state.targetQuat, 'YXZ');
		clampEuler.x = Math.max(-X_CLAMP, Math.min(X_CLAMP, clampEuler.x));
		state.targetQuat.setFromEuler(clampEuler);
	}

	function focusSection(id: SectionId | null): void {
		state.focusedSectionId = id;
		if (!id) return;
		const entry = hotspotById.get(id);
		if (!entry) return;

		localDir.copy(entry.clickMesh.position).normalize();
		worldDir.copy(localDir).applyQuaternion(state.targetQuat);
		correctionQuat.setFromUnitVectors(worldDir, forward);
		state.targetQuat.premultiply(correctionQuat);
		clampStateTargetQuat();
		state.velQuat.identity();
	}

	function worldToScreen(pos: THREE.Vector3): { x: number; y: number } {
		screenProjector.copy(pos).project(camera);
		return {
			x: (screenProjector.x * 0.5 + 0.5) * window.innerWidth,
			y: (-screenProjector.y * 0.5 + 0.5) * window.innerHeight,
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
				onHotspotClick(id);
			} else {
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

			dragQuatY.setFromAxisAngle(axisY, dx * sensitivity);
			dragQuatX.setFromAxisAngle(axisX, dy * sensitivity);
			dragVelQuat.copy(dragQuatY).multiply(dragQuatX);
			state.velQuat.slerp(dragVelQuat, 0.55);

			state.targetQuat.premultiply(state.velQuat);
			clampStateTargetQuat();

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

	return {
		onPointerDown,
		onPointerMove,
		onPointerUp,
		onPointerCancel,
		focusSection,
		worldToScreen,
		state,
	};
}
