import { describe, it, expect } from "vitest";
import { TrackSchema, PlaylistSchema } from "../src/types/index.js";

describe("Type schemas", () => {
  it("validates a valid track", () => {
    const track = {
      id: 123,
      title: "Test Track",
      artist: "Test Artist",
      duration: 180000,
      artworkUrl: "https://example.com/art.jpg",
      streamUrl: "https://example.com/stream",
      permalink: "https://soundcloud.com/artist/track",
    };

    const result = TrackSchema.safeParse(track);
    expect(result.success).toBe(true);
  });

  it("validates a track with null artwork", () => {
    const track = {
      id: 123,
      title: "Test Track",
      artist: "Test Artist",
      duration: 180000,
      artworkUrl: null,
      streamUrl: null,
      permalink: "https://soundcloud.com/artist/track",
    };

    const result = TrackSchema.safeParse(track);
    expect(result.success).toBe(true);
  });

  it("rejects invalid track", () => {
    const track = {
      id: "not a number",
      title: 123,
    };

    const result = TrackSchema.safeParse(track);
    expect(result.success).toBe(false);
  });
});
