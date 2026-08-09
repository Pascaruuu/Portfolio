<script lang="ts">
	let { items }: { items: { value: string; label: string }[] } = $props();
</script>

<div class="stat-block">
	{#each items as item, i (i)}
		<div class="stat-block-item">
			<span class="stat-block-value">{item.value}</span>
			<span class="stat-block-label">{item.label}</span>
		</div>
	{/each}
</div>
