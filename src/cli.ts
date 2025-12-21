/**
 * Simple CLI mode - works without a TTY (for testing, CI, scripting)
 * Uses plain console output instead of Ink TUI
 */

import type { AppConfig, Track } from "./types/index.js";
import { soundcloud } from "./services/soundcloud.js";
import { downloadTrack } from "./services/downloader.js";
import { runConcurrent } from "./utils/concurrent.js";

// How many tracks to download at once
const CONCURRENCY = 4;

export async function runCli(url: string, config: AppConfig): Promise<void> {
  console.log("🎵 SoundCloud Downloader (CLI mode)\n");

  // Step 1: Resolve URL
  console.log(`Resolving: ${url}`);
  const result = await soundcloud.resolveUrl(url);

  // Step 2: Get track list
  const tracks: Track[] = "tracks" in result ? result.tracks : [result];
  const title = "tracks" in result ? result.title : `${result.artist} - ${result.title}`;

  console.log(`Found: ${title}`);
  console.log(`Tracks: ${tracks.length}`);
  console.log(`Parallel downloads: ${CONCURRENCY}\n`);

  // Step 3: Download tracks in parallel
  let completed = 0;
  let failed = 0;
  const total = tracks.length;

  await runConcurrent(
    tracks,
    async (track, _index) => {
      const name = `${track.artist} - ${track.title}`;

      try {
        await downloadTrack(track, config);
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

  // Step 4: Summary
  console.log("");
  console.log(`Done! ${completed} downloaded, ${failed} failed`);
  console.log(`Saved to: ${config.outputDir}`);
}
