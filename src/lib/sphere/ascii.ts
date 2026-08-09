import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, Effect, BlendFunction } from 'postprocessing';
import {
	ASCII_CELL_SIZE_DESKTOP,
	ASCII_CELL_SIZE_MOBILE,
	ASCII_CHARS,
	ASCII_COLOR,
	ASCII_LAND_END_INDEX,
	ASCII_LAND_START_INDEX,
	ASCII_OCEAN_END_INDEX,
	ASCII_OCEAN_START_INDEX,
	TERRAIN_SEA_LEVEL,
} from './constants.js';
import { viewport } from '../viewport.svelte.js';

const FRAGMENT = /* glsl */`
uniform sampler2D uCharacters;
uniform float uCellSize;
uniform float uCharactersCount;
uniform vec3 uColor;
uniform mat4 viewToSphereObject;
uniform vec3 sphereCenterView;
uniform vec2 uViewOffset; // NDC-space offset from camera.setViewOffset
uniform bool uSphereEnabled;
uniform float uSphereScale;

const float OCEAN_SEA_LEVEL = ${TERRAIN_SEA_LEVEL.toFixed(2)}; // interpolated from constants.ts TERRAIN_SEA_LEVEL, the single source shared with particles.ts
const float OCEAN_ALPHA_MULTIPLIER = 0.35; // dim enough to read as background texture, not compete visually with landmass glyphs
const float OCEAN_GLYPH_FLOOR_INDEX = ${ASCII_OCEAN_START_INDEX.toFixed(1)}; // derived from ASCII_OCEAN_START_INDEX in constants.ts; sparsest ocean glyph, used for deep water
const float OCEAN_GLYPH_CEILING_INDEX = ${ASCII_OCEAN_END_INDEX.toFixed(1)}; // derived from ASCII_OCEAN_END_INDEX in constants.ts; densest ocean glyph, used at the coastline
const float OCEAN_DEPTH_FLOOR = 0.04; // measured (500k-sample fbm survey): ~p25 of ocean depth-below-sea-level; beyond this depth most open ocean already bottoms out at the sparsest glyph
const float LAND_GLYPH_FLOOR_INDEX = ${ASCII_LAND_START_INDEX.toFixed(1)}; // derived from ASCII_LAND_START_INDEX in constants.ts (land segment start)
const float LAND_GLYPH_CEILING_INDEX = ${ASCII_LAND_END_INDEX.toFixed(1)}; // derived from ASCII_LAND_END_INDEX in constants.ts (land segment end); land can never select an ocean-segment index
const float LAND_SEGMENT_WIDTH = LAND_GLYPH_CEILING_INDEX - LAND_GLYPH_FLOOR_INDEX; // land index range, used to scale erosion into glyph-index steps
const float LAND_ELEVATION_CEILING = 0.18; // measured (500k-sample fbm survey): ~p95 of land elevation above sea level; rare highest ridges saturate here so the rest of land spreads across the full segment
const float RIM_ONSET_NV = 0.30; // N·V where the rim band begins; chosen to match the removed discard threshold below, so erosion's fade spans exactly the band that used to render nothing

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

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 cellCount = resolution.xy / uCellSize;
  vec2 cell = floor(uv * cellCount);
  vec2 cellUV = fract(uv * cellCount);
  vec2 cellCenter = (cell + 0.5) / cellCount;

  // 3x3 box average over the cell (9 fixed taps at cell thirds) instead of one centre texel, so a feature narrower than a cell contributes proportional coverage instead of an all-or-nothing hit.
  float luminance = 0.0;
  for (int sx = 0; sx < 3; sx++) {
    for (int sy = 0; sy < 3; sy++) {
      vec2 tapUV = (cell + (vec2(float(sx), float(sy)) + 0.5) / 3.0) / cellCount; // evenly spaced taps, not the pixel's own uv, matching the existing cell-centre sampling convention
      luminance += dot(texture2D(inputBuffer, tapUV).rgb, vec3(0.299, 0.587, 0.114));
    }
  }
  luminance /= 9.0; // normalize the sum back to a 0..1 luminance

  float luma = luminance;
  bool sphereHit = false; // true only when the reconstructed ray actually intersects the sphere; reused below instead of a second intersection test
  float terrain = 0.0; // hoisted out of the uSphereEnabled block so the ocean/land branches below can read it
  float nv = 0.0; // hoisted N·V (surface normal dot view direction) so the rim discard below can reuse the same geometric measure edgeFactor derives from
  float edgeFactor = 0.0; // hoisted so land's erosion scaling below can reuse it
  float erosion = 0.0; // hoisted so land's glyph-index reduction below can reuse it

  if (uSphereEnabled) {
    // Reconstruct a view-space ray from the cell centre, not the fragment, so every downstream decision is evaluated once per cell
    vec2 ndc = cellCenter * 2.0 - 1.0 - uViewOffset;
    float aspect = resolution.x / resolution.y;

    // Reconstruct view-space ray (FOV=55deg, tan(27.5deg)=0.5206)
    float tanHalfFov = 0.5206;
    vec3 rayOrigin = vec3(0.0); // camera at origin in view space
    vec3 rayDir = normalize(vec3(ndc.x * aspect * tanHalfFov, ndc.y * tanHalfFov, -1.0));

    // Ray-sphere intersection in view space
    vec3 oc = rayOrigin - sphereCenterView;
    float b2 = dot(oc, rayDir);
    float c = dot(oc, oc) - uSphereScale * uSphereScale;
    float disc = b2 * b2 - c;
    sphereHit = disc > 0.0; // capture the ray-hit result once for reuse outside this block

    vec3 surfacePoint = vec3(0.0);
    float surfaceNoise = 0.5;
    if (disc > 0.0) {
      float t = -b2 - sqrt(disc);
      vec3 hitView = rayOrigin + t * rayDir;
      vec3 viewNormal = normalize(hitView - sphereCenterView); // outward surface normal in view space at the hit point
      nv = dot(viewNormal, -rayDir); // N·V: 1 facing the camera, 0 at the limb -- replaces the aspect-distorted distFromCenter as the rim measure
      surfacePoint = (viewToSphereObject * vec4(hitView - sphereCenterView, 0.0)).xyz;
      surfaceNoise = fbm(surfacePoint * 2.5);
    }

    // --- Terrain depth ---
    if (disc > 0.0) {
      // Multi-octave FBM for terrain elevation
      terrain = fbm(surfacePoint * 1.8 + vec3(3.7, 1.2, 5.5));
      // terrain is 0..1, remap to -0.5..0.5
      terrain = terrain - 0.5;
    }

    // Edge erosion: now driven by N·V (surface geometry) instead of screen-space distance, so the rim band follows the sphere's true round silhouette regardless of viewport aspect
    edgeFactor = smoothstep(RIM_ONSET_NV, 0.0, nv); // reversed edges (same pattern used elsewhere in this file): 0 near the camera-facing pole, 1 at the true limb
    erosion = surfaceNoise * 0.9 * edgeFactor;

    luma = luminance - erosion; // luma now only feeds the background discard below; ocean and land glyph selection read terrain/depth directly instead
  }

  bool isOcean = sphereHit && terrain < OCEAN_SEA_LEVEL; // below-sea-level cells on the sphere bypass the luma ramp/discard; land and background paths are untouched

  if (!sphereHit && luma < 0.12) discard; // background only -- land and ocean always render at least their floor glyph, matching ocean all the way to the silhouette

  float charIndex;
  float alpha;
  vec3 glyphColor = uColor;

  if (!sphereHit) {
    // Background is not ocean: map luminance across the full combined atlas (ocean+land segments), the pre-Phase-8 background behavior, so it keeps responding to scene brightness instead of pinning to one glyph
    float bgT = clamp((luma - 0.05) / 0.95, 0.0, 1.0);
    charIndex = floor(bgT * (uCharactersCount - 1.0));
    vec2 atlasUV = vec2((charIndex + cellUV.x) / uCharactersCount, cellUV.y);
    alpha = texture2D(uCharacters, atlasUV).r; // full glyph alpha -- OCEAN_ALPHA_MULTIPLIER exists to push ocean behind land, which doesn't apply to background
  } else if (isOcean) {
    float oceanDepth = OCEAN_SEA_LEVEL - terrain; // positive depth below sea level; terrain < OCEAN_SEA_LEVEL is guaranteed here since isOcean is true
    float oceanDepthT = clamp(oceanDepth / OCEAN_DEPTH_FLOOR, 0.0, 1.0); // 0 at the coastline, 1 at/beyond the measured depth floor
    charIndex = floor(mix(OCEAN_GLYPH_CEILING_INDEX, OCEAN_GLYPH_FLOOR_INDEX, oceanDepthT)); // shallow water (t=0) selects the densest ocean glyph, deep water (t=1) the sparsest
    vec2 atlasUV = vec2((charIndex + cellUV.x) / uCharactersCount, cellUV.y);
    alpha = texture2D(uCharacters, atlasUV).r * OCEAN_ALPHA_MULTIPLIER; // dimmed uniformly across all four ocean glyphs so ocean reads as texture, not terrain detail
  } else {
    float landElevationT = clamp(terrain / LAND_ELEVATION_CEILING, 0.0, 1.0); // land's index now derives from elevation above sea level, not particle-driven luminance
    charIndex = floor(mix(LAND_GLYPH_FLOOR_INDEX, LAND_GLYPH_CEILING_INDEX, landElevationT)); // land maps into [land segment start, land segment end] only, never into the ocean segment
    float erosionSteps = erosion * LAND_SEGMENT_WIDTH; // scale normalized erosion into land index-steps so rim cells step down toward sparser glyphs
    charIndex = floor(clamp(charIndex - erosionSteps, LAND_GLYPH_FLOOR_INDEX, LAND_GLYPH_CEILING_INDEX)); // re-floor after the continuous erosion subtraction so the atlas lookup stays glyph-aligned
    vec2 atlasUV = vec2((charIndex + cellUV.x) / uCharactersCount, cellUV.y);
    alpha = texture2D(uCharacters, atlasUV).r;
  }

  outputColor = vec4(glyphColor * alpha, alpha);
}
`;

