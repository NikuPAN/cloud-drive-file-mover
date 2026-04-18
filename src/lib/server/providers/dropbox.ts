import type { Cookies } from '@sveltejs/kit';
import type { DriveFile, DriveListing, Quota, SessionData } from '$lib/types';
import { dropboxClient } from '../oauth';
import { readSession, writeSession } from '../session';
import type { DriveProvider } from './types';

const API = 'https://api.dropboxapi.com/2';
const CONTENT_API = 'https://content.dropboxapi.com/2';
const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MiB

interface DbxMetadata {
	'.tag': 'file' | 'folder';
	id: string;
	name: string;
	size?: number;
	client_modified?: string;
	path_lower?: string;
	path_display?: string;
}

function toDropboxPath(folderId: string): string {
	// folderId is either 'root' or a Dropbox path like '/Photos'
	return folderId === 'root' ? '' : folderId;
}

function toDriveFile(item: DbxMetadata): DriveFile {
	const isFolder = item['.tag'] === 'folder';
	return {
		id: item.path_lower ?? item.id,
		name: item.name,
		mimeType: isFolder ? 'application/vnd.dropbox.folder' : 'application/octet-stream',
		size: item.size ?? null,
		modifiedTime: item.client_modified ?? new Date(0).toISOString(),
		isFolder,
		isWorkspaceDoc: false
	};
}

export class DropboxProvider implements DriveProvider {
	constructor(
		private session: SessionData,
		private cookies: Cookies
	) {}

	async getAccessToken(): Promise<string> {
		const d = this.session.dropbox;
		if (!d) throw new Error('Dropbox is not connected');
		if (Date.now() < d.expiresAt - 60_000) return d.accessToken;
		if (!d.refreshToken) throw new Error('Dropbox session expired; please sign in again');

		const tokens = await dropboxClient().refreshAccessToken(d.refreshToken);
		d.accessToken = tokens.accessToken();
		d.expiresAt = tokens.accessTokenExpiresAt().getTime();
		if (tokens.hasRefreshToken()) d.refreshToken = tokens.refreshToken();
		await writeSession(this.cookies, this.session);
		return d.accessToken;
	}

