import { access } from "node:fs/promises";
import { join } from "node:path";
import type { Track } from "../types/index.js";

/**
 * Sanitize a string for use as a filename (same logic as downloader.ts)
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

/**
 * Get the expected filename for a track
 */
export function getTrackFilename(track: Track, format: string): string {
  const sanitizedTitle = sanitizeFilename(`${track.artist} - ${track.title}`);
  return `${sanitizedTitle}.${format}`;
}

/**
 * Check if a file exists at the given path
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if the output directory exists
 */
export async function directoryExists(path: string): Promise<boolean> {
  return fileExists(path);
}

/**
 * Check if a track has already been downloaded
 */
export async function isTrackDownloaded(
  track: Track,
  outputDir: string,
  format: string
): Promise<boolean> {
  const filename = getTrackFilename(track, format);
  const filepath = join(outputDir, filename);
  return fileExists(filepath);
}

/**
 * Filter tracks to only include those not already downloaded
 * Returns { toDownload, skipped } where:
 * - toDownload: tracks that need to be downloaded
 * - skipped: tracks that already exist
 */
export async function filterExistingTracks(
  tracks: Track[],
  outputDir: string,
  format: string
): Promise<{ toDownload: Track[]; skipped: Track[] }> {
  const toDownload: Track[] = [];
  const skipped: Track[] = [];

  for (const track of tracks) {
    const exists = await isTrackDownloaded(track, outputDir, format);
    if (exists) {
      skipped.push(track);
    } else {
      toDownload.push(track);
    }
  }

  return { toDownload, skipped };
}
