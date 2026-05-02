import type { HotspotDef } from '../types.js';

export const HOTSPOT_DEFS: HotspotDef[] = [
	{ id: 'about',      lat:  22, lon:   0 },
	{ id: 'skills',     lat:  -12, lon:  76 },
	{ id: 'projects',   lat:  10, lon: 124 },
	{ id: 'experience', lat: -22, lon: 216 },
	{ id: 'contact',    lat:  10, lon: 288 },
];

export const SPHERE_R      = 158;
export const AUTO_SPEED    = 0.0004;
export const SENSITIVITY   = 0.0042;
export const INERTIA       = 0.93;
export const X_CLAMP       = Math.PI / 3.2;
export const DRAG_THRESHOLD = 7; // px - below this on pointerup = click
export const ROTATION_LERP = 0.06;
export const HOVER_RADIUS_SQ = 52 * 52; // screen-space px^2

export const PARTICLE_DRIFT_RADIUS = 1.6;
export const PARTICLE_RADIAL_AMPLITUDE = 0.9;
export const FLOW_RESPONSE = 172;
export const FLOW_DAMPING = 0.92;
export const FLOW_MAX = 9.5;
export const WAVE_SPEED = 2.35;
export const WAVE_WIDTH = 0.28;
export const WAVE_AMPLITUDE = 13;
export const WAVE_DECAY = 1.75;

// Single source of truth for accent color (mirrors --accent / #E44040 in theme.css)
export const ACCENT = 0xe44040;
export const ACCENT_HEX = '#E44040';
export const ASCII_COLOR = '#6A7C8A';
export const BG_COLOR = '#0a0a0b';
