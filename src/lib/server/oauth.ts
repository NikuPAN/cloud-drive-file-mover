import { Google, MicrosoftEntraId } from 'arctic';
import { serverEnv } from './env';

export function googleClient(): Google {
	return new Google(
		serverEnv.GOOGLE_CLIENT_ID,
		serverEnv.GOOGLE_CLIENT_SECRET,
		`${serverEnv.PUBLIC_ORIGIN}/api/auth/google/callback`
	);
}

export function microsoftClient(): MicrosoftEntraId {
	return new MicrosoftEntraId(
		serverEnv.MICROSOFT_TENANT,
		serverEnv.MICROSOFT_CLIENT_ID,
		serverEnv.MICROSOFT_CLIENT_SECRET,
		`${serverEnv.PUBLIC_ORIGIN}/api/auth/microsoft/callback`
	);
}

export const googleScopes = [
	'openid',
	'https://www.googleapis.com/auth/drive',
	'https://www.googleapis.com/auth/drive.readonly'
];

export const microsoftScopes = ['offline_access', 'Files.ReadWrite.All', 'User.Read'];
