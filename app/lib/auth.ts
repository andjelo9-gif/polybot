export const AUTH_COOKIE = "polybot_auth";

// Session token = SHA-256 of the app password; changing the password
// invalidates existing sessions. Web Crypto so it runs in both the
// proxy (edge) and server actions (node).
export async function authToken(): Promise<string> {
  const password = process.env.APP_PASSWORD ?? "";
  const data = new TextEncoder().encode(`polybot:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
