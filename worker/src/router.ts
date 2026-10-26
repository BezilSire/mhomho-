import type { Ctx } from './context.ts';

export type Handler = (ctx: Ctx) => Promise<Response> | Response;

interface Route {
  method: string;
  regex: RegExp;
  keys: string[];
  handler: Handler;
}

/**
 * Tiny explicit router. No wildcard proxying, no method override headers and no
 * path traversal: every route is declared with an exact method and pattern.
 */
export class Router {
  private routes: Route[] = [];

  add(method: string, path: string, handler: Handler): this {
    const keys: string[] = [];
    const pattern = path.replace(/:([A-Za-z0-9_]+)/g, (_match, key: string) => {
      keys.push(key);
      return '([^/]+)';
    });
    this.routes.push({
      method,
      regex: new RegExp(`^${pattern}$`),
      keys,
      handler,
    });
    return this;
  }

  get(path: string, handler: Handler) {
    return this.add('GET', path, handler);
  }
  post(path: string, handler: Handler) {
    return this.add('POST', path, handler);
  }
  patch(path: string, handler: Handler) {
    return this.add('PATCH', path, handler);
  }
  delete(path: string, handler: Handler) {
    return this.add('DELETE', path, handler);
  }

  match(method: string, pathname: string): { handler: Handler; params: Record<string, string> } | null {
    let methodMismatch = false;
    for (const route of this.routes) {
      const match = route.regex.exec(pathname);
      if (!match) continue;
      if (route.method !== method) {
        methodMismatch = true;
        continue;
      }
      const params: Record<string, string> = {};
      route.keys.forEach((key, index) => {
        const raw = match[index + 1] ?? '';
        try {
          params[key] = decodeURIComponent(raw);
        } catch {
          params[key] = raw;
        }
      });
      return { handler: route.handler, params };
    }
    if (methodMismatch) return null;
    return null;
  }

  hasPath(pathname: string): boolean {
    return this.routes.some((route) => route.regex.test(pathname));
  }

  allowedMethods(pathname: string): string[] {
    return this.routes
      .filter((route) => route.regex.test(pathname))
      .map((route) => route.method);
  }
}
