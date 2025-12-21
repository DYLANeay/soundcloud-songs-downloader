# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SoundCloud songs downloader - a TUI application that downloads SoundCloud tracks and playlists to MP3 format for iTunes import. Built with TypeScript, Ink (React for CLIs), and ffmpeg for audio conversion.

## Commands

```bash
npm run dev          # Run in development mode with hot reload
npm run build        # Compile TypeScript to dist/
npm run start        # Run compiled version
npm run check        # Run typecheck + lint + tests (use before commits)
npm run test         # Run tests once
npm run test:watch   # Run tests in watch mode
npm run lint:fix     # Auto-fix lint issues
npm run format       # Format code with Prettier
```

## Architecture

```
src/
├── index.tsx              # CLI entry point (commander for args, renders App)
├── app.tsx                # Main TUI app component, state machine for UI flow
├── components/            # Ink React components
│   ├── url-input.tsx      # URL entry with validation
│   └── download-list.tsx  # Progress display for downloads
├── services/              # Core business logic
│   ├── soundcloud.ts      # SoundCloud API client (resolve URLs, get streams)
│   └── downloader.ts      # Download + ffmpeg conversion pipeline
├── types/                 # Zod schemas and TypeScript types
│   └── index.ts
└── utils/                 # Utility functions
```

## Key Technical Details

- **SoundCloud API**: No official API. Client ID is scraped from SoundCloud's JS bundles. API calls go to `api-v2.soundcloud.com`.
- **Audio streams**: SoundCloud provides HLS or progressive streams. We prefer progressive for simpler downloading.
- **Conversion**: Uses fluent-ffmpeg. Requires ffmpeg installed on system (`brew install ffmpeg` or `apt install ffmpeg`).
- **TUI Framework**: Ink v5 (React 18 for terminals). Components are React functional components with hooks.

## Type Patterns

- Use Zod schemas for runtime validation of external data (API responses)
- Export inferred types: `export type Track = z.infer<typeof TrackSchema>`
- All SoundCloud API responses should be validated before use

## Testing

Tests use Vitest. Run `npm test` for single run, `npm run test:watch` for development.

```bash
npm test -- tests/soundcloud.test.ts    # Run specific test file
npm test -- -t "validates"              # Run tests matching pattern
```

## Workflow

Commit after every meaningful change with a descriptive message. No attribution footer needed.
