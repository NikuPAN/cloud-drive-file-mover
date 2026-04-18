import type { LayoutServerLoad } from './$types';
import { readSession } from '$lib/server/session';

export const load: LayoutServerLoad = async ({ cookies }) => {
	const session = await readSession(cookies);
	return {
		connected: {
			google: !!session.google?.accessToken,
			microsoft: !!session.microsoft?.accessToken,
			dropbox: !!session.dropbox?.accessToken,
			box: !!session.box?.accessToken
		}
	};
};
