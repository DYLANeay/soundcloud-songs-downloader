import { useState, useCallback } from "react";
import type { Track, DownloadProgress, AppConfig } from "../types/index.js";
import { soundcloud } from "../services/soundcloud.js";
import { downloadTrack } from "../services/downloader.js";

// All possible states the downloader can be in
export type DownloaderState =
  | "idle"        // Waiting for user input
  | "resolving"   // Fetching track/playlist info from SoundCloud
  | "downloading" // Actively downloading tracks
  | "complete"    // All downloads finished
  | "error";      // Something went wrong

export interface UseDownloaderResult {
  tracks: Track[];
  progress: Map<number, DownloadProgress>;
  error: string | null;
  state: DownloaderState;
  startDownload: (url: string) => Promise<void>;
}

export function useDownloader(config: AppConfig): UseDownloaderResult {
  // ─────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────
  const [state, setState] = useState<DownloaderState>("idle");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [progress, setProgress] = useState<Map<number, DownloadProgress>>(new Map());
  const [error, setError] = useState<string | null>(null);

  // ─────────────────────────────────────────────────────────────
  // Helper: Update progress for a single track
  // ─────────────────────────────────────────────────────────────
  const updateProgress = useCallback((trackId: number, update: Partial<DownloadProgress>) => {
    setProgress((prev) => {
      const next = new Map(prev);
      const current = next.get(trackId) ?? {
        trackId,
        percent: 0,
        status: "pending" as const
      };
      next.set(trackId, { ...current, ...update });
      return next;
    });
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Helper: Download a single track with progress updates
  // ─────────────────────────────────────────────────────────────
  const downloadSingleTrack = useCallback(async (track: Track): Promise<void> => {
    updateProgress(track.id, { status: "downloading", percent: 0 });

    try {
      await downloadTrack(track, config, {
        onProgress: (percent) => {
          updateProgress(track.id, { percent });
        },
        onConverting: () => {
          updateProgress(track.id, { status: "converting", percent: 100 });
        },
        onComplete: () => {
          updateProgress(track.id, { status: "complete" });
        },
        onError: (err) => {
          updateProgress(track.id, { status: "error", error: err.message });
        },
      });
    } catch (err) {
      // Error already handled by onError callback
      // But we need to catch to prevent unhandled rejection
    }
  }, [config, updateProgress]);

  // ─────────────────────────────────────────────────────────────
  // Main function: Start the download process
  // ─────────────────────────────────────────────────────────────
  const startDownload = useCallback(async (url: string): Promise<void> => {
    // Reset state
    setError(null);
    setProgress(new Map());
    setState("resolving");

    try {
      // Step 1: Resolve the URL to get track(s)
      const result = await soundcloud.resolveUrl(url);

      // Step 2: Normalize to array of tracks
      // (single track vs playlist)
      const trackList: Track[] = "tracks" in result
        ? result.tracks   // It's a playlist
        : [result];       // It's a single track

      setTracks(trackList);

      // Step 3: Initialize progress for all tracks
      const initialProgress = new Map<number, DownloadProgress>();
      for (const track of trackList) {
        initialProgress.set(track.id, {
          trackId: track.id,
          percent: 0,
          status: "pending",
        });
      }
      setProgress(initialProgress);

      // Step 4: Download tracks sequentially
      // (we'll add parallel downloads later)
      setState("downloading");

      for (const track of trackList) {
        await downloadSingleTrack(track);
      }

      // Step 5: Check if all succeeded
      setState("complete");

    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setState("error");
    }
  }, [downloadSingleTrack]);

  return {
    tracks,
    progress,
    error,
    state,
    startDownload,
  };
}
