<script lang="ts">
	import { getAbout, getUi } from '$lib/content.js';
	import { pfpImage } from '$lib/portfolio-data.js';
	import type { Lang } from '$lib/types.js';

	let { lang }: { lang: Lang } = $props();

	const c = $derived(getAbout(lang));
	const ui = $derived(getUi(lang));
</script>

<enhanced:img src={pfpImage} alt={ui.profilePhotoAlt} class="about-photo" />
<div class="about-body">
	{#each c.paragraphs as para, i (i)}
		<p>{para}</p>
	{/each}
</div>
<div class="about-social">
	{#each c.social as link (link.url)}
		<a href={link.url} target="_blank" rel="external noopener noreferrer" class="pill">
			{link.label}
		</a>
	{/each}
</div>
