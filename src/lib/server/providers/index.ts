import type { Cookies } from '@sveltejs/kit';
import type { Provider } from '$lib/types';
import { googleProvider } from './google';
import { onedriveProvider } from './microsoft';
import { dropboxProvider } from './dropbox';
import { boxProvider } from './box';
import type { DriveProvider } from './types';

export async function getProvider(
	name: Provider,
	cookies: Cookies
): Promise<DriveProvider | null> {
	if (name === 'google') return googleProvider(cookies);
	if (name === 'microsoft') return onedriveProvider(cookies);
	if (name === 'dropbox') return dropboxProvider(cookies);
	if (name === 'box') return boxProvider(cookies);
	return null;
}

export { isWorkspaceDoc, OFFICE_EXPORT_MIME, GOOGLE_WORKSPACE_MIME } from './types';
