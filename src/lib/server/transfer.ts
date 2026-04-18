import type { DriveFile } from '$lib/types';
import { OFFICE_EXPORT_MIME, isWorkspaceDoc } from './providers/types';
import type { DriveProvider } from './providers/types';

export interface TransferPlanEntry {
	sourceFile: DriveFile;
	/** Folder path from the root of the selection, e.g. ['Photos', '2024'] */
	relativePath: string[];
	/** If source is a Workspace doc we'll export to Office — name with rewritten extension. */
	targetName: string;
	/** Mime type expected at destination after optional conversion. */
	targetMime: string;
	/** If Workspace doc: export mime to request. */
	exportMime?: string;
}

export interface TransferPlan {
	entries: TransferPlanEntry[];
	totalBytes: number;
}

/**
 * Walk the selected items, expanding folders recursively.
 * `workspaceDocs = 'skip'` drops Workspace docs from the plan.
 */
export async function buildTransferPlan(
	source: DriveProvider,
	selection: DriveFile[],
	workspaceDocs: 'convert' | 'skip'
): Promise<TransferPlan> {
	const entries: TransferPlanEntry[] = [];
	let totalBytes = 0;

	async function walk(file: DriveFile, relPath: string[]): Promise<void> {
		if (file.isFolder) {
			const listing = await source.list(file.id);
			const subPath = [...relPath, file.name];
			for (const child of listing.items) await walk(child, subPath);
			return;
		}
		if (file.isWorkspaceDoc) {
			if (workspaceDocs === 'skip') return;
			const mapping = OFFICE_EXPORT_MIME[file.mimeType];
			if (!mapping) return;
			entries.push({
				sourceFile: file,
				relativePath: relPath,
				targetName: file.name + mapping.ext,
				targetMime: mapping.mime,
				exportMime: mapping.mime
			});
			// size unknown for Workspace exports — don't add to total
			return;
		}
		entries.push({
			sourceFile: file,
			relativePath: relPath,
			targetName: file.name,
			targetMime: file.mimeType
		});
		if (file.size != null) totalBytes += file.size;
	}

	for (const item of selection) await walk(item, []);
	return { entries, totalBytes };
}

/** Ensure a nested folder path exists at destination; return the deepest folder id. */
export async function ensureFolderPath(
	dest: DriveProvider,
	rootId: string,
	segments: string[],
	cache: Map<string, string>
): Promise<string> {
	let parentId = rootId;
	let key = rootId;
	for (const name of segments) {
		key = `${key}/${name}`;
		const cached = cache.get(key);
		if (cached) {
			parentId = cached;
			continue;
		}
		const existing = await dest.findChildByName(parentId, name);
		if (existing && existing.isFolder) {
			parentId = existing.id;
		} else {
			parentId = await dest.createFolder(parentId, name);
		}
		cache.set(key, parentId);
	}
	return parentId;
}

/** Produce a non-conflicting name by appending " (1)", " (2)", etc. */
export async function renameForConflict(
	dest: DriveProvider,
	parentId: string,
	name: string
): Promise<string> {
	const dot = name.lastIndexOf('.');
	const base = dot > 0 ? name.slice(0, dot) : name;
	const ext = dot > 0 ? name.slice(dot) : '';
	for (let i = 1; i < 1000; i++) {
		const candidate = `${base} (${i})${ext}`;
		const hit = await dest.findChildByName(parentId, candidate);
		if (!hit) return candidate;
	}
	return `${base} (${Date.now()})${ext}`;
}

export { isWorkspaceDoc };
