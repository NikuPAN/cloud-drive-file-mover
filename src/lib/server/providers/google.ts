import type { Cookies } from '@sveltejs/kit';
import type { DriveFile, DriveListing, Quota, SessionData } from '$lib/types';
import { googleClient } from '../oauth';
import { readSession, writeSession } from '../session';
import {
	GOOGLE_WORKSPACE_MIME,
	OFFICE_EXPORT_MIME,
	isWorkspaceDoc,
	type DriveProvider
} from './types';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

export class GoogleDriveProvider implements DriveProvider {
	constructor(
		private session: SessionData,
		private cookies: Cookies
	) {}

	async getAccessToken(): Promise<string> {
		const g = this.session.google;
		if (!g) throw new Error('Google is not connected');
		if (Date.now() < g.expiresAt - 60_000) return g.accessToken;
		if (!g.refreshToken) throw new Error('Google session expired; please sign in again');

		const tokens = await googleClient().refreshAccessToken(g.refreshToken);
		g.accessToken = tokens.accessToken();
		g.expiresAt = tokens.accessTokenExpiresAt().getTime();
		if (tokens.hasRefreshToken()) g.refreshToken = tokens.refreshToken();
		await writeSession(this.cookies, this.session);
		return g.accessToken;
	}

	private async authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
		const token = await this.getAccessToken();
		const headers = new Headers(init.headers);
		headers.set('Authorization', `Bearer ${token}`);
		const res = await fetch(input, { ...init, headers });
		if (!res.ok && res.status === 401) {
			// token was invalidated between check and use — retry once
			this.session.google!.expiresAt = 0;
			const newToken = await this.getAccessToken();
			headers.set('Authorization', `Bearer ${newToken}`);
			return fetch(input, { ...init, headers });
		}
		return res;
	}

	async list(folderId: string): Promise<DriveListing> {
		const id = folderId === 'root' ? 'root' : folderId;
		const q = encodeURIComponent(`'${id}' in parents and trashed=false`);
		const fields = encodeURIComponent(
			'nextPageToken,files(id,name,mimeType,size,modifiedTime,parents)'
		);
		const items: DriveFile[] = [];
		let pageToken: string | undefined;
		do {
			const url = `${API}/files?q=${q}&fields=${fields}&pageSize=1000${
				pageToken ? `&pageToken=${pageToken}` : ''
			}`;
			const res = await this.authedFetch(url);
			if (!res.ok) throw new Error(`Google list failed: ${res.status}`);
			const data = (await res.json()) as {
				files: Array<{
					id: string;
					name: string;
					mimeType: string;
					size?: string;
					modifiedTime: string;
					parents?: string[];
				}>;
				nextPageToken?: string;
			};
			for (const f of data.files) {
				items.push({
					id: f.id,
					name: f.name,
					mimeType: f.mimeType,
					size: f.size ? Number(f.size) : null,
					modifiedTime: f.modifiedTime,
					isFolder: f.mimeType === GOOGLE_WORKSPACE_MIME.folder,
					isWorkspaceDoc: isWorkspaceDoc(f.mimeType),
					parents: f.parents
				});
			}
			pageToken = data.nextPageToken;
		} while (pageToken);

		items.sort((a, b) => {
			if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
			return a.name.localeCompare(b.name);
		});

		const folderName = id === 'root' ? 'My Drive' : (await this.getItem(id)).name;
		return { items, folderId: id, folderName, breadcrumbs: [] };
	}

	async getItem(itemId: string): Promise<DriveFile> {
		const fields = encodeURIComponent('id,name,mimeType,size,modifiedTime,parents');
		const res = await this.authedFetch(`${API}/files/${itemId}?fields=${fields}`);
		if (!res.ok) throw new Error(`Google getItem failed: ${res.status}`);
		const f = (await res.json()) as {
			id: string;
			name: string;
			mimeType: string;
			size?: string;
			modifiedTime: string;
			parents?: string[];
		};
		return {
			id: f.id,
			name: f.name,
			mimeType: f.mimeType,
			size: f.size ? Number(f.size) : null,
			modifiedTime: f.modifiedTime,
			isFolder: f.mimeType === GOOGLE_WORKSPACE_MIME.folder,
			isWorkspaceDoc: isWorkspaceDoc(f.mimeType),
			parents: f.parents
		};
	}

	async quota(): Promise<Quota> {
		const res = await this.authedFetch(`${API}/about?fields=storageQuota`);
		if (!res.ok) throw new Error(`Google quota failed: ${res.status}`);
		const data = (await res.json()) as {
			storageQuota: { limit?: string; usage: string };
		};
		const used = Number(data.storageQuota.usage);
		const total = data.storageQuota.limit ? Number(data.storageQuota.limit) : null;
		return { total, used, free: total == null ? null : total - used };
	}

	async download(
		fileId: string,
		exportMime?: string
	): Promise<{ stream: ReadableStream<Uint8Array>; size: number | null; contentType: string }> {
		const url = exportMime
			? `${API}/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}`
			: `${API}/files/${fileId}?alt=media`;
		const res = await this.authedFetch(url);
		if (!res.ok || !res.body) throw new Error(`Google download failed: ${res.status}`);
		const len = res.headers.get('content-length');
		return {
			stream: res.body,
			size: len ? Number(len) : null,
			contentType: res.headers.get('content-type') ?? 'application/octet-stream'
		};
	}

	async createFolder(parentId: string, name: string): Promise<string> {
		const res = await this.authedFetch(`${API}/files?fields=id`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name,
				mimeType: GOOGLE_WORKSPACE_MIME.folder,
				parents: [parentId === 'root' ? 'root' : parentId]
			})
		});
		if (!res.ok) throw new Error(`Google createFolder failed: ${res.status}`);
		const data = (await res.json()) as { id: string };
		return data.id;
	}

	async findChildByName(parentId: string, name: string): Promise<DriveFile | null> {
		const q = encodeURIComponent(
			`'${parentId}' in parents and name='${name.replace(/'/g, "\\'")}' and trashed=false`
		);
		const fields = encodeURIComponent('files(id,name,mimeType,size,modifiedTime,parents)');
		const res = await this.authedFetch(`${API}/files?q=${q}&fields=${fields}&pageSize=1`);
		if (!res.ok) throw new Error(`Google findChildByName failed: ${res.status}`);
		const data = (await res.json()) as {
			files: Array<{
				id: string;
				name: string;
				mimeType: string;
				size?: string;
				modifiedTime: string;
				parents?: string[];
			}>;
		};
		const f = data.files[0];
		if (!f) return null;
		return {
			id: f.id,
			name: f.name,
			mimeType: f.mimeType,
			size: f.size ? Number(f.size) : null,
			modifiedTime: f.modifiedTime,
			isFolder: f.mimeType === GOOGLE_WORKSPACE_MIME.folder,
			isWorkspaceDoc: isWorkspaceDoc(f.mimeType),
			parents: f.parents
		};
	}

	async deleteItem(itemId: string): Promise<void> {
		const res = await this.authedFetch(`${API}/files/${itemId}`, { method: 'DELETE' });
		if (!res.ok && res.status !== 204) throw new Error(`Google deleteItem failed: ${res.status}`);
	}

	async uploadStream(
		parentId: string,
		name: string,
		size: number,
		contentType: string,
		stream: ReadableStream<Uint8Array>
	): Promise<void> {
		// Resumable upload: start session → PUT bytes
		const startRes = await this.authedFetch(
			`${UPLOAD_API}/files?uploadType=resumable`,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json; charset=UTF-8',
					'X-Upload-Content-Type': contentType,
					'X-Upload-Content-Length': String(size)
				},
				body: JSON.stringify({
					name,
					parents: [parentId === 'root' ? 'root' : parentId]
				})
			}
		);
		if (!startRes.ok) throw new Error(`Google upload-init failed: ${startRes.status}`);
		const location = startRes.headers.get('location');
		if (!location) throw new Error('Google upload: no resumable session URL');

		const putRes = await fetch(location, {
			method: 'PUT',
			headers: {
				'Content-Type': contentType,
				'Content-Length': String(size)
			},
			body: stream,
			// @ts-expect-error — duplex is required for streaming bodies in Node
			duplex: 'half'
		});
		if (!putRes.ok) throw new Error(`Google upload failed: ${putRes.status}`);
	}
}

export async function googleProvider(cookies: Cookies): Promise<GoogleDriveProvider | null> {
	const session = await readSession(cookies);
	if (!session.google) return null;
	return new GoogleDriveProvider(session, cookies);
}
