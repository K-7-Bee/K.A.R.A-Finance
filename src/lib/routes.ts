/** Paths a signed-out visitor may open. Everything else requires a session. */
const PUBLIC_PATHS = ["/sign-in", "/sign-up", "/forgot-password", "/auth/confirm", "/auth/error"];

/** Auth pages a signed-in user has no reason to see; they go to the Overview instead. */
const AUTH_PAGES = ["/sign-in", "/sign-up"];

const matches = (path: string, list: string[]) =>
  list.some((p) => path === p || path.startsWith(`${p}/`));

export const isPublicPath = (path: string) => matches(path, PUBLIC_PATHS);
export const isAuthPage = (path: string) => matches(path, AUTH_PAGES);
