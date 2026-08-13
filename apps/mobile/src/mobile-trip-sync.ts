import {
  createOfflineMobileCache,
  createOfflineTripPackage,
  MobileTripListResponseSchema,
  SHOW_TO_LOCAL_PHRASE_PACK,
  TOOLS_CONTENT_PACK,
  type OfflineMobileCache,
  type ReadOnlyTripSnapshot,
} from "@visepanda/domain";

export type MobileTripSyncErrorCode =
  "MOBILE_SYNC_UNAVAILABLE" | "MOBILE_SESSION_INVALID" | "MOBILE_SYNC_RESPONSE_INVALID";

export class MobileTripSyncError extends Error {
  constructor(
    readonly code: MobileTripSyncErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MobileTripSyncError";
  }
}

export function readMobileWebBaseUrl(
  environment: Readonly<Record<string, string | undefined>>,
): string | null {
  const configured = environment.EXPO_PUBLIC_VISEPANDA_WEB_URL?.trim();
  if (!configured) return null;
  try {
    const parsed = new URL(configured);
    return parsed.protocol === "https:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

export async function fetchMobileTrips(input: {
  accessToken: string;
  baseUrl: string;
  fetcher?: typeof fetch;
}): Promise<ReadonlyArray<ReadOnlyTripSnapshot>> {
  const fetcher = input.fetcher ?? fetch;
  let response: Response;
  try {
    response = await fetcher(`${input.baseUrl}/api/mobile/trips`, {
      headers: { Authorization: `Bearer ${input.accessToken}` },
      method: "GET",
    });
  } catch {
    throw new MobileTripSyncError(
      "MOBILE_SYNC_UNAVAILABLE",
      "Trip sync is unavailable. Your existing offline Trip was not changed.",
    );
  }

  const payload = await readJson(response);
  if (response.status === 401) {
    throw new MobileTripSyncError(
      "MOBILE_SESSION_INVALID",
      "Your sign-in session has expired. Sign in again to sync Trips.",
    );
  }
  if (!response.ok) {
    throw new MobileTripSyncError(
      "MOBILE_SYNC_UNAVAILABLE",
      "Trip sync is unavailable. Your existing offline Trip was not changed.",
    );
  }

  const parsed = MobileTripListResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new MobileTripSyncError(
      "MOBILE_SYNC_RESPONSE_INVALID",
      "Trip sync returned an invalid response. Your existing offline Trip was not changed.",
    );
  }
  return parsed.data.trips;
}

export function createReadOnlyTripOfflineCache(
  snapshot: ReadOnlyTripSnapshot,
  savedAt = new Date(),
): OfflineMobileCache {
  const tripPackage = createOfflineTripPackage({
    trip: snapshot.trip,
    toolContentVersion: String(TOOLS_CONTENT_PACK.version),
    phrasePackVersion: String(SHOW_TO_LOCAL_PHRASE_PACK.version),
    cities: uniqueTripCities(snapshot.trip.days),
    savedAt,
    expiresAt: new Date(savedAt.getTime() + 7 * 24 * 60 * 60 * 1000),
  });
  return createOfflineMobileCache({
    refreshedAt: savedAt,
    tripPackage,
    toolsContent: TOOLS_CONTENT_PACK,
    phrasePack: SHOW_TO_LOCAL_PHRASE_PACK,
  });
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function uniqueTripCities(days: ReadonlyArray<{ city?: string | undefined }>): string[] {
  return [...new Set(days.flatMap((day) => (day.city?.trim() ? [day.city.trim()] : [])))];
}
