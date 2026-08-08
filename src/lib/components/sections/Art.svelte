<script lang="ts">
	import { getArt } from '$lib/content.js';
	import type { Lang } from '$lib/types.js';
	import { artPieces, ART_GRID_THUMB_SIZES } from '$lib/content/art/loader.js';
	import { lightbox } from '$lib/lightbox.svelte.js';
	import { artFilter } from '$lib/artFilter.svelte.js';

	let { lang }: { lang: Lang } = $props();

	const c = $derived(getArt(lang));

	const filteredPieces = $derived(
		artFilter.selected === 'all'
			? artPieces
			: artPieces.filter((piece) => piece.category === artFilter.selected)
	);
</script>

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
