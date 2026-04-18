<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Check, Cloud, CloudCog, Shield, LogOut } from 'lucide-svelte';
	import Button from '$lib/components/Button.svelte';
	import { m } from '$lib/paraglide/messages.js';

	let { data } = $props();
	const canContinue = $derived(data.connected.google && data.connected.microsoft);

	async function signOut() {
		await fetch('/api/auth/logout', { method: 'POST' });
		goto('/', { invalidateAll: true });
	}
</script>

<section class="mb-10 text-center sm:mb-14">
	<h1 class="text-3xl font-bold tracking-tight sm:text-4xl">{m.home_heading()}</h1>
	<p class="mx-auto mt-3 max-w-2xl text-sm sm:text-base" style="color: rgb(var(--text-muted));">
		{m.home_sub()}
	</p>
</section>

<section class="mb-10 grid gap-4 sm:grid-cols-2">
	<article
		class="rounded-xl border p-6"
		style="background-color: rgb(var(--surface-2)); border-color: rgb(var(--border));"
	>
		<div class="mb-4 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<Cloud class="size-6" />
				<span class="font-semibold">Google Drive</span>
			</div>
			{#if data.connected.google}
				<span
					class="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
					style="background-color: rgb(var(--success) / 0.15); color: rgb(var(--success));"
				>
					<Check class="size-3.5" />
					{m.home_connected()}
				</span>
			{/if}
		</div>
		<Button
			variant={data.connected.google ? 'secondary' : 'primary'}
			class="w-full"
			onclick={() => (window.location.href = '/api/auth/google/login')}
		>
			{#snippet children()}
				{data.connected.google ? m.home_connect_google() + ' ✓' : m.home_connect_google()}
			{/snippet}
		</Button>
	</article>

	<article
		class="rounded-xl border p-6"
		style="background-color: rgb(var(--surface-2)); border-color: rgb(var(--border));"
	>
		<div class="mb-4 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<CloudCog class="size-6" />
				<span class="font-semibold">Microsoft OneDrive</span>
			</div>
			{#if data.connected.microsoft}
				<span
					class="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
					style="background-color: rgb(var(--success) / 0.15); color: rgb(var(--success));"
				>
					<Check class="size-3.5" />
					{m.home_connected()}
				</span>
			{/if}
		</div>
		<Button
			variant={data.connected.microsoft ? 'secondary' : 'primary'}
			class="w-full"
			onclick={() => (window.location.href = '/api/auth/microsoft/login')}
		>
			{#snippet children()}
				{data.connected.microsoft
					? m.home_connect_microsoft() + ' ✓'
					: m.home_connect_microsoft()}
			{/snippet}
		</Button>
	</article>
</section>

{#if canContinue}
	<div class="mb-12 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
		<Button variant="primary" onclick={() => goto('/transfer')}>
			{#snippet children()}
				{m.home_continue()} →
			{/snippet}
		</Button>
		<Button variant="ghost" onclick={signOut}>
			{#snippet children()}
				<LogOut class="size-4" />
				{m.auth_sign_out()}
			{/snippet}
		</Button>
	</div>
{:else if data.connected.google || data.connected.microsoft}
	<div class="mb-12 text-center text-sm" style="color: rgb(var(--text-muted));">
		{m.auth_required()}
	</div>
{/if}

<section
	class="rounded-xl border p-6"
	style="background-color: rgb(var(--surface-2)); border-color: rgb(var(--border));"
>
	<h2 class="mb-4 flex items-center gap-2 text-lg font-semibold">
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
