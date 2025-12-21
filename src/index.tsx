#!/usr/bin/env node
import { render } from "ink";
import { program } from "commander";
import { App } from "./app.js";

program
  .name("scdown")
  .description("Download SoundCloud songs to MP3")
  .version("0.1.0")
  .argument("[url]", "SoundCloud track or playlist URL")
  .option("-o, --output <dir>", "Output directory", "./downloads")
  .option("-q, --quality <bitrate>", "Audio quality (128/192/256/320)", "320")
  .option("--no-tui", "Disable TUI, use simple output")
  .parse();

const options = program.opts();
const [url] = program.args;

render(<App url={url} outputDir={options.output} quality={options.quality} />);
