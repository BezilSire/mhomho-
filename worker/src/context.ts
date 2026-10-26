import type { Env } from './env.ts';
import type { AccountRow, SessionRow } from './env.ts';

export interface Ctx {
  request: Request;
  env: Env;
  url: URL;
  params: Record<string, string>;
  requestId: string;
  account: AccountRow | null;
  session: SessionRow | null;
}
