import * as THREE from 'three';
import type { SectionId, HotspotDef, HotspotState, SphereCallbacks, SphereControls } from './types.js';

// ─── Constants ────────────────────────────────────────
export const HOTSPOT_DEFS: HotspotDef[] = [
	{ id: 'about',      lat:  22, lon:   0 },
	{ id: 'skills',     lat:  -8, lon:  72 },
	{ id: 'projects',   lat:  20, lon: 144 },
	{ id: 'experience', lat: -22, lon: 216 },
	{ id: 'contact',    lat:  10, lon: 288 },
];

const SPHERE_R      = 158;
const AUTO_SPEED    = 0.0013;
const SENSITIVITY   = 0.0042;
const INERTIA       = 0.93;
const X_CLAMP       = Math.PI / 3.2;
const DRAG_THRESHOLD = 7; // px — below this on pointerup = click
const ROTATION_LERP = 0.14;
const VELOCITY_EPSILON = 0.00002;
const HOVER_RADIUS_SQ = 52 * 52; // screen-space px²
const MOON_ORBIT_RADIUS = SPHERE_R * 1.7;
const MOON_RADIUS = 14;
const PARTICLE_DRIFT_RADIUS = 3.2;
const PARTICLE_RADIAL_AMPLITUDE = 1.8;
const FLOW_RESPONSE = 172;
const FLOW_DAMPING = 0.92;
const FLOW_MAX = 9.5;
const WAVE_SPEED = 2.35;
const WAVE_WIDTH = 0.28;
const WAVE_AMPLITUDE = 13;
const WAVE_DECAY = 1.75;

// ─── Helpers ──────────────────────────────────────────
function latLonToVec3(lat: number, lon: number, r: number): THREE.Vector3 {
	const phi   = (90 - lat) * (Math.PI / 180);
	const theta = lon         * (Math.PI / 180);
	return new THREE.Vector3(
		-r * Math.sin(phi) * Math.cos(theta),
		 r * Math.cos(phi),
		 r * Math.sin(phi) * Math.sin(theta)
	);
}

function makeCircleTex(size: number): THREE.CanvasTexture {
	const c    = document.createElement('canvas');
	c.width    = size;
	c.height   = size;
	const ctx  = c.getContext('2d')!;
	const half = size * 0.5;
	ctx.beginPath();
	ctx.arc(half, half, half * 0.72, 0, Math.PI * 2);
	ctx.fillStyle = 'white';
	ctx.fill();
	return new THREE.CanvasTexture(c);
}

function makeGlowTex(): THREE.CanvasTexture {
	const c    = document.createElement('canvas');
	c.width    = 128;
	c.height   = 128;
	const ctx  = c.getContext('2d')!;
	ctx.clearRect(0, 0, 128, 128);

	const horizontal = ctx.createLinearGradient(8, 64, 120, 64);
	horizontal.addColorStop(0, 'rgba(255, 123, 53, 0)');
	horizontal.addColorStop(0.18, 'rgba(255, 153, 91, 0.12)');
	horizontal.addColorStop(0.5, 'rgba(255, 208, 166, 0.42)');
	horizontal.addColorStop(0.82, 'rgba(255, 153, 91, 0.12)');
	horizontal.addColorStop(1, 'rgba(255, 123, 53, 0)');
	ctx.fillStyle = horizontal;
	ctx.fillRect(8, 58, 112, 12);

	const vertical = ctx.createLinearGradient(64, 18, 64, 110);
	vertical.addColorStop(0, 'rgba(255, 123, 53, 0)');
	vertical.addColorStop(0.3, 'rgba(255, 185, 130, 0.08)');
	vertical.addColorStop(0.5, 'rgba(255, 232, 205, 0.2)');
	vertical.addColorStop(0.7, 'rgba(255, 185, 130, 0.08)');
	vertical.addColorStop(1, 'rgba(255, 123, 53, 0)');
	ctx.fillStyle = vertical;
	ctx.fillRect(58, 18, 12, 92);

	const ember = ctx.createRadialGradient(64, 64, 0, 64, 64, 24);
	ember.addColorStop(0, 'rgba(255, 245, 232, 0.24)');
	ember.addColorStop(0.45, 'rgba(255, 180, 118, 0.12)');
	ember.addColorStop(1, 'rgba(255, 123, 53, 0)');
	ctx.fillStyle = ember;
	ctx.beginPath();
	ctx.arc(64, 64, 24, 0, Math.PI * 2);
	ctx.fill();

	return new THREE.CanvasTexture(c);
}

