import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, Effect, BlendFunction } from 'postprocessing';
import { ASCII_COLOR } from './constants.js';

const FRAGMENT = /* glsl */`
uniform sampler2D uCharacters;
uniform float uCellSize;
uniform float uCharactersCount;
uniform vec3 uColor;
uniform vec2 sphereCenter;
uniform float sphereRadius;
uniform mat4 viewToSphereObject;
uniform vec3 sphereCenterView;

float hash3(vec3 p) {
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}

float noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i), hash3(i+vec3(1,0,0)), f.x),
        mix(hash3(i+vec3(0,1,0)), hash3(i+vec3(1,1,0)), f.x), f.y),
    mix(mix(hash3(i+vec3(0,0,1)), hash3(i+vec3(1,0,1)), f.x),
        mix(hash3(i+vec3(0,1,1)), hash3(i+vec3(1,1,1)), f.x), f.y),
    f.z
  );
}

// FBM for more natural continent shapes
float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise3(p);
    p = p * 2.1 + vec3(1.7, 9.2, 3.4);
    a *= 0.5;
  }
  return v;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 cellCount = resolution.xy / uCellSize;
  vec2 cellUV = fract(uv * cellCount);
  vec2 cellCenter = (floor(uv * cellCount) + 0.5) / cellCount;

  vec4 scene = texture2D(inputBuffer, cellCenter);
  float luminance = dot(scene.rgb, vec3(0.299, 0.587, 0.114));

  // Reconstruct a view-space ray to find the surface point.
  vec2 ndc = uv * 2.0 - 1.0;
  vec2 sc = sphereCenter * 2.0 - 1.0;
  float sr = sphereRadius * 2.0;
  vec2 localNDC = ndc - sc;
  float distFromCenter = length(localNDC) / sr;

  // Ray in NDC space from camera toward pixel
  // Camera at (0,0,1) in NDC, sphere at sc with radius sr
  // Simple 2D+depth ray: origin=(0,0), dir=normalize(ndc - sphereCenter_ndc, depth)
  // Use sphere screen projection directly for intersection
  // Ray origin in screen-normalized space
  float aspect = resolution.x / resolution.y;

  // Reconstruct view-space ray (FOV=55deg, tan(27.5deg)=0.5206)
  float tanHalfFov = 0.5206;
  vec3 rayOrigin = vec3(0.0); // camera at origin in view space
  vec3 rayDir = normalize(vec3(ndc.x * aspect * tanHalfFov, ndc.y * tanHalfFov, -1.0));

  // Ray-sphere intersection in view space
  vec3 oc = rayOrigin - sphereCenterView;
  float b2 = dot(oc, rayDir);
  float c = dot(oc, oc) - 1.0;
  float disc = b2 * b2 - c;

  vec3 surfacePoint = vec3(0.0);
  float surfaceNoise = 0.5;
  if (disc > 0.0) {
    float t = -b2 - sqrt(disc);
    vec3 hitView = rayOrigin + t * rayDir;
    surfacePoint = (viewToSphereObject * vec4(hitView - sphereCenterView, 0.0)).xyz;
    surfaceNoise = fbm(surfacePoint * 2.5);
  }

  // --- Terrain depth ---
  float terrain = 0.0;
  if (disc > 0.0) {
    // Multi-octave FBM for terrain elevation
    terrain = fbm(surfacePoint * 1.8 + vec3(3.7, 1.2, 5.5));
    // terrain is 0..1, remap to -0.5..0.5
    terrain = terrain - 0.5;
  }

  // Ocean zones: terrain < -0.1 -> suppress luminance (dark water)
  // Land zones:  terrain > 0.1  -> boost luminance (bright landmass)
  // Ridge zones: terrain > 0.35 -> extra boost (mountain highlights)

  // Edge erosion
  float edgeFactor = smoothstep(0.55, 1.0, distFromCenter);
  float erosion = surfaceNoise * 0.9 * edgeFactor;

  // Terrain boost/suppress
  float terrainBoost = 0.0;
  if (disc > 0.0) {
    terrainBoost = smoothstep(-0.1, 0.35, terrain) * 1.2;
    float oceanSuppress = smoothstep(0.0, -0.25, terrain) * 0.9;
    terrainBoost -= oceanSuppress;
  }

  float luma = luminance - erosion + terrainBoost;
  if (luma < 0.12) discard;

  float terrainRampBoost = disc > 0.0 ? smoothstep(0.1, 0.45, terrain) * 0.5 : 0.0;
  float remapped = clamp((luma - 0.05) / (1.0 - 0.05), 0.0, 1.0);
  remapped = clamp(remapped + terrainRampBoost, 0.0, 1.0);
  float charIndex = floor(remapped * (uCharactersCount - 1.0));

  vec2 atlasUV = vec2((charIndex + cellUV.x) / uCharactersCount, cellUV.y);
  float alpha = texture2D(uCharacters, atlasUV).r;
  outputColor = vec4(uColor * alpha, alpha);
}
`;

