<script lang="ts">
	import { ArrowRight, RefreshCw, ArrowLeftRight, Play, Info } from 'lucide-svelte';
	import FileTable from '$lib/components/FileTable.svelte';
	import Button from '$lib/components/Button.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import type {
		ConflictStrategy,
		DriveFile,
		DriveListing,
		Provider,
		Quota,
		WorkspaceDocStrategy
	} from '$lib/types';
	import { formatBytes } from '$lib/utils/format';
	import { getLocale } from '$lib/paraglide/runtime';
	import { m } from '$lib/paraglide/messages.js';
	import { toastStore } from '$lib/stores/toast.svelte';

	let source = $state<Provider>('google');
	const destination = $derived<Provider>(source === 'google' ? 'microsoft' : 'google');

	let listing = $state<DriveListing | null>(null);
	let loading = $state(false);
	let breadcrumbs = $state<{ id: string; name: string }[]>([]);
	let selectedFiles = $state<Map<string, DriveFile>>(new Map());
	let destQuota = $state<Quota | null>(null);

	let conflictStrategy = $state<ConflictStrategy>('rename');
	let workspaceStrategy = $state<WorkspaceDocStrategy>('convert');

	let showWorkspaceModal = $state(false);
	let showConflictModal = $state(false);
	let checkingConflicts = $state(false);

	let progress = $state<{
		running: boolean;
		current: number;
		total: number;
		message: string;
		failed: boolean;
		done: boolean;
	}>({ running: false, current: 0, total: 0, message: '', failed: false, done: false });

	let planBytes = $state<number | null>(null);

	const selectedIds = $derived(new Set(selectedFiles.keys()));
	const selectedSize = $derived(
		[...selectedFiles.values()].reduce((sum, f) => sum + (f.size ?? 0), 0)
	);
	const hasFolders = $derived([...selectedFiles.values()].some((f) => f.isFolder));
	const hasWorkspaceDocs = $derived(
		[...selectedFiles.values()].some((f) => f.isWorkspaceDoc) && source === 'google'
	);
	const insufficientSpace = $derived(destQuota?.free != null && selectedSize > destQuota.free);
	const currentFolderId = $derived(
		breadcrumbs.length === 0 ? 'root' : breadcrumbs[breadcrumbs.length - 1].id
	);

	async function loadFolder(folderId: string, name?: string, depth?: number) {
		loading = true;
		selectedFiles = new Map();
		try {
			const res = await fetch(`/api/drive/${source}/list?folderId=${encodeURIComponent(folderId)}`);
			if (!res.ok) throw new Error(`List failed: ${res.status}`);
			listing = (await res.json()) as DriveListing;
			if (depth != null) breadcrumbs = breadcrumbs.slice(0, depth);
			else if (name && folderId !== 'root') breadcrumbs = [...breadcrumbs, { id: folderId, name }];
			else if (folderId === 'root') breadcrumbs = [];
		} finally {
			loading = false;
		}
	}

	async function loadQuota() {
		try {
			const res = await fetch(`/api/drive/${destination}/quota`);
			if (res.ok) destQuota = (await res.json()) as Quota;
		} catch {
			destQuota = null;
		}
	}

	function swap() {
		source = destination;
		selectedFiles = new Map();
		breadcrumbs = [];
		listing = null;
		destQuota = null;
		planBytes = null;
	}

	function toggleSelect(file: DriveFile) {
		const next = new Map(selectedFiles);
		if (next.has(file.id)) next.delete(file.id);
		else next.set(file.id, file);
		selectedFiles = next;
	}

	function selectAll(checked: boolean) {
		const next = new Map(selectedFiles);
		for (const f of listing?.items ?? []) {
			if (checked) next.set(f.id, f);
			else next.delete(f.id);
		}
		selectedFiles = next;
	}

	async function startTransfer() {
		if (selectedFiles.size === 0 || insufficientSpace) return;

		// Show Workspace modal first if applicable
		if (hasWorkspaceDocs) {
			showWorkspaceModal = true;
			return;
		}
		await checkConflictsAndProceed();
	}

	async function checkConflictsAndProceed() {
		// Quick top-level conflict check against destination
		checkingConflicts = true;
		try {
			const names = [...selectedFiles.values()].map((f) => f.name);
			const res = await fetch(`/api/drive/${destination}/check-conflicts`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ names, parentId: 'root' })
			});
			if (res.ok) {
				const { conflicts } = (await res.json()) as { conflicts: string[] };
				if (conflicts.length > 0) {
					showConflictModal = true;
					return;
				}
			}
		} finally {
			checkingConflicts = false;
		}
		// No conflicts — proceed directly with safe default (rename)
		await runTransfer();
	}

	function confirmWorkspace(strategy: WorkspaceDocStrategy) {
		workspaceStrategy = strategy;
		showWorkspaceModal = false;
		checkConflictsAndProceed();
	}

	async function confirmConflict(strategy: ConflictStrategy) {
		conflictStrategy = strategy;
		showConflictModal = false;
		await runTransfer();
	}

	async function runTransfer() {
		progress = { running: true, current: 0, total: 0, message: '', failed: false, done: false };
		planBytes = null;
		const res = await fetch('/api/transfer', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				source,
				destination,
				fileIds: [...selectedFiles.keys()],
				conflict: conflictStrategy,
				workspaceDocs: workspaceStrategy
			})
		});
		if (!res.ok || !res.body) {
			progress = { ...progress, running: false, failed: true, message: m.transfer_failed() };
			toastStore.error(m.transfer_failed());
			return;
		}

		const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
		let buffer = '';
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			buffer += value;
			let idx;
			while ((idx = buffer.indexOf('\n\n')) !== -1) {
				const chunk = buffer.slice(0, idx).trim();
				buffer = buffer.slice(idx + 2);
				if (chunk.startsWith('data: ')) handleEvent(JSON.parse(chunk.slice(6)));
			}
		}
	}

	function handleEvent(ev: Record<string, unknown>) {
		if (ev.type === 'plan') {
			progress = { ...progress, total: ev.total as number };
			if (ev.totalBytes != null) planBytes = ev.totalBytes as number;
		} else if (ev.type === 'progress') {
			progress = {
				...progress,
				current: ev.current as number,
				total: ev.total as number,
				message: m.transfer_progress({ current: String(ev.current), total: String(ev.total) })
			};
		} else if (ev.type === 'done') {
			progress = { ...progress, running: false, done: true, message: m.transfer_done() };
			selectedFiles = new Map();
			loadQuota();
			toastStore.success(m.transfer_done());
		} else if (ev.type === 'fatal') {
			const msg =
				ev.message === 'insufficient_space' ? m.transfer_insufficient_space() : m.transfer_failed();
			progress = { ...progress, running: false, failed: true, message: msg };
			toastStore.error(msg);
		}
	}

	$effect(() => {
		void source;
		loadFolder('root');
		loadQuota();
	});
