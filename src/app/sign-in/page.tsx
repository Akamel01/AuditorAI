// /sign-in — the minimal sign-in surface. Server-rendered: it reads the auth
// configuration at request time and shows a plain notice when sign-in is not
// configured. The browser never receives a token; forms post to the server.
import Link from "next/link";
import { authConfigured, authEnv, enabledProviders } from "@/lib/auth/config";
import { authNoticeText } from "@/lib/auth/notice";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  const env = authEnv();
  const configured = authConfigured(env);
  const providers = enabledProviders(env);
  const emailEnabled = providers.includes("email");
  const oauth = providers.filter((p) => p !== "email");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-16">
      <div>
        <p className="mono text-xs uppercase tracking-[0.2em] text-fg-muted">AuditorAI</p>
        <h1 className="mt-2 text-2xl font-semibold">Sign in</h1>
      </div>

      {!configured ? (
        <p role="status" className="rounded border border-line px-4 py-3 text-sm">
          {authNoticeText()}
        </p>
      ) : (
        <>
          {emailEnabled ? (
            <form method="post" action="/api/auth/email" className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                Email
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="rounded border border-line bg-transparent px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Password
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="rounded border border-line bg-transparent px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Workspace ID (only if you belong to more than one)
                <input
                  name="workspace_id"
                  autoComplete="off"
                  className="rounded border border-line bg-transparent px-3 py-2"
                />
              </label>
              <button
                type="submit"
                className="rounded border border-line px-3 py-2 text-sm font-medium"
              >
                Sign in with email
              </button>
            </form>
          ) : null}

          {oauth.length ? (
            <div className="flex flex-col gap-2">
              {oauth.map((provider) => (
                <Link
                  key={provider}
                  href={`/api/auth/signin/${provider}`}
                  className="rounded border border-line px-3 py-2 text-center text-sm font-medium capitalize"
                >
                  Continue with {provider}
                </Link>
              ))}
            </div>
          ) : null}
        </>
      )}

      <Link href="/" className="text-sm text-fg-muted underline">
        Back
      </Link>
    </main>
  );
}
