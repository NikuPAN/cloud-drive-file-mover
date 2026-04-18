export type Provider = 'google' | 'microsoft';

export interface DriveFile {
	id: string;
	name: string;
	mimeType: string;
	size: number | null;
	modifiedTime: string;
	isFolder: boolean;
	isWorkspaceDoc: boolean;
	parents?: string[];
}

export interface DriveListing {
	items: DriveFile[];
	folderId: string;
	folderName: string;
	breadcrumbs: { id: string; name: string }[];
}

export interface Quota {
	total: number | null;
	used: number;
	free: number | null;
}

export interface SessionData {
	google?: { accessToken: string; refreshToken?: string; expiresAt: number };
	microsoft?: { accessToken: string; refreshToken?: string; expiresAt: number };
}

export type ConflictStrategy = 'skip' | 'rename' | 'overwrite';
export type WorkspaceDocStrategy = 'convert' | 'skip';

export interface TransferRequest {
	source: Provider;
	destination: Provider;
	fileIds: string[];
	destinationFolderId?: string;
	conflict: ConflictStrategy;
	workspaceDocs: WorkspaceDocStrategy;
}
