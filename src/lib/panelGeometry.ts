/** Gutter between the viewport edge and the popup panel (px). */
export const PANEL_GUTTER = 48;

/** Max width of the popup panel (px). */
export const PANEL_MAX_W = 900;

/** Horizontal space reserved for the gutter on both sides = PANEL_GUTTER * 2 (px). */
export const PANEL_H_GUTTER = PANEL_GUTTER * 2;

/** Desktop panel opening height, as a fraction of viewport height — opens here regardless of content length, clamped by the gutter (see createDraggablePanel.svelte.ts init()). */
export const PANEL_DEFAULT_H_VH = 0.75;

/** Minimum resizable panel dimensions (px). */
export const MIN_W = 320;
export const MIN_H = 240;
