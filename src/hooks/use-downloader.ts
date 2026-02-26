import { useState, useCallback, useRef } from "react";
import { join } from "node:path";
import type { Track, DownloadProgress, AppConfig } from "../types/index.js";
import { soundcloud } from "../services/soundcloud.js";
import { downloadTrack } from "../services/downloader.js";
import { runConcurrent } from "../utils/concurrent.js";
import { filterExistingTracks } from "../utils/duplicates.js";

// How many tracks to download at once
const CONCURRENCY = 4;

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
  outputDir: string;
  startDownload: (url: string) => Promise<void>;
}

// Sanitize playlist name for use as folder name
function sanitizeFolderName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

export function useDownloader(config: AppConfig): UseDownloaderResult {
  // ─────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────
  const [state, setState] = useState<DownloaderState>("idle");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [progress, setProgress] = useState<Map<number, DownloadProgress>>(new Map());
  const [error, setError] = useState<string | null>(null);

  // Effective output directory (may include playlist subfolder)
  const effectiveOutputDir = useRef<string>(config.outputDir);

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

    // Use effective output dir (includes playlist subfolder if applicable)
    const downloadConfig: AppConfig = {
      ...config,
      outputDir: effectiveOutputDir.current,
    };

    try {
      await downloadTrack(track, downloadConfig, {
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

      // Step 2: Normalize to array of tracks and set output directory
      // Playlists get their own subfolder, single tracks go directly to outputDir
      let allTracks: Track[];
      if ("tracks" in result) {
        // It's a playlist - create subfolder with playlist name
        allTracks = result.tracks;
        const folderName = sanitizeFolderName(result.title);
        effectiveOutputDir.current = join(config.outputDir, folderName);
      } else {
        // Single track - use base output directory
        allTracks = [result];
        effectiveOutputDir.current = config.outputDir;
      }

      // Step 3: Filter out already-downloaded tracks if skipDuplicates is enabled
      let tracksToDownload = allTracks;
      let skippedTracks: Track[] = [];

      if (config.skipDuplicates) {
        const filtered = await filterExistingTracks(
          allTracks,
          effectiveOutputDir.current,
          config.format
        );
        tracksToDownload = filtered.toDownload;
        skippedTracks = filtered.skipped;
      }

      // Show all tracks (including skipped ones)
      setTracks(allTracks);

      // Step 4: Initialize progress for all tracks
      const initialProgress = new Map<number, DownloadProgress>();

      // Mark skipped tracks
      for (const track of skippedTracks) {
        initialProgress.set(track.id, {
          trackId: track.id,
          percent: 100,
          status: "skipped",
        });
      }

      // Mark tracks to download as pending
      for (const track of tracksToDownload) {
        initialProgress.set(track.id, {
          trackId: track.id,
          percent: 0,
          status: "pending",
        });
      }
      setProgress(initialProgress);

      // If all tracks are skipped, go straight to complete
      if (tracksToDownload.length === 0) {
        setState("complete");
        return;
      }

      // Step 5: Download tracks in parallel
      setState("downloading");

      await runConcurrent(
        tracksToDownload,
        async (track) => downloadSingleTrack(track),
        CONCURRENCY
      );

      // Step 6: All done
      setState("complete");

    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setState("error");
    }
  }, [config.skipDuplicates, config.format, config.outputDir, downloadSingleTrack]);

  return {
    tracks,
    progress,
    error,
    state,
    outputDir: effectiveOutputDir.current,
    startDownload,
  };
}
