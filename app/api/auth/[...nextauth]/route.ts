import { handlers } from "@/lib/auth";

// Expose GET and POST handlers for all Auth.js routes:
//   /api/auth/session
//   /api/auth/csrf
//   /api/auth/signin
//   /api/auth/signout
//   /api/auth/callback/credentials
export const { GET, POST } = handlers;
