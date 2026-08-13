export type MobileAuthConfig = {
  supabaseAnonKey: string;
  supabaseUrl: string;
};

type Environment = Readonly<Record<string, string | undefined>>;

/**
 * Expo public variables can carry only the Supabase public client configuration.
 * A missing or malformed value disables sign-in rather than falling back to a fixture.
 */
export function readMobileAuthConfig(environment: Environment): MobileAuthConfig | null {
  const supabaseUrl = environment.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = environment.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnonKey) return null;

  try {
    const parsed = new URL(supabaseUrl);
    if (parsed.protocol !== "https:") return null;
    return { supabaseUrl: parsed.origin, supabaseAnonKey };
  } catch {
    return null;
  }
}
