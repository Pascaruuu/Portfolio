<script lang="ts">
	let { items }: { items: { key: string; value: string }[] } = $props();
</script>

<dl class="spec-list">
	{#each items as item, i (i)}
		<div class="spec-list-row">
			<dt class="spec-list-key">{item.key}</dt>
			<dd class="spec-list-value">{item.value}</dd>
		</div>
	{/each}
</dl>
