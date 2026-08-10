import * as THREE from 'three';
import { LAND_DUST_MAX_SIZE_CSS, SPHERE_R, TERRAIN_SEA_LEVEL } from './constants.js';
import { buildParticles } from './helpers.js';
import type { TerrainMap } from './terrain-bake.js';

type ParticleShaderMaterial = THREE.ShaderMaterial & {
	size: number;
	uniforms: THREE.ShaderMaterial['uniforms'] & {
		uTime: THREE.IUniform<number>;
		uSize: THREE.IUniform<number>;
	};
};

export interface ParticleSystem {
	particleMaterial: ParticleShaderMaterial;
}

function buildLandBiasedParticles(targetCount: number, r: number, terrainMap: TerrainMap): { geometry: THREE.BufferGeometry; terrainValues: Float32Array } {
	const candidateCount = Math.ceil(targetCount * 3.2);
	const { geometry: candidateGeometry } = buildParticles(candidateCount, SPHERE_R);
	const candidatePositions = candidateGeometry.getAttribute('position') as THREE.BufferAttribute;
	const candidateColors = candidateGeometry.getAttribute('color') as THREE.BufferAttribute;
	const candidatePositionArray = candidatePositions.array as ArrayLike<number>;
	const candidateColorArray = candidateColors.array as ArrayLike<number>;
	const landIndices: number[] = [];

	const candidateTerrainValues = new Float32Array(candidateCount);
	for (let i = 0; i < candidateCount; i++) {
		const nx = (candidatePositionArray[i * 3] ?? 0) / r;
		const ny = (candidatePositionArray[i * 3 + 1] ?? 0) / r;
		const nz = (candidatePositionArray[i * 3 + 2] ?? 0) / r;
		candidateTerrainValues[i] = terrainMap.sample(nx, ny, nz);
	}

	for (let i = 0; i < candidateCount; i++) {
		const terrain = candidateTerrainValues[i] ?? -1;
		if (terrain >= TERRAIN_SEA_LEVEL) {
			landIndices.push(i);
		}
	}

	const selectedIndices = landIndices.slice(0, targetCount);
	if (selectedIndices.length < targetCount) {
		const selectedIndexSet = new Set(selectedIndices);
		const fallbackIndices = Array.from({ length: candidateCount }, (_, i) => i)
			.filter((i) => !selectedIndexSet.has(i))
			.sort((a, b) => (candidateTerrainValues[b] ?? -1) - (candidateTerrainValues[a] ?? -1));
		selectedIndices.push(...fallbackIndices.slice(0, targetCount - selectedIndices.length));
	}

	const selectedCount = selectedIndices.length;
	const positions = new Float32Array(selectedCount * 3);
	const colors = new Float32Array(selectedCount * 3);
	const selectedTerrainValues = new Float32Array(selectedCount);
	for (let i = 0; i < selectedCount; i++) {
		const sourceIndex = selectedIndices[i] ?? 0;
		const sourceI3 = sourceIndex * 3;
		const targetI3 = i * 3;
		positions[targetI3] = candidatePositionArray[sourceI3] ?? 0;
		positions[targetI3 + 1] = candidatePositionArray[sourceI3 + 1] ?? 0;
		positions[targetI3 + 2] = candidatePositionArray[sourceI3 + 2] ?? 0;
		colors[targetI3] = candidateColorArray[sourceI3] ?? 0;
		colors[targetI3 + 1] = candidateColorArray[sourceI3 + 1] ?? 0;
		colors[targetI3 + 2] = candidateColorArray[sourceI3 + 2] ?? 0;
		selectedTerrainValues[i] = Math.max(TERRAIN_SEA_LEVEL, candidateTerrainValues[sourceIndex] ?? TERRAIN_SEA_LEVEL);
	}

	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
	geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
	candidateGeometry.dispose();
	return { geometry, terrainValues: selectedTerrainValues };
}

