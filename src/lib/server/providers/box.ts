import type { Cookies } from '@sveltejs/kit';
import type { DriveFile, DriveListing, Quota, SessionData } from '$lib/types';
import { boxClient } from '../oauth';
import { readSession, writeSession } from '../session';
import type { DriveProvider } from './types';

const API = 'https://api.box.com/2.0';
const UPLOAD_API = 'https://upload.box.com/api/2.0';
const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MiB — Box minimum chunk is 1 MiB

interface BoxItem {
	id: string;
	name: string;
	type: 'file' | 'folder';
	size?: number;
	modified_at?: string;
	parent?: { id: string };
}

function toDriveFile(item: BoxItem): DriveFile {
	const isFolder = item.type === 'folder';
	return {
		id: item.id,
		name: item.name,
		mimeType: isFolder ? 'application/vnd.box.folder' : 'application/octet-stream',
		size: item.size ?? null,
		modifiedTime: item.modified_at ?? new Date(0).toISOString(),
		isFolder,
		isWorkspaceDoc: false,
		parents: item.parent ? [item.parent.id] : undefined
	};
}

export class BoxProvider implements DriveProvider {
	constructor(
		private session: SessionData,
		private cookies: Cookies
	) {}

	async getAccessToken(): Promise<string> {
		const b = this.session.box;
		if (!b) throw new Error('Box is not connected');
		if (Date.now() < b.expiresAt - 60_000) return b.accessToken;
		if (!b.refreshToken) throw new Error('Box session expired; please sign in again');

		const tokens = await boxClient().refreshAccessToken(b.refreshToken);
		b.accessToken = tokens.accessToken();
		b.expiresAt = tokens.accessTokenExpiresAt().getTime();
		if (tokens.hasRefreshToken()) b.refreshToken = tokens.refreshToken();
		await writeSession(this.cookies, this.session);
		return b.accessToken;
	}

