<script lang="ts">
	import {
		Folder,
		FileText,
		FileSpreadsheet,
		Presentation,
		File as FileIcon,
		ChevronRight,
		Home,
		RefreshCw,
		CheckSquare,
		Square,
		X
	} from 'lucide-svelte';
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
		onRefresh: () => void;
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
		onClear,
		onRefresh
	}: Props = $props();

	const allSelected = $derived(
		listing != null && listing.items.length > 0 && listing.items.every((f) => selected.has(f.id))
	);
	const someSelected = $derived(
		listing != null && listing.items.some((f) => selected.has(f.id)) && !allSelected
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
	<!-- Toolbar -->
	<div
		class="flex flex-wrap items-center gap-1 border-b px-3 py-2"
		style="border-color: rgb(var(--border)); background-color: rgb(var(--surface-2));"
	>
		<!-- Breadcrumbs -->
		<button
			type="button"
			class="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-sm transition-colors hover:bg-black/8 dark:hover:bg-white/10"
			onclick={() => onUp(0)}
			title="Drive root"
		>
			<Home class="size-3.5" />
		</button>
		{#each breadcrumbs as crumb, i (crumb.id)}
			<ChevronRight class="size-3.5 opacity-40" />
			<button
				type="button"
				class="cursor-pointer rounded-md px-2 py-1 text-sm transition-colors hover:bg-black/8 dark:hover:bg-white/10"
				onclick={() => onUp(i + 1)}
			>
				{crumb.name}
			</button>
		{/each}

		<!-- Right-side actions -->
		<div class="ml-auto flex items-center gap-1">
			<button
				type="button"
				title={m.transfer_refresh()}
				class="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-all hover:bg-black/8 dark:hover:bg-white/10 active:scale-95"
				style="border-color: rgb(var(--border)); color: rgb(var(--text-muted));"
				onclick={onRefresh}
			>
				<RefreshCw class="size-3.5" />
				{m.transfer_refresh()}
			</button>

			<button
				type="button"
				title={m.transfer_select_all()}
				class="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-all hover:bg-black/8 dark:hover:bg-white/10 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
				style="border-color: rgb(var(--border)); color: rgb(var(--text-muted));"
				disabled={!listing || listing.items.length === 0}
				onclick={() => onSelectAll(!allSelected)}
			>
				{#if allSelected}
					<CheckSquare class="size-3.5" style="color: rgb(var(--accent));" />
				{:else}
					<Square class="size-3.5" />
				{/if}
				{allSelected ? m.transfer_clear() : m.transfer_select_all()}
			</button>

			{#if selected.size > 0}
				<button
					type="button"
					title={m.transfer_clear()}
					class="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-all hover:bg-black/8 dark:hover:bg-white/10 active:scale-95"
					style="border-color: rgb(var(--border)); color: rgb(var(--text-muted));"
					onclick={onClear}
				>
					<X class="size-3.5" />
					{m.transfer_clear()}
				</button>
			{/if}
		</div>
	</div>

	<!-- Table -->
	<div class="max-h-[56vh] overflow-auto">
		<table class="w-full text-sm">
			<thead class="sticky top-0 z-10" style="background-color: rgb(var(--surface-2));">
				<tr
					class="border-b text-left text-xs font-semibold uppercase tracking-wide"
					style="border-color: rgb(var(--border)); color: rgb(var(--text-muted));"
				>
					<th class="w-10 px-3 py-2.5">
						<button
							type="button"
							class="cursor-pointer"
							onclick={() => onSelectAll(!allSelected)}
							disabled={!listing || listing.items.length === 0}
							title={allSelected ? 'Deselect all' : 'Select all'}
						>
							{#if allSelected}
								<CheckSquare class="size-4" style="color: rgb(var(--accent));" />
							{:else if someSelected}
								<Square class="size-4 opacity-60" style="color: rgb(var(--accent));" />
							{:else}
								<Square class="size-4" />
							{/if}
						</button>
					</th>
					<th class="px-3 py-2.5">{m.transfer_name()}</th>
					<th class="hidden px-3 py-2.5 sm:table-cell">{m.transfer_kind()}</th>
					<th class="hidden px-3 py-2.5 text-right sm:table-cell">{m.transfer_size()}</th>
					<th class="hidden px-3 py-2.5 md:table-cell">{m.transfer_modified()}</th>
				</tr>
			</thead>
			<tbody>
				{#if loading}
					<tr>
						<td
							colspan="5"
							class="px-4 py-12 text-center text-sm"
							style="color: rgb(var(--text-muted));"
						>
							<RefreshCw class="mx-auto mb-2 size-5 animate-spin" />
							{m.transfer_loading()}
						</td>
					</tr>
				{:else if !listing || listing.items.length === 0}
					<tr>
						<td
							colspan="5"
							class="px-4 py-12 text-center text-sm"
							style="color: rgb(var(--text-muted));"
						>
							{m.transfer_empty()}
						</td>
					</tr>
				{:else}
					{#each listing.items as file (file.id)}
						{@const Icon = iconFor(file)}
						{@const isSelected = selected.has(file.id)}
						<tr
							class="group border-t transition-colors"
							style="border-color: rgb(var(--border)); {isSelected ? 'background-color: rgb(var(--accent) / 0.06);' : ''}"
							onclick={() => onToggleSelect(file)}
						>
							<td class="px-3 py-2.5" onclick={(e) => e.stopPropagation()}>
								<input
									type="checkbox"
									checked={isSelected}
									onchange={() => onToggleSelect(file)}
									class="size-4 cursor-pointer accent-[rgb(var(--accent))]"
									aria-label={file.name}
								/>
							</td>
							<td class="cursor-pointer px-3 py-2.5">
								{#if file.isFolder}
									<button
										type="button"
										class="flex cursor-pointer items-center gap-2 text-left"
										onclick={(e) => {
											e.stopPropagation();
											onNavigate(file.id, file.name);
										}}
									>
										<Icon class="size-4 shrink-0" style="color: rgb(var(--accent));" />
										<span class="truncate font-medium hover:underline">{file.name}</span>
									</button>
								{:else}
									<div class="flex items-center gap-2">
										<Icon class="size-4 shrink-0" style="color: rgb(var(--text-muted));" />
										<span class="truncate">{file.name}</span>
										{#if file.isWorkspaceDoc}
											<span
												class="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
												style="background-color: rgb(var(--accent) / 0.15); color: rgb(var(--accent));"
											>
												Workspace
											</span>
										{/if}
									</div>
								{/if}
							</td>
							<td
								class="hidden cursor-pointer px-3 py-2.5 sm:table-cell"
								style="color: rgb(var(--text-muted));"
							>
								{kindLabel(file)}
							</td>
							<td
								class="hidden cursor-pointer px-3 py-2.5 text-right tabular-nums sm:table-cell"
								style="color: rgb(var(--text-muted));"
							>
								{file.isFolder ? '—' : formatBytes(file.size, getLocale())}
							</td>
							<td
								class="hidden cursor-pointer px-3 py-2.5 md:table-cell"
								style="color: rgb(var(--text-muted));"
							>
								{formatDate(file.modifiedTime, getLocale())}
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</div>
