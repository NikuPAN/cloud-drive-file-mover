<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { Check, Cloud, CloudCog, Shield, ArrowRight, LogOut, RefreshCw, HardDrive, Box } from 'lucide-svelte';
	import Button from '$lib/components/Button.svelte';
	import { m } from '$lib/paraglide/messages.js';

	let { data } = $props();

	const providers = [
		{ provider: 'google' as const, label: 'Google Drive', Icon: Cloud },
		{ provider: 'microsoft' as const, label: 'Microsoft OneDrive', Icon: CloudCog },
		{ provider: 'dropbox' as const, label: 'Dropbox', Icon: HardDrive },
		{ provider: 'box' as const, label: 'Box', Icon: Box }
	];

	const connectedCount = $derived(
		Object.values(data.connected).filter(Boolean).length
	);
	const canContinue = $derived(connectedCount >= 2);

	async function disconnect(provider: 'google' | 'microsoft' | 'dropbox' | 'box') {
		await fetch(`/api/auth/${provider}/logout`, { method: 'POST' });
		await invalidateAll();
	}

	async function signOutAll() {
		await fetch('/api/auth/logout', { method: 'POST' });
		await invalidateAll();
	}
</script>

<section class="mb-10 text-center sm:mb-12">
	<h1 class="text-3xl font-bold tracking-tight sm:text-4xl">{m.home_heading()}</h1>
	<p class="mx-auto mt-3 max-w-2xl text-sm sm:text-base" style="color: rgb(var(--text-muted));">
		{m.home_sub()}
	</p>
</section>

<!-- Connect cards — 2×2 grid -->
<section class="mb-8 grid gap-4 sm:grid-cols-2">
	{#each providers as card (card.provider)}
		{@const connected = data.connected[card.provider]}
		<article
			class="rounded-xl border p-5 transition-shadow"
			style="background-color: rgb(var(--surface-2));"
			style:border-color={connected ? 'rgb(var(--success) / 0.4)' : 'rgb(var(--border))'}
		>
			<div class="mb-4 flex items-center justify-between">
				<div class="flex items-center gap-2.5">
					<card.Icon class="size-5" style={connected ? 'color: rgb(var(--success));' : ''} />
					<span class="font-semibold">{card.label}</span>
				</div>
				{#if connected}
					<span
						class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
						style="background-color: rgb(var(--success) / 0.15); color: rgb(var(--success));"
					>
						<Check class="size-3" />
						{m.home_connected()}
					</span>
				{/if}
			</div>

			{#if connected}
				<div class="flex gap-2">
					<Button variant="secondary" size="sm" class="flex-1" onclick={() => (window.location.href = `/api/auth/${card.provider}/login`)}>
						{#snippet children()}
							<RefreshCw class="size-3.5" />
							Switch account
						{/snippet}
					</Button>
					<Button variant="danger" size="sm" class="flex-1" onclick={() => disconnect(card.provider)}>
						{#snippet children()}
							<LogOut class="size-3.5" />
							Disconnect
						{/snippet}
					</Button>
				</div>
			{:else}
				<Button variant="primary" class="w-full" onclick={() => (window.location.href = `/api/auth/${card.provider}/login`)}>
					{#snippet children()}
						Connect {card.label}
					{/snippet}
				</Button>
			{/if}
		</article>
	{/each}
</section>

<!-- CTA -->
{#if canContinue}
	<div class="mb-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
		<Button variant="primary" onclick={() => goto('/transfer')}>
			{#snippet children()}
				{m.home_continue()}
				<ArrowRight class="size-4" />
			{/snippet}
		</Button>
		<Button variant="ghost" onclick={signOutAll}>
			{#snippet children()}
				<LogOut class="size-4" />
				{m.auth_sign_out()} (all)
			{/snippet}
		</Button>
	</div>
{:else}
	<p class="mb-10 text-center text-sm" style="color: rgb(var(--text-muted));">
		Connect at least 2 drives to continue.
	</p>
{/if}

<!-- Privacy disclaimer -->
<section
	class="rounded-xl border p-6"
	style="background-color: rgb(var(--surface-2)); border-color: rgb(var(--border));"
>
	<h2 class="mb-4 flex items-center gap-2 text-base font-semibold">
		<Shield class="size-5" style="color: rgb(var(--accent));" />
		{m.disclaimer_heading()}
	</h2>
	<ul class="space-y-2 text-sm" style="color: rgb(var(--text-muted));">
		<li class="flex gap-2"><Check class="mt-0.5 size-4 shrink-0" />{m.disclaimer_1()}</li>
		<li class="flex gap-2"><Check class="mt-0.5 size-4 shrink-0" />{m.disclaimer_2()}</li>
		<li class="flex gap-2"><Check class="mt-0.5 size-4 shrink-0" />{m.disclaimer_3()}</li>
		<li class="flex gap-2"><Check class="mt-0.5 size-4 shrink-0" />{m.disclaimer_4()}</li>
	</ul>
</section>
