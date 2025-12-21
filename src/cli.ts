/**
 * Simple CLI mode - works without a TTY (for testing, CI, scripting)
 * Uses plain console output instead of Ink TUI
 */

import type { AppConfig, Track } from "./types/index.js";
import { soundcloud } from "./services/soundcloud.js";
import { downloadTrack } from "./services/downloader.js";

export async function runCli(url: string, config: AppConfig): Promise<void> {
  console.log("🎵 SoundCloud Downloader (CLI mode)\n");

  // Step 1: Resolve URL
  console.log(`Resolving: ${url}`);
  const result = await soundcloud.resolveUrl(url);

  // Step 2: Get track list
  const tracks: Track[] = "tracks" in result ? result.tracks : [result];
  const title = "tracks" in result ? result.title : `${result.artist} - ${result.title}`;

  console.log(`Found: ${title}`);
  console.log(`Tracks: ${tracks.length}\n`);

  // Step 3: Download each track
  let completed = 0;
  let failed = 0;

  for (const track of tracks) {
    const prefix = `[${completed + failed + 1}/${tracks.length}]`;
    process.stdout.write(`${prefix} ${track.artist} - ${track.title}... `);

    try {
      await downloadTrack(track, config, {
        onProgress: (percent) => {
          process.stdout.write(`\r${prefix} ${track.artist} - ${track.title}... ${percent}%`);
        },
        onConverting: () => {
          process.stdout.write(`\r${prefix} ${track.artist} - ${track.title}... converting`);
        },
      });
      console.log(`\r${prefix} ${track.artist} - ${track.title}... ✓`);
      completed++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.log(`\r${prefix} ${track.artist} - ${track.title}... ✗ ${msg}`);
      failed++;
    }
  }

  // Step 4: Summary
  console.log("");
  console.log(`Done! ${completed} downloaded, ${failed} failed`);
  console.log(`Saved to: ${config.outputDir}`);
}
