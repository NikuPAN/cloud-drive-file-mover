import type { DriveFile, DriveListing, Quota } from '$lib/types';

export interface DriveProvider {
	/** Return a valid access token, refreshing if expired. */
	getAccessToken(): Promise<string>;

	/** List contents of a folder. Use 'root' for the drive root. */
	list(folderId: string): Promise<DriveListing>;

	/** Get full metadata for a single item. */
	getItem(itemId: string): Promise<DriveFile>;

	/** Get drive storage quota. */
	quota(): Promise<Quota>;

	/**
	 * Download an item. For Google Workspace docs you must pass `exportMime`
	 * (e.g. Office format) — the item cannot be downloaded natively.
	 * Returns the binary stream and its Content-Length if known.
	 */
	download(
		fileId: string,
		exportMime?: string
	): Promise<{ stream: ReadableStream<Uint8Array>; size: number | null; contentType: string }>;

	/** Create a folder and return its id. */
	createFolder(parentId: string, name: string): Promise<string>;

	/** Return the child file/folder id with the given name, or null. */
	findChildByName(parentId: string, name: string): Promise<DriveFile | null>;

	/** Delete an item (used for 'overwrite' conflict strategy). */
	deleteItem(itemId: string): Promise<void>;

	/**
	 * Upload a file stream to the given parent folder.
	 * Content length is required — needed for resumable session chunking.
	 */
	uploadStream(
		parentId: string,
		name: string,
		size: number,
		contentType: string,
		stream: ReadableStream<Uint8Array>
	): Promise<void>;
}

export const GOOGLE_WORKSPACE_MIME = {
	document: 'application/vnd.google-apps.document',
	spreadsheet: 'application/vnd.google-apps.spreadsheet',
	presentation: 'application/vnd.google-apps.presentation',
	drawing: 'application/vnd.google-apps.drawing',
	folder: 'application/vnd.google-apps.folder'
} as const;

export const OFFICE_EXPORT_MIME: Record<string, { mime: string; ext: string }> = {
	[GOOGLE_WORKSPACE_MIME.document]: {
		mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		ext: '.docx'
	},
	[GOOGLE_WORKSPACE_MIME.spreadsheet]: {
		mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		ext: '.xlsx'
	},
	[GOOGLE_WORKSPACE_MIME.presentation]: {
		mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		ext: '.pptx'
	},
	[GOOGLE_WORKSPACE_MIME.drawing]: {
		mime: 'image/png',
		ext: '.png'
	}
};

export function isWorkspaceDoc(mimeType: string): boolean {
	return (
		mimeType.startsWith('application/vnd.google-apps.') &&
		mimeType !== GOOGLE_WORKSPACE_MIME.folder
	);
}
