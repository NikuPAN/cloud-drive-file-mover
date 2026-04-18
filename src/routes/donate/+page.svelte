<script lang="ts">
	import { Coffee, Heart } from 'lucide-svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { env } from '$env/dynamic/public';

	// Set PUBLIC_PAYPAL_BUTTON_ID in your .env to activate the button
	const buttonId = env.PUBLIC_PAYPAL_BUTTON_ID ?? '';
</script>

<section class="mx-auto max-w-lg text-center">
	<div
		class="mx-auto mb-6 flex size-20 items-center justify-center rounded-full"
		style="background-color: rgb(var(--accent) / 0.15); color: rgb(var(--accent));"
	>
		<Coffee class="size-10" />
	</div>

	<h1 class="mb-3 text-2xl font-bold">{m.donate_heading()}</h1>
	<p class="mb-8 text-sm leading-relaxed" style="color: rgb(var(--text-muted));">
		{m.donate_body()}
	</p>

	{#if buttonId}
		<!-- PayPal hosted donate button — navigates in the current tab, no new window -->
		<form
			action="https://www.paypal.com/donate"
			method="post"
			class="inline-flex flex-col items-center gap-4"
		>
			<input type="hidden" name="hosted_button_id" value={buttonId} />
			<!-- Custom-styled submit button matching the app design -->
			<button
				type="submit"
				class="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-6 py-3 text-sm font-semibold transition-all duration-150 hover:brightness-110 active:brightness-95"
				style="background-color: rgb(var(--accent)); color: rgb(var(--accent-contrast)); border-color: transparent;"
			>
				<Heart class="size-4" />
				{m.donate_cta()}
			</button>
			<p class="text-xs" style="color: rgb(var(--text-muted));">
				Powered by PayPal · Secure checkout
			</p>
		</form>
	{:else}
		<!-- Placeholder shown until PUBLIC_PAYPAL_BUTTON_ID is configured -->
		<div
			class="rounded-xl border p-6 text-sm"
			style="border-color: rgb(var(--border)); color: rgb(var(--text-muted));"
		>
			Donation link coming soon. Thank you for your support!
		</div>
	{/if}
</section>
