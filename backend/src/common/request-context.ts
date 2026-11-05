import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestUser {
  id: string;
  username: string;
}

interface RequestStore {
  user?: RequestUser;
}

const storage = new AsyncLocalStorage<RequestStore>();

/**
 * Per-request context, so deep services (e.g. the audit log) know who made a
 * change without passing the user through every method. A middleware opens the
 * context for each request; JwtAuthGuard stores the authenticated user in it.
 */
export const RequestContext = {
  run<T>(fn: () => T): T {
    return storage.run({}, fn);
  },
  setUser(user: RequestUser): void {
    const store = storage.getStore();
    if (store) store.user = user;
  },
  user(): RequestUser | undefined {
    return storage.getStore()?.user;
  },
};
