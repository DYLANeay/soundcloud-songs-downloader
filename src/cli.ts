/**
 * Simple CLI mode - works without a TTY (for testing, CI, scripting)
 * Uses plain console output instead of Ink TUI
 */

import { join } from "node:path";
import type { AppConfig, Track } from "./types/index.js";
import { soundcloud } from "./services/soundcloud.js";
import { downloadTrack } from "./services/downloader.js";
import { runConcurrent } from "./utils/concurrent.js";
import { filterExistingTracks } from "./utils/duplicates.js";

// How many tracks to download at once
const CONCURRENCY = 4;

// Sanitize playlist name for use as folder name
function sanitizeFolderName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

export async function runCli(url: string, config: AppConfig): Promise<void> {
  console.log("🎵 SoundCloud Downloader (CLI mode)\n");

  // Step 1: Resolve URL
  console.log(`Resolving: ${url}`);
  const result = await soundcloud.resolveUrl(url);

  // Step 2: Get track list and determine output directory
  const isPlaylist = "tracks" in result;
  const allTracks: Track[] = isPlaylist ? result.tracks : [result];
  const title = isPlaylist ? result.title : `${result.artist} - ${result.title}`;

  // Playlists get their own subfolder
  const effectiveOutputDir = isPlaylist
    ? join(config.outputDir, sanitizeFolderName(result.title))
    : config.outputDir;

  // Create effective config with the right output directory
  const effectiveConfig: AppConfig = {
    ...config,
    outputDir: effectiveOutputDir,
  };

  console.log(`Found: ${title}`);
  console.log(`Total tracks: ${allTracks.length}`);

  // Step 3: Filter out already-downloaded tracks if skipDuplicates is enabled
  let tracksToDownload = allTracks;
  let skippedCount = 0;

  if (config.skipDuplicates) {
    const { toDownload, skipped } = await filterExistingTracks(
      allTracks,
      effectiveOutputDir,
      config.format
    );
    tracksToDownload = toDownload;
    skippedCount = skipped.length;

    if (skippedCount > 0) {
      console.log(`Skipping ${skippedCount} already downloaded track(s)`);
    }

    if (tracksToDownload.length === 0) {
      console.log("\nAll tracks already downloaded!");
      console.log(`Location: ${effectiveOutputDir}`);
      return;
    }
  }

  console.log(`Downloading: ${tracksToDownload.length}`);
  console.log(`Parallel downloads: ${CONCURRENCY}\n`);

  // Step 4: Download tracks in parallel
  let completed = 0;
  let failed = 0;
  const total = tracksToDownload.length;

  await runConcurrent(
    tracksToDownload,
    async (track, _index) => {
      const name = `${track.artist} - ${track.title}`;

      try {
        await downloadTrack(track, effectiveConfig);
        completed++;
        console.log(`✓ [${completed + failed}/${total}] ${name}`);
      } catch (error) {
        failed++;
        const msg = error instanceof Error ? error.message : "Unknown error";
        console.log(`✗ [${completed + failed}/${total}] ${name} - ${msg}`);
      }
    },
    CONCURRENCY
  );

  // Step 5: Summary
  console.log("");
  console.log(`Done! ${completed} downloaded, ${failed} failed${skippedCount > 0 ? `, ${skippedCount} skipped` : ""}`);
  console.log(`Saved to: ${effectiveOutputDir}`);
}
