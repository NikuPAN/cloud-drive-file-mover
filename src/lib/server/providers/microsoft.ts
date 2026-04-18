import type { Cookies } from '@sveltejs/kit';
import type { DriveFile, DriveListing, Quota, SessionData } from '$lib/types';
import { microsoftClient, microsoftScopes } from '../oauth';
import { readSession, writeSession } from '../session';
import type { DriveProvider } from './types';

const API = 'https://graph.microsoft.com/v1.0';
const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MiB — must be multiple of 320 KiB per Graph docs
const SIMPLE_UPLOAD_LIMIT = 4 * 1024 * 1024; // 4 MiB

interface GraphItem {
	id: string;
	name: string;
	size?: number;
	lastModifiedDateTime: string;
	folder?: { childCount: number };
	file?: { mimeType?: string };
	parentReference?: { id?: string };
}

function toDriveFile(item: GraphItem): DriveFile {
	const isFolder = !!item.folder;
	return {
		id: item.id,
		name: item.name,
		mimeType: isFolder ? 'application/vnd.onedrive.folder' : (item.file?.mimeType ?? 'application/octet-stream'),
		size: item.size ?? null,
		modifiedTime: item.lastModifiedDateTime,
		isFolder,
		isWorkspaceDoc: false,
		parents: item.parentReference?.id ? [item.parentReference.id] : undefined
	};
}

export class OneDriveProvider implements DriveProvider {
	constructor(
		private session: SessionData,
		private cookies: Cookies
	) {}

	async getAccessToken(): Promise<string> {
		const m = this.session.microsoft;
		if (!m) throw new Error('Microsoft is not connected');
		if (Date.now() < m.expiresAt - 60_000) return m.accessToken;
		if (!m.refreshToken) throw new Error('Microsoft session expired; please sign in again');

		const tokens = await microsoftClient().refreshAccessToken(m.refreshToken, microsoftScopes);
		m.accessToken = tokens.accessToken();
		m.expiresAt = tokens.accessTokenExpiresAt().getTime();
		if (tokens.hasRefreshToken()) m.refreshToken = tokens.refreshToken();
		await writeSession(this.cookies, this.session);
		return m.accessToken;
	}

