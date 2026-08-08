<script lang="ts">
	import { getExperience } from '$lib/content.js';
	import type { Lang } from '$lib/types.js';

	let { lang }: { lang: Lang } = $props();

	const c = $derived(getExperience(lang));
</script>

{#each c.items as item (item.title)}
	<div class="exp-item">
		<div class="exp-title">{item.title}</div>
		<p class="exp-desc">{item.desc}</p>
	</div>
{/each}
