/** Gutter between the viewport edge and the popup panel (px). */
export const PANEL_GUTTER = 48;

/** Max width of the popup panel (px). */
export const PANEL_MAX_W = 900;

/** Horizontal space reserved for the gutter on both sides = PANEL_GUTTER * 2 (px). */
export const PANEL_H_GUTTER = PANEL_GUTTER * 2;

/**
 * Default panel height on first init, as a fraction of viewport height (see
 * createDraggablePanel.svelte.ts init()). Content shorter than this renders
 * at its own natural height; content taller than this is capped here, with
 * .panel-body's own overflow-y: auto handling the rest. Only the tallest
 * sections (Projects, Art — image grids/cards) actually reach this cap;
 * About/Skills/Experience/Contact all render well under it regardless of
 * its value — see PHASE 6 report for the per-section estimates.
 */
export const PANEL_DEFAULT_H_VH = 0.75;

/** Minimum resizable panel dimensions (px). */
export const MIN_W = 320;
export const MIN_H = 240;
