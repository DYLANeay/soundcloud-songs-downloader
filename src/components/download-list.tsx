import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { Track, DownloadProgress } from "../types/index.js";

interface DownloadListProps {
  tracks: Track[];
  progress: Map<number, DownloadProgress>;
}

const MAX_RECENT = 3;

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

  // Partition tracks by status
  const active: { track: Track; progress?: DownloadProgress }[] = [];
  const finished: { track: Track; progress?: DownloadProgress }[] = [];
  const pending: { track: Track; progress?: DownloadProgress }[] = [];

  for (const track of tracks) {
    const p = progress.get(track.id);
    const status = p?.status ?? "pending";

    if (status === "downloading" || status === "converting") {
      active.push({ track, progress: p });
    } else if (status === "complete" || status === "error" || status === "skipped") {
      finished.push({ track, progress: p });
    } else {
      pending.push({ track, progress: p });
    }
  }

  // Show only the most recent completions (tail of the finished list,
  // since tracks finish roughly in order they started)
  const recentFinished = finished.slice(-MAX_RECENT);

  // Build summary counts
  const complete = finished.filter(f => f.progress?.status === "complete").length;
  const failed = finished.filter(f => f.progress?.status === "error").length;
  const skipped = finished.filter(f => f.progress?.status === "skipped").length;

  const parts = [`${complete + failed + skipped}/${tracks.length} complete`];
  if (failed > 0) parts.push(`${failed} failed`);
  if (skipped > 0) parts.push(`${skipped} skipped`);

  return (
    <Box flexDirection="column">
      {/* Summary counter — always visible */}
      <Box>
        <Text color="yellow">
          <Spinner type="dots" />
        </Text>
        <Text> Downloading: {parts.join(", ")}</Text>
      </Box>

      {/* Recent completions — feedback that work is finishing */}
      {recentFinished.map(({ track, progress: p }) => (
        <TrackRow key={track.id} track={track} progress={p} />
      ))}

      {/* Active downloads — the rows that are actually changing */}
      {active.map(({ track, progress: p }) => (
        <TrackRow key={track.id} track={track} progress={p} />
      ))}
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
    skipped: "⊘",
  }[status];

  const colorMap = {
    pending: "gray",
    downloading: "blue",
    converting: "yellow",
    complete: "green",
    error: "red",
    skipped: "cyan",
  } as const;
  const statusColor = colorMap[status];

  return (
    <Box>
      <Text color={statusColor}>  {statusIcon} </Text>
      <Text>
        {track.artist} - {track.title}
      </Text>
      {status === "downloading" && (
        <Text color="gray"> ({percent}%)</Text>
      )}
      {status === "skipped" && (
        <Text color="cyan"> (already downloaded)</Text>
      )}
      {status === "error" && progress?.error && (
        <Text color="red"> - {progress.error}</Text>
      )}
    </Box>
  );
}
