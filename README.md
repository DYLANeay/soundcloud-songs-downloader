# SoundCloud Songs Downloader

Download SoundCloud tracks and playlists to MP3.

## Requirements

- Node.js 20+
- ffmpeg

Install ffmpeg:
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg
```

## Usage

```bash
git clone <repo-url>
cd soundcloud-songs-downloader
npm install
npx tsx src/index.tsx [url]
```

### Examples

Interactive mode (TUI):
```bash
npx tsx src/index.tsx
```

Download a track:
```bash
npx tsx src/index.tsx https://soundcloud.com/artist/track
```

Download a playlist:
```bash
npx tsx src/index.tsx https://soundcloud.com/artist/sets/playlist
```

### Options

```
-o, --output <dir>      Output directory (default: ~/Documents/songs)
-q, --quality <bitrate> Audio quality: 128/192/256/320 (default: 320)
--no-tui                Disable interactive mode
```
