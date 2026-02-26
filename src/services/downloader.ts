import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { join } from "node:path";
import ffmpeg from "fluent-ffmpeg";
import type { Track, AppConfig } from "../types/index.js";
import { soundcloud, httpClient } from "./soundcloud.js";

export interface DownloadCallbacks {
  onProgress?: (percent: number) => void;
  onConverting?: () => void;
  onComplete?: (outputPath: string) => void;
  onError?: (error: Error) => void;
}

export async function downloadTrack(
  track: Track,
  config: AppConfig,
  callbacks: DownloadCallbacks = {}
): Promise<string> {
  const { onProgress, onConverting, onComplete, onError } = callbacks;

  try {
    await mkdir(config.outputDir, { recursive: true });

    const streamUrl = await soundcloud.getStreamUrl(track);
    const sanitizedTitle = sanitizeFilename(`${track.artist} - ${track.title}`);
    const tempPath = join(config.outputDir, `${sanitizedTitle}.tmp`);
    const outputPath = join(config.outputDir, `${sanitizedTitle}.${config.format}`);

    // Download the stream
    const downloadStream = httpClient.stream(streamUrl);
    const fileStream = createWriteStream(tempPath);

    downloadStream.on("downloadProgress", ({ transferred, total }) => {
      if (total) {
        onProgress?.(Math.round((transferred / total) * 100));
      }
    });

    await pipeline(downloadStream, fileStream);

    // Convert to desired format
    onConverting?.();

    await new Promise<void>((resolve, reject) => {
      ffmpeg(tempPath)
        .audioBitrate(config.quality)
        .audioCodec(config.format === "mp3" ? "libmp3lame" : "pcm_s16le")
        .output(outputPath)
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .run();
    });

    // Clean up temp file
    const { unlink } = await import("node:fs/promises");
    await unlink(tempPath).catch(() => {});

    onComplete?.(outputPath);
    return outputPath;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    onError?.(err);
    throw err;
  }
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}
