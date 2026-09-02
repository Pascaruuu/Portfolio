<script lang="ts">
	import { getAbout, getUi } from '$lib/content.js';
	import { pfpImage } from '$lib/portfolio-data.js';
	import type { Lang } from '$lib/types.js';

	let { lang }: { lang: Lang } = $props();

	const c = $derived(getAbout(lang));
	const ui = $derived(getUi(lang));
</script>

<div class="about-layout">
	<div class="about-rail">
		<enhanced:img src={pfpImage} alt={ui.profilePhotoAlt} class="about-photo" />
		<p class="about-name">{ui.hero.name}</p>
		<p class="about-descriptor">{c.descriptor}</p>
		<div class="about-social">
			{#each c.social as link (link.url)}
				<a href={link.url} target="_blank" rel="external noopener noreferrer" class="pill">
					{link.label}
				</a>
			{/each}
		</div>
	</div>
	<div class="about-body">
		{#each c.blocks as block, i (i)}
			<section class="about-block">
				{#if block.label}
					<h3 class="about-block-label">{block.label}</h3>
				{/if}
				{#each block.paragraphs as para, j (j)}
					<p>{para}</p>
				{/each}
			</section>
		{/each}
	</div>
</div>