class ASCIIEffect extends Effect {
	constructor(characters: string, cellSize: number, color: string, sphereEnabled: boolean) {
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
		const viewToSphereObject = new THREE.Uniform(new THREE.Matrix4());
		const sphereCenterView = new THREE.Uniform(new THREE.Vector3());

		super('ASCIIEffect', FRAGMENT, {
			blendFunction: BlendFunction.NORMAL,
			uniforms: new Map<string, THREE.Uniform<unknown>>([
				['uCharacters', new THREE.Uniform(texture)],
				['uCellSize', new THREE.Uniform(cellSize)],
				['uCharactersCount', new THREE.Uniform(count)],
				['uColor', new THREE.Uniform(new THREE.Vector3(c.r, c.g, c.b))],
				['viewToSphereObject', viewToSphereObject],
				['sphereCenterView', sphereCenterView],
				['uViewOffset', new THREE.Uniform(new THREE.Vector2(0, 0))],
				['uSphereEnabled', new THREE.Uniform(sphereEnabled)],
				['uSphereScale', new THREE.Uniform(1.0)],
			]),
		});
	}

	setWorldState(viewToSphereObject: THREE.Matrix4, sphereCenterView: THREE.Vector3): void {
		this.uniforms.get('viewToSphereObject')!.value.copy(viewToSphereObject);
		this.uniforms.get('sphereCenterView')!.value.copy(sphereCenterView);
	}

