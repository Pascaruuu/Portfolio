import * as THREE from 'three';
import { HOTSPOT_DEFS } from './constants.js';
import { accentParticleBase, portfolioColors } from '../theme.js';

export function latLonToVec3(lat: number, lon: number, r: number): THREE.Vector3 {
	const phi   = (90 - lat) * (Math.PI / 180);
	const theta = lon         * (Math.PI / 180);
	return new THREE.Vector3(
		-r * Math.sin(phi) * Math.cos(theta),
		 r * Math.cos(phi),
		 r * Math.sin(phi) * Math.sin(theta)
	);
}

export function buildParticles(count: number, r: number): { geometry: THREE.BufferGeometry } {
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

		const mix = Math.random();
		colors[i * 3]     = accentParticleBase.r + mix * 0.06;
		colors[i * 3 + 1] = accentParticleBase.g + mix * 0.04;
		colors[i * 3 + 2] = accentParticleBase.b + mix * 0.04;
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

		// Brighter red for hotspot clusters
		const mix = 0.72 + Math.random() * 0.28;
		colors[targetIndex * 3]     = accentParticleBase.r + mix * 0.06;
		colors[targetIndex * 3 + 1] = accentParticleBase.g + mix * 0.03;
		colors[targetIndex * 3 + 2] = accentParticleBase.b + mix * 0.03;
	}

	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
	geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
	return { geometry: geo };
}

export function buildAsciiStars(container: HTMLElement): HTMLElement {
	const CHARS = ['·', '∗', '×'];
	const COLORS = [
		{ color: portfolioColors.textSoft, weight: 70 },
		{ color: portfolioColors.starMuted, weight: 30 },
	];
	const COUNT = 180;

	const div = document.createElement('div');
	div.style.cssText = 'position:fixed;inset:0;z-index:10;pointer-events:none;overflow:hidden;';
	div.style.maskImage = 'radial-gradient(circle var(--sphere-r) at var(--sphere-x) var(--sphere-y), transparent 100%, black 100%)';
	div.style.webkitMaskImage = div.style.maskImage;
	div.style.setProperty('--sphere-x', '50%');
	div.style.setProperty('--sphere-y', '50%');
	div.style.setProperty('--sphere-r', '0px');

	function pickColor(): string {
		const r = Math.random() * 100;
		let acc = 0;
		for (const { color, weight } of COLORS) {
			acc += weight;
			if (r < acc) return color;
		}
		return COLORS[0]?.color ?? portfolioColors.textSoft;
	}

	for (let i = 0; i < COUNT; i++) {
		const span = document.createElement('span');
		const twinkle = Math.random() < 0.2;
		const duration = 4 + Math.random() * 4;
		const delay = Math.random() * 6;
		const baseOpacity = 0.45 + Math.random() * 0.35;
		// Range scaled up by the same factor the desktop ASCII glyph cell size
		// increased (6 -> 10 CSS px, ~1.67x); was 6-10, now 10-17. This is a
		// separate DOM-based system from the shader ASCII effect -- CSS pixels
		// need no pixel-ratio correction of their own.
		const fontSize = 10 + Math.floor(Math.random() * 8);

		span.textContent = CHARS[Math.floor(Math.random() * CHARS.length)] ?? '*';
		span.style.cssText = [
			'position:absolute',
			`left:${(Math.random() * 100).toFixed(2)}%`,
			`top:${(Math.random() * 100).toFixed(2)}%`,
			`color:${pickColor()}`,
			`opacity:${baseOpacity.toFixed(3)}`,
			`font-size:${fontSize}px`,
			'font-family:"courier new",monospace',
			twinkle
				? `animation:asciiTwinkle ${duration.toFixed(1)}s ${delay.toFixed(1)}s ease-in-out infinite alternate`
				: '',
		].join(';');

		div.appendChild(span);
	}

	if (!document.getElementById('ascii-twinkle-style')) {
		const style = document.createElement('style');
		style.id = 'ascii-twinkle-style';
		style.textContent = '@keyframes asciiTwinkle{from{opacity:var(--star-base,0.1)}to{opacity:0.02}}';
		document.head.appendChild(style);
	}

	container.insertBefore(div, container.firstChild);
	return div;
}
