import {
  supabaseUrl,
  supabaseAnonKey,
  supabaseJwtSecret,
} from "@/lib/db/config";

export interface AuthEnv {
  url: string | null;
  anonKey: string | null;
  jwtSecret: string | null;
  redirectOrigin: string | null;
  emailEnabled: boolean;
  googleEnabled: boolean;
  microsoftEnabled: boolean;
}

function env(name: string): string | null {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

function flag(name: string): boolean {
  return (process.env[name] ?? "").trim().toLowerCase() === "true";
}

export function authEnv(): AuthEnv {
  const master = flag("SUPABASE_AUTH_ENABLED");
  const redirectOrigin = env("SUPABASE_AUTH_REDIRECT_ORIGIN");
  return {
    url: supabaseUrl(),
    anonKey: supabaseAnonKey(),
    jwtSecret: supabaseJwtSecret(),
    redirectOrigin,
    emailEnabled: master && flag("SUPABASE_AUTH_EMAIL_ENABLED"),
    googleEnabled: master && flag("SUPABASE_AUTH_GOOGLE_ENABLED"),
    microsoftEnabled: master && flag("SUPABASE_AUTH_MICROSOFT_ENABLED"),
  };
}

export function enabledProviders(env: AuthEnv = authEnv()): ("email" | "google" | "microsoft")[] {
  const providers: ("email" | "google" | "microsoft")[] = [];
  if (env.emailEnabled) providers.push("email");
  if (env.googleEnabled && env.redirectOrigin) providers.push("google");
  if (env.microsoftEnabled && env.redirectOrigin) providers.push("microsoft");
  return providers;
}

export function authConfigured(env: AuthEnv = authEnv()): boolean {
  return (
    env.url !== null &&
    env.anonKey !== null &&
    env.jwtSecret !== null &&
    enabledProviders(env).length > 0
  );
}
