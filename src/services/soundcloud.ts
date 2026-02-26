import got from "got";
import type { Track, Playlist } from "../types/index.js";

// Configured HTTP client with browser headers.
// SoundCloud blocks requests that don't look like browser traffic,
// so we set User-Agent, Accept, and Accept-Language to match Chrome.
export const httpClient = got.extend({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  },
});

// Multiple patterns to find client IDs in JS bundles.
// SoundCloud embeds client IDs differently across bundle versions:
//   - Modern: client_id:"abc123..."  (colon-separated, inside object literals)
//   - Variant: ,client_id:"abc123..." (comma-prefixed property)
//   - Legacy:  client_id=abc123...    (query-param style in URLs)
// All SoundCloud client IDs are exactly 32 alphanumeric characters.
const CLIENT_ID_PATTERNS = [
  /client_id\s*:\s*"([0-9a-zA-Z]{32})"/,
  /,client_id:"([0-9a-zA-Z]{32})"/,
  /client_id=([a-zA-Z0-9]{32})/,
];

export class SoundCloudService {
  private clientId: string | null = null;

  // ─────────────────────────────────────────────────────────────
  // Main entry point: resolve any SoundCloud URL to tracks
  // ─────────────────────────────────────────────────────────────
  async resolveUrl(url: string): Promise<Track | Playlist> {
    // Step 1: Expand shortened URLs (on.soundcloud.com → soundcloud.com)
    const expandedUrl = await this.expandUrl(url);

    // Step 2: Clean URL (remove tracking params)
    const cleanUrl = this.cleanUrl(expandedUrl);

    // Step 3: Resolve via SoundCloud API
    const response = await this.apiRequest<Record<string, unknown>>(
      `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(cleanUrl)}`
    );

    // Step 4: Handle different content types
    switch (response.kind) {
      case "track":
        return this.parseTrack(response);

      case "playlist":
        return await this.parsePlaylist(response);

      case "user":
        // User profile → fetch their tracks
        return this.fetchUserTracks(response);

      default:
        throw new Error(`Unsupported URL type: ${response.kind}`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Get the actual audio stream URL for a track
  // ─────────────────────────────────────────────────────────────
  async getStreamUrl(track: Track): Promise<string> {
    if (!track.streamUrl) {
      throw new Error(`Track "${track.title}" has no stream URL (might be region-locked or premium)`);
    }

    const response = await this.apiRequest<{ url: string }>(track.streamUrl);
    return response.url;
  }

  // ─────────────────────────────────────────────────────────────
  // Expand shortened URLs by following redirects
  // ─────────────────────────────────────────────────────────────
  private async expandUrl(url: string): Promise<string> {
    // on.soundcloud.com URLs redirect to the full URL
    if (url.includes("on.soundcloud.com")) {
      // HEAD request to follow redirects without downloading content
      const response = await httpClient.head(url, { followRedirect: true });
      return response.url;
    }
    return url;
  }

  // ─────────────────────────────────────────────────────────────
  // Remove tracking parameters from URL
  // ─────────────────────────────────────────────────────────────
  private cleanUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Remove common tracking params
      parsed.searchParams.delete("utm_source");
      parsed.searchParams.delete("utm_medium");
      parsed.searchParams.delete("utm_campaign");
      parsed.searchParams.delete("si");
      return parsed.toString();
    } catch {
      return url;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Fetch tracks from a user's profile
  // ─────────────────────────────────────────────────────────────
  private async fetchUserTracks(userData: Record<string, unknown>): Promise<Playlist> {
    const userId = userData.id as number;
    const username = userData.username as string;

    // Fetch user's tracks (limit to 50 most recent)
    const response = await this.apiRequest<{ collection: Array<Record<string, unknown>> }>(
      `https://api-v2.soundcloud.com/users/${userId}/tracks?limit=50`
    );

    const tracks = response.collection.map((t) => this.parseTrack(t));

    if (tracks.length === 0) {
      throw new Error(`User "${username}" has no public tracks`);
    }

    // Return as a "playlist" for uniform handling
    return {
      id: userId,
      title: `${username}'s tracks`,
      tracks,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Scrape client ID from SoundCloud's JavaScript bundles
  // ─────────────────────────────────────────────────────────────
  private async getClientId(): Promise<string> {
    if (this.clientId) {
      return this.clientId;
    }

    // Fetch SoundCloud homepage
    const html = await httpClient("https://soundcloud.com").text();

    // Find JavaScript bundle URLs — match any script from sndcdn.com/assets/
    // (covers a-v2.sndcdn.com, a-v3.sndcdn.com, etc.)
    const scripts =
      html.match(/<script[^>]+src="(https?:\/\/[^"]*sndcdn\.com\/assets\/[^"]+\.js)"/g) ?? [];

    // Search all matching scripts in reverse order (client ID is usually in later bundles).
    // Stop as soon as we find a valid one.
    for (const scriptTag of [...scripts].reverse()) {
      const scriptUrl = scriptTag.match(/src="([^"]+)"/)?.[1];
      if (!scriptUrl) continue;

      const scriptContent = await httpClient(scriptUrl).text();

      // Try each regex pattern against the bundle content
      for (const pattern of CLIENT_ID_PATTERNS) {
        const match = scriptContent.match(pattern);
        if (match?.[1]) {
          this.clientId = match[1];
          return this.clientId;
        }
      }
    }

    throw new Error("Could not find SoundCloud client ID - SoundCloud may have changed their site");
  }

  // ─────────────────────────────────────────────────────────────
  // Clear cached client ID (used on auth failure to force re-extraction)
  // ─────────────────────────────────────────────────────────────
  private clearClientId(): void {
    this.clientId = null;
  }

  // ─────────────────────────────────────────────────────────────
  // Centralized API request with auto client_id and 401/403 retry
  // Appends client_id as a query param, and on auth failure:
  //   1. Clears the cached client ID
  //   2. Re-extracts from SoundCloud's bundles
  //   3. Retries the request once
  // ─────────────────────────────────────────────────────────────
  private async apiRequest<T>(url: string): Promise<T> {
    const makeUrl = (clientId: string) => {
      const separator = url.includes("?") ? "&" : "?";
      return `${url}${separator}client_id=${clientId}`;
    };

    const clientId = await this.getClientId();

    try {
      return await httpClient(makeUrl(clientId)).json<T>();
    } catch (error: unknown) {
      const status =
        error instanceof Object && "response" in error
          ? (error as { response: { statusCode: number } }).response?.statusCode
          : undefined;

      // On 401/403, the client ID may have been revoked — retry with a fresh one
      if (status === 401 || status === 403) {
        this.clearClientId();
        const freshId = await this.getClientId();
        return await httpClient(makeUrl(freshId)).json<T>();
      }

      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Parse raw API response into Track type
  // ─────────────────────────────────────────────────────────────
  private parseTrack(data: Record<string, unknown>): Track {
    const media = data.media as { transcodings?: Array<{ url: string; format: { protocol: string } }> } | undefined;

    // Prefer progressive stream (direct download) over HLS
    const transcoding = media?.transcodings?.find(
      (t) => t.format.protocol === "progressive"
    ) ?? media?.transcodings?.[0];

    // User info might be missing in playlist track listings
    const user = data.user as { username: string } | undefined;

    return {
      id: data.id as number,
      title: (data.title as string) ?? "Unknown Title",
      artist: user?.username ?? "Unknown Artist",
      duration: (data.duration as number) ?? 0,
      artworkUrl: (data.artwork_url as string | null) ?? null,
      streamUrl: transcoding?.url ?? null,
      permalink: (data.permalink_url as string) ?? "",
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Parse raw API response into Playlist type
  // SoundCloud only returns full track data for first ~5 tracks.
  // The rest only have IDs - we need to fetch them separately.
  // ─────────────────────────────────────────────────────────────
  private async parsePlaylist(data: Record<string, unknown>): Promise<Playlist> {
    const rawTracks = data.tracks as Array<Record<string, unknown>>;

    // Separate complete tracks (have title) from incomplete ones (only have id)
    const completeTracks: Track[] = [];
    const incompleteTrackIds: number[] = [];

    for (const t of rawTracks) {
      // A track is incomplete if it lacks a title or media transcodings
      const hasTitle = typeof t.title === "string" && t.title.length > 0;
      const hasMedia = t.media && (t.media as { transcodings?: unknown[] }).transcodings?.length;

      if (hasTitle && hasMedia) {
        completeTracks.push(this.parseTrack(t));
      } else if (t.id) {
        incompleteTrackIds.push(t.id as number);
      }
    }

    // Fetch full data for incomplete tracks in batches of 50
    if (incompleteTrackIds.length > 0) {
      const fetchedTracks = await this.fetchTracksByIds(incompleteTrackIds);
      completeTracks.push(...fetchedTracks);
    }

    return {
      id: data.id as number,
      title: data.title as string,
      tracks: completeTracks,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Fetch full track data by IDs (batch endpoint, max 50 per request)
  // ─────────────────────────────────────────────────────────────
  private async fetchTracksByIds(trackIds: number[]): Promise<Track[]> {
    const tracks: Track[] = [];
    const batchSize = 50;

    // Process in batches of 50 (SoundCloud API limit)
    for (let i = 0; i < trackIds.length; i += batchSize) {
      const batchIds = trackIds.slice(i, i + batchSize);
      const idsParam = batchIds.join(",");

      try {
        const response = await this.apiRequest<Array<Record<string, unknown>>>(
          `https://api-v2.soundcloud.com/tracks?ids=${idsParam}`
        );

        for (const trackData of response) {
          tracks.push(this.parseTrack(trackData));
        }
      } catch {
        // Silently continue - some tracks may be unavailable/region-locked
      }
    }

    return tracks;
  }
}

export const soundcloud = new SoundCloudService();
