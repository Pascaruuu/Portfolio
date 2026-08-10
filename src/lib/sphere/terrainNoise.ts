// Shared FBM terrain noise, used identically by the ASCII glyph shader
// (ascii.ts) and the terrain bake shader (terrain-bake.ts). Both must
// compute the same value for the same input point: the baked terrain map
// drives particle placement and hotspot elevation, so if it diverges from
// what the ASCII shader renders, land and glyphs disagree about where land
// is.
export const TERRAIN_NOISE_GLSL = /* glsl */`
float hash3(vec3 p) {
  // Small multiplier: a large one (this used to be ~440 per axis) can push
  // fract() past the precision some mobile GPU drivers can resolve, even
  // at highp -- confirmed on-device as the cause of a terrain seam.
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
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
`;
