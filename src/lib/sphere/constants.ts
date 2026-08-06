import type { HotspotDef } from '../types.js';
import { portfolioColors } from '../theme.js';

export const HOTSPOT_DEFS: HotspotDef[] = [
	{ id: 'about',      lat:  2, lon: 300 },
	{ id: 'skills',     lat:  -2, lon: 108 },
	{ id: 'projects',   lat: -44, lon: 260 },
	{ id: 'experience', lat:  50, lon: 204 },
	{ id: 'art',        lat:  80, lon: 350 },
	{ id: 'contact',    lat:  -4, lon: 378 },
];

export const SPHERE_R      = 158;
export const AUTO_SPEED    = 0.0004;
export const SENSITIVITY   = 0.0042;
export const INERTIA       = 0.93;
export const X_CLAMP       = Math.PI / 3.2;
export const DRAG_THRESHOLD = 7; // px - below this on pointerup = click
export const ROTATION_LERP = 0.06;
export const HOVER_RADIUS_SQ = 52 * 52; // screen-space px^2

export const ACCENT = portfolioColors.accentNumber;
export const ASCII_COLOR = portfolioColors.ascii;
export const ASCII_CHARS = ' .,·:;!|=+xo#%&@██';

/**
 * ASCII glyph cell size on desktop viewports, in CSS pixels. This is the
 * single tuning lever for glyph legibility -- the renderer converts it to
 * device pixels internally (see createAsciiRenderer in sphere/ascii.ts)
 * using its own clamped pixel ratio.
 */
export const ASCII_CELL_SIZE_DESKTOP = 10;

/**
 * ASCII glyph cell size on mobile viewports, in CSS pixels. Same tuning
 * lever as ASCII_CELL_SIZE_DESKTOP; selected via viewport.isDesktop.
 */
export const ASCII_CELL_SIZE_MOBILE = 7;

/** Fraction of viewport width the sphere shifts left (desktop) when a panel is open. */
export const SHIFT_RATIO = 0.22;

/** Fraction of viewport width the sphere shifts left when a panel is open. */
export const PANEL_SHIFT_RATIO = SHIFT_RATIO;

/**
 * Fraction of viewport height the sphere shifts up when a panel is open
 * (mobile). Deliberately lower than SHIFT_RATIO/PANEL_SHIFT_RATIO: the
 * mobile sphere's projected radius leaves much less vertical margin (its
 * top edge sits close to the screen edge already), so the desktop ratio
 * pushes it off-screen. Intentionally decoupled from SHIFT_RATIO -- do
 * not re-alias the two.
 */
export const MOBILE_VERTICAL_SHIFT_RATIO = 0.08;
