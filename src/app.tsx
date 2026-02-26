import { useEffect } from "react";
import { Box, Text, useApp } from "ink";
import { UrlInput } from "./components/url-input.js";
import { DownloadList } from "./components/download-list.js";
import { useDownloader } from "./hooks/use-downloader.js";
import type { AppConfig } from "./types/index.js";

interface AppProps {
  url?: string;
  outputDir: string;
  quality: string;
  skipDuplicates?: boolean;
}

export function App({ url: initialUrl, outputDir, quality, skipDuplicates }: AppProps) {
  const { exit } = useApp();

  // ─────────────────────────────────────────────────────────────
  // Build config from props
  // ─────────────────────────────────────────────────────────────
  const config: AppConfig = {
    outputDir,
    format: "mp3",
    quality: quality as "128" | "192" | "256" | "320",
    skipDuplicates,
  };

  // ─────────────────────────────────────────────────────────────
  // Use our downloader hook - this manages all download state
  // ─────────────────────────────────────────────────────────────
  const { tracks, progress, error, state, outputDir: effectiveOutputDir, startDownload } = useDownloader(config);

  // ─────────────────────────────────────────────────────────────
  // If URL was passed via CLI args, start downloading immediately
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (initialUrl) {
      startDownload(initialUrl);
    }
  }, []);  // Only run once on mount

  // ─────────────────────────────────────────────────────────────
  // Auto-exit after completion (with small delay to show result)
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (state !== "complete") return;

    const timer = setTimeout(() => exit(), 2000);
    return () => clearTimeout(timer);
  }, [state, exit]);

  // ─────────────────────────────────────────────────────────────
  // Render based on current state
  // ─────────────────────────────────────────────────────────────
  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🎵 SoundCloud Downloader
        </Text>
      </Box>

      {/* State: Waiting for URL input */}
      {state === "idle" && <UrlInput onSubmit={startDownload} />}

      {/* State: Resolving URL to get track info */}
      {state === "resolving" && (
        <Text color="yellow">Fetching track info...</Text>
      )}

      {/* State: Downloading tracks */}
      {state === "downloading" && (
        <DownloadList tracks={tracks} progress={progress} />
      )}

      {/* State: All done */}
      {state === "complete" && (() => {
        const statuses = Array.from(progress.values());
        const downloaded = statuses.filter(p => p.status === "complete").length;
        const failed = statuses.filter(p => p.status === "error").length;
        const skipped = statuses.filter(p => p.status === "skipped").length;

        const parts = [`${downloaded} downloaded`];
        if (failed > 0) parts.push(`${failed} failed`);
        if (skipped > 0) parts.push(`${skipped} skipped`);

        return (
          <Box flexDirection="column">
            <DownloadList tracks={tracks} progress={progress} />
            <Box marginTop={1}>
              <Text color="green">
                ✓ {parts.join(", ")} — Saved to {effectiveOutputDir}
              </Text>
            </Box>
          </Box>
        );
      })()}

      {/* State: Error occurred */}
      {state === "error" && (
        <Box flexDirection="column">
          <Text color="red">✗ Error: {error}</Text>
          <Box marginTop={1}>
            <UrlInput onSubmit={startDownload} />
          </Box>
        </Box>
      )}
    </Box>
  );
}
