import type { Database } from "@vc/db";
import type { RequestMeta } from "./audit";
import type { Actor } from "./auth/permissions";

/** Everything a service needs to run an operation on behalf of someone. */
export type ServiceContext = {
  db: Database;
  actor: Actor;
  meta?: RequestMeta;
};
