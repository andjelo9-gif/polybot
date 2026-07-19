import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, authToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <form action={login} className="w-80 space-y-4 rounded-lg border p-8">
        <h1 className="font-mono text-sm font-semibold tracking-[0.2em] uppercase">
          Polybot
        </h1>
        <p className="text-sm text-muted-foreground">Enter the app password.</p>
        {error && <p className="text-sm text-red-400">Wrong password.</p>}
        <Input type="password" name="password" autoFocus />
        <Button type="submit" className="w-full">
          Sign in
        </Button>
      </form>
    </main>
  );
}
