<script lang="ts">
	import { getArt } from '$lib/content.js';
	import type { Lang } from '$lib/types.js';

	let { lang }: { lang: Lang } = $props();

	const c = $derived(getArt(lang));
</script>

<p class="panel-eyebrow">{c.label}</p>
<h2 class="panel-heading">{c.heading}</h2>
<p class="exp-desc">{c.body}</p>
