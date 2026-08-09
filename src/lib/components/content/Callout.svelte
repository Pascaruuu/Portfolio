<script lang="ts">
	import type { Snippet } from 'svelte';

	let { label = 'Note', children }: { label?: string; children?: Snippet } = $props();
</script>

<aside class="callout">
	<p class="callout-label">{label}</p>
	<div class="callout-body">
		{@render children?.()}
	</div>
</aside>
