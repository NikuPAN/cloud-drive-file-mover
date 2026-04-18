<script lang="ts">
	import { Coffee, ExternalLink } from 'lucide-svelte';
	import Button from '$lib/components/Button.svelte';
	import { m } from '$lib/paraglide/messages.js';

	// TODO: set to real Buy Me a Coffee URL once registered
	const DONATE_URL = '#';
</script>

<section class="mx-auto max-w-lg text-center">
	<div
		class="mx-auto mb-6 flex size-20 items-center justify-center rounded-full"
		style="background-color: rgb(var(--accent) / 0.15); color: rgb(var(--accent));"
	>
		<Coffee class="size-10" />
	</div>
	<h1 class="mb-3 text-2xl font-bold">{m.donate_heading()}</h1>
	<p class="mb-8 text-sm" style="color: rgb(var(--text-muted));">{m.donate_body()}</p>
	<Button variant="primary" onclick={() => window.open(DONATE_URL, '_blank', 'noopener')}>
		{#snippet children()}
			<ExternalLink class="size-4" />
			{m.donate_cta()}
		{/snippet}
	</Button>
</section>
