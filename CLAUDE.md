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

**PRIMARY GOAL: Explain everything.** When implementing features:
1. Explain what you're about to implement and why
2. Explain how it works technically (algorithms, patterns, architecture decisions)
3. Explain trade-offs and alternatives considered
4. Show the code with inline comments for complex logic
5. Explain how pieces fit together in the larger system

Commit after every meaningful change with a descriptive message. No attribution footer needed.

## Workflow Orchestration

### 1. Plan Node Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately - don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One tack per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes - don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests - then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.

## Git Typology

**Commit frequently.** Every meaningful change should be its own commit — don't batch unrelated changes together. Commit after each logical step: a new function, a bug fix, a refactor, a test addition. Small, frequent commits make history easy to read, bisect, and revert.

Use conventional commit prefixes for all commit messages:

| Prefix       | When to use                                      |
|--------------|--------------------------------------------------|
| `feat:`      | New feature or capability                        |
| `fix:`       | Bug fix                                          |
| `refactor:`  | Code restructuring without behavior change       |
| `docs:`      | Documentation only changes                       |
| `style:`     | Formatting, whitespace, missing semicolons, etc. |
| `test:`      | Adding or updating tests                         |
| `chore:`     | Build process, dependencies, tooling             |
| `perf:`      | Performance improvement                          |
| `ci:`        | CI/CD configuration changes                      |
| `revert:`    | Reverting a previous commit                      |

Examples:
```
feat: add playlist subfolder support
fix: handle incomplete track data in large playlists
refactor: extract download logic into service layer
docs: update CLAUDE.md with workflow orchestration
chore: bump ink to v5
test: add coverage for SoundCloud API client
```
