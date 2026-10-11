import type { NextFunction, Request, Response } from "express";

export type SupabaseUser = {
  id: string;
  email?: string;
  phone?: string;
  user_metadata?: { full_name?: string; username?: string; avatar_url?: string };
  email_confirmed_at?: string | null;
  phone_confirmed_at?: string | null;
};

export type AuthenticatedRequest = Request & { userId: string; supabaseUser?: SupabaseUser };

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_KEY must be configured");
  return { url: url.replace(/\/$/, ""), key };
}

export async function supabaseUserFromToken(token: string): Promise<SupabaseUser | null> {
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  return (await response.json()) as SupabaseUser;
}

export async function requireUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const user = await supabaseUserFromToken(token);
    if (!user?.id) {
      res.status(401).json({ error: "Invalid or expired Supabase session" });
      return;
    }
    (req as AuthenticatedRequest).userId = user.id;
    (req as AuthenticatedRequest).supabaseUser = user;
    next();
  } catch (error) {
    req.log?.error?.(error);
    res.status(503).json({ error: "Authentication service unavailable" });
  }
}

export async function supabaseProfile(userId: string, user?: SupabaseUser) {
  const profile = user;

  return {
    email: profile?.email ?? "",
    emailVerified: Boolean(profile?.email_confirmed_at),
    fullName: profile?.user_metadata?.full_name ?? "",
    username: profile?.user_metadata?.username ?? "",
    phone: profile?.phone_confirmed_at ? profile.phone ?? null : null,
    avatarUrl: profile?.user_metadata?.avatar_url ?? null,
  };
}
