import got from "got";
import type { Track, Playlist } from "../types/index.js";

const CLIENT_ID_REGEX = /client_id=([a-zA-Z0-9]+)/;

export class SoundCloudService {
  private clientId: string | null = null;

  async resolveUrl(url: string): Promise<Track | Playlist> {
    const clientId = await this.getClientId();
    const resolveUrl = `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(url)}&client_id=${clientId}`;

    const response = await got(resolveUrl).json<Record<string, unknown>>();

    if (response.kind === "track") {
      return this.parseTrack(response);
    } else if (response.kind === "playlist") {
      return this.parsePlaylist(response);
    }

    throw new Error(`Unsupported URL type: ${response.kind}`);
  }

  async getStreamUrl(track: Track): Promise<string> {
    const clientId = await this.getClientId();

    if (!track.streamUrl) {
      throw new Error("Track has no stream URL");
    }

    const response = await got(
      `${track.streamUrl}?client_id=${clientId}`
    ).json<{ url: string }>();

    return response.url;
  }

  private async getClientId(): Promise<string> {
    if (this.clientId) {
      return this.clientId;
    }

    // Fetch client ID from SoundCloud's main page
    const html = await got("https://soundcloud.com").text();
    const scripts = html.match(/src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g) ?? [];

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

    throw new Error("Could not find SoundCloud client ID");
  }

  private parseTrack(data: Record<string, unknown>): Track {
    const media = data.media as { transcodings?: Array<{ url: string; format: { protocol: string } }> } | undefined;
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
