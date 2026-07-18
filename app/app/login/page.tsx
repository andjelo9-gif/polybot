import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, authToken } from "@/lib/auth";

async function login(formData: FormData) {
  "use server";
  const password = formData.get("password");
  if (typeof password !== "string" || password !== process.env.APP_PASSWORD) {
    redirect("/login?error=1");
  }
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE, await authToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/signals");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
      <form action={login} className="w-80 space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-8">
        <h1 className="text-xl font-semibold">Polybot</h1>
        <p className="text-sm text-zinc-400">Enter the app password.</p>
        {error && <p className="text-sm text-red-400">Wrong password.</p>}
        <input
          type="password"
          name="password"
          autoFocus
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-400"
        />
        <button
          type="submit"
          className="w-full rounded-md bg-zinc-100 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
