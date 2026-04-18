import type { Cookies } from '@sveltejs/kit';
import type { Provider } from '$lib/types';
import { googleProvider } from './google';
import { onedriveProvider } from './microsoft';
import type { DriveProvider } from './types';

export async function getProvider(
	name: Provider,
	cookies: Cookies
): Promise<DriveProvider | null> {
	if (name === 'google') return googleProvider(cookies);
	if (name === 'microsoft') return onedriveProvider(cookies);
	return null;
}

export { isWorkspaceDoc, OFFICE_EXPORT_MIME, GOOGLE_WORKSPACE_MIME } from './types';
