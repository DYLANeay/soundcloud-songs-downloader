import { z } from "zod";

export const TrackSchema = z.object({
  id: z.number(),
  title: z.string(),
  artist: z.string(),
  duration: z.number(), // in milliseconds
  artworkUrl: z.string().url().nullable(),
  streamUrl: z.string().url().nullable(),
  permalink: z.string().url(),
});

export type Track = z.infer<typeof TrackSchema>;

export const PlaylistSchema = z.object({
  id: z.number(),
  title: z.string(),
  tracks: z.array(TrackSchema),
});

export type Playlist = z.infer<typeof PlaylistSchema>;

export interface DownloadProgress {
  trackId: number;
  percent: number;
  status: "pending" | "downloading" | "converting" | "complete" | "error";
  error?: string;
}

export interface AppConfig {
  outputDir: string;
  format: "mp3" | "wav" | "flac";
  quality: "128" | "192" | "256" | "320";
}
