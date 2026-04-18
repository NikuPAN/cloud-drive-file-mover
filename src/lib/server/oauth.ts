import { Google, MicrosoftEntraId, Dropbox, Box } from 'arctic';
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

export function dropboxClient(): Dropbox {
	return new Dropbox(
		serverEnv.DROPBOX_CLIENT_ID,
		serverEnv.DROPBOX_CLIENT_SECRET,
		`${serverEnv.PUBLIC_ORIGIN}/api/auth/dropbox/callback`
	);
}

export function boxClient(): Box {
	return new Box(
		serverEnv.BOX_CLIENT_ID,
		serverEnv.BOX_CLIENT_SECRET,
		`${serverEnv.PUBLIC_ORIGIN}/api/auth/box/callback`
	);
}

export const googleScopes = [
	'openid',
	'https://www.googleapis.com/auth/drive',
	'https://www.googleapis.com/auth/drive.readonly'
];

export const microsoftScopes = ['offline_access', 'Files.ReadWrite.All', 'User.Read'];

export const dropboxScopes = ['files.metadata.read', 'files.content.read', 'files.content.write', 'account_info.read'];

export const boxScopes = ['root_readwrite'];
