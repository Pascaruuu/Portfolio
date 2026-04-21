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
const INERTIA       = 0.935;
const X_CLAMP       = Math.PI / 3.2;
const DRAG_THRESHOLD = 5; // px — below this on mouseup = click

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
	const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
	grad.addColorStop(0,    'rgba(255, 123, 53, 0.95)');
	grad.addColorStop(0.28, 'rgba(255, 123, 53, 0.45)');
	grad.addColorStop(0.65, 'rgba(255, 123, 53, 0.08)');
	grad.addColorStop(1,    'rgba(255, 123, 53, 0)');
	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, 128, 128);
	return new THREE.CanvasTexture(c);
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

	for (let i = 0; i < count; i++) {
		const y   = 1 - (i / (count - 1)) * 2;
		const rad = Math.sqrt(Math.max(0, 1 - y * y));
		const t   = phi * i;
		const rr  = r * (1 + (Math.random() - 0.5) * 0.045);

		pos[i * 3]     = rr * rad * Math.cos(t);
		pos[i * 3 + 1] = rr * y;
		pos[i * 3 + 2] = rr * rad * Math.sin(t);

		// Warm white → light orange gradient per particle
		const mix        = Math.random();
		colors[i * 3]     = 0.88 + mix * 0.12;  // R — high
		colors[i * 3 + 1] = 0.65 + mix * 0.18;  // G — medium-warm
		colors[i * 3 + 2] = 0.42 + mix * 0.22;  // B — lower (warm)
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
	clickMesh: THREE.Mesh;
	worldPos:  THREE.Vector3;
}