	private async authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
		const token = await this.getAccessToken();
		const headers = new Headers(init.headers);
		headers.set('Authorization', `Bearer ${token}`);
		const res = await fetch(input, { ...init, headers });
		if (!res.ok && res.status === 401) {
			this.session.microsoft!.expiresAt = 0;
			const newToken = await this.getAccessToken();
			headers.set('Authorization', `Bearer ${newToken}`);
			return fetch(input, { ...init, headers });
		}
		return res;
	}

	async list(folderId: string): Promise<DriveListing> {
		const path =
			folderId === 'root'
				? `${API}/me/drive/root/children?$top=1000`
				: `${API}/me/drive/items/${folderId}/children?$top=1000`;
		const items: DriveFile[] = [];
		let next: string | undefined = path;
		while (next) {
			const res: Response = await this.authedFetch(next);
			if (!res.ok) throw new Error(`OneDrive list failed: ${res.status}`);
			const data = (await res.json()) as { value: GraphItem[]; '@odata.nextLink'?: string };
			for (const v of data.value) items.push(toDriveFile(v));
			next = data['@odata.nextLink'];
		}

		items.sort((a, b) => {
			if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
			return a.name.localeCompare(b.name);
		});

		const folderName = folderId === 'root' ? 'OneDrive' : (await this.getItem(folderId)).name;
		return { items, folderId, folderName, breadcrumbs: [] };
	}

	async getItem(itemId: string): Promise<DriveFile> {
		const url = itemId === 'root' ? `${API}/me/drive/root` : `${API}/me/drive/items/${itemId}`;
		const res = await this.authedFetch(url);
		if (!res.ok) throw new Error(`OneDrive getItem failed: ${res.status}`);
		return toDriveFile((await res.json()) as GraphItem);
	}

	async quota(): Promise<Quota> {
		const res = await this.authedFetch(`${API}/me/drive?$select=quota`);
		if (!res.ok) throw new Error(`OneDrive quota failed: ${res.status}`);
		const data = (await res.json()) as {
			quota: { total?: number; used?: number; remaining?: number };
		};
		return {
			total: data.quota.total ?? null,
			used: data.quota.used ?? 0,
			free: data.quota.remaining ?? null
		};
	}

	async download(
		fileId: string
	): Promise<{ stream: ReadableStream<Uint8Array>; size: number | null; contentType: string }> {
		const res = await this.authedFetch(`${API}/me/drive/items/${fileId}/content`);
		if (!res.ok || !res.body) throw new Error(`OneDrive download failed: ${res.status}`);
		const len = res.headers.get('content-length');
		return {
			stream: res.body,
			size: len ? Number(len) : null,
			contentType: res.headers.get('content-type') ?? 'application/octet-stream'
		};
	}

	async createFolder(parentId: string, name: string): Promise<string> {
		const url =
			parentId === 'root'
				? `${API}/me/drive/root/children`
				: `${API}/me/drive/items/${parentId}/children`;
		const res = await this.authedFetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name,
				folder: {},
				'@microsoft.graph.conflictBehavior': 'rename'
			})
		});
		if (!res.ok) throw new Error(`OneDrive createFolder failed: ${res.status}`);
		const data = (await res.json()) as { id: string };
		return data.id;
	}

	async findChildByName(parentId: string, name: string): Promise<DriveFile | null> {
		// URL-escape single-quotes + other characters
		const encoded = encodeURIComponent(name).replace(/'/g, '%27');
		const url =
			parentId === 'root'
				? `${API}/me/drive/root:/${encoded}`
				: `${API}/me/drive/items/${parentId}:/${encoded}`;
		const res = await this.authedFetch(url);
		if (res.status === 404) return null;
		if (!res.ok) throw new Error(`OneDrive findChildByName failed: ${res.status}`);
		return toDriveFile((await res.json()) as GraphItem);
	}

	async deleteItem(itemId: string): Promise<void> {
		const res = await this.authedFetch(`${API}/me/drive/items/${itemId}`, { method: 'DELETE' });
		if (!res.ok && res.status !== 204) throw new Error(`OneDrive deleteItem failed: ${res.status}`);
	}

	async uploadStream(
		parentId: string,
		name: string,
		size: number,
		contentType: string,
		stream: ReadableStream<Uint8Array>
	): Promise<void> {
		if (size > 0 && size <= SIMPLE_UPLOAD_LIMIT) {
			return this.simpleUpload(parentId, name, contentType, stream);
		}
		return this.chunkedUpload(parentId, name, size, contentType, stream);
	}

	private async simpleUpload(
		parentId: string,
		name: string,
		contentType: string,
		stream: ReadableStream<Uint8Array>
	): Promise<void> {
		const encoded = encodeURIComponent(name).replace(/'/g, '%27');
		const url =
			parentId === 'root'
				? `${API}/me/drive/root:/${encoded}:/content`
				: `${API}/me/drive/items/${parentId}:/${encoded}:/content`;
		const res = await this.authedFetch(url, {
			method: 'PUT',
			headers: { 'Content-Type': contentType },
			body: stream,
			// @ts-expect-error — duplex required for streaming bodies
			duplex: 'half'
		});
		if (!res.ok) throw new Error(`OneDrive simple upload failed: ${res.status}`);
	}

	private async chunkedUpload(
		parentId: string,
		name: string,
		size: number,
		contentType: string,
		stream: ReadableStream<Uint8Array>
	): Promise<void> {
		const encoded = encodeURIComponent(name).replace(/'/g, '%27');
		const sessionUrl =
			parentId === 'root'
				? `${API}/me/drive/root:/${encoded}:/createUploadSession`
				: `${API}/me/drive/items/${parentId}:/${encoded}:/createUploadSession`;

		const sessRes = await this.authedFetch(sessionUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				item: {
					'@microsoft.graph.conflictBehavior': 'replace',
					name
				}
			})
		});
		if (!sessRes.ok) throw new Error(`OneDrive upload-session failed: ${sessRes.status}`);
		const { uploadUrl } = (await sessRes.json()) as { uploadUrl: string };

		const reader = stream.getReader();
		let offset = 0;
		let pending: Uint8Array | null = null;

		const flushChunk = async (chunk: Uint8Array, isLast: boolean) => {
			const end = offset + chunk.byteLength - 1;
			const res = await fetch(uploadUrl, {
				method: 'PUT',
				headers: {
					'Content-Length': String(chunk.byteLength),
					'Content-Range': `bytes ${offset}-${end}/${size}`,
					'Content-Type': contentType
				},
				body: chunk as unknown as BodyInit
			});
			if (!res.ok && !(isLast && (res.status === 200 || res.status === 201))) {
				throw new Error(`OneDrive chunk upload failed: ${res.status}`);
			}
			offset = end + 1;
		};

		const buf: Uint8Array[] = [];
		let bufLen = 0;

		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			buf.push(value);
			bufLen += value.byteLength;

			while (bufLen >= CHUNK_SIZE) {
				const chunk = concat(buf, CHUNK_SIZE);
				buf.length = 0;
				if (chunk.leftover) buf.push(chunk.leftover);
				bufLen = chunk.leftover?.byteLength ?? 0;
				await flushChunk(chunk.data, false);
			}
		}
		if (bufLen > 0) {
			const chunk = concat(buf, bufLen);
			await flushChunk(chunk.data, true);
		}
		void pending; // suppress unused
	}
}

function concat(
	parts: Uint8Array[],
	take: number
): { data: Uint8Array; leftover: Uint8Array | null } {
	let total = 0;
	for (const p of parts) total += p.byteLength;
	const amount = Math.min(take, total);
	const out = new Uint8Array(amount);
	let written = 0;
	let leftoverStart: { partIdx: number; offset: number } | null = null;
	for (let i = 0; i < parts.length; i++) {
		const p = parts[i];
		const need = amount - written;
		if (need <= 0) {
			leftoverStart = { partIdx: i, offset: 0 };
			break;
		}
		if (p.byteLength <= need) {
			out.set(p, written);
			written += p.byteLength;
		} else {
			out.set(p.subarray(0, need), written);
			written += need;
			leftoverStart = { partIdx: i, offset: need };
			break;
		}
	}
	if (!leftoverStart) return { data: out, leftover: null };
	const tailParts: Uint8Array[] = [];
	const first = parts[leftoverStart.partIdx];
	if (leftoverStart.offset < first.byteLength) {
		tailParts.push(first.subarray(leftoverStart.offset));
	}
	for (let i = leftoverStart.partIdx + 1; i < parts.length; i++) tailParts.push(parts[i]);
	if (tailParts.length === 0) return { data: out, leftover: null };
	let tailLen = 0;
	for (const p of tailParts) tailLen += p.byteLength;
	const leftover = new Uint8Array(tailLen);
	let w = 0;
	for (const p of tailParts) {
		leftover.set(p, w);
		w += p.byteLength;
	}
	return { data: out, leftover };
}

export async function onedriveProvider(cookies: Cookies): Promise<OneDriveProvider | null> {
	const session = await readSession(cookies);
	if (!session.microsoft) return null;
	return new OneDriveProvider(session, cookies);
}
