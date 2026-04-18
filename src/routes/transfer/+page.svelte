<script lang="ts">
	import { ArrowRight, RefreshCw, ArrowLeftRight, Play } from 'lucide-svelte';
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

	let source = $state<Provider>('google');
	const destination = $derived<Provider>(source === 'google' ? 'microsoft' : 'google');

	let listing = $state<DriveListing | null>(null);
	let loading = $state(false);
	let breadcrumbs = $state<{ id: string; name: string }[]>([]);
	let selectedFiles = $state<Map<string, DriveFile>>(new Map());
	let destQuota = $state<Quota | null>(null);

	// Transfer options — surfaced via modals before we start
	let conflictStrategy = $state<ConflictStrategy>('rename');
	let workspaceStrategy = $state<WorkspaceDocStrategy>('convert');

	let showWorkspaceModal = $state(false);
	let showConflictModal = $state(false);
	let progress = $state<{
		running: boolean;
		current: number;
		total: number;
		message: string;
		failed: boolean;
	}>({ running: false, current: 0, total: 0, message: '', failed: false });

	const selectedIds = $derived(new Set(selectedFiles.keys()));
	const selectedSize = $derived(
		[...selectedFiles.values()].reduce((sum, f) => sum + (f.size ?? 0), 0)
	);
	const hasWorkspaceDocs = $derived(
		[...selectedFiles.values()].some((f) => f.isWorkspaceDoc) && source === 'google'
	);
	const insufficientSpace = $derived(
		destQuota?.free != null && selectedSize > destQuota.free
	);
	const currentFolderId = $derived(
		breadcrumbs.length === 0 ? 'root' : breadcrumbs[breadcrumbs.length - 1].id
	);

	async function loadFolder(folderId: string, name?: string, depth?: number) {
		loading = true;
		try {
			const res = await fetch(`/api/drive/${source}/list?folderId=${encodeURIComponent(folderId)}`);
			if (!res.ok) throw new Error(`List failed: ${res.status}`);
			listing = (await res.json()) as DriveListing;
			if (depth != null) {
				breadcrumbs = breadcrumbs.slice(0, depth);
			} else if (name && folderId !== 'root') {
				breadcrumbs = [...breadcrumbs, { id: folderId, name }];
			} else if (folderId === 'root') {
				breadcrumbs = [];
			}
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
		loadFolder('root');
		loadQuota();
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

	function clearSelection() {
		selectedFiles = new Map();
	}

	function startTransfer() {
		if (selectedFiles.size === 0 || insufficientSpace) return;
		if (hasWorkspaceDocs) {
			showWorkspaceModal = true;
			return;
		}
		showConflictModal = true;
	}

	function confirmWorkspace(strategy: WorkspaceDocStrategy) {
		workspaceStrategy = strategy;
		showWorkspaceModal = false;
		showConflictModal = true;
	}

	async function confirmConflict(strategy: ConflictStrategy) {
		conflictStrategy = strategy;
		showConflictModal = false;
		await runTransfer();
	}

	async function runTransfer() {
		progress = { running: true, current: 0, total: 0, message: '', failed: false };
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
			progress = { running: false, current: 0, total: 0, message: m.transfer_failed(), failed: true };
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
			progress = {
				...progress,
				total: ev.total as number
			};
		} else if (ev.type === 'progress') {
			progress = {
				...progress,
				current: ev.current as number,
				total: ev.total as number,
				message: m.transfer_progress({
					current: String(ev.current),
					total: String(ev.total)
				})
			};
		} else if (ev.type === 'done') {
			progress = { ...progress, running: false, message: m.transfer_done() };
			selectedFiles = new Map();
			loadQuota();
		} else if (ev.type === 'fatal') {
			const msg =
				ev.message === 'insufficient_space' ? m.transfer_insufficient_space() : m.transfer_failed();
			progress = { ...progress, running: false, failed: true, message: msg };
		}
	}

	$effect(() => {
		void source; // re-run on source change
		loadFolder('root');
		loadQuota();
	});
</script>

<div class="mb-6 flex flex-wrap items-center gap-3">
	<div
		class="flex items-center gap-2 rounded-md border px-3 py-2"
		style="border-color: rgb(var(--border));"
	>
		<span class="text-xs uppercase" style="color: rgb(var(--text-muted));">{m.transfer_source()}:</span>
		<span class="font-medium">{source === 'google' ? 'Google Drive' : 'OneDrive'}</span>
	</div>
	<Button variant="ghost" onclick={swap}>
		{#snippet children()}
			<ArrowLeftRight class="size-4" />
			{m.transfer_swap()}
		{/snippet}
	</Button>
	<ArrowRight class="size-5 opacity-50" />
	<div
		class="flex items-center gap-2 rounded-md border px-3 py-2"
		style="border-color: rgb(var(--border));"
	>
		<span class="text-xs uppercase" style="color: rgb(var(--text-muted));">{m.transfer_destination()}:</span>
		<span class="font-medium">{destination === 'google' ? 'Google Drive' : 'OneDrive'}</span>
	</div>
	<Button variant="ghost" onclick={() => { loadFolder(currentFolderId); loadQuota(); }}>
		{#snippet children()}
			<RefreshCw class="size-4" />
			{m.transfer_refresh()}
		{/snippet}
	</Button>
</div>

<FileTable
	{listing}
	{loading}
	selected={selectedIds}
	{breadcrumbs}
	onNavigate={(id, name) => loadFolder(id, name)}
	onUp={(idx) => {
		if (idx === 0) loadFolder('root', undefined, 0);
		else loadFolder(breadcrumbs[idx - 1].id, undefined, idx);
	}}
	onToggleSelect={toggleSelect}
	onSelectAll={selectAll}
	onClear={clearSelection}
/>

<div
	class="sticky bottom-0 mt-4 -mx-4 border-t px-4 py-3"
	style="background-color: rgb(var(--surface) / 0.95); border-color: rgb(var(--border)); backdrop-filter: blur(8px);"
>
	<div class="flex flex-wrap items-center justify-between gap-4">
		<div class="text-sm">
			<div>
				{m.transfer_selected_count({ count: String(selectedFiles.size) })}
				<span class="mx-2 opacity-40">·</span>
				{m.transfer_selected_size({ size: formatBytes(selectedSize, getLocale()) })}
			</div>
			<div style="color: rgb(var(--text-muted));" class="text-xs">
				{m.transfer_destination_free({
					size: destQuota ? formatBytes(destQuota.free, getLocale()) : '—'
				})}
			</div>
			{#if insufficientSpace}
				<div class="text-xs font-medium" style="color: rgb(var(--danger));">
					{m.transfer_insufficient_space()}
				</div>
			{/if}
		</div>
		<div class="flex items-center gap-3">
			{#if progress.running}
				<span class="text-sm" style="color: rgb(var(--text-muted));">{progress.message}</span>
			{:else if progress.message}
				<span
					class="text-sm"
					style={progress.failed ? 'color: rgb(var(--danger));' : 'color: rgb(var(--success));'}
				>
					{progress.message}
				</span>
			{/if}
			<Button
				variant="primary"
				disabled={progress.running || selectedFiles.size === 0 || insufficientSpace}
				onclick={startTransfer}
			>
				{#snippet children()}
					<Play class="size-4" />
					{m.transfer_start()}
				{/snippet}
			</Button>
		</div>
	</div>
</div>

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