// ─── Main export ──────────────────────────────────────
export function initSphere(
	canvas:    HTMLCanvasElement,
	callbacks: SphereCallbacks
): SphereControls {
	const { onHotspotClick, onFrame, onDragStateChange, onFirstDrag } = callbacks;

	// ── Renderer ────────────────────────────────────────
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setClearColor(0x0d0905, 1);

	const scene  = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(
		55,
		window.innerWidth / window.innerHeight,
		0.1,
		4000
	);
	camera.position.set(0, 0, 470);
	camera.lookAt(0, 0, 0);

	const sphereGroup = new THREE.Group();
	scene.add(sphereGroup);

	// ── Background stars (fixed — not in sphereGroup) ───
	scene.add(new THREE.Points(
		buildStarField(900),
		new THREE.PointsMaterial({
			size: 1.0,
			color: 0xffe8d0,
			transparent: true,
			opacity: 0.2,
			sizeAttenuation: true,
		})
	));

	// ── Fibonacci particle sphere ────────────────────────
	const particleCount = window.innerWidth < 768 ? 1600 : 2800;
	sphereGroup.add(new THREE.Points(
		buildParticles(particleCount, SPHERE_R),
		new THREE.PointsMaterial({
			size:         2.4,
			vertexColors: true,
			transparent:  true,
			opacity:      0.65,
			map:          makeCircleTex(32),
			alphaTest:    0.4,
			sizeAttenuation: true,
		})
	));

	// ── Inner glow ───────────────────────────────────────
	sphereGroup.add(new THREE.Mesh(
		new THREE.SphereGeometry(SPHERE_R * 0.94, 32, 32),
		new THREE.MeshBasicMaterial({
			color:       0xff7b35,
			transparent: true,
			opacity:     0.018,
			side:        THREE.BackSide,
		})
	));

	// ── Hotspot nodes ────────────────────────────────────
	const glowTex = makeGlowTex();

	const hotspotEntries: HotspotEntry[] = HOTSPOT_DEFS.map(def => {
		const pos = latLonToVec3(def.lat, def.lon, SPHERE_R);

		// Visual glow sprite — always faces the camera
		const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
			map:         glowTex,
			transparent: true,
			depthTest:   false,
		}));
		sprite.scale.set(44, 44, 1);
		sprite.position.copy(pos);
		sphereGroup.add(sprite);

		// Invisible sphere mesh used only for raycasting
		const clickMesh = new THREE.Mesh(
			new THREE.SphereGeometry(20, 8, 8),
			new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
		);
		clickMesh.position.copy(pos);
		(clickMesh.userData as { hotspotId: SectionId }).hotspotId = def.id;
		sphereGroup.add(clickMesh);

		return { id: def.id, sprite, clickMesh, worldPos: new THREE.Vector3() };
	});

	const clickMeshes = hotspotEntries.map(h => h.clickMesh);

	// ── Interaction ──────────────────────────────────────
	const mouse     = new THREE.Vector2();
	const raycaster = new THREE.Raycaster();
	const HOVER_RADIUS_SQ = 45 * 45; // screen-space px²

	let isDragging         = false;
	let isHoveringHotspot  = false;
	let isPanelOpen        = false;
	let prevX = 0, prevY   = 0;
	let startX = 0, startY = 0;
	let velX = 0, velY    = 0;
	let autoRotate        = true;
	let hintFired         = false;
	let autoRotateTimer: ReturnType<typeof setTimeout> | null = null;

	function getPoint(e: MouseEvent | TouchEvent): { clientX: number; clientY: number } {
		if ('touches' in e)        { const t = e.touches[0];        if (t) return t; }
		if ('changedTouches' in e) { const t = e.changedTouches[0]; if (t) return t; }
		return e as MouseEvent;
	}

	const onMouseDown = (e: MouseEvent): void => {
		const pt = getPoint(e);
		isDragging = true;
		prevX = startX = pt.clientX;
		prevY = startY = pt.clientY;
		velX  = 0; velY = 0;
		autoRotate = false;
		if (autoRotateTimer) { clearTimeout(autoRotateTimer); autoRotateTimer = null; }
		if (!hintFired) { hintFired = true; onFirstDrag(); }
		onDragStateChange(true, false);
	};

	const onTouchStart = (e: TouchEvent): void => {
		const pt = getPoint(e);
		isDragging = true;
		prevX = startX = pt.clientX;
		prevY = startY = pt.clientY;
		velX  = 0; velY = 0;
		autoRotate = false;
		if (autoRotateTimer) { clearTimeout(autoRotateTimer); autoRotateTimer = null; }
		if (!hintFired) { hintFired = true; onFirstDrag(); }
		onDragStateChange(true, false);
	};

	const onMouseMove = (e: MouseEvent): void => {
		if (isDragging) {
			const dx = e.clientX - prevX;
			const dy = e.clientY - prevY;
			velX = dx * SENSITIVITY;
			velY = dy * SENSITIVITY;
			sphereGroup.rotation.y += velX;
			sphereGroup.rotation.x  = Math.max(
				-X_CLAMP, Math.min(X_CLAMP, sphereGroup.rotation.x + velY)
			);
			prevX = e.clientX;
			prevY = e.clientY;
		} else {
			// Screen-space proximity — more reliable than 3D raycasting
			// against a rotating group; worldPos is kept current by animate()
			let hovering = false;
			for (const h of hotspotEntries) {
				const dot = h.worldPos.z / SPHERE_R;
				if (dot < -0.15) continue; // hotspot is on the back face, invisible
				const sc = worldToScreen(h.worldPos);
				const dx = e.clientX - sc.x;
				const dy = e.clientY - sc.y;
				if (dx * dx + dy * dy < HOVER_RADIUS_SQ) { hovering = true; break; }
			}
			isHoveringHotspot = hovering;
			onDragStateChange(false, hovering);
		}
	};

	const onTouchMove = (e: TouchEvent): void => {
		if (!isDragging) return;
		const pt = e.touches[0];
		if (!pt) return;
		const dx = pt.clientX - prevX;
		const dy = pt.clientY - prevY;
		velX = dx * SENSITIVITY;
		velY = dy * SENSITIVITY;
		sphereGroup.rotation.y += velX;
		sphereGroup.rotation.x  = Math.max(
			-X_CLAMP, Math.min(X_CLAMP, sphereGroup.rotation.x + velY)
		);
		prevX = pt.clientX;
		prevY = pt.clientY;
	};

	const onMouseUp = (e: MouseEvent): void => {
		if (!isDragging) return;
		const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
		isDragging  = false;
		onDragStateChange(false, false);

		if (dist < DRAG_THRESHOLD) {
			mouse.x = (e.clientX / window.innerWidth)  *  2 - 1;
			mouse.y = (e.clientY / window.innerHeight) * -2 + 1;
			raycaster.setFromCamera(mouse, camera);
			const hits = raycaster.intersectObjects(clickMeshes);
			const [hit] = hits;
			if (hit) {
				const id = (hit.object.userData as { hotspotId: SectionId }).hotspotId;
				const entry = hotspotEntries.find(h => h.id === id)!;
				entry.clickMesh.getWorldPosition(entry.worldPos);
				const sc = worldToScreen(entry.worldPos);
				onHotspotClick(id, sc.x, sc.y);
			} else {
				callbacks.onBackgroundClick?.();
			}
		}

		autoRotateTimer = setTimeout(() => { if (!isPanelOpen) autoRotate = true; }, 2200);
	};

	const onTouchEnd = (e: TouchEvent): void => {
		if (!isDragging) return;
		const pt = e.changedTouches[0];
		if (!pt) return;
		const dist = Math.hypot(pt.clientX - startX, pt.clientY - startY);
		isDragging  = false;
		onDragStateChange(false, false);

		if (dist < DRAG_THRESHOLD) {
			mouse.x = (pt.clientX / window.innerWidth)  *  2 - 1;
			mouse.y = (pt.clientY / window.innerHeight) * -2 + 1;
			raycaster.setFromCamera(mouse, camera);
			const hits = raycaster.intersectObjects(clickMeshes);
			const [hit] = hits;
			if (hit) {
				const id = (hit.object.userData as { hotspotId: SectionId }).hotspotId;
				const entry = hotspotEntries.find(h => h.id === id)!;
				entry.clickMesh.getWorldPosition(entry.worldPos);
				const sc = worldToScreen(entry.worldPos);
				onHotspotClick(id, sc.x, sc.y);
			} else {
				callbacks.onBackgroundClick?.();
			}
		}

		autoRotateTimer = setTimeout(() => { if (!isPanelOpen) autoRotate = true; }, 2200);
	};

	const onDocLeave = (e: MouseEvent): void => {
		if (e.relatedTarget === null) isHoveringHotspot = false;
	};

	canvas.addEventListener('mousedown',    onMouseDown);
	canvas.addEventListener('mouseup',      onMouseUp);
	window.addEventListener('mousemove',    onMouseMove);
	document.addEventListener('mouseleave', onDocLeave);
	canvas.addEventListener('touchstart',   onTouchStart, { passive: true });
	canvas.addEventListener('touchmove',    onTouchMove,  { passive: true });
	canvas.addEventListener('touchend',     onTouchEnd);

	// ── Animation loop ───────────────────────────────────
	const clock = new THREE.Clock();
	let pulse        = 0;
	let animId       = 0;
	let currentSpeed = AUTO_SPEED;

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
				sphereGroup.rotation.y += currentSpeed;
			} else {
				velX *= INERTIA;
				velY *= INERTIA;
				sphereGroup.rotation.y += velX;
				sphereGroup.rotation.x  = Math.max(
					-X_CLAMP, Math.min(X_CLAMP, sphereGroup.rotation.x + velY)
				);
			}
		}

		// Build per-frame hotspot states for the UI
		const states: HotspotState[] = hotspotEntries.map((h, i) => {
			h.clickMesh.getWorldPosition(h.worldPos);

			// Camera sits on +Z axis; dot product with (0,0,1) = worldPos.z / SPHERE_R
			const dot     = h.worldPos.z / SPHERE_R;
			const opacity = dot > -0.15
				? THREE.MathUtils.clamp((dot + 0.15) / 0.35, 0, 1)
				: 0;

			// Pulsing scale on sprite
			const s = 44 * (1 + Math.sin(pulse * 1.8 + i * 1.3) * 0.1);
			h.sprite.scale.set(s, s, 1);
			h.sprite.material.opacity = opacity * 0.8;

			const sc = worldToScreen(h.worldPos);
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
			canvas.removeEventListener('mousedown',    onMouseDown);
			canvas.removeEventListener('mouseup',      onMouseUp);
			window.removeEventListener('mousemove',    onMouseMove);
			document.removeEventListener('mouseleave', onDocLeave);
			canvas.removeEventListener('touchstart',   onTouchStart);
			canvas.removeEventListener('touchmove',    onTouchMove);
			canvas.removeEventListener('touchend',     onTouchEnd);
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
	};
}
