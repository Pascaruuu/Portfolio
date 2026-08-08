import type { ArtCategory } from './content/art/types.js';

export type ArtFilter = 'all' | ArtCategory;

/**
 * Shared category-filter state for the Art section. It lives here, not as
 * component-local state, because the control (rendered in +page.svelte's
 * pinned header, moved out of .panel-body — see PHASE 4 report) and the
 * consumer (Art.svelte, filtering the grid) are different components.
 *
 * Persists for the page's lifetime rather than resetting on panel close or
 * section change: panel geometry already persists across reopen by design
 * (see the handoff), and a category filter is the same kind of low-stakes
 * arrangement choice — resetting it would just make the app look like it
 * forgot what the user was looking at.
 */
function createArtFilter() {
	let selected = $state<ArtFilter>('all');

	function select(filter: ArtFilter): void {
		selected = filter;
	}

	return {
		get selected() { return selected; },
		select,
	};
}

export const artFilter = createArtFilter();