</script>

<!-- Direction bar -->
<div
	class="mb-5 flex flex-wrap items-center gap-3 rounded-xl border p-4"
	style="background-color: rgb(var(--surface-2)); border-color: rgb(var(--border));"
>
	<div class="flex items-center gap-2 text-sm font-medium">
		<span style="color: rgb(var(--text-muted));">{m.transfer_source()}:</span>
		<span
			class="rounded-md px-2.5 py-1 font-semibold"
			style="background-color: rgb(var(--accent) / 0.12); color: rgb(var(--accent));"
		>
			{source === 'google' ? 'Google Drive' : 'OneDrive'}
		</span>
	</div>
	<ArrowRight class="size-4" style="color: rgb(var(--text-muted));" />
	<div class="flex items-center gap-2 text-sm font-medium">
		<span style="color: rgb(var(--text-muted));">{m.transfer_destination()}:</span>
		<span class="rounded-md px-2.5 py-1 font-semibold" style="background-color: rgb(var(--surface)); color: rgb(var(--text));">
			{destination === 'google' ? 'Google Drive' : 'OneDrive'}
		</span>
	</div>
	<div class="ml-auto">
		<Button variant="secondary" size="sm" onclick={swap}>
			{#snippet children()}
				<ArrowLeftRight class="size-4" />
				{m.transfer_swap()}
			{/snippet}
		</Button>
	</div>
</div>

<!-- Instruction hint -->
<p class="mb-3 flex items-center gap-1.5 text-xs" style="color: rgb(var(--text-muted));">
	<Info class="size-3.5 shrink-0" />
	Click rows or checkboxes to select files. Click a folder name to browse inside it.
</p>

<FileTable
	{listing}
	{loading}
	selected={selectedIds}
	{breadcrumbs}
	onNavigate={(id: string, name: string) => loadFolder(id, name)}
	onUp={(idx: number) => {
		if (idx === 0) loadFolder('root', undefined, 0);
		else loadFolder(breadcrumbs[idx - 1].id, undefined, idx);
	}}
	onToggleSelect={toggleSelect}
	onSelectAll={selectAll}
	onClear={() => (selectedFiles = new Map())}
	onRefresh={() => loadFolder(currentFolderId)}
/>

<!-- Sticky bottom action bar -->
<div
	class="sticky bottom-0 z-10 -mx-4 mt-4 border-t"
	style="background-color: rgb(var(--surface) / 0.96); border-color: rgb(var(--border)); backdrop-filter: blur(12px);"
>
	<!-- Progress bar -->
	{#if progress.running || progress.done}
		{@const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}
		<div class="relative h-1.5 w-full overflow-hidden" style="background-color: rgb(var(--border));">
			<div
				class="absolute left-0 top-0 h-full transition-all duration-500 ease-out"
				style="width: {progress.done ? 100 : pct}%; background-color: rgb(var({progress.done ? '--success' : '--accent'}));"
			></div>
		</div>
	{/if}

	<div class="px-4 py-3">
		<!-- Progress label row (only while running) -->
		{#if progress.running && progress.total > 0}
			<div class="mb-2 flex items-center gap-2 text-sm" style="color: rgb(var(--text-muted));">
				<RefreshCw class="size-3.5 animate-spin shrink-0" />
				<span>
					{m.transfer_progress({ current: String(progress.current), total: String(progress.total) })}
				</span>
				<span class="ml-auto font-medium tabular-nums" style="color: rgb(var(--accent));">
					{progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%
				</span>
			</div>
		{/if}

		<div class="flex flex-wrap items-center justify-between gap-3">
			<div class="text-sm">
				{#if selectedFiles.size > 0}
					<div class="font-medium">
						{m.transfer_selected_count({ count: String(selectedFiles.size) })}
						<span class="mx-1.5 opacity-30">·</span>
						{#if planBytes != null}
							{m.transfer_selected_size({ size: formatBytes(planBytes, getLocale()) })}
						{:else if hasFolders}
							<span class="font-normal" style="color: rgb(var(--text-muted));">Size: calculating…</span>
						{:else}
							{m.transfer_selected_size({ size: formatBytes(selectedSize, getLocale()) })}
						{/if}
					</div>
				{:else}
					<div style="color: rgb(var(--text-muted));">No files selected</div>
				{/if}
				<div class="mt-0.5 text-xs" style="color: rgb(var(--text-muted));">
					{m.transfer_destination_free({ size: destQuota ? formatBytes(destQuota.free, getLocale()) : '—' })}
				</div>
				{#if insufficientSpace}
					<div class="mt-0.5 text-xs font-medium" style="color: rgb(var(--danger));">
						⚠ {m.transfer_insufficient_space()}
					</div>
				{/if}
			</div>

			<div class="flex items-center gap-3">
				<Button
					variant="primary"
					disabled={progress.running || checkingConflicts || selectedFiles.size === 0 || insufficientSpace}
					onclick={startTransfer}
				>
					{#snippet children()}
						{#if checkingConflicts}
							<RefreshCw class="size-4 animate-spin" />
							Checking…
						{:else if progress.running}
							<RefreshCw class="size-4 animate-spin" />
							Transferring…
						{:else}
							<Play class="size-4" />
							{m.transfer_start()}
						{/if}
					{/snippet}
				</Button>
			</div>
		</div>
	</div>
</div>

<!-- Workspace doc modal -->
<Modal
	open={showWorkspaceModal}
	title={m.modal_gdoc_title()}
	body={m.modal_gdoc_body()}
	onClose={() => (showWorkspaceModal = false)}
>
	{#snippet actions()}
		<Button variant="ghost" onclick={() => confirmWorkspace('skip')}>
			{#snippet children()}{m.modal_gdoc_skip()}{/snippet}
		</Button>
		<Button variant="primary" onclick={() => confirmWorkspace('convert')}>
			{#snippet children()}{m.modal_gdoc_convert()}{/snippet}
		</Button>
	{/snippet}
</Modal>

<!-- Conflict modal (only shown when conflicts detected) -->
<Modal
	open={showConflictModal}
	title={m.modal_conflict_title()}
	body={m.modal_conflict_body()}
	onClose={() => (showConflictModal = false)}
>
	{#snippet actions()}
		<Button variant="ghost" onclick={() => confirmConflict('skip')}>
			{#snippet children()}{m.modal_conflict_skip()}{/snippet}
		</Button>
		<Button variant="secondary" onclick={() => confirmConflict('overwrite')}>
			{#snippet children()}{m.modal_conflict_overwrite()}{/snippet}
		</Button>
		<Button variant="primary" onclick={() => confirmConflict('rename')}>
			{#snippet children()}{m.modal_conflict_rename()}{/snippet}
		</Button>
	{/snippet}
</Modal>
