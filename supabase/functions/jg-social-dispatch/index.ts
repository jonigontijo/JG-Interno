import { dispatch, endpoint } from "../_shared/social-server.ts";
Deno.serve((req) => endpoint(req, dispatch));
