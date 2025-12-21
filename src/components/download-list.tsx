import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { Track, DownloadProgress } from "../types/index.js";

interface DownloadListProps {
  tracks: Track[];
  progress: Map<number, DownloadProgress>;
}

export function DownloadList({ tracks, progress }: DownloadListProps) {
  if (tracks.length === 0) {
    return (
      <Box>
        <Text color="yellow">
          <Spinner type="dots" />
        </Text>
        <Text> Fetching track info...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {tracks.map((track) => {
        const trackProgress = progress.get(track.id);
        return (
          <TrackRow key={track.id} track={track} progress={trackProgress} />
        );
      })}
    </Box>
  );
}

interface TrackRowProps {
  track: Track;
  progress?: DownloadProgress;
}

function TrackRow({ track, progress }: TrackRowProps) {
  const status = progress?.status ?? "pending";
  const percent = progress?.percent ?? 0;

  const statusIcon = {
    pending: "○",
    downloading: "↓",
    converting: "⟳",
    complete: "✓",
    error: "✗",
  }[status];

  const colorMap = {
    pending: "gray",
    downloading: "blue",
    converting: "yellow",
    complete: "green",
    error: "red",
  } as const;
  const statusColor = colorMap[status];

  return (
    <Box>
      <Text color={statusColor}>{statusIcon} </Text>
      <Text>
        {track.artist} - {track.title}
      </Text>
      {status === "downloading" && (
        <Text color="gray"> ({percent}%)</Text>
      )}
      {status === "error" && progress?.error && (
        <Text color="red"> - {progress.error}</Text>
      )}
    </Box>
  );
}
