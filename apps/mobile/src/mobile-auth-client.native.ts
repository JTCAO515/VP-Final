import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

import type { MobileAuthConfig } from "./mobile-auth";

const MOBILE_AUTH_STORAGE_KEY = "visepanda.mobile.auth";

/** Native-only client: tokens remain in Keychain/Keystore through Expo SecureStore. */
export function createMobileAuthClient(config: MobileAuthConfig): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
      storage: {
        getItem: (key) => SecureStore.getItemAsync(key),
        setItem: (key, value) => SecureStore.setItemAsync(key, value),
        removeItem: (key) => SecureStore.deleteItemAsync(key),
      },
      storageKey: MOBILE_AUTH_STORAGE_KEY,
    },
  });
}