	private async authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
		const token = await this.getAccessToken();
		const headers = new Headers(init.headers);
		headers.set('Authorization', `Bearer ${token}`);
		const res = await fetch(input, { ...init, headers });
		if (!res.ok && res.status === 401) {
			this.session.dropbox!.expiresAt = 0;
			const newToken = await this.getAccessToken();
			headers.set('Authorization', `Bearer ${newToken}`);
			return fetch(input, { ...init, headers });
		}
		return res;
	}

	async list(folderId: string): Promise<DriveListing> {
		const path = toDropboxPath(folderId);
		const items: DriveFile[] = [];
		let cursor: string | undefined;
		let hasMore = true;

		while (hasMore) {
			const res = cursor
			? await this.authedFetch(`${API}/files/list_folder/continue`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ cursor })
				})
			: await this.authedFetch(`${API}/files/list_folder`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ path, limit: 2000 })
				});

			if (!res.ok) throw new Error(`Dropbox list failed: ${res.status}`);
			const data = (await res.json()) as {
				entries: DbxMetadata[];
				cursor: string;
				has_more: boolean;
			};

			for (const e of data.entries) items.push(toDriveFile(e));
			cursor = data.cursor;
			hasMore = data.has_more;
		}

		items.sort((a, b) => {
			if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
			return a.name.localeCompare(b.name);
		});

		const folderName = folderId === 'root' ? 'Dropbox' : folderId.split('/').pop() ?? folderId;
		return { items, folderId, folderName, breadcrumbs: [] };
	}

	async getItem(itemId: string): Promise<DriveFile> {
		const res = await this.authedFetch(`${API}/files/get_metadata`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ path: itemId })
		});
		if (!res.ok) throw new Error(`Dropbox getItem failed: ${res.status}`);
		return toDriveFile((await res.json()) as DbxMetadata);
	}

	async quota(): Promise<Quota> {
		const res = await this.authedFetch(`${API}/users/get_space_usage`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: null
		});
		if (!res.ok) throw new Error(`Dropbox quota failed: ${res.status}`);
		const data = (await res.json()) as {
			used: number;
			allocation: { '.tag': string; allocated?: number };
		};
		const total = data.allocation.allocated ?? null;
		const used = data.used;
		return { total, used, free: total != null ? total - used : null };
	}

	async download(
		fileId: string
	): Promise<{ stream: ReadableStream<Uint8Array>; size: number | null; contentType: string }> {
		const res = await this.authedFetch(`${CONTENT_API}/files/download`, {
			method: 'POST',
			headers: {
				'Dropbox-API-Arg': JSON.stringify({ path: fileId }),
				'Content-Type': ''
			}
		});
		if (!res.ok || !res.body) throw new Error(`Dropbox download failed: ${res.status}`);
		const meta = res.headers.get('dropbox-api-result');
		const parsed = meta ? (JSON.parse(meta) as DbxMetadata) : null;
		return {
			stream: res.body,
			size: parsed?.size ?? null,
			contentType: 'application/octet-stream'
		};
	}

	async createFolder(parentId: string, name: string): Promise<string> {
		const path = parentId === 'root' ? `/${name}` : `${parentId}/${name}`;
		const res = await this.authedFetch(`${API}/files/create_folder_v2`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ path, autorename: false })
		});
		if (!res.ok) throw new Error(`Dropbox createFolder failed: ${res.status}`);
		const data = (await res.json()) as { metadata: DbxMetadata };
		return data.metadata.path_lower ?? path.toLowerCase();
	}

	async findChildByName(parentId: string, name: string): Promise<DriveFile | null> {
		const path =
			parentId === 'root' ? `/${name}` : `${parentId}/${name}`;
		const res = await this.authedFetch(`${API}/files/get_metadata`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ path })
		});
		if (res.status === 409) return null; // path not found
		if (!res.ok) return null;
		const data = (await res.json()) as DbxMetadata & { error_summary?: string };
		if (data.error_summary) return null;
		return toDriveFile(data);
	}

	async deleteItem(itemId: string): Promise<void> {
		const res = await this.authedFetch(`${API}/files/delete_v2`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ path: itemId })
		});
		if (!res.ok) throw new Error(`Dropbox deleteItem failed: ${res.status}`);
	}

	async uploadStream(
		parentId: string,
		name: string,
		size: number,
		_contentType: string,
		stream: ReadableStream<Uint8Array>
	): Promise<void> {
		const destPath = parentId === 'root' ? `/${name}` : `${parentId}/${name}`;

		if (size <= CHUNK_SIZE) {
			// Single-request upload
			const reader = stream.getReader();
			const chunks: Uint8Array[] = [];
			while (true) {
				const { value, done } = await reader.read();
				if (done) break;
				chunks.push(value);
			}
			const buf = new Uint8Array(size);
			let w = 0;
			for (const c of chunks) { buf.set(c, w); w += c.byteLength; }

			const res = await this.authedFetch(`${CONTENT_API}/files/upload`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/octet-stream',
					'Dropbox-API-Arg': JSON.stringify({ path: destPath, mode: 'overwrite', autorename: false })
				},
				body: buf as unknown as BodyInit
			});
			if (!res.ok) throw new Error(`Dropbox upload failed: ${res.status}`);
			return;
		}

		// Chunked upload session
		const reader = stream.getReader();
		let sessionId: string | undefined;
		let offset = 0;
		const buf: Uint8Array[] = [];
		let bufLen = 0;

		const flush = async (chunk: Uint8Array, isFinal: boolean) => {
			if (!sessionId) {
				// start session
				const startRes = await this.authedFetch(`${CONTENT_API}/files/upload_session/start`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/octet-stream',
						'Dropbox-API-Arg': JSON.stringify({ close: false })
					},
					body: chunk as unknown as BodyInit
				});
				if (!startRes.ok) throw new Error(`Dropbox upload-session start failed: ${startRes.status}`);
				const data = (await startRes.json()) as { session_id: string };
				sessionId = data.session_id;
				offset += chunk.byteLength;
				return;
			}
			if (isFinal) {
				const finishRes = await this.authedFetch(`${CONTENT_API}/files/upload_session/finish`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/octet-stream',
						'Dropbox-API-Arg': JSON.stringify({
							cursor: { session_id: sessionId, offset },
							commit: { path: destPath, mode: 'overwrite', autorename: false }
						})
					},
					body: chunk as unknown as BodyInit
				});
				if (!finishRes.ok) throw new Error(`Dropbox upload-session finish failed: ${finishRes.status}`);
				return;
			}
			const appendRes = await this.authedFetch(`${CONTENT_API}/files/upload_session/append_v2`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/octet-stream',
					'Dropbox-API-Arg': JSON.stringify({ cursor: { session_id: sessionId, offset }, close: false })
				},
				body: chunk as unknown as BodyInit
			});
			if (!appendRes.ok) throw new Error(`Dropbox upload-session append failed: ${appendRes.status}`);
			offset += chunk.byteLength;
		};

		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			buf.push(value);
			bufLen += value.byteLength;
			while (bufLen >= CHUNK_SIZE) {
				const chunk = extractChunk(buf, CHUNK_SIZE);
				bufLen -= CHUNK_SIZE;
				await flush(chunk.data, false);
				if (chunk.leftover) { buf.length = 0; buf.push(chunk.leftover); }
				else buf.length = 0;
			}
		}
		// final chunk
		const finalBuf = new Uint8Array(bufLen);
		let w = 0;
		for (const c of buf) { finalBuf.set(c, w); w += c.byteLength; }
		await flush(finalBuf, true);
	}
}

function extractChunk(parts: Uint8Array[], take: number): { data: Uint8Array; leftover: Uint8Array | null } {
	const out = new Uint8Array(take);
	let written = 0;
	const remaining: Uint8Array[] = [];
	let hasRemainder = false;
	for (const p of parts) {
		if (written >= take) { remaining.push(p); hasRemainder = true; continue; }
		const need = take - written;
		if (p.byteLength <= need) { out.set(p, written); written += p.byteLength; }
		else { out.set(p.subarray(0, need), written); written += need; remaining.push(p.subarray(need)); hasRemainder = true; }
	}
	if (!hasRemainder) return { data: out, leftover: null };
	let len = 0;
	for (const r of remaining) len += r.byteLength;
	const lo = new Uint8Array(len);
	let lw = 0;
	for (const r of remaining) { lo.set(r, lw); lw += r.byteLength; }
	return { data: out, leftover: lo };
}

export async function dropboxProvider(cookies: Cookies): Promise<DropboxProvider | null> {
	const session = await readSession(cookies);
	if (!session.dropbox) return null;
	return new DropboxProvider(session, cookies);
}