class ASCIIEffect extends Effect {
	private readonly sphereCenterUniform: THREE.Uniform<THREE.Vector2>;
	private readonly sphereRadiusUniform: THREE.Uniform<number>;

	constructor(characters: string, cellSize: number, color: string) {
		const count = characters.length;
		const atlas = document.createElement('canvas');
		atlas.width = cellSize * count;
		atlas.height = cellSize;
		const ctx = atlas.getContext('2d')!;
		ctx.fillStyle = '#000';
		ctx.fillRect(0, 0, atlas.width, atlas.height);
		ctx.fillStyle = '#fff';
		ctx.font = `bold ${Math.floor(cellSize * 0.85)}px "Courier New", monospace`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		for (let i = 0; i < count; i++) {
			ctx.fillText(characters[i]!, i * cellSize + cellSize / 2, cellSize / 2);
		}

		const texture = new THREE.CanvasTexture(atlas);
		texture.minFilter = THREE.NearestFilter;
		texture.magFilter = THREE.NearestFilter;

		const c = new THREE.Color(color);
		const sphereCenter = new THREE.Uniform(new THREE.Vector2(0.5, 0.5));
		const sphereRadius = new THREE.Uniform(0.38);
		const viewToSphereObject = new THREE.Uniform(new THREE.Matrix4());
		const sphereCenterView = new THREE.Uniform(new THREE.Vector3());

		super('ASCIIEffect', FRAGMENT, {
			blendFunction: BlendFunction.NORMAL,
			uniforms: new Map<string, THREE.Uniform<unknown>>([
				['uCharacters', new THREE.Uniform(texture)],
				['uCellSize', new THREE.Uniform(cellSize)],
				['uCharactersCount', new THREE.Uniform(count)],
				['uColor', new THREE.Uniform(new THREE.Vector3(c.r, c.g, c.b))],
				['sphereCenter', sphereCenter],
				['sphereRadius', sphereRadius],
				['viewToSphereObject', viewToSphereObject],
				['sphereCenterView', sphereCenterView],
			]),
		});

		this.sphereCenterUniform = sphereCenter;
		this.sphereRadiusUniform = sphereRadius;
	}

	setSphereScreenPos(cx: number, cy: number, r: number): void {
		this.sphereCenterUniform.value.set(cx, cy);
		this.sphereRadiusUniform.value = r;
	}

	setWorldState(viewToSphereObject: THREE.Matrix4, sphereCenterView: THREE.Vector3): void {
		this.uniforms.get('viewToSphereObject')!.value.copy(viewToSphereObject);
		this.uniforms.get('sphereCenterView')!.value.copy(sphereCenterView);
	}
}

export function createAsciiRenderer(
	renderer: THREE.WebGLRenderer,
	scene: THREE.Scene,
	camera: THREE.Camera
): { composer: EffectComposer; dispose(): void; setSphereScreenPos(cx: number, cy: number, r: number): void; setWorldState(viewToSphereObject: THREE.Matrix4, sphereCenterView: THREE.Vector3): void } {
	const composer = new EffectComposer(renderer);
	composer.addPass(new RenderPass(scene, camera));
	const effect = new ASCIIEffect(' .,·:;!|=+xo#%&@██', 6, ASCII_COLOR);
	composer.addPass(new EffectPass(camera, effect));

	return {
		composer,
		setSphereScreenPos(cx: number, cy: number, r: number): void {
			effect.setSphereScreenPos(cx, cy, r);
		},
		setWorldState(viewToSphereObject: THREE.Matrix4, sphereCenterView: THREE.Vector3): void {
			effect.setWorldState(viewToSphereObject, sphereCenterView);
		},
		dispose() {
			composer.dispose();
		},
	};
}
