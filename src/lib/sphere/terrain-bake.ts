import * as THREE from 'three';
import { TERRAIN_NOISE_GLSL } from './terrainNoise.js';

const VERTEX = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAGMENT = /* glsl */`
varying vec2 vUv;

${TERRAIN_NOISE_GLSL}

void main() {
  float lon = vUv.x * 6.283185307179586;
  float lat = (vUv.y - 0.5) * 3.141592653589793;
  vec3 point = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
  float terrain = fbm(point * 1.8 + vec3(3.7, 1.2, 5.5)) - 0.5;
  gl_FragColor = vec4(terrain + 0.5, 0.0, 0.0, 1.0);
}
`;

const BAKE_SIZE = 512;

export interface TerrainMap {
	width: number;
	height: number;
	/** Sample terrain at normalized sphere coords (unit vector). */
	sample(x: number, y: number, z: number): number;
	dispose(): void;
}

export async function bakeTerrainTexture(renderer: THREE.WebGLRenderer): Promise<TerrainMap> {
	const useFloat = renderer.capabilities.isWebGL2;
	const type = useFloat ? THREE.FloatType : THREE.UnsignedByteType;

	const renderTarget = new THREE.WebGLRenderTarget(BAKE_SIZE, BAKE_SIZE, {
		format: THREE.RGBAFormat,
		type,
		depthBuffer: false,
		stencilBuffer: false,
	});

	const scene = new THREE.Scene();
	const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
	const geometry = new THREE.PlaneGeometry(2, 2);
	const material = new THREE.ShaderMaterial({
		vertexShader: VERTEX,
		fragmentShader: FRAGMENT,
	});
	const quad = new THREE.Mesh(geometry, material);
	scene.add(quad);

	const prevTarget = renderer.getRenderTarget();
	renderer.setRenderTarget(renderTarget);
	renderer.render(scene, camera);
	renderer.setRenderTarget(prevTarget);

	const pixels: Float32Array | Uint8Array = type === THREE.FloatType
		? new Float32Array(BAKE_SIZE * BAKE_SIZE * 4)
		: new Uint8Array(BAKE_SIZE * BAKE_SIZE * 4);
	renderer.readRenderTargetPixels(renderTarget, 0, 0, BAKE_SIZE, BAKE_SIZE, pixels);

	scene.remove(quad);
	geometry.dispose();
	material.dispose();
	renderTarget.dispose();

	const width = BAKE_SIZE;
	const height = BAKE_SIZE;

	function sample(x: number, y: number, z: number): number {
		const lon = Math.atan2(z, x);
		const lat = Math.asin(THREE.MathUtils.clamp(y, -1, 1));
		const u = ((lon / (Math.PI * 2)) + 1) % 1;
		const v = lat / Math.PI + 0.5;
		const col = Math.min(Math.floor(u * width),  width  - 1);
		const row = Math.min(Math.floor(v * height), height - 1);
		const idx = (row * width + col) * 4;
		return type === THREE.FloatType
			? (pixels[idx] ?? 0) - 0.5
			: ((pixels[idx] ?? 0) / 255) - 0.5;
	}

	return {
		width,
		height,
		sample,
		// Render target is released immediately above; nothing left to free.
		dispose() {},
	};
}
