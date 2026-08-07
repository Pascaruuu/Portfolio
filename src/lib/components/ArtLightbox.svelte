<script lang="ts">
	import { lightbox } from '$lib/lightbox.svelte.js';
	import { getArt } from '$lib/content.js';
	import type { Lang } from '$lib/types.js';
	import type { ArtCategory } from '$lib/content/art/types.js';

	let { lang }: { lang: Lang } = $props();

	const c = $derived(getArt(lang));

	let closeBtnEl = $state<HTMLButtonElement | null>(null);

	// A fresh instance mounts each time lightbox.piece flips from null (the
	// {#if} in +page.svelte creates/destroys it), so this runs once per open.
	$effect(() => {
		closeBtnEl?.focus();
	});

	function categoryLabel(category: ArtCategory | null): string {
		if (category === 'hand-drawn') return c.filters.handDrawn;
		if (category === 'digital') return c.filters.digital;
		return '—';
	}

	function imageLabel(index: number): string {
		return c.imageLabelTemplate.replace('{n}', String(index + 1));
	}
</script>

{#if lightbox.piece}
	{@const piece = lightbox.piece}
	{@const activeImage = piece.images[lightbox.index] ?? piece.images[0]}
	<div
		class="lightbox-backdrop"
		onclick={() => lightbox.close()}
		role="presentation"
	>
		<button
			class="lightbox-close"
			onclick={() => lightbox.close()}
			aria-label={c.lightboxCloseLabel}
			bind:this={closeBtnEl}
		>
			<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor"
				fill="none" stroke-width="2" stroke-linecap="round">
				<line x1="18" y1="6" x2="6" y2="18" />
				<line x1="6" y1="6" x2="18" y2="18" />
			</svg>
		</button>

		<div class="lightbox-content" onclick={(e) => e.stopPropagation()} role="presentation">
			{#if activeImage}
				<enhanced:img class="lightbox-image" src={activeImage} alt="" />
			{/if}

			<div class="lightbox-meta">
				<h3 class="lightbox-title">{piece.title[lang] ?? '—'}</h3>
				<p class="lightbox-desc">{piece.description[lang] ?? '—'}</p>
				<div class="lightbox-fields">
					<span>{piece.date ?? '—'}</span>
					<span>{categoryLabel(piece.category)}</span>
				</div>
			</div>

			{#if piece.images.length > 1}
				<div class="lightbox-strip" role="group" aria-label={c.imageStripLabel}>
					{#each piece.images as img, i (i)}
						<button
							class="lightbox-strip-thumb"
							class:active={i === lightbox.index}
							onclick={() => lightbox.select(i)}
							aria-label={imageLabel(i)}
							aria-current={i === lightbox.index}
						>
							<enhanced:img src={img} alt="" />
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}