	setViewOffset(ndcX: number, ndcY: number): void {
		this.uniforms.get('uViewOffset')!.value.set(ndcX, ndcY);
	}

	setSphereEnabled(enabled: boolean): void {
		this.uniforms.get('uSphereEnabled')!.value = enabled;
	}

	setSphereScale(s: number): void {
		this.uniforms.get('uSphereScale')!.value = s;
	}
}

export function createAsciiRenderer(
	renderer: THREE.WebGLRenderer,
	scene: THREE.Scene,
	camera: THREE.Camera,
	sphereEnabled: boolean
): { composer: EffectComposer; dispose(): void; setWorldState(viewToSphereObject: THREE.Matrix4, sphereCenterView: THREE.Vector3): void; setViewOffset(ndcX: number, ndcY: number): void; setSphereEnabled(enabled: boolean): void; setSphereScale(s: number): void } {
	const composer = new EffectComposer(renderer);
	composer.addPass(new RenderPass(scene, camera));
	// ASCII_CELL_SIZE_DESKTOP/MOBILE are tuned in CSS pixels; the shader's
	// resolution uniform is in device pixels (renderer.getDrawingBufferSize()),
	// so convert using the renderer's own clamped pixel ratio here -- not a
	// fresh read of window.devicePixelRatio, which could diverge from what
	// the renderer was actually configured with at setPixelRatio() time.
	const cssCellSize = viewport.isDesktop ? ASCII_CELL_SIZE_DESKTOP : ASCII_CELL_SIZE_MOBILE;
	const cellSize = cssCellSize * renderer.getPixelRatio();
	const effect = new ASCIIEffect(ASCII_CHARS, cellSize, ASCII_COLOR, sphereEnabled);
	composer.addPass(new EffectPass(camera, effect));

	return {
		composer,
		setWorldState(viewToSphereObject: THREE.Matrix4, sphereCenterView: THREE.Vector3): void {
			effect.setWorldState(viewToSphereObject, sphereCenterView);
		},
		setViewOffset(ndcX: number, ndcY: number): void {
			effect.setViewOffset(ndcX, ndcY);
		},
		setSphereEnabled(enabled: boolean): void {
			effect.setSphereEnabled(enabled);
		},
		setSphereScale(s: number): void {
			effect.setSphereScale(s);
		},
		dispose() {
			composer.dispose();
		},
	};
}
