import type { HotspotDef } from '../types.js';
import { portfolioColors } from '../theme.js';

export const HOTSPOT_DEFS: HotspotDef[] = [
	{ id: 'about',      lat:  2, lon: 300 },
	{ id: 'skills',     lat:  -2, lon: 108 },
	{ id: 'projects',   lat: -44, lon: 260 },
	{ id: 'experience', lat:  50, lon: 204 },
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

/** Fraction of viewport width the sphere shifts left when a panel is open. */
export const PANEL_SHIFT_RATIO = 0.22;

/** Fraction of viewport height the sphere shifts up when a panel is open (mobile). */
export const MOBILE_VERTICAL_SHIFT_RATIO = 0.22;