export function createParticleSystem(
	sphereGroup: THREE.Group,
	particleCount: number,
	terrainMap: TerrainMap,
	pixelRatio: number
): ParticleSystem {
	const { geometry: particleGeometry, terrainValues } = buildLandBiasedParticles(particleCount, SPHERE_R, terrainMap);
	particleGeometry.setAttribute('terrain', new THREE.BufferAttribute(terrainValues, 1));
	const flickerPhases = new Float32Array(particleCount);
	for (let i = 0; i < particleCount; i++) flickerPhases[i] = Math.random() * 6.28;
	particleGeometry.setAttribute('flickerPhase', new THREE.BufferAttribute(flickerPhases, 1));

	const FLICKER_CHARS = ' .,·:;+x';
	const CHAR_COUNT = FLICKER_CHARS.length;
	const CELL = 10;
	const atlas = document.createElement('canvas');
	atlas.width = CELL * CHAR_COUNT;
	atlas.height = CELL;
	const ctx = atlas.getContext('2d')!;
	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, atlas.width, atlas.height);
	ctx.fillStyle = '#fff';
	ctx.font = `bold ${Math.floor(CELL * 0.85)}px "Courier New", monospace`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	for (let i = 0; i < CHAR_COUNT; i++) {
		ctx.fillText(FLICKER_CHARS[i]!, i * CELL + CELL / 2, CELL / 2);
	}
	const charTex = new THREE.CanvasTexture(atlas);
	charTex.minFilter = THREE.NearestFilter;
	charTex.magFilter = THREE.NearestFilter;

	const particleMaterial = new THREE.ShaderMaterial({
		uniforms: {
			uCharacters: { value: charTex },
			uCharCount: { value: CHAR_COUNT },
			uTime: { value: 0 },
			uOpacity: { value: 0.9 },
			uSize: { value: 7.0 },
			uPixelRatio: { value: pixelRatio },
		},
		vertexShader: `
			attribute float terrain;
			attribute vec3 color;
			attribute float flickerPhase;
			uniform float uTime;
			uniform float uCharCount;
			uniform float uSize;
			uniform float uPixelRatio;
			varying vec3 vColor;
			varying float vTerrain;
			varying float vFlicker;

			void main() {
				vColor = color;
				vTerrain = terrain;
				// Flicker: slow phase-offset sine mapped to char index
				vFlicker = mod(floor((sin(uTime * 0.8 + flickerPhase) * 0.5 + 0.5) * float(uCharCount - 1.0) + 0.5), float(uCharCount));
				vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
				float pointSizeCss = min(uSize * (300.0 / -mvPosition.z), ${LAND_DUST_MAX_SIZE_CSS.toFixed(1)});
				gl_PointSize = pointSizeCss * uPixelRatio;
				gl_Position = projectionMatrix * mvPosition;
			}
		`,
		fragmentShader: `
			uniform sampler2D uCharacters;
			uniform float uCharCount;
			uniform float uOpacity;
			varying vec3 vColor;
			varying float vTerrain;
			varying float vFlicker;

			void main() {
				if (vTerrain < ${TERRAIN_SEA_LEVEL.toFixed(2)}) discard;
				float charIndex = vFlicker;
				vec2 atlasUV = vec2((charIndex + gl_PointCoord.x) / uCharCount, gl_PointCoord.y);
				float alpha = texture2D(uCharacters, atlasUV).r;
				if (alpha < 0.2) discard;
				gl_FragColor = vec4(vColor, uOpacity * alpha);
			}
		`,
		transparent: true,
		blending: THREE.NormalBlending,
		depthTest: true,
		depthWrite: false,
	}) as ParticleShaderMaterial;
	Object.defineProperty(particleMaterial, 'size', {
		get() {
			return this.uniforms.uSize.value as number;
		},
		set(value: number) {
			this.uniforms.uSize.value = value;
		},
	});
	const particlePoints = new THREE.Points(
		particleGeometry,
		particleMaterial
	);
	particlePoints.renderOrder = 1;
	particlePoints.layers.set(1);
	sphereGroup.add(particlePoints);

	const depthOccluder = new THREE.Mesh(
		new THREE.SphereGeometry(SPHERE_R * 0.985, 36, 36),
		new THREE.MeshBasicMaterial({
			colorWrite: false,
			depthWrite: true,
			depthTest: true,
		})
	);
	depthOccluder.renderOrder = -1;
	sphereGroup.add(depthOccluder);

	return {
		particleMaterial,
	};
}
