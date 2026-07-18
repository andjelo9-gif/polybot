export function trackerAuthorized(request: Request): boolean {
  const secret = process.env.TRACKER_API_SECRET;
  if (!secret) return false;
  return request.headers.get("x-tracker-secret") === secret;
}

export function unauthorized(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