	private async authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
		const token = await this.getAccessToken();
		const headers = new Headers(init.headers);
		headers.set('Authorization', `Bearer ${token}`);
		const res = await fetch(input, { ...init, headers });
		if (!res.ok && res.status === 401) {
			this.session.box!.expiresAt = 0;
			const newToken = await this.getAccessToken();
			headers.set('Authorization', `Bearer ${newToken}`);
			return fetch(input, { ...init, headers });
		}
		return res;
	}

	async list(folderId: string): Promise<DriveListing> {
		const id = folderId === 'root' ? '0' : folderId;
		const items: DriveFile[] = [];
		let offset = 0;
		const limit = 1000;

		while (true) {
			const res = await this.authedFetch(
				`${API}/folders/${id}/items?fields=id,name,type,size,modified_at,parent&limit=${limit}&offset=${offset}`
			);
			if (!res.ok) throw new Error(`Box list failed: ${res.status}`);
			const data = (await res.json()) as {
				entries: BoxItem[];
				total_count: number;
			};
			for (const e of data.entries) items.push(toDriveFile(e));
			offset += data.entries.length;
			if (offset >= data.total_count) break;
		}

		items.sort((a, b) => {
			if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
			return a.name.localeCompare(b.name);
		});

		const folderName = id === '0' ? 'Box' : (await this.getItem(id)).name;
		return { items, folderId, folderName, breadcrumbs: [] };
	}

	async getItem(itemId: string): Promise<DriveFile> {
		const id = itemId === 'root' ? '0' : itemId;
		// Try file first, then folder
		const fileRes = await this.authedFetch(`${API}/files/${id}?fields=id,name,type,size,modified_at,parent`);
		if (fileRes.ok) return toDriveFile((await fileRes.json()) as BoxItem);
		const folderRes = await this.authedFetch(`${API}/folders/${id}?fields=id,name,type,size,modified_at,parent`);
		if (!folderRes.ok) throw new Error(`Box getItem failed: ${folderRes.status}`);
		return toDriveFile((await folderRes.json()) as BoxItem);
	}

	async quota(): Promise<Quota> {
		const res = await this.authedFetch(`${API}/users/me?fields=space_used,space_amount`);
		if (!res.ok) throw new Error(`Box quota failed: ${res.status}`);
		const data = (await res.json()) as { space_used: number; space_amount: number };
		const total = data.space_amount > 0 ? data.space_amount : null;
		const used = data.space_used;
		return { total, used, free: total != null ? total - used : null };
	}

	async download(
		fileId: string
	): Promise<{ stream: ReadableStream<Uint8Array>; size: number | null; contentType: string }> {
		const res = await this.authedFetch(`${API}/files/${fileId}/content`);
		if (!res.ok || !res.body) throw new Error(`Box download failed: ${res.status}`);
		const len = res.headers.get('content-length');
		return {
			stream: res.body,
			size: len ? Number(len) : null,
			contentType: res.headers.get('content-type') ?? 'application/octet-stream'
		};
	}

	async createFolder(parentId: string, name: string): Promise<string> {
		const parent = parentId === 'root' ? '0' : parentId;
		const res = await this.authedFetch(`${API}/folders`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name, parent: { id: parent } })
		});
		if (!res.ok) throw new Error(`Box createFolder failed: ${res.status}`);
		const data = (await res.json()) as { id: string };
		return data.id;
	}

	async findChildByName(parentId: string, name: string): Promise<DriveFile | null> {
		const id = parentId === 'root' ? '0' : parentId;
		const q = encodeURIComponent(name);
		const res = await this.authedFetch(
			`${API}/search?query=${q}&ancestor_folder_ids=${id}&fields=id,name,type,size,modified_at,parent&limit=5`
		);
		if (!res.ok) return null;
		const data = (await res.json()) as { entries: BoxItem[] };
		const match = data.entries.find(
			(e) => e.name.toLowerCase() === name.toLowerCase() && e.parent?.id === id
		);
		return match ? toDriveFile(match) : null;
	}

	async deleteItem(itemId: string): Promise<void> {
		// Try file delete first, then folder
		const fileRes = await this.authedFetch(`${API}/files/${itemId}`, { method: 'DELETE' });
		if (fileRes.ok || fileRes.status === 204) return;
		const folderRes = await this.authedFetch(`${API}/folders/${itemId}?recursive=true`, { method: 'DELETE' });
		if (!folderRes.ok && folderRes.status !== 204) {
			throw new Error(`Box deleteItem failed: ${folderRes.status}`);
		}
	}

	async uploadStream(
		parentId: string,
		name: string,
		size: number,
		_contentType: string,
		stream: ReadableStream<Uint8Array>
	): Promise<void> {
		const parent = parentId === 'root' ? '0' : parentId;

		if (size <= CHUNK_SIZE) {
			return this.simpleUpload(parent, name, size, stream);
		}
		return this.chunkedUpload(parent, name, size, stream);
	}

	private async simpleUpload(
		parentId: string,
		name: string,
		size: number,
		stream: ReadableStream<Uint8Array>
	): Promise<void> {
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

		const form = new FormData();
		form.append('attributes', JSON.stringify({ name, parent: { id: parentId } }));
		form.append('file', new Blob([buf]), name);

		const res = await this.authedFetch(`${UPLOAD_API}/files/content`, {
			method: 'POST',
			body: form
		});
		if (!res.ok) throw new Error(`Box upload failed: ${res.status}`);
	}

	private async chunkedUpload(
		parentId: string,
		name: string,
		size: number,
		stream: ReadableStream<Uint8Array>
	): Promise<void> {
		// 1. Create upload session
		const sessRes = await this.authedFetch(`${UPLOAD_API}/files/upload_sessions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ folder_id: parentId, file_name: name, file_size: size })
		});
		if (!sessRes.ok) throw new Error(`Box upload-session failed: ${sessRes.status}`);
		const sessData = (await sessRes.json()) as { id: string; part_size: number };
		const sessionId = sessData.id;
		const partSize = sessData.part_size;

		// 2. Upload parts
		const parts: { part_id: string; offset: number; size: number }[] = [];
		const reader = stream.getReader();
		const buf: Uint8Array[] = [];
		let bufLen = 0;
		let offset = 0;

		const flushPart = async (chunk: Uint8Array) => {
			const end = offset + chunk.byteLength - 1;
			const sha256 = await crypto.subtle.digest('SHA-256', chunk.buffer as ArrayBuffer);
			const sha256b64 = btoa(String.fromCharCode(...new Uint8Array(sha256)));
			const partRes = await this.authedFetch(`${UPLOAD_API}/files/upload_sessions/${sessionId}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/octet-stream',
					'Content-Range': `bytes ${offset}-${end}/${size}`,
					Digest: `sha=${sha256b64}`
				},
				body: chunk as unknown as BodyInit
			});
			if (!partRes.ok) throw new Error(`Box chunk upload failed: ${partRes.status}`);
			const partData = (await partRes.json()) as { part: { part_id: string; offset: number; size: number } };
			parts.push(partData.part);
			offset += chunk.byteLength;
		};

		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			buf.push(value);
			bufLen += value.byteLength;
			while (bufLen >= partSize) {
				const chunk = buildChunk(buf, partSize);
				bufLen -= partSize;
				buf.length = 0;
				if (chunk.leftover) buf.push(chunk.leftover);
				await flushPart(chunk.data);
			}
		}
		if (bufLen > 0) {
			const finalBuf = new Uint8Array(bufLen);
			let w = 0;
			for (const c of buf) { finalBuf.set(c, w); w += c.byteLength; }
			await flushPart(finalBuf);
		}

		// 3. Commit session
		const commitRes = await this.authedFetch(`${UPLOAD_API}/files/upload_sessions/${sessionId}/commit`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ parts, attributes: { name, parent: { id: parentId } } })
		});
		if (!commitRes.ok && commitRes.status !== 201 && commitRes.status !== 202) {
			throw new Error(`Box upload-session commit failed: ${commitRes.status}`);
		}
	}
}

function buildChunk(parts: Uint8Array[], take: number): { data: Uint8Array; leftover: Uint8Array | null } {
	const out = new Uint8Array(take);
	let written = 0;
	const rem: Uint8Array[] = [];
	for (const p of parts) {
		if (written >= take) { rem.push(p); continue; }
		const need = take - written;
		if (p.byteLength <= need) { out.set(p, written); written += p.byteLength; }
		else { out.set(p.subarray(0, need), written); written += need; rem.push(p.subarray(need)); }
	}
	if (rem.length === 0) return { data: out, leftover: null };
	let len = 0;
	for (const r of rem) len += r.byteLength;
	const lo = new Uint8Array(len);
	let lw = 0;
	for (const r of rem) { lo.set(r, lw); lw += r.byteLength; }
	return { data: out, leftover: lo };
}

export async function boxProvider(cookies: Cookies): Promise<BoxProvider | null> {
	const session = await readSession(cookies);
	if (!session.box) return null;
	return new BoxProvider(session, cookies);
}
