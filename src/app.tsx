import { useState } from "react";
import { Box, Text } from "ink";
import { UrlInput } from "./components/url-input.js";
import { DownloadList } from "./components/download-list.js";
import type { Track, DownloadProgress } from "./types/index.js";

interface AppProps {
  url?: string;
  outputDir: string;
  quality: string;
}

type AppState = "input" | "downloading" | "complete";

export function App({ url: initialUrl, outputDir, quality: _quality }: AppProps) {
  const [state, setState] = useState<AppState>(initialUrl ? "downloading" : "input");
  const [_url, setUrl] = useState(initialUrl ?? "");
  const [tracks, _setTracks] = useState<Track[]>([]);
  const [progress, _setProgress] = useState<Map<number, DownloadProgress>>(new Map());

  const handleUrlSubmit = (submittedUrl: string) => {
    setUrl(submittedUrl);
    setState("downloading");
    // TODO: Start download process
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          SoundCloud Downloader
        </Text>
      </Box>

      {state === "input" && <UrlInput onSubmit={handleUrlSubmit} />}

      {state === "downloading" && (
        <DownloadList tracks={tracks} progress={progress} />
      )}

      {state === "complete" && (
        <Text color="green">All downloads complete! Saved to {outputDir}</Text>
      )}
    </Box>
  );
}
