import got from "got";
import type { Track, Playlist } from "../types/index.js";

const CLIENT_ID_REGEX = /client_id=([a-zA-Z0-9]+)/;

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
    const clientId = await this.getClientId();
    const resolveEndpoint = `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(cleanUrl)}&client_id=${clientId}`;

    const response = await got(resolveEndpoint).json<Record<string, unknown>>();

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
    const clientId = await this.getClientId();

    if (!track.streamUrl) {
      throw new Error(`Track "${track.title}" has no stream URL (might be region-locked or premium)`);
    }

    const response = await got(
      `${track.streamUrl}?client_id=${clientId}`
    ).json<{ url: string }>();

    return response.url;
  }

  // ─────────────────────────────────────────────────────────────
  // Expand shortened URLs by following redirects
  // ─────────────────────────────────────────────────────────────
  private async expandUrl(url: string): Promise<string> {
    // on.soundcloud.com URLs redirect to the full URL
    if (url.includes("on.soundcloud.com")) {
      // HEAD request to follow redirects without downloading content
      const response = await got.head(url, { followRedirect: true });
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
    const clientId = await this.getClientId();
    const userId = userData.id as number;
    const username = userData.username as string;

    // Fetch user's tracks (limit to 50 most recent)
    const tracksEndpoint = `https://api-v2.soundcloud.com/users/${userId}/tracks?client_id=${clientId}&limit=50`;
    const response = await got(tracksEndpoint).json<{ collection: Array<Record<string, unknown>> }>();

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
    const html = await got("https://soundcloud.com").text();

    // Find JavaScript bundle URLs
    const scripts = html.match(/src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g) ?? [];

    // Search last 5 scripts for client_id
    for (const scriptMatch of scripts.slice(-5)) {
      const scriptUrl = scriptMatch.match(/src="([^"]+)"/)?.[1];
      if (!scriptUrl) continue;

      const scriptContent = await got(scriptUrl).text();
      const clientIdMatch = scriptContent.match(CLIENT_ID_REGEX);

      if (clientIdMatch?.[1]) {
        this.clientId = clientIdMatch[1];
        return this.clientId;
      }
    }

    throw new Error("Could not find SoundCloud client ID - SoundCloud may have changed their site");
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
    const clientId = await this.getClientId();
    const tracks: Track[] = [];
    const batchSize = 50;

    // Process in batches of 50 (SoundCloud API limit)
    for (let i = 0; i < trackIds.length; i += batchSize) {
      const batchIds = trackIds.slice(i, i + batchSize);
      const idsParam = batchIds.join(",");

      const endpoint = `https://api-v2.soundcloud.com/tracks?ids=${idsParam}&client_id=${clientId}`;

      try {
        const response = await got(endpoint).json<Array<Record<string, unknown>>>();

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
