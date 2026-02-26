# scdown

Download SoundCloud tracks and playlists to MP3.

A terminal app with an interactive TUI (built with [Ink](https://github.com/vadimdemedes/ink)) or a simple CLI mode for scripts and automation.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [ffmpeg](https://ffmpeg.org/) installed and available in your PATH

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg

# Arch
sudo pacman -S ffmpeg
```

## Install

```bash
git clone https://github.com/DYLANeay/soundcloud-songs-downloader.git
cd soundcloud-songs-downloader
npm install
npm run build
```

## Usage

```bash
# Download a single track
npm start -- "https://soundcloud.com/artist/track-name"

# Download an entire playlist
npm start -- "https://soundcloud.com/artist/sets/playlist-name"

# Download a user's tracks
npm start -- "https://soundcloud.com/artist"

# Shortened URLs work too
npm start -- "https://on.soundcloud.com/abc123"

# Interactive mode (TUI) — launches a URL prompt
npm start
```

### Interactive mode (TUI)

Run without a URL to get an interactive terminal interface:

```bash
npm start
```

```
 SoundCloud Downloader

 Enter SoundCloud URL: https://soundcloud.com/artist/track
```

Paste a URL and press Enter. For playlists, you'll be prompted to choose a folder name before downloading begins.

During download, the TUI shows a compact rolling view — a progress summary, active downloads, and the last few completed tracks:

```
 SoundCloud Downloader

 ⠋ Downloading: 5/20 complete
   ✓ Artist - Track Four
   ✓ Artist - Track Five
   ↓ Artist - Track Six (42%)
   ↓ Artist - Track Seven (18%)
   ⟳ Artist - Track Eight
```

| Symbol | Meaning |
|--------|---------|
| `↓` | Downloading (with %) |
| `⟳` | Converting to MP3 |
| `✓` | Complete |
| `✗` | Error |
| `⊘` | Skipped (already exists) |

On completion, a summary is shown (`✓ 18 downloaded, 2 failed — Saved to /path`) and the app exits automatically. On error, the URL prompt reappears so you can try again.

### Options

```
-o, --output <dir>       Output directory (default: ~/Documents/songs)
-q, --quality <bitrate>  Audio quality: 128, 192, 256, 320 (default: 320)
-nd, --no-duplicates     Skip tracks that are already downloaded
--no-tui                 Disable interactive TUI, use plain text output
```

### Examples

```bash
# Download to a specific folder at 256kbps
npm start -- "https://soundcloud.com/artist/track" -o ~/Music -q 256

# Download a playlist, skip already-downloaded tracks
npm start -- "https://soundcloud.com/artist/sets/playlist" -nd

# Non-interactive mode (for scripts/cron)
npm start -- "https://soundcloud.com/artist/track" --no-tui
```

## Development

```bash
# Run directly without building (hot reload)
npm run dev -- "https://soundcloud.com/artist/track"

# Type check + lint + tests
npm run check

# Run tests
npm test
```

## How it works

1. Scrapes a client ID from SoundCloud's JavaScript bundles (no API key needed)
2. Resolves the URL via SoundCloud's API to get track metadata and stream URLs
3. Downloads the audio stream (prefers progressive over HLS)
4. Converts to MP3 using ffmpeg
5. Saves to the output directory (playlists get their own subfolder)

## License

MIT
