import { endpoint, receive } from "../_shared/social-server.ts";
Deno.serve((req) => endpoint(req, receive));