function makeStreakTex(): THREE.CanvasTexture {
	const c = document.createElement('canvas');
	c.width = 128;
	c.height = 128;
	const ctx = c.getContext('2d')!;
	const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
	grad.addColorStop(0, 'rgba(255, 245, 232, 1)');
	grad.addColorStop(0.24, 'rgba(255, 182, 112, 0.9)');
	grad.addColorStop(0.5, 'rgba(255, 123, 53, 0.26)');
	grad.addColorStop(1, 'rgba(255, 123, 53, 0)');
	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, 128, 128);
	return new THREE.CanvasTexture(c);
}

function wrapAngle(angle: number): number {
	return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function buildStarField(count: number): THREE.BufferGeometry {
	const pos = new Float32Array(count * 3);
	for (let i = 0; i < count; i++) {
		pos[i * 3]     = (Math.random() - 0.5) * 3600;
		pos[i * 3 + 1] = (Math.random() - 0.5) * 3600;
		pos[i * 3 + 2] = (Math.random() - 0.5) * 3600 - 300;
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
	return geo;
}

function buildParticles(count: number, r: number): THREE.BufferGeometry {
	const pos    = new Float32Array(count * 3);
	const colors = new Float32Array(count * 3);
	const phi    = Math.PI * (3 - Math.sqrt(5)); // golden angle
	const hotspotVectors = HOTSPOT_DEFS.map((def) => latLonToVec3(def.lat, def.lon, 1).normalize());
	const hotspotParticleCount = Math.floor(count * 0.72);
	const baseParticleCount = count - hotspotParticleCount;

	for (let i = 0; i < baseParticleCount; i++) {
		const y   = 1 - (i / Math.max(1, baseParticleCount - 1)) * 2;
		const rad = Math.sqrt(Math.max(0, 1 - y * y));
		const t   = phi * i;
		const rr  = r * (1 + (Math.random() - 0.5) * 0.08);
		const swirl = 1 + Math.sin(i * 0.19) * 0.018;
		const jitterX = (Math.random() - 0.5) * 4.4;
		const jitterY = (Math.random() - 0.5) * 4.4;
		const jitterZ = (Math.random() - 0.5) * 4.4;

		pos[i * 3] = rr * swirl * rad * Math.cos(t) + jitterX;
		pos[i * 3 + 1] = rr * y + jitterY;
		pos[i * 3 + 2] = rr * swirl * rad * Math.sin(t) + jitterZ;

		// Warm white → light orange gradient per particle
		const mix        = Math.random();
		colors[i * 3]     = 0.88 + mix * 0.12;  // R — high
		colors[i * 3 + 1] = 0.65 + mix * 0.18;  // G — medium-warm
		colors[i * 3 + 2] = 0.42 + mix * 0.22;  // B — lower (warm)
	}

	for (let i = 0; i < hotspotParticleCount; i++) {
		const targetIndex = baseParticleCount + i;
		const hotspot = hotspotVectors[i % hotspotVectors.length]!;
		const ref = Math.abs(hotspot.y) < 0.92
			? new THREE.Vector3(0, 1, 0)
			: new THREE.Vector3(1, 0, 0);
		const tangent = hotspot.clone().cross(ref).normalize();
		const bitangent = hotspot.clone().cross(tangent).normalize();
		const spread = Math.pow(Math.random(), 2) * 0.38;
		const angle = Math.random() * Math.PI * 2;
		const tangentOffset = Math.cos(angle) * spread;
		const bitangentOffset = Math.sin(angle) * spread;
		const dir = hotspot.clone()
			.addScaledVector(tangent, tangentOffset)
			.addScaledVector(bitangent, bitangentOffset)
			.normalize();
		const clusterRadius = r * (0.985 + (Math.random() - 0.5) * 0.15);

		pos[targetIndex * 3] = dir.x * clusterRadius;
		pos[targetIndex * 3 + 1] = dir.y * clusterRadius;
		pos[targetIndex * 3 + 2] = dir.z * clusterRadius;

		const mix = 0.72 + Math.random() * 0.28;
		colors[targetIndex * 3] = 0.97 + mix * 0.03;
		colors[targetIndex * 3 + 1] = 0.82 + mix * 0.12;
		colors[targetIndex * 3 + 2] = 0.62 + mix * 0.14;
	}

	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
	geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
	return geo;
}

// ─── Internal hotspot entry ────────────────────────────
interface HotspotEntry {
	id:        SectionId;
	sprite:    THREE.Sprite;
	core:      THREE.Sprite;
	clickMesh: THREE.Mesh;
	worldPos:  THREE.Vector3;
	screenX:   number;
	screenY:   number;
	hoverMix:  number;
}

interface WaveState {
	origin: THREE.Vector3;
	startTime: number;
}

// ─── Main export ──────────────────────────────────────
export function initSphere(
	canvas:    HTMLCanvasElement,
	callbacks: SphereCallbacks
): SphereControls {
	const { onHotspotClick, onFrame, onDragStateChange, onFirstDrag } = callbacks;

	const css = getComputedStyle(document.documentElement);
	const bgHex = css.getPropertyValue('--bg').trim() || '#1c1c1a';
	const clearColor = new THREE.Color(bgHex);

	// ── Renderer ────────────────────────────────────────
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setClearColor(clearColor, 1);

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
	const baseCameraPos = new THREE.Vector3(0, 0, 470);
	const targetCameraPos = baseCameraPos.clone();
	const currentLookAt = new THREE.Vector3();
	const targetLookAt = new THREE.Vector3();

	const sphereGroup = new THREE.Group();
	scene.add(sphereGroup);

	const ambientLight = new THREE.AmbientLight(0xffc79a, 0.22);
	scene.add(ambientLight);

	const keyLight = new THREE.PointLight(0xff8d47, 1.15, 1200, 2);
	keyLight.position.set(280, 120, 360);
	scene.add(keyLight);

	const fillLight = new THREE.PointLight(0xffd9ba, 0.28, 1300, 2);
	fillLight.position.set(-360, -180, 240);
	scene.add(fillLight);

	const moonLight = new THREE.PointLight(0xffd4a6, 1.45, 520, 2);
	scene.add(moonLight);

	// ── Background stars (fixed — not in sphereGroup) ───
	const starMaterial = new THREE.PointsMaterial({
		size: 1.0,
		color: 0xffe8d0,
		transparent: true,
		opacity: 0.2,
		sizeAttenuation: true,
	});
	scene.add(new THREE.Points(
		buildStarField(900),
		starMaterial
	));

	// ── Fibonacci particle sphere ────────────────────────
	const particleCount = window.innerWidth < 768 ? 14000 : 28000;
	const particleGeometry = buildParticles(particleCount, SPHERE_R);
	const particlePositions = particleGeometry.getAttribute('position') as THREE.BufferAttribute;
	const particleColors = particleGeometry.getAttribute('color') as THREE.BufferAttribute;
	const particlePositionArray = particlePositions.array as Float32Array;
	const baseParticleColors = new Float32Array(particleColors.array as ArrayLike<number>);
	const baseParticlePositions = new Float32Array(particlePositionArray);
	const particleNormals = new Float32Array(particleCount * 3);
	const particleTangents = new Float32Array(particleCount * 3);
	const particleBitangents = new Float32Array(particleCount * 3);
	const particlePhases = new Float32Array(particleCount);
	const particleSpeeds = new Float32Array(particleCount);
	const particleAmplitudes = new Float32Array(particleCount);
	const particleTwists = new Float32Array(particleCount);
	const particleClusterWeight = new Float32Array(particleCount);
	const hotspotStartIndex = particleCount - Math.floor(particleCount * 0.72);

	for (let i = 0; i < particleCount; i++) {
		const i3 = i * 3;
		const px = baseParticlePositions[i3] ?? 0;
		const py = baseParticlePositions[i3 + 1] ?? 0;
		const pz = baseParticlePositions[i3 + 2] ?? 0;
		const len = Math.hypot(px, py, pz) || 1;
		const nx = px / len;
		const ny = py / len;
		const nz = pz / len;
		particleNormals[i3] = nx;
		particleNormals[i3 + 1] = ny;
		particleNormals[i3 + 2] = nz;

		const ref = Math.abs(ny) < 0.92
			? new THREE.Vector3(0, 1, 0)
			: new THREE.Vector3(1, 0, 0);
		const tangent = new THREE.Vector3(nx, ny, nz).cross(ref).normalize();
		const bitangent = new THREE.Vector3(nx, ny, nz).cross(tangent).normalize();
		particleTangents[i3] = tangent.x;
		particleTangents[i3 + 1] = tangent.y;
		particleTangents[i3 + 2] = tangent.z;
		particleBitangents[i3] = bitangent.x;
		particleBitangents[i3 + 1] = bitangent.y;
		particleBitangents[i3 + 2] = bitangent.z;

		particlePhases[i] = Math.random() * Math.PI * 2;
		particleSpeeds[i] = 0.55 + Math.random() * 0.75;
		particleAmplitudes[i] = 0.45 + Math.random() * 0.85;
		particleTwists[i] = Math.random() * Math.PI * 2;
		particleClusterWeight[i] = i >= hotspotStartIndex ? 1 : 0;
	}

	const particleMaterial = new THREE.PointsMaterial({
		size:         2.4,
		vertexColors: true,
		transparent:  true,
		opacity:      0.8,
		map:          makeCircleTex(32),
		alphaTest:    0.4,
		sizeAttenuation: true,
		blending:     THREE.AdditiveBlending,
		depthWrite:   false,
	});
	const particlePoints = new THREE.Points(
		particleGeometry,
		particleMaterial
	);
	particlePoints.renderOrder = 1;
	sphereGroup.add(particlePoints);

	const waveSurface = new THREE.Mesh(
		new THREE.SphereGeometry(SPHERE_R, 32, 32),
		new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
	);
	sphereGroup.add(waveSurface);

	const depthOccluder = new THREE.Mesh(
		new THREE.SphereGeometry(SPHERE_R * 0.985, 36, 36),
		new THREE.MeshBasicMaterial({
			colorWrite: false,
			depthWrite: true,
			depthTest: true,
		})
	);
	depthOccluder.renderOrder = 2;
	sphereGroup.add(depthOccluder);

	const streakTex = makeStreakTex();

	const moonMaterial = new THREE.MeshPhongMaterial({
		color: 0xf7ecda,
		emissive: 0xffc687,
		emissiveIntensity: 0.35,
		shininess: 140,
		specular: new THREE.Color(0xfff7eb),
		transparent: true,
		opacity: 0.98,
	});
	const moon = new THREE.Mesh(
		new THREE.SphereGeometry(MOON_RADIUS, 28, 28),
		moonMaterial
	);
	moon.renderOrder = 3;
	scene.add(moon);

	const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({
		map: streakTex,
		color: 0xffd39c,
		transparent: true,
		opacity: 0.42,
		blending: THREE.AdditiveBlending,
		depthTest: true,
		depthWrite: false,
	}));
	moonGlow.scale.set(72, 72, 1);
	moonGlow.renderOrder = 4;
	scene.add(moonGlow);

	// ── Hotspot nodes ────────────────────────────────────
	const glowTex = makeGlowTex();

	const hotspotEntries: HotspotEntry[] = HOTSPOT_DEFS.map(def => {
		const pos = latLonToVec3(def.lat, def.lon, SPHERE_R);

		// Visual glow sprite — always faces the camera
		const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
			map:         glowTex,
			transparent: true,
			opacity:     0.72,
			blending:    THREE.AdditiveBlending,
			depthTest:   true,
			depthWrite:  false,
		}));
		sprite.scale.set(52, 30, 1);
		sprite.position.copy(pos);
		sphereGroup.add(sprite);

		const core = new THREE.Sprite(new THREE.SpriteMaterial({
			map:         streakTex,
			color:       0xfff0dc,
			transparent: true,
			opacity:     0.9,
			blending:    THREE.AdditiveBlending,
			depthTest:   false,
			depthWrite:  false,
		}));
		core.scale.set(12, 12, 1);
		core.position.copy(pos);
		sphereGroup.add(core);

		// Invisible sphere mesh used only for raycasting
		const clickMesh = new THREE.Mesh(
			new THREE.SphereGeometry(22, 10, 10),
			new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
		);
		clickMesh.position.copy(pos);
		(clickMesh.userData as { hotspotId: SectionId }).hotspotId = def.id;
		sphereGroup.add(clickMesh);

		return {
			id: def.id,
			sprite,
			core,
			clickMesh,
			worldPos: new THREE.Vector3(),
			screenX: 0,
			screenY: 0,
			hoverMix: 0,
		};
	});

	const clickMeshes = hotspotEntries.map(h => h.clickMesh);

	// ── Interaction ──────────────────────────────────────
	const mouse     = new THREE.Vector2();
	const raycaster = new THREE.Raycaster();

	let isDragging         = false;
	let isHoveringHotspot  = false;
	let isPanelOpen        = false;
	let activePointerId: number | null = null;
	let prevX = 0, prevY = 0;
	let startX = 0, startY = 0;
	let velX = 0, velY = 0;
	let targetRotX = 0;
	let targetRotY = 0;
	let autoRotate        = true;
	let hintFired         = false;
	let autoRotateTimer: ReturnType<typeof setTimeout> | null = null;
	let waveStates: WaveState[] = [];
	let focusedSectionId: SectionId | null = null;
	let flowVelX = 0;
	let flowVelY = 0;

	function getEventPoint(e: PointerEvent): { clientX: number; clientY: number } {
		return { clientX: e.clientX, clientY: e.clientY };
	}

	function clampRotX(value: number): number {
		return Math.max(-X_CLAMP, Math.min(X_CLAMP, value));
	}

	function scheduleAutoRotate(): void {
		if (autoRotateTimer) clearTimeout(autoRotateTimer);
		autoRotateTimer = setTimeout(() => {
			if (!isPanelOpen) autoRotate = true;
		}, 2200);
	}

	function triggerWave(id: SectionId): void {
		const entry = hotspotEntries.find(h => h.id === id);
		if (!entry) return;
		triggerWaveFromNormal(entry.clickMesh.position.clone().normalize());
	}

	function triggerWaveFromNormal(origin: THREE.Vector3): void {
		waveStates.push({
			origin: origin.normalize(),
			startTime: clock.getElapsedTime(),
		});
		if (waveStates.length > 6) waveStates = waveStates.slice(-6);
	}

	function focusSection(id: SectionId | null): void {
		focusedSectionId = id;
		if (!id) return;
		const entry = hotspotEntries.find(h => h.id === id);
		if (!entry) return;

		const pos = entry.clickMesh.position.clone().normalize();
		let focusRotX = Math.atan2(pos.y, pos.z);
		if (focusRotX > Math.PI / 2) focusRotX -= Math.PI;
		if (focusRotX < -Math.PI / 2) focusRotX += Math.PI;
		focusRotX = clampRotX(focusRotX);

		const zAfterX = pos.y * Math.sin(focusRotX) + pos.z * Math.cos(focusRotX);
		const rawFocusRotY = Math.atan2(-pos.x, zAfterX);
		const focusRotY = targetRotY + wrapAngle(rawFocusRotY - targetRotY);

		targetRotX = focusRotX;
		targetRotY = focusRotY;
	}

	function beginInteraction(clientX: number, clientY: number, pointerId: number): void {
		isDragging = true;
		activePointerId = pointerId;
		prevX = startX = clientX;
		prevY = startY = clientY;
		velX = 0;
		velY = 0;
		autoRotate = false;
		if (autoRotateTimer) {
			clearTimeout(autoRotateTimer);
			autoRotateTimer = null;
		}
		if (!hintFired) {
			hintFired = true;
			onFirstDrag();
		}
		onDragStateChange(true, false);
	}

	function finishInteraction(clientX: number, clientY: number): void {
		const dist = Math.hypot(clientX - startX, clientY - startY);
		isDragging = false;
		activePointerId = null;
		onDragStateChange(false, false);

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
		const pt = getEventPoint(e);
		canvas.setPointerCapture(e.pointerId);
		beginInteraction(pt.clientX, pt.clientY, e.pointerId);
	};

	const onPointerMove = (e: PointerEvent): void => {
		if (isDragging) {
			if (activePointerId !== e.pointerId) return;
			const dx = e.clientX - prevX;
			const dy = e.clientY - prevY;
			const nextVelX = dx * SENSITIVITY;
			const nextVelY = dy * SENSITIVITY;
			velX += (nextVelX - velX) * 0.55;
			velY += (nextVelY - velY) * 0.55;
			targetRotY += velX;
			targetRotX = clampRotX(targetRotX + velY);
			prevX = e.clientX;
			prevY = e.clientY;
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
			isHoveringHotspot = hovering;
			onDragStateChange(false, hovering);
		}
	};

	const onPointerUp = (e: PointerEvent): void => {
		if (!isDragging || activePointerId !== e.pointerId) return;
		finishInteraction(e.clientX, e.clientY);
		if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
	};

	const onPointerCancel = (e: PointerEvent): void => {
		if (!isDragging || activePointerId !== e.pointerId) return;
		isDragging = false;
		activePointerId = null;
		onDragStateChange(false, false);
		scheduleAutoRotate();
		if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
	};

	const onDocLeave = (e: MouseEvent): void => {
		if (e.relatedTarget === null) isHoveringHotspot = false;
	};

	canvas.style.touchAction = 'none';
	canvas.addEventListener('pointerdown',  onPointerDown);
	window.addEventListener('pointermove',  onPointerMove);
	window.addEventListener('pointerup',    onPointerUp);
	window.addEventListener('pointercancel', onPointerCancel);
	document.addEventListener('mouseleave', onDocLeave);

	// ── Animation loop ───────────────────────────────────
	const clock = new THREE.Clock();
	let pulse        = 0;
	let animId       = 0;
	let currentSpeed = AUTO_SPEED;

	targetRotX = sphereGroup.rotation.x;
	targetRotY = sphereGroup.rotation.y;

	function worldToScreen(pos: THREE.Vector3): { x: number; y: number } {
		const v = pos.clone();
		v.project(camera);
		return {
			x: ( v.x * 0.5 + 0.5) * window.innerWidth,
			y: (-v.y * 0.5 + 0.5) * window.innerHeight,
		};
	}

	function animate(): void {
		animId = requestAnimationFrame(animate);
		const dt = clock.getDelta();
		pulse   += dt;

		// Rotation with auto-rotate / inertia
		if (!isDragging && !isPanelOpen) {
			if (autoRotate) {
				const targetSpeed = isHoveringHotspot ? AUTO_SPEED * 0.18 : AUTO_SPEED;
				currentSpeed += (targetSpeed - currentSpeed) * 0.05;
				targetRotY += currentSpeed;
			} else {
				velX *= INERTIA;
				velY *= INERTIA;
				targetRotY += velX;
				targetRotX = clampRotX(targetRotX + velY);
				if (Math.abs(velX) < VELOCITY_EPSILON && Math.abs(velY) < VELOCITY_EPSILON) {
					velX = 0;
					velY = 0;
				}
			}
		}

		flowVelX = THREE.MathUtils.clamp(flowVelX * FLOW_DAMPING + velX * FLOW_RESPONSE, -FLOW_MAX, FLOW_MAX);
		flowVelY = THREE.MathUtils.clamp(flowVelY * FLOW_DAMPING + velY * FLOW_RESPONSE, -FLOW_MAX, FLOW_MAX);

		sphereGroup.rotation.x += (targetRotX - sphereGroup.rotation.x) * ROTATION_LERP;
		sphereGroup.rotation.y += (targetRotY - sphereGroup.rotation.y) * ROTATION_LERP;

		keyLight.position.x = Math.cos(pulse * 0.38) * 320;
		keyLight.position.y = 120 + Math.sin(pulse * 0.42) * 70;
		keyLight.position.z = 290 + Math.cos(pulse * 0.26) * 90;
		fillLight.position.x = -320 + Math.sin(pulse * 0.3) * 80;
		starMaterial.opacity = 0.16 + Math.sin(pulse * 0.45) * 0.03;
		particleMaterial.size = 2.42 + Math.sin(pulse * 1.15) * 0.08;

		const moonAngle = pulse * 0.42;
		const moonHeight = Math.sin(pulse * 0.34) * 42;
		moon.position.set(
			Math.cos(moonAngle) * MOON_ORBIT_RADIUS,
			moonHeight,
			Math.sin(moonAngle) * (MOON_ORBIT_RADIUS * 0.72)
		);
		moonGlow.position.copy(moon.position);
		moonGlow.material.rotation += 0.003;
		const moonScale = 1 + Math.sin(pulse * 1.4) * 0.02;
		moon.scale.setScalar(moonScale);
		moonGlow.scale.setScalar(68 + Math.sin(pulse * 1.7) * 4);
		moonLight.position.copy(moon.position);
		moonLight.intensity = 1.32 + Math.sin(pulse * 0.9) * 0.14;
		moonMaterial.emissiveIntensity = 0.3 + Math.sin(pulse * 1.1) * 0.05;
		moon.visible = true;
		moonGlow.visible = true;
		moonMaterial.opacity = 0.98;
		moonGlow.material.opacity = 0.42;

		const moonLocal = sphereGroup.worldToLocal(moon.position.clone()).normalize();
		const now = clock.getElapsedTime();
		waveStates = waveStates.filter(
			(wave) => now - wave.startTime <= Math.PI / WAVE_SPEED + WAVE_DECAY
		);
		for (let i = 0; i < particleCount; i++) {
			const i3 = i * 3;
			const baseX = baseParticlePositions[i3] ?? 0;
			const baseY = baseParticlePositions[i3 + 1] ?? 0;
			const baseZ = baseParticlePositions[i3 + 2] ?? 0;
			const nx = particleNormals[i3] ?? 0;
			const ny = particleNormals[i3 + 1] ?? 0;
			const nz = particleNormals[i3 + 2] ?? 0;
			const tx = particleTangents[i3] ?? 0;
			const ty = particleTangents[i3 + 1] ?? 0;
			const tz = particleTangents[i3 + 2] ?? 0;
			const bx = particleBitangents[i3] ?? 0;
			const by = particleBitangents[i3 + 1] ?? 0;
			const bz = particleBitangents[i3 + 2] ?? 0;
			const phase = particlePhases[i] ?? 0;
			const speed = particleSpeeds[i] ?? 1;
			const driftAmp = particleAmplitudes[i] ?? 1;
			const twist = particleTwists[i] ?? 0;
			const clusterWeight = particleClusterWeight[i] ?? 0;

			const driftPhase = pulse * speed + phase;
			const radialOffset = Math.sin(driftPhase) * PARTICLE_RADIAL_AMPLITUDE * driftAmp;
			const tangentOffset = Math.cos(driftPhase * 0.9 + twist) * PARTICLE_DRIFT_RADIUS * driftAmp;
			const bitangentOffset = Math.sin(driftPhase * 1.15 - twist) * PARTICLE_DRIFT_RADIUS * 0.72 * driftAmp;

			const flowYx = nz;
			const flowYy = 0;
			const flowYz = -nx;
			const flowXx = 0;
			const flowXy = -nz;
			const flowXz = ny;
			const flowScale = 0.45 + Math.max(0, nz) * 0.58 + clusterWeight * 0.22;
			const cohesion = 1 + clusterWeight * 0.2;
			const waterX = (flowYx * flowVelX + flowXx * flowVelY) * driftAmp * flowScale;
			const waterY = (flowYy * flowVelX + flowXy * flowVelY) * driftAmp * flowScale;
			const waterZ = (flowYz * flowVelX + flowXz * flowVelY) * driftAmp * flowScale;
			const gooPulse = Math.sin(driftPhase * 0.55 + twist) * clusterWeight * 0.4;
			const surfaceClamp = 1 - clusterWeight * 0.86;

			let waveOffset = 0;
			for (const wave of waveStates) {
				const waveAge = now - wave.startTime;
				const waveDot = THREE.MathUtils.clamp(
					nx * wave.origin.x + ny * wave.origin.y + nz * wave.origin.z,
					-1,
					1
				);
				const angularDist = Math.acos(waveDot);
				const waveFront = waveAge * WAVE_SPEED;
				const bandDist = Math.abs(angularDist - waveFront);
				const band = Math.exp(-Math.pow(bandDist / WAVE_WIDTH, 2));
				const tail = Math.exp(-waveAge * WAVE_DECAY);
				waveOffset += band * tail * WAVE_AMPLITUDE;
			}

			particlePositionArray[i3] =
				baseX + nx * ((radialOffset + waveOffset + gooPulse) * surfaceClamp) + tx * (tangentOffset * cohesion) + bx * (bitangentOffset * cohesion) + waterX;
			particlePositionArray[i3 + 1] =
				baseY + ny * ((radialOffset + waveOffset + gooPulse) * surfaceClamp) + ty * (tangentOffset * cohesion) + by * (bitangentOffset * cohesion) + waterY;
			particlePositionArray[i3 + 2] =
				baseZ + nz * ((radialOffset + waveOffset + gooPulse) * surfaceClamp) + tz * (tangentOffset * cohesion) + bz * (bitangentOffset * cohesion) + waterZ;

			const moonDot = Math.max(0, nx * moonLocal.x + ny * moonLocal.y + nz * moonLocal.z);
			// Keep the moonlit region visibly particulate instead of flattening into
			// a broad bright cap. A tighter falloff preserves point separation.
			const moonGlow = Math.pow(moonDot, 2.8);
			const moonSpec = Math.pow(moonDot, 9) * 0.55;
			const waveGlow = waveOffset / WAVE_AMPLITUDE;
			const brightness = 0.34 + moonGlow * 0.9 + moonSpec + waveGlow * 0.62;
			const baseR = baseParticleColors[i3] ?? 0;
			const baseG = baseParticleColors[i3 + 1] ?? 0;
			const baseB = baseParticleColors[i3 + 2] ?? 0;
			particleColors.setXYZ(
				i,
				Math.min(1, baseR * brightness),
				Math.min(1, baseG * brightness),
				Math.min(1, baseB * brightness)
			);
		}
		particlePositions.needsUpdate = true;
		particleColors.needsUpdate = true;

		if (focusedSectionId) {
			const entry = hotspotEntries.find(h => h.id === focusedSectionId);
			if (entry) {
				entry.clickMesh.getWorldPosition(entry.worldPos);
				const dir = entry.worldPos.clone().normalize();
				targetCameraPos.set(
					dir.x * 64,
					dir.y * 56,
					392 - Math.max(0, dir.z) * 26
				);
				targetLookAt.copy(dir.multiplyScalar(28));
			}
		} else {
			targetCameraPos.copy(baseCameraPos);
			targetLookAt.set(0, 0, 0);
		}

		camera.position.lerp(targetCameraPos, 0.085);
		currentLookAt.lerp(targetLookAt, 0.1);
		camera.lookAt(currentLookAt);

		// Build per-frame hotspot states for the UI
		const states: HotspotState[] = hotspotEntries.map((h, i) => {
			h.clickMesh.getWorldPosition(h.worldPos);

			// Camera sits on +Z axis; dot product with (0,0,1) = worldPos.z / SPHERE_R
			const dot     = h.worldPos.z / SPHERE_R;
			const opacity = dot > -0.15
				? THREE.MathUtils.clamp((dot + 0.15) / 0.35, 0, 1)
				: 0;

			// Pulsing scale on sprite
			const sc = worldToScreen(h.worldPos);
			h.screenX = sc.x;
			h.screenY = sc.y;
			const pointerDx = prevX - sc.x;
			const pointerDy = prevY - sc.y;
			const pointerDistSq = pointerDx * pointerDx + pointerDy * pointerDy;
			const targetHoverMix = !isDragging && opacity > 0.18 && pointerDistSq < HOVER_RADIUS_SQ ? 1 : 0;
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
		renderer.render(scene, camera);
	}

	animate();

	// ── Public API ───────────────────────────────────────
	return {
		dispose() {
			cancelAnimationFrame(animId);
			if (autoRotateTimer) clearTimeout(autoRotateTimer);
			canvas.removeEventListener('pointerdown',  onPointerDown);
			window.removeEventListener('pointermove',  onPointerMove);
			window.removeEventListener('pointerup',    onPointerUp);
			window.removeEventListener('pointercancel', onPointerCancel);
			document.removeEventListener('mouseleave', onDocLeave);
			renderer.dispose();
		},
		resize() {
			camera.aspect = window.innerWidth / window.innerHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(window.innerWidth, window.innerHeight);
		},
		setPanelOpen(open: boolean) {
			isPanelOpen = open;
			if (open) {
				autoRotate = false;
				if (autoRotateTimer) { clearTimeout(autoRotateTimer); autoRotateTimer = null; }
			} else {
				autoRotate = true;
			}
		},
		triggerWave,
		focusSection,
	};
}
