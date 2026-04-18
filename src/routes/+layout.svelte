<script lang="ts">
	import '../app.css';
	import Navbar from '$lib/components/Navbar.svelte';
	import { m } from '$lib/paraglide/messages.js';

	let { children } = $props();
</script>

<svelte:head>
	<title>{m.app_name()}</title>
</svelte:head>

<div class="flex min-h-dvh flex-col">
	<Navbar />
	<main class="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
		{@render children()}
	</main>
	<footer
		class="border-t px-4 py-6 text-center text-xs"
		style="border-color: rgb(var(--border)); color: rgb(var(--text-muted));"
	>
		{m.footer_made_by()}
	</footer>
</div>
