import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { ConflictStrategy, Provider, TransferRequest } from '$lib/types';
import { getProvider } from '$lib/server/providers';
import {
	buildTransferPlan,
	ensureFolderPath,
	renameForConflict
} from '$lib/server/transfer';

function sseEvent(obj: unknown): Uint8Array {
	return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	const body = (await request.json()) as TransferRequest;

	if (
		!body ||
		(body.source !== 'google' && body.source !== 'microsoft') ||
		(body.destination !== 'google' && body.destination !== 'microsoft') ||
		body.source === body.destination ||
		!Array.isArray(body.fileIds) ||
		body.fileIds.length === 0
	) {
		throw error(400, 'Invalid transfer request');
	}

	const source = await getProvider(body.source as Provider, cookies);
	const dest = await getProvider(body.destination as Provider, cookies);
	if (!source || !dest) throw error(401, 'Both drives must be connected');

	const destRoot = body.destinationFolderId ?? 'root';
	const conflict: ConflictStrategy = body.conflict ?? 'rename';
	const workspaceDocs = body.workspaceDocs ?? 'convert';

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const emit = (e: unknown) => controller.enqueue(sseEvent(e));
			try {
				// 1. Load metadata for each selected id
				const selected = await Promise.all(body.fileIds.map((id) => source.getItem(id)));
				// 2. Walk and build plan
				const plan = await buildTransferPlan(source, selected, workspaceDocs);
				emit({
					type: 'plan',
					total: plan.entries.length,
					totalBytes: plan.totalBytes
				});

				// 3. Quota pre-check — only if destination reports a limit
				const quota = await dest.quota();
				if (quota.free != null && plan.totalBytes > quota.free) {
					emit({ type: 'fatal', message: 'insufficient_space' });
					controller.close();
					return;
				}

				// 4. Transfer
				const folderCache = new Map<string, string>();
				let done = 0;
				for (const entry of plan.entries) {
					try {
						const targetParent = await ensureFolderPath(
							dest,
							destRoot,
							entry.relativePath,
							folderCache
						);

						let targetName = entry.targetName;
						const existing = await dest.findChildByName(targetParent, targetName);
						if (existing) {
							if (conflict === 'skip') {
								emit({
									type: 'skipped',
									name: targetName,
									path: entry.relativePath.join('/'),
									reason: 'exists'
								});
								done++;
								emit({
									type: 'progress',
									current: done,
									total: plan.entries.length,
									name: targetName
								});
								continue;
							}
							if (conflict === 'rename') {
								targetName = await renameForConflict(dest, targetParent, targetName);
							} else if (conflict === 'overwrite') {
								await dest.deleteItem(existing.id);
							}
						}

						const { stream: srcStream, size, contentType } = await source.download(
							entry.sourceFile.id,
							entry.exportMime
						);

						let uploadSize = size ?? entry.sourceFile.size;
						let uploadStream = srcStream;

						// If size unknown (e.g. Workspace doc export), buffer up to a safe cap
						if (uploadSize == null) {
							const reader = srcStream.getReader();
							const chunks: Uint8Array[] = [];
							let total = 0;
							const MAX = 256 * 1024 * 1024; // 256 MiB cap for unknown-size items
							while (true) {
								const { value, done: rDone } = await reader.read();
								if (rDone) break;
								total += value.byteLength;
								if (total > MAX) throw new Error('Exported document exceeds buffer cap');
								chunks.push(value);
							}
							const buffer = new Uint8Array(total);
							let w = 0;
							for (const c of chunks) {
								buffer.set(c, w);
								w += c.byteLength;
							}
							uploadSize = total;
							uploadStream = new ReadableStream({
								start(c) {
									c.enqueue(buffer);
									c.close();
								}
							});
						}

						await dest.uploadStream(
							targetParent,
							targetName,
							uploadSize,
							entry.targetMime || contentType,
							uploadStream
						);

						done++;
						emit({
							type: 'progress',
							current: done,
							total: plan.entries.length,
							name: targetName,
							bytes: uploadSize
						});
					} catch (err) {
						emit({
							type: 'error',
							name: entry.targetName,
							path: entry.relativePath.join('/'),
							message: (err as Error).message
						});
						done++;
						emit({
							type: 'progress',
							current: done,
							total: plan.entries.length,
							name: entry.targetName
						});
					}
				}
				emit({ type: 'done' });
			} catch (err) {
				emit({ type: 'fatal', message: (err as Error).message });
			} finally {
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no'
		}
	});
};
