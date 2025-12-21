#!/usr/bin/env node
import { render } from "ink";
import { program } from "commander";
import { App } from "./app.js";
import { runCli } from "./cli.js";
import type { AppConfig } from "./types/index.js";

program
  .name("scdown")
  .description("Download SoundCloud songs to MP3")
  .version("0.1.0")
  .argument("[url]", "SoundCloud track or playlist URL")
  .option("-o, --output <dir>", "Output directory", "/home/dylan/Documents/songs")
  .option("-q, --quality <bitrate>", "Audio quality (128/192/256/320)", "320")
  .option("--no-tui", "Disable TUI, use simple output")
  .parse();

const options = program.opts();
const [url] = program.args;

// Build config
const config: AppConfig = {
  outputDir: options.output,
  format: "mp3",
  quality: options.quality as "128" | "192" | "256" | "320",
};

// Decide which mode to use:
// 1. --no-tui flag explicitly set
// 2. No TTY available (piped, CI, etc.)
// 3. URL provided (can run non-interactively)
const useCli = !options.tui || !process.stdin.isTTY;

if (useCli && url) {
  // CLI mode: simple console output
  runCli(url, config).catch((error) => {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
} else if (useCli && !url) {
  // No TTY and no URL - can't do anything
  console.error("Error: URL required when running without a terminal");
  console.error("Usage: scdown <soundcloud-url>");
  process.exit(1);
} else {
  // TUI mode: interactive Ink interface
  render(<App url={url} outputDir={options.output} quality={options.quality} />);
}
