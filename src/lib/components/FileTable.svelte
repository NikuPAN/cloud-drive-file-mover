<script lang="ts">
	import { Folder, FileText, FileSpreadsheet, Presentation, File as FileIcon, ChevronRight, Home } from 'lucide-svelte';
	import type { DriveFile, DriveListing } from '$lib/types';
	import { formatBytes, formatDate } from '$lib/utils/format';
	import { getLocale } from '$lib/paraglide/runtime';
	import { m } from '$lib/paraglide/messages.js';

	interface Props {
		listing: DriveListing | null;
		loading: boolean;
		selected: Set<string>;
		breadcrumbs: { id: string; name: string }[];
		onNavigate: (folderId: string, name: string) => void;
		onUp: (toIndex: number) => void;
		onToggleSelect: (file: DriveFile) => void;
		onSelectAll: (checked: boolean) => void;
		onClear: () => void;
	}

	let {
		listing,
		loading,
		selected,
		breadcrumbs,
		onNavigate,
		onUp,
		onToggleSelect,
		onSelectAll,
		onClear
	}: Props = $props();

	const allSelected = $derived(
		listing != null && listing.items.length > 0 && listing.items.every((f) => selected.has(f.id))
	);

	function iconFor(file: DriveFile) {
		if (file.isFolder) return Folder;
		if (file.mimeType === 'application/vnd.google-apps.document') return FileText;
		if (file.mimeType === 'application/vnd.google-apps.spreadsheet') return FileSpreadsheet;
		if (file.mimeType === 'application/vnd.google-apps.presentation') return Presentation;
		if (file.mimeType.startsWith('text/')) return FileText;
		return FileIcon;
	}

	function kindLabel(file: DriveFile) {
		if (file.isFolder) return m.transfer_folder();
		if (file.isWorkspaceDoc) return m.transfer_workspace_doc();
		return m.transfer_file();
	}
</script>

<div
	class="overflow-hidden rounded-xl border"
	style="background-color: rgb(var(--surface)); border-color: rgb(var(--border));"
>
	<div
		class="flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm"
		style="border-color: rgb(var(--border));"
	>
		<button
			type="button"
			class="inline-flex items-center gap-1 rounded px-2 py-1 transition-colors hover:bg-black/5"
			onclick={() => onUp(0)}
		>
			<Home class="size-3.5" /> /
		</button>
		{#each breadcrumbs as crumb, i (crumb.id)}
			<ChevronRight class="size-3.5 opacity-50" />
			<button
				type="button"
				class="rounded px-2 py-1 transition-colors hover:bg-black/5"
				onclick={() => onUp(i + 1)}
			>
				{crumb.name}
			</button>
		{/each}

		<div class="ml-auto flex items-center gap-2">
			<button
				type="button"
				class="rounded px-2 py-1 text-xs transition-colors hover:bg-black/5"
				onclick={() => onSelectAll(!allSelected)}
				disabled={!listing || listing.items.length === 0}
			>
				{allSelected ? m.transfer_clear() : m.transfer_select_all()}
			</button>
			<button
				type="button"
				class="rounded px-2 py-1 text-xs transition-colors hover:bg-black/5"
				onclick={onClear}
				disabled={selected.size === 0}
			>
				{m.transfer_clear()}
			</button>
		</div>
	</div>

	<div class="max-h-[60vh] overflow-auto">
		<table class="w-full text-sm">
			<thead class="sticky top-0" style="background-color: rgb(var(--surface-2));">
				<tr class="text-left text-xs uppercase" style="color: rgb(var(--text-muted));">
					<th class="w-10 px-3 py-2"></th>
					<th class="px-3 py-2">{m.transfer_name()}</th>
					<th class="hidden px-3 py-2 sm:table-cell">{m.transfer_kind()}</th>
					<th class="hidden px-3 py-2 text-right sm:table-cell">{m.transfer_size()}</th>
					<th class="hidden px-3 py-2 md:table-cell">{m.transfer_modified()}</th>
				</tr>
			</thead>
			<tbody>
				{#if loading}
					<tr>
						<td colspan="5" class="px-4 py-10 text-center text-sm" style="color: rgb(var(--text-muted));">
							{m.transfer_loading()}
						</td>
					</tr>
				{:else if !listing || listing.items.length === 0}
					<tr>
						<td colspan="5" class="px-4 py-10 text-center text-sm" style="color: rgb(var(--text-muted));">
							{m.transfer_empty()}
						</td>
					</tr>
				{:else}
					{#each listing.items as file (file.id)}
						{@const Icon = iconFor(file)}
						{@const isSelected = selected.has(file.id)}
						<tr
							class="border-t transition-colors hover:bg-black/5"
							style="border-color: rgb(var(--border));"
						>
							<td class="px-3 py-2">
								<input
									type="checkbox"
									checked={isSelected}
									onchange={() => onToggleSelect(file)}
									aria-label={file.name}
								/>
							</td>
							<td class="px-3 py-2">
								{#if file.isFolder}
									<button
										type="button"
										class="flex items-center gap-2 text-left hover:underline"
										onclick={() => onNavigate(file.id, file.name)}
									>
										<Icon class="size-4 shrink-0" style="color: rgb(var(--accent));" />
										<span class="truncate">{file.name}</span>
									</button>
								{:else}
									<div class="flex items-center gap-2">
										<Icon class="size-4 shrink-0" style="color: rgb(var(--text-muted));" />
										<span class="truncate">{file.name}</span>
									</div>
								{/if}
							</td>
							<td class="hidden px-3 py-2 sm:table-cell" style="color: rgb(var(--text-muted));">
								{kindLabel(file)}
							</td>
							<td class="hidden px-3 py-2 text-right tabular-nums sm:table-cell" style="color: rgb(var(--text-muted));">
								{file.isFolder ? '—' : formatBytes(file.size, getLocale())}
							</td>
							<td class="hidden px-3 py-2 md:table-cell" style="color: rgb(var(--text-muted));">
								{formatDate(file.modifiedTime, getLocale())}
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</div>
