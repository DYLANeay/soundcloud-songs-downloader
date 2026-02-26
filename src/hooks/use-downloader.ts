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
  | "naming"      // Waiting for user to choose a folder name
  | "downloading" // Actively downloading tracks
  | "complete"    // All downloads finished
  | "error";      // Something went wrong

export interface UseDownloaderResult {
  tracks: Track[];
  progress: Map<number, DownloadProgress>;
  error: string | null;
  state: DownloaderState;
  outputDir: string;
  suggestedName: string;
  startDownload: (url: string) => Promise<void>;
  confirmDownload: (outputPath: string) => Promise<void>;
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
  const [suggestedName, setSuggestedName] = useState("");

  // Effective output directory (may include playlist subfolder)
  const effectiveOutputDir = useRef<string>(config.outputDir);

  // Holds resolved tracks between the "naming" and "downloading" phases
  const resolvedTracks = useRef<Track[]>([]);

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
    } catch {
      // Error already handled by onError callback
      // But we need to catch to prevent unhandled rejection
    }
  }, [config, updateProgress]);

  // ─────────────────────────────────────────────────────────────
  // Phase 1: Resolve URL and pause for folder name input
  // ─────────────────────────────────────────────────────────────
  const startDownload = useCallback(async (url: string): Promise<void> => {
    // Reset state
    setError(null);
    setProgress(new Map());
    setState("resolving");

    try {
      // Step 1: Resolve the URL to get track(s)
      const result = await soundcloud.resolveUrl(url);

      // Step 2: Normalize to array of tracks, compute suggested folder name
      let allTracks: Track[];
      let defaultName: string;

      if ("tracks" in result) {
        allTracks = result.tracks;
        defaultName = join(config.outputDir, sanitizeFolderName(result.title));
      } else {
        allTracks = [result];
        defaultName = join(config.outputDir, sanitizeFolderName(`${result.artist} - ${result.title}`));
      }

      // Store resolved data for phase 2
      resolvedTracks.current = allTracks;
      setTracks(allTracks);
      setSuggestedName(defaultName);

      // Pause here — user picks the folder name next
      setState("naming");

    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setState("error");
    }
  }, [config.outputDir]);

  // ─────────────────────────────────────────────────────────────
  // Phase 2: User confirmed folder name, start downloading
  // ─────────────────────────────────────────────────────────────
  const confirmDownload = useCallback(async (outputPath: string): Promise<void> => {
    try {
      const allTracks = resolvedTracks.current;

      // Use the full path provided by the user
      effectiveOutputDir.current = outputPath;

      // Filter duplicates against the chosen directory
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

      // Initialize progress for all tracks
      const initialProgress = new Map<number, DownloadProgress>();

      for (const track of skippedTracks) {
        initialProgress.set(track.id, {
          trackId: track.id,
          percent: 100,
          status: "skipped",
        });
      }

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

      // Download tracks in parallel
      setState("downloading");

      await runConcurrent(
        tracksToDownload,
        async (track) => downloadSingleTrack(track),
        CONCURRENCY
      );

      setState("complete");

    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setState("error");
    }
  }, [config.skipDuplicates, config.format, downloadSingleTrack]);

  return {
    tracks,
    progress,
    error,
    state,
    outputDir: effectiveOutputDir.current,
    suggestedName,
    startDownload,
    confirmDownload,
  };
}
