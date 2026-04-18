import { env } from '$env/dynamic/private';

function required(name: string, value: string | undefined): string {
	if (!value) throw new Error(`Missing required env var: ${name}`);
	return value;
}

export const serverEnv = {
	get PUBLIC_ORIGIN(): string {
		return required('PUBLIC_ORIGIN', env.PUBLIC_ORIGIN);
	},
	get GOOGLE_CLIENT_ID(): string {
		return required('GOOGLE_CLIENT_ID', env.GOOGLE_CLIENT_ID);
	},
	get GOOGLE_CLIENT_SECRET(): string {
		return required('GOOGLE_CLIENT_SECRET', env.GOOGLE_CLIENT_SECRET);
	},
	get MICROSOFT_CLIENT_ID(): string {
		return required('MICROSOFT_CLIENT_ID', env.MICROSOFT_CLIENT_ID);
	},
	get MICROSOFT_CLIENT_SECRET(): string {
		return required('MICROSOFT_CLIENT_SECRET', env.MICROSOFT_CLIENT_SECRET);
	},
	get MICROSOFT_TENANT(): string {
		return env.MICROSOFT_TENANT ?? 'common';
	},
	get SESSION_SECRET(): string {
		return required('SESSION_SECRET', env.SESSION_SECRET);
	}
};
