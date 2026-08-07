<script lang="ts">
	import { getArt } from '$lib/content.js';
	import type { Lang } from '$lib/types.js';
	import type { ArtCategory } from '$lib/content/art/types.js';
	import { artPieces, ART_GRID_THUMB_SIZES } from '$lib/content/art/loader.js';
	import SegmentedControl from '$lib/components/SegmentedControl.svelte';
	import { lightbox } from '$lib/lightbox.svelte.js';

	let { lang }: { lang: Lang } = $props();

	const c = $derived(getArt(lang));

	type Filter = 'all' | ArtCategory;
	const filterOptions: Filter[] = ['all', 'hand-drawn', 'digital'];

	let selectedFilter = $state<Filter>('all');

	function filterLabel(filter: Filter): string {
		if (filter === 'all') return c.filters.all;
		if (filter === 'hand-drawn') return c.filters.handDrawn;
		return c.filters.digital;
	}

	const filteredPieces = $derived(
		selectedFilter === 'all'
			? artPieces
			: artPieces.filter((piece) => piece.category === selectedFilter)
	);
</script>

<p class="panel-eyebrow">{c.label}</p>

{#snippet filterIcon(filter: Filter)}
	{#if filter === 'all'}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
			stroke-linecap="round" stroke-linejoin="round">
			<rect x="3" y="3" width="7" height="7" />
			<rect x="14" y="3" width="7" height="7" />
			<rect x="14" y="14" width="7" height="7" />
			<rect x="3" y="14" width="7" height="7" />
		</svg>
	{:else if filter === 'hand-drawn'}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
			stroke-linecap="round" stroke-linejoin="round">
			<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
		</svg>
	{:else}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
			stroke-linecap="round" stroke-linejoin="round">
			<rect x="4" y="2" width="16" height="20" rx="2" />
			<line x1="12" y1="18" x2="12.01" y2="18" />
		</svg>
	{/if}
{/snippet}

<div class="art-heading-row">
	<h2 class="panel-heading">{c.heading}</h2>

	{#if artPieces.length > 0}
		<div class="art-filter segmented-control" role="group" aria-label={c.filterLabel}>
			<SegmentedControl
				items={filterOptions}
				itemKey={(item) => item}
				itemLabel={filterLabel}
				itemIcon={filterIcon}
				activeItem={selectedFilter}
				onSelect={(item) => (selectedFilter = item)}
			/>
		</div>
	{/if}
</div>

{#if artPieces.length === 0}
	<p class="exp-desc">{c.emptyAll}</p>
{:else if filteredPieces.length === 0}
	<p class="exp-desc">{c.emptyFiltered}</p>
{:else}
	<div class="art-grid">
		{#each filteredPieces as piece (piece.slug)}
			{@const [thumbnail] = piece.thumbnails}
			{#if thumbnail}
				<div class="art-cell-wrap">
					{#if piece.images.length > 1}
						<span class="art-cell-edge layer-1" aria-hidden="true"></span>
					{/if}
					<button
						class="art-cell"
						onclick={(e) => lightbox.open(piece, e.currentTarget as HTMLElement)}
					>
						<enhanced:img class="art-cell-img" src={thumbnail} alt="" sizes={ART_GRID_THUMB_SIZES} />
						<span class="art-cell-title">{piece.title[lang] ?? '—'}</span>
					</button>
				</div>
			{/if}
		{/each}
	</div>
{/if}
