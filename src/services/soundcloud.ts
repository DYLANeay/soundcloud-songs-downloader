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
        return this.parsePlaylist(response);

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

    return {
      id: data.id as number,
      title: data.title as string,
      artist: (data.user as { username: string }).username,
      duration: data.duration as number,
      artworkUrl: (data.artwork_url as string | null) ?? null,
      streamUrl: transcoding?.url ?? null,
      permalink: data.permalink_url as string,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Parse raw API response into Playlist type
  // ─────────────────────────────────────────────────────────────
  private parsePlaylist(data: Record<string, unknown>): Playlist {
    const tracks = (data.tracks as Array<Record<string, unknown>>).map((t) =>
      this.parseTrack(t)
    );

    return {
      id: data.id as number,
      title: data.title as string,
      tracks,
    };
  }
}

export const soundcloud = new SoundCloudService();
