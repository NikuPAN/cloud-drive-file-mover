<script lang="ts">
	import { page } from '$app/state';
	import { Coffee, Home, ArrowLeftRight } from 'lucide-svelte';
	import ThemeSwitch from './ThemeSwitch.svelte';
	import LocaleSwitch from './LocaleSwitch.svelte';
	import { m } from '$lib/paraglide/messages.js';

	const links = $derived([
		{ href: '/', label: m.nav_home(), Icon: Home },
		{ href: '/transfer', label: m.nav_transfer(), Icon: ArrowLeftRight },
		{ href: '/donate', label: m.nav_donate(), Icon: Coffee }
	]);
</script>

<header
	class="sticky top-0 z-20 border-b backdrop-blur"
	style="border-color: rgb(var(--border)); background-color: rgb(var(--surface) / 0.8);"
>
	<nav class="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
		<a href="/" class="flex items-center gap-2 font-semibold">
			<ArrowLeftRight class="size-5" style="color: rgb(var(--accent));" />
			<span>{m.app_name()}</span>
		</a>
		<ul class="ml-4 hidden gap-1 sm:flex">
			{#each links as link (link.href)}
				{@const active = page.url.pathname === link.href}
				<li>
					<a
						href={link.href}
						data-sveltekit-preload-data="hover"
						class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors"
						style={active
							? 'background-color: rgb(var(--surface-2)); color: rgb(var(--text));'
							: 'color: rgb(var(--text-muted));'}
					>
						<link.Icon class="size-4" />
						{link.label}
					</a>
				</li>
			{/each}
		</ul>
		<div class="ml-auto flex items-center gap-3">
			<LocaleSwitch />
			<ThemeSwitch />
		</div>
	</nav>
	<ul
		class="flex gap-1 overflow-x-auto border-t px-4 py-2 sm:hidden"
		style="border-color: rgb(var(--border));"
	>
		{#each links as link (link.href)}
			{@const active = page.url.pathname === link.href}
			<li>
				<a
					href={link.href}
					data-sveltekit-preload-data="hover"
					class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm whitespace-nowrap"
					style={active
						? 'background-color: rgb(var(--surface-2)); color: rgb(var(--text));'
						: 'color: rgb(var(--text-muted));'}
				>
					<link.Icon class="size-4" />
					{link.label}
				</a>
			</li>
		{/each}
	</ul>
</header>
