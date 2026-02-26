# SoundCloud Downloader - Complete Reference Annex

> A comprehensive guide to understanding every aspect of this codebase, including TypeScript concepts for newcomers.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture & Data Flow](#2-architecture--data-flow)
3. [TypeScript Fundamentals Used](#3-typescript-fundamentals-used)
4. [File-by-File Breakdown](#4-file-by-file-breakdown)
5. [React & Ink (Terminal UI)](#5-react--ink-terminal-ui)
6. [State Machine & Application Flow](#6-state-machine--application-flow)
7. [SoundCloud API Reverse Engineering](#7-soundcloud-api-reverse-engineering)
8. [Download Pipeline](#8-download-pipeline)
9. [Concurrency Model](#9-concurrency-model)
10. [Error Handling Patterns](#10-error-handling-patterns)
11. [Configuration & Build System](#11-configuration--build-system)
12. [Testing Strategy](#12-testing-strategy)
13. [Glossary](#13-glossary)

---

## 1. Project Overview

### What This Application Does

This is a **TUI (Terminal User Interface)** application that:
1. Takes a SoundCloud URL (track, playlist, or user profile)
2. Resolves it via SoundCloud's API to get track metadata
3. Downloads the audio streams
4. Converts them to MP3 using FFmpeg
5. Saves them to your filesystem for iTunes import

### Technology Stack

| Technology | Purpose |
|------------|---------|
| **TypeScript** | Typed JavaScript for safer code |
| **Ink v5** | React for terminals (renders to CLI instead of browser) |
| **React 18** | Component-based UI framework |
| **Zod** | Runtime data validation with automatic type inference |
| **Commander** | CLI argument parsing |
| **Got** | HTTP client for API calls and downloads |
| **fluent-ffmpeg** | Node.js wrapper for FFmpeg audio conversion |
hello word

### System Requirements

- **Node.js 20+** - JavaScript runtime
- **FFmpeg** - System-level audio processing tool
- **npm** - Package manager

---

## 2. Architecture & Data Flow

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INPUT                                   │
│                    (SoundCloud URL)                                  │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      ENTRY POINT (index.tsx)                         │
│  • Parse CLI arguments with Commander                                │
│  • Decide: TUI mode vs CLI mode                                      │
└─────────────────────────────────────────────────────────────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              ▼                                   ▼
┌──────────────────────────┐       ┌──────────────────────────┐
│     TUI MODE (app.tsx)   │       │    CLI MODE (cli.ts)     │
│  • Interactive React app │       │  • Simple console output │
│  • Visual progress bars  │       │  • For scripts & CI      │
│  • State machine UI      │       │  • No interactivity      │
└──────────────────────────┘       └──────────────────────────┘
              │                                   │
              └─────────────────┬─────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   HOOK: useDownloader                                │
│  • Manages download state                                            │
│  • Orchestrates the entire download process                          │
│  • Tracks progress for each track                                    │
└─────────────────────────────────────────────────────────────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              ▼                                   ▼
┌──────────────────────────┐       ┌──────────────────────────┐
│  SoundCloud Service      │       │   Downloader Service     │
│  (soundcloud.ts)         │       │   (downloader.ts)        │
│                          │       │                          │
│  • Resolve URLs          │       │  • Download audio stream │
│  • Get client_id         │       │  • Convert with FFmpeg   │
│  • Fetch track metadata  │       │  • Report progress       │
│  • Handle playlists      │       │  • Save to filesystem    │
└──────────────────────────┘       └──────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         OUTPUT                                       │
│              ~/Documents/songs/Artist - Title.mp3                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow Sequence

```
1. User enters: https://soundcloud.com/artist/track-name
                              │
2. Expand URL (if shortened): on.soundcloud.com/xxx → full URL
                              │
3. Scrape client_id from SoundCloud JS bundles
                              │
4. API call: api-v2.soundcloud.com/resolve?url=...&client_id=...
                              │
5. Parse response → Track or Playlist object
                              │
6. For each track:
   │
   ├─► Get stream URL from track.media.transcodings
   │
   ├─► Download audio via got.stream()
   │
   ├─► Write to temp file (.tmp)
   │
   ├─► Convert with FFmpeg → MP3
   │
   └─► Remove temp file, done!
```

---

## 3. TypeScript Fundamentals Used

TypeScript adds **static types** to JavaScript. Here's every TypeScript concept used in this project, explained from scratch.

### 3.1 Basic Types

```typescript
// Primitive types
const name: string = "Track Name";      // Text
const id: number = 12345;               // Numbers (integers & decimals)
const isActive: boolean = true;         // true or false
const nothing: null = null;             // Intentional absence
const notDefined: undefined = undefined; // Not yet assigned

// Arrays - list of items of the same type
const ids: number[] = [1, 2, 3];
const names: string[] = ["a", "b", "c"];

// Alternative array syntax
const ids2: Array<number> = [1, 2, 3];
```

**Where used:** Throughout the codebase for variable declarations, function parameters, and return types.

---

### 3.2 Type Annotations

Type annotations tell TypeScript what type a variable, parameter, or return value should be.

```typescript
// Variable annotation
let count: number = 0;

// Function parameter annotations
function greet(name: string): void {
  console.log(`Hello, ${name}`);
}

// Return type annotation (after the parentheses)
function add(a: number, b: number): number {
  return a + b;
}

// Arrow function with types
const multiply = (a: number, b: number): number => a * b;
```

**Where used:** `src/services/soundcloud.ts:18-25` - all service functions have explicit parameter and return types.

---

### 3.3 Interfaces

Interfaces define the **shape** of an object - what properties it must have and their types.

```typescript
// Define the shape of a Track object
interface Track {
  id: number;
  title: string;
  artist: string;
  duration: number;
  artworkUrl: string | null;  // Can be string OR null
}

// Now TypeScript enforces this shape
const track: Track = {
  id: 1,
  title: "My Song",
  artist: "DJ Example",
  duration: 180000,
  artworkUrl: null
};

// ERROR: missing required property 'duration'
const badTrack: Track = {
  id: 1,
  title: "Bad",
  artist: "Oops"
};
```

**Where used:** `src/types/index.ts` - defines all data structures. `src/components/*.tsx` - defines component props.

---

### 3.4 Type Aliases

Type aliases create a new name for a type. Similar to interfaces but more flexible.

```typescript
// Simple alias
type ID = number;

// Object type (similar to interface)
type Point = {
  x: number;
  y: number;
};

// Union type (can be one OR the other)
type Status = "pending" | "complete" | "error";

// The key difference from interfaces:
// - Types can represent unions, primitives, tuples
// - Interfaces are better for object shapes that might be extended
```

**Where used:** `src/types/index.ts:35` - `type Track = z.infer<typeof TrackSchema>` creates a type from a Zod schema.

---

### 3.5 Union Types

Union types allow a value to be one of several types.

```typescript
// A variable that can be string OR null
let username: string | null = null;
username = "Dylan";  // OK
username = null;     // OK
username = 123;      // ERROR: number is not allowed

// Literal union - only specific values allowed
type Status = "idle" | "loading" | "success" | "error";
let state: Status = "idle";
state = "loading";   // OK
state = "waiting";   // ERROR: "waiting" is not in the union

// Function that returns different types
function parseInput(input: string): number | null {
  const num = parseInt(input);
  return isNaN(num) ? null : num;
}
```

**Where used:**
- `src/types/index.ts:29` - `status: z.enum(["pending", "downloading", "converting", "complete", "error"])`
- `src/app.tsx:12` - State machine: `"idle" | "resolving" | "downloading" | "complete" | "error"`

---

### 3.6 Optional Properties

Optional properties might or might not exist on an object.

```typescript
interface Config {
  required: string;      // Must be provided
  optional?: number;     // May or may not exist (undefined if missing)
}

const config1: Config = { required: "yes" };              // OK
const config2: Config = { required: "yes", optional: 5 }; // OK
const config3: Config = { optional: 5 };                  // ERROR: missing 'required'
```

**Where used:** `src/services/downloader.ts:15-20` - `DownloadCallbacks` has all optional properties:
```typescript
interface DownloadCallbacks {
  onProgress?: (percent: number) => void;
  onConverting?: () => void;
  onComplete?: (path: string) => void;
  onError?: (error: Error) => void;
}
```

---

### 3.7 Generics

Generics are **type parameters** - they let you write code that works with any type while maintaining type safety.

```typescript
// A function that works with ANY type
function identity<T>(value: T): T {
  return value;
}

// T becomes 'number' here
const num = identity<number>(5);  // Returns: number

// T becomes 'string' here
const str = identity<string>("hello");  // Returns: string

// TypeScript can often infer T automatically
const inferred = identity("auto");  // T inferred as "string"


// Generics with arrays
function firstElement<T>(arr: T[]): T | undefined {
  return arr[0];
}

const first = firstElement([1, 2, 3]);  // T = number, returns number | undefined


// Multiple type parameters
function pair<A, B>(first: A, second: B): [A, B] {
  return [first, second];
}
```

**Where used:** `src/utils/concurrent.ts:1-4`:
```typescript
async function runConcurrent<T, R>(
  items: T[],           // Array of any type T
  fn: (item: T) => Promise<R>,  // Function taking T, returning Promise<R>
  concurrency: number
): Promise<R[]>         // Returns array of R
```

This allows the function to work with any input/output types while keeping them connected.

---

### 3.8 Type Guards & Narrowing

Type guards help TypeScript understand the specific type within a union.

```typescript
// The "typeof" type guard
function printValue(value: string | number) {
  if (typeof value === "string") {
    // TypeScript knows value is a string here
    console.log(value.toUpperCase());
  } else {
    // TypeScript knows value is a number here
    console.log(value.toFixed(2));
  }
}

// The "instanceof" type guard
function handleError(error: unknown) {
  if (error instanceof Error) {
    // TypeScript knows error is Error here
    console.log(error.message);
  } else {
    console.log(String(error));
  }
}

// The "in" operator type guard
type Track = { kind: "track"; title: string };
type Playlist = { kind: "playlist"; tracks: Track[] };

function handle(item: Track | Playlist) {
  if ("tracks" in item) {
    // TypeScript knows item is Playlist
    console.log(item.tracks.length);
  } else {
    // TypeScript knows item is Track
    console.log(item.title);
  }
}
```

**Where used:**
- `src/hooks/use-downloader.ts:47` - `"tracks" in result` checks if result is a Playlist
- `src/services/downloader.ts:67` - `error instanceof Error` for error handling

---

### 3.9 Async/Await & Promises

TypeScript fully supports async/await with typed Promises.

```typescript
// Promise type annotation
function fetchData(): Promise<string> {
  return new Promise((resolve) => {
    setTimeout(() => resolve("data"), 1000);
  });
}

// Async function - automatically returns a Promise
async function getData(): Promise<string> {
  const result = await fetchData();  // Waits for promise to resolve
  return result;
}

// Async arrow function
const loadUser = async (id: number): Promise<User> => {
  const response = await fetch(`/users/${id}`);
  return response.json();
};

// Promise.all - run multiple promises in parallel
const [user, posts] = await Promise.all([
  fetchUser(1),
  fetchPosts(1)
]);
```

**Where used:** Almost every file uses async/await. See `src/services/soundcloud.ts` for extensive examples.

---

### 3.10 Enums & Literal Types

```typescript
// String literal type (preferred in this codebase)
type Status = "pending" | "complete" | "error";

// Numeric enum (traditional, but less common now)
enum StatusEnum {
  Pending,   // 0
  Complete,  // 1
  Error      // 2
}

// String enum
enum Direction {
  Up = "UP",
  Down = "DOWN"
}
```

**Where used:** This codebase uses **string literal unions** instead of enums:
```typescript
// src/types/index.ts
status: z.enum(["pending", "downloading", "converting", "complete", "error"])
```

---

### 3.11 The `unknown` Type

`unknown` is the type-safe counterpart to `any`. You must check its type before using it.

```typescript
// 'any' - TypeScript stops checking (dangerous!)
let dangerous: any = "hello";
dangerous.nonExistentMethod();  // No error, but will crash at runtime!

// 'unknown' - Must check type first (safe)
let safe: unknown = "hello";
safe.toUpperCase();  // ERROR: Object is of type 'unknown'

if (typeof safe === "string") {
  safe.toUpperCase();  // OK - TypeScript knows it's a string now
}
```

**Where used:** Error handling throughout the codebase. Caught exceptions are `unknown`:
```typescript
} catch (error: unknown) {
  const err = error instanceof Error ? error : new Error(String(error));
}
```

---

### 3.12 Function Types

Functions themselves have types describing their parameters and return value.

```typescript
// Function type as a variable
type ClickHandler = (event: MouseEvent) => void;

// Function type in an interface
interface ButtonProps {
  onClick: (id: number) => void;
  onHover?: () => void;  // Optional function property
}

// Callback parameter
function doSomething(callback: (result: string) => void) {
  callback("done");
}
```

**Where used:** `src/services/downloader.ts:15-20`:
```typescript
interface DownloadCallbacks {
  onProgress?: (percent: number) => void;
  onConverting?: () => void;
  onComplete?: (path: string) => void;
  onError?: (error: Error) => void;
}
```

---

### 3.13 Type Inference with Zod

Zod is a validation library that can **infer TypeScript types** from schemas.

```typescript
import { z } from "zod";

// Define a schema (runtime validation rules)
const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  age: z.number().optional()
});

// Infer the TypeScript type FROM the schema
type User = z.infer<typeof UserSchema>;
// Equivalent to:
// type User = {
//   id: number;
//   name: string;
//   email: string;
//   age?: number;
// }

// Validate data at runtime
const result = UserSchema.safeParse(someData);
if (result.success) {
  // result.data is typed as User
  console.log(result.data.name);
} else {
  console.error(result.error);
}
```

**Where used:** `src/types/index.ts` - All types are inferred from Zod schemas:
```typescript
export const TrackSchema = z.object({
  id: z.number(),
  title: z.string(),
  // ...
});
export type Track = z.infer<typeof TrackSchema>;
```

---

### 3.14 Mapped Types (Map<K, V>)

JavaScript's `Map` is a key-value data structure with type parameters.

```typescript
// Map where keys are numbers and values are DownloadProgress
const progress = new Map<number, DownloadProgress>();

// Set a value
progress.set(123, { trackId: 123, percent: 50, status: "downloading" });

// Get a value (returns undefined if not found)
const p = progress.get(123);  // Type: DownloadProgress | undefined

// Check existence
if (progress.has(123)) { /* ... */ }

// Iterate
for (const [id, prog] of progress) {
  console.log(id, prog.percent);
}
```

**Where used:** `src/hooks/use-downloader.ts:23`:
```typescript
const [progress, setProgress] = useState<Map<number, DownloadProgress>>(new Map());
```

---

### 3.15 Utility Types

TypeScript provides built-in utility types for common transformations.

```typescript
// Partial<T> - Makes all properties optional
interface User { name: string; age: number; }
type PartialUser = Partial<User>;
// { name?: string; age?: number; }

// Required<T> - Makes all properties required
type RequiredUser = Required<PartialUser>;

// Pick<T, K> - Select specific properties
type NameOnly = Pick<User, "name">;
// { name: string; }

// Omit<T, K> - Remove specific properties
type NoAge = Omit<User, "age">;
// { name: string; }

// Record<K, V> - Object with keys K and values V
type Scores = Record<string, number>;
// { [key: string]: number }
```

**Where used:** Less common in this codebase, but understanding helps when reading type definitions.

---

### 3.16 Non-null Assertion Operator (!)

Tells TypeScript you're certain a value isn't null/undefined (use carefully!).

```typescript
const element = document.getElementById("app");
// Type: HTMLElement | null

element.innerHTML = "Hello";  // ERROR: Object is possibly 'null'

element!.innerHTML = "Hello";  // OK - you're telling TS "trust me, it exists"
// But if it IS null, this will crash at runtime!

// Better: explicit check
if (element) {
  element.innerHTML = "Hello";  // OK - TypeScript knows it's not null
}
```

**Where used:** Sparingly. Prefer explicit null checks.

---

### 3.17 Nullish Coalescing (??) and Optional Chaining (?.)

Modern JavaScript/TypeScript features for handling null/undefined.

```typescript
// Nullish coalescing - use default if null or undefined
const value = maybeNull ?? "default";
// Different from ||: only triggers on null/undefined, not 0 or ""

// Optional chaining - safely access nested properties
const name = user?.profile?.name;
// Returns undefined if any part is null/undefined, no crash

// Combined
const username = user?.name ?? "Anonymous";
```

**Where used:** Throughout. See `src/services/soundcloud.ts` for API response handling.

---

### 3.18 Rest Parameters and Spread Operator

```typescript
// Rest parameters - collect remaining arguments into an array
function sum(...numbers: number[]): number {
  return numbers.reduce((a, b) => a + b, 0);
}
sum(1, 2, 3, 4);  // 10

// Spread operator - expand array/object
const arr1 = [1, 2];
const arr2 = [...arr1, 3, 4];  // [1, 2, 3, 4]

const obj1 = { a: 1 };
const obj2 = { ...obj1, b: 2 };  // { a: 1, b: 2 }
```

**Where used:** Object spread for state updates, array spread for combining arrays.

---

### 3.19 Destructuring with Types

```typescript
// Object destructuring with type annotation
const { name, age }: { name: string; age: number } = person;

// Array destructuring
const [first, second]: [string, number] = ["hello", 42];

// With default values
const { name = "Unknown" }: { name?: string } = config;

// In function parameters
function greet({ name, age }: { name: string; age: number }) {
  console.log(`${name} is ${age}`);
}
```

**Where used:** Extensively in component props:
```typescript
function UrlInput({ onSubmit }: { onSubmit: (url: string) => void }) {
```

---

### 3.20 Module System (import/export)

```typescript
// Named exports
export const PI = 3.14;
export function calculate() { }
export interface Config { }

// Default export (one per file)
export default function main() { }

// Named imports
import { PI, calculate } from "./math.js";

// Default import
import main from "./main.js";

// Rename on import
import { calculate as calc } from "./math.js";

// Import all as namespace
import * as math from "./math.js";
math.PI;
math.calculate();

// Type-only imports (removed at runtime)
import type { Config } from "./config.js";
```

**Where used:** Every file. See file headers for import patterns.

---

## 4. File-by-File Breakdown

### Entry Points

#### `src/index.tsx` - CLI Entry Point
**Lines:** ~50
**Purpose:** Parse command-line arguments and start the app.

```
┌─────────────────────────────────────────────────┐
│                   index.tsx                      │
├─────────────────────────────────────────────────┤
│ 1. Import Commander (CLI parser)                 │
│ 2. Define CLI options:                           │
│    • [url] - optional positional argument        │
│    • -o, --output <dir> - output directory       │
│    • -q, --quality <rate> - bitrate              │
│    • --no-tui - disable interactive mode         │
│ 3. Parse arguments                               │
│ 4. Decision:                                     │
│    if (no TTY or --no-tui) && url → CLI mode    │
│    if (no TTY or --no-tui) && !url → Error      │
│    else → TUI mode (Ink)                         │
└─────────────────────────────────────────────────┘
```

**Key concept:** `process.stdin.isTTY` checks if running interactively (terminal) vs piped (script).

---

#### `src/app.tsx` - Main TUI Application
**Lines:** ~100
**Purpose:** React component managing the entire UI state machine.

```
State Machine:

   ┌─────────┐
   │  idle   │ ─── User enters URL ──→ ┌───────────┐
   └─────────┘                          │ resolving │
        ▲                               └───────────┘
        │                                     │
        │                         API resolves track/playlist
        │                                     │
        │  ┌─────────┐                       ▼
        └──│  error  │ ◄── Error ──── ┌─────────────┐
           └─────────┘                 │ downloading │
                                       └─────────────┘
                                             │
                                       All tracks done
                                             │
                                             ▼
                                       ┌──────────┐
                                       │ complete │ → Auto-exit (2s)
                                       └──────────┘
```

**What renders in each state:**
- `idle` → `<UrlInput>` component
- `resolving` → "Fetching track info..." spinner
- `downloading` → `<DownloadList>` with progress
- `complete` → Summary + "Closing in 2 seconds"
- `error` → Error message + `<UrlInput>` for retry

---

#### `src/cli.ts` - Non-Interactive CLI Mode
**Lines:** ~80
**Purpose:** Simple console-based download for scripts and CI.

No React/Ink - just `console.log` for output. Used when:
- Running in a script (piped input)
- `--no-tui` flag is set

---

### Hooks

#### `src/hooks/use-downloader.ts` - Download State Management
**Lines:** ~120
**Purpose:** Custom React hook encapsulating all download logic.

```typescript
// What the hook provides:
const {
  tracks,        // Track[] - resolved tracks
  progress,      // Map<number, DownloadProgress> - per-track progress
  error,         // string | null - error message
  state,         // "idle" | "resolving" | ... - current state
  outputDir,     // string - where files are saved
  startDownload  // (url: string) => Promise<void> - trigger download
} = useDownloader(config);
```

**Internal flow:**
1. `startDownload(url)` called
2. Set state to "resolving"
3. Call `soundcloud.resolveUrl(url)`
4. If playlist, create subfolder with playlist name
5. Initialize progress map for all tracks
6. Set state to "downloading"
7. Call `runConcurrent()` with 4 parallel downloads
8. Update progress on each callback
9. Set state to "complete" or "error"

---

### Services

#### `src/services/soundcloud.ts` - SoundCloud API Client
**Lines:** ~200
**Purpose:** All SoundCloud API interactions.

**Public Methods:**

| Method | Input | Output | Purpose |
|--------|-------|--------|---------|
| `resolveUrl(url)` | SoundCloud URL | `Track \| Playlist` | Main entry point - resolves any URL |
| `getStreamUrl(track)` | Track object | `string` | Gets downloadable audio URL |

**Private Methods:**

| Method | Purpose |
|--------|---------|
| `getClientId()` | Scrape client_id from SoundCloud's JS bundles |
| `expandUrl(url)` | Follow redirects for on.soundcloud.com URLs |
| `cleanUrl(url)` | Remove UTM tracking parameters |
| `parseTrack(data)` | Validate and transform API track data |
| `parsePlaylist(data)` | Handle playlists with incomplete track data |
| `fetchTracksByIds(ids)` | Batch-fetch track details (50 per request) |
| `fetchUserTracks(user)` | Get user's most recent 50 tracks |

**Client ID Scraping Algorithm:**
```
1. Fetch https://soundcloud.com (HTML)
2. Find <script src="https://a-v2.sndcdn.com/assets/..."> tags
3. Download last 5 JavaScript bundles
4. Search each for regex: client_id=([a-zA-Z0-9]+)
5. Return first match
6. Cache result for session
```

---

#### `src/services/downloader.ts` - Download & Conversion
**Lines:** ~100
**Purpose:** Download audio streams and convert to MP3.

**Main Function:**
```typescript
async function downloadTrack(
  track: Track,
  config: AppConfig,
  callbacks?: DownloadCallbacks
): Promise<string>  // Returns output file path
```

**Pipeline:**
```
1. Create output directory (mkdir -p)
         │
2. Get stream URL from SoundCloud
         │
3. Sanitize filename (remove illegal chars)
         │
4. Download to .tmp file with progress reporting
         │
5. Convert with FFmpeg:
   • Input: .tmp file
   • Codec: libmp3lame (for MP3)
   • Bitrate: 128/192/256/320 kbps
   • Output: Artist - Title.mp3
         │
6. Delete .tmp file
         │
7. Return output path
```

**Filename Sanitization:**
- Removes: `< > : " / \ | ? *`
- Collapses multiple spaces
- Limits to 200 characters
- Format: `{Artist} - {Title}.mp3`

---

### Components

#### `src/components/url-input.tsx` - URL Entry Component
**Lines:** ~40
**Purpose:** Text input for SoundCloud URLs.

```
┌────────────────────────────────────────────────┐
│ Enter SoundCloud URL: [                      ] │
│                                                │
│ (shows error if URL doesn't contain soundcloud)│
└────────────────────────────────────────────────┘
```

**Props:**
```typescript
interface Props {
  onSubmit: (url: string) => void;  // Called when Enter pressed
  disabled?: boolean;               // Disable input
}
```

---

#### `src/components/download-list.tsx` - Progress Display
**Lines:** ~60
**Purpose:** Show download progress for all tracks.

```
┌────────────────────────────────────────────────┐
│ ✓ Artist A - Song One                          │
│ ↓ Artist B - Song Two (45%)                    │
│ ⟳ Artist C - Song Three                        │
│ ○ Artist D - Song Four                         │
│ ✗ Artist E - Song Five                         │
│   └─ Error: Network timeout                    │
└────────────────────────────────────────────────┘
```

**Status Icons:**
| Icon | Color | Status |
|------|-------|--------|
| ○ | gray | pending |
| ↓ | blue | downloading |
| ⟳ | yellow | converting |
| ✓ | green | complete |
| ✗ | red | error |

---

### Utilities

#### `src/utils/concurrent.ts` - Parallel Execution
**Lines:** ~30
**Purpose:** Run async tasks with limited concurrency.

```typescript
async function runConcurrent<T, R>(
  items: T[],                              // Items to process
  fn: (item: T, index: number) => Promise<R>,  // Async processor
  concurrency: number                      // Max parallel tasks
): Promise<R[]>                            // Results in order
```

**How it works:**
```
Items: [A, B, C, D, E, F]
Concurrency: 2

Time →
Worker 1: |--A--|--C--|--E--|
Worker 2: |--B--|--D--|--F--|

Instead of:
Sequential: |--A--|--B--|--C--|--D--|--E--|--F--|
```

**Algorithm:**
1. Create N worker promises (N = concurrency)
2. Shared index counter (atomic via closure)
3. Each worker loops: grab next item, process, repeat
4. All workers finish when no items left

---

### Types

#### `src/types/index.ts` - Zod Schemas & Types
**Lines:** ~50
**Purpose:** Define all data structures with runtime validation.

**Schemas:**

```typescript
// Track - A single audio track
TrackSchema = {
  id: number,
  title: string,
  artist: string,
  duration: number,         // Milliseconds
  artworkUrl: string | null,
  streamUrl: string | null,  // URL to fetch actual audio
  permalink: string          // SoundCloud URL
}

// Playlist - Collection of tracks
PlaylistSchema = {
  id: number,
  title: string,
  tracks: Track[]
}

// DownloadProgress - Status of a single download
DownloadProgressSchema = {
  trackId: number,
  percent: number,           // 0-100
  status: "pending" | "downloading" | "converting" | "complete" | "error",
  error?: string
}

// AppConfig - Application settings
AppConfigSchema = {
  outputDir: string,
  format: "mp3" | "wav" | "flac",
  quality: "128" | "192" | "256" | "320"
}
```

---

## 5. React & Ink (Terminal UI)

### What is Ink?

Ink is **React for the terminal**. Instead of rendering to a browser DOM, it renders to the terminal using ANSI escape codes.

```
Regular React:              Ink:
┌─────────────┐            ┌─────────────┐
│   Browser   │            │  Terminal   │
│   Window    │            │   Window    │
├─────────────┤            ├─────────────┤
│  <div>      │            │  <Box>      │
│  <span>     │            │  <Text>     │
│  <input>    │            │  <TextInput>│
└─────────────┘            └─────────────┘
```

### Ink Components Used

| Ink Component | HTML Equivalent | Purpose |
|---------------|-----------------|---------|
| `<Box>` | `<div>` | Container for layout |
| `<Text>` | `<span>` | Text content |
| `<Spinner>` | (none) | Loading animation |
| `<TextInput>` | `<input>` | Text input field |

### React Hooks Used

#### `useState` - State Management
```typescript
const [count, setCount] = useState(0);
//     ▲       ▲                   ▲
//   value   setter           initial value

setCount(5);           // Set to 5
setCount(c => c + 1);  // Increment based on previous
```

#### `useCallback` - Memoized Functions
```typescript
// Without useCallback: new function created every render
const handleClick = () => doSomething(dep);

// With useCallback: same function unless deps change
const handleClick = useCallback(() => {
  doSomething(dep);
}, [dep]);  // Only recreate if 'dep' changes
```

#### `useRef` - Mutable Reference
```typescript
const countRef = useRef(0);
//                      ▲
//              initial value

countRef.current = 5;  // Mutate directly
// Doesn't trigger re-render!
```

#### `useEffect` - Side Effects
```typescript
useEffect(() => {
  // Runs after render

  return () => {
    // Cleanup (runs before next effect or unmount)
  };
}, [deps]);  // Only run when deps change
```

---

## 6. State Machine & Application Flow

### States

```typescript
type AppState =
  | "idle"        // Waiting for user input
  | "resolving"   // Fetching from SoundCloud API
  | "downloading" // Downloading/converting tracks
  | "complete"    // All done
  | "error";      // Something went wrong
```

### Transitions

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  START                                                      │
│    │                                                        │
│    ▼                                                        │
│ ┌──────┐                                                    │
│ │ idle │◄─────────────────────────────────────────────┐     │
│ └──┬───┘                                              │     │
│    │ onSubmit(url)                                    │     │
│    ▼                                                  │     │
│ ┌───────────┐                                         │     │
│ │ resolving │                                         │     │
│ └─────┬─────┘                                         │     │
│       │                                               │     │
│       ├─── Success ──► ┌─────────────┐                │     │
│       │                │ downloading │                │     │
│       │                └──────┬──────┘                │     │
│       │                       │                       │     │
│       │                       ├─── All done ──► ┌──────────┐│
│       │                       │                 │ complete ││
│       │                       │                 └────┬─────┘│
│       │                       │                      │      │
│       │                       │                  (2s timer) │
│       │                       │                      │      │
│       │                       │                      ▼      │
│       │                       │                    EXIT     │
│       │                       │                             │
│       └─── Error ────►┌───────┴───────┐                     │
│                       │     error     │                     │
│                       └───────┬───────┘                     │
│                               │                             │
│                               │ (retry)                     │
│                               └─────────────────────────────┘
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. SoundCloud API Reverse Engineering

### Why Reverse Engineering?

SoundCloud doesn't provide a public API. This app reverse-engineers their internal API:
- **Base URL:** `https://api-v2.soundcloud.com`
- **Authentication:** `client_id` query parameter

### Client ID Discovery

```
┌─────────────────────────────────────────────┐
│ 1. Fetch soundcloud.com homepage            │
│    └─► HTML with <script> tags              │
│                                             │
│ 2. Find script URLs:                        │
│    https://a-v2.sndcdn.com/assets/0-xxx.js  │
│    https://a-v2.sndcdn.com/assets/1-xxx.js  │
│    ...                                      │
│                                             │
│ 3. Download last 5 JS bundles               │
│                                             │
│ 4. Search for: client_id=xxxxxxxxxxxxx      │
│                                             │
│ 5. Cache the client_id for the session      │
└─────────────────────────────────────────────┘
```

### API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `/resolve?url=X` | Convert SoundCloud URL to track/playlist data |
| `/tracks?ids=X` | Fetch track details by IDs (batch) |
| `/users/X/tracks` | Get user's tracks |
| `/tracks/X/streams` | Get audio stream URL |

### URL Types Supported

| URL Pattern | Type |
|-------------|------|
| `soundcloud.com/artist/track-name` | Single track |
| `soundcloud.com/artist/sets/playlist-name` | Playlist |
| `soundcloud.com/artist` | User profile (downloads recent tracks) |
| `on.soundcloud.com/xxxxx` | Shortened URL (redirects) |

---

## 8. Download Pipeline

### Complete Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ INPUT: Track { id, title, artist, streamUrl }                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. GET STREAM URL                                               │
│    Track.streamUrl → API call → Actual audio URL                │
│    (streamUrl is a pointer, not the actual audio)               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. SANITIZE FILENAME                                            │
│    "Artist / Name: Version?" → "Artist  Name Version"           │
│    Removes: < > : " / \ | ? *                                   │
│    Limits to 200 characters                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. DOWNLOAD STREAM                                              │
│    GET audio URL                                                │
│    └─► Stream to temp file: "Artist - Title.tmp"                │
│    └─► Report progress: onProgress(45%)                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. CONVERT WITH FFMPEG                                          │
│    Input: .tmp file                                             │
│    Output: .mp3 file                                            │
│    Settings:                                                    │
│      - Codec: libmp3lame                                        │
│      - Bitrate: 320k (or user-specified)                        │
│      - Format: mp3                                              │
│                                                                 │
│    └─► Report: onConverting()                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. CLEANUP                                                      │
│    Delete .tmp file                                             │
│    Report: onComplete("/path/to/Artist - Title.mp3")            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ OUTPUT: ~/Documents/songs/Artist - Title.mp3                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Concurrency Model

### Why Limited Concurrency?

Downloading 100 tracks simultaneously would:
- Overwhelm network bandwidth
- Get rate-limited by SoundCloud
- Consume too much memory

**Solution:** Process N items at a time (default: 4)

### Worker Pool Pattern

```
Items to process: [T1, T2, T3, T4, T5, T6, T7, T8]
Concurrency: 3

Time ─────────────────────────────────────────────►

Worker 1: |████ T1 ████|████ T4 ████|████ T7 ████|
Worker 2: |████ T2 ████|████ T5 ████|████ T8 ████|
Worker 3: |████ T3 ████|████ T6 ████|

Results:  [R1, R2, R3, R4, R5, R6, R7, R8]
          (maintained in original order)
```

### Implementation

```typescript
async function runConcurrent<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;  // Atomic grab
      const item = items[currentIndex]!;
      results[currentIndex] = await fn(item, currentIndex);
    }
  }

  // Start N workers in parallel
  await Promise.all(
    Array.from({ length: concurrency }, () => worker())
  );

  return results;
}
```

---

## 10. Error Handling Patterns

### Per-Track Error Isolation

Errors in one track don't stop others:

```typescript
for (const track of tracks) {
  try {
    await downloadTrack(track);
    markComplete(track.id);
  } catch (error) {
    markError(track.id, error.message);
    // Continue with next track!
  }
}
```

### Error Type Narrowing

```typescript
try {
  await riskyOperation();
} catch (error: unknown) {
  // 'error' is 'unknown' - could be anything

  // Narrow to Error type
  const err = error instanceof Error
    ? error
    : new Error(String(error));

  // Now we can safely access .message
  console.error(err.message);
}
```

### Callback-Based Error Reporting

```typescript
interface DownloadCallbacks {
  onError?: (error: Error) => void;
}

async function download(callbacks?: DownloadCallbacks) {
  try {
    // ... download logic
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    callbacks?.onError?.(err);  // Report to caller
    throw err;                  // Re-throw for caller to handle
  }
}
```

---

## 11. Configuration & Build System

### TypeScript Configuration (`tsconfig.json`)

```json
{
  "compilerOptions": {
    // Strictness (catch more bugs at compile time)
    "strict": true,              // Enable all strict checks
    "noUnusedLocals": true,      // Error on unused variables
    "noUnusedParameters": true,  // Error on unused parameters
    "noImplicitReturns": true,   // Ensure all paths return
    "noUncheckedIndexedAccess": true,  // Array access may be undefined

    // Module system
    "module": "NodeNext",        // ESM modules with Node.js resolution
    "moduleResolution": "NodeNext",

    // Output
    "target": "ES2022",          // Modern JavaScript features
    "outDir": "./dist",          // Compiled files go here

    // React
    "jsx": "react-jsx"           // React 18 automatic JSX transform
  }
}
```

### Package.json Scripts

```bash
npm run dev        # tsx watch src/index.tsx
                   # Hot reload during development

npm run build      # tsc
                   # Compile TypeScript to JavaScript

npm run start      # node dist/index.js
                   # Run compiled version

npm run check      # npm run typecheck && npm run lint && npm test
                   # Full validation (run before commits)

npm run test       # vitest run
                   # Run tests once

npm run test:watch # vitest
                   # Run tests in watch mode

npm run lint       # eslint .
                   # Check for code issues

npm run lint:fix   # eslint . --fix
                   # Auto-fix linting issues

npm run format     # prettier --write .
                   # Format all code
```

---

## 12. Testing Strategy

### Test Framework

**Vitest** - Fast, Vite-based test runner compatible with Jest API.

### Test File Location

Tests live in `tests/` directory:
```
tests/
└── soundcloud.test.ts
```

### Test Patterns

```typescript
import { describe, it, expect } from "vitest";
import { TrackSchema } from "../src/types/index.js";

describe("TrackSchema", () => {
  it("validates a complete track", () => {
    const result = TrackSchema.safeParse({
      id: 1,
      title: "Test",
      artist: "Artist",
      duration: 180000,
      artworkUrl: "https://example.com/art.jpg",
      streamUrl: "https://example.com/stream",
      permalink: "https://soundcloud.com/test"
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid data", () => {
    const result = TrackSchema.safeParse({
      id: "not-a-number"  // Should be number
    });

    expect(result.success).toBe(false);
  });
});
```

### Running Tests

```bash
# Run all tests once
npm test

# Run specific file
npm test -- tests/soundcloud.test.ts

# Run tests matching pattern
npm test -- -t "validates"

# Watch mode (re-run on changes)
npm run test:watch
```

---

## 13. Glossary

### General Terms

| Term | Definition |
|------|------------|
| **TUI** | Terminal User Interface - a graphical interface rendered in the terminal |
| **CLI** | Command Line Interface - text-based interaction |
| **API** | Application Programming Interface - how programs communicate |
| **ESM** | ECMAScript Modules - modern JavaScript module system (`import`/`export`) |
| **TTY** | Teletype - refers to an interactive terminal session |

### TypeScript Terms

| Term | Definition |
|------|------------|
| **Type annotation** | Explicitly declaring a variable's type: `let x: number` |
| **Type inference** | TypeScript automatically determining a type: `let x = 5` (inferred as number) |
| **Generic** | Type parameter allowing code to work with multiple types: `Array<T>` |
| **Union type** | Type that can be one of several types: `string \| number` |
| **Interface** | Contract defining object structure |
| **Type alias** | Custom name for a type: `type ID = number` |
| **Type guard** | Code that narrows a type: `if (typeof x === "string")` |
| **Narrowing** | Process of refining a type to something more specific |

### React Terms

| Term | Definition |
|------|------------|
| **Component** | Reusable UI building block (function returning JSX) |
| **Props** | Properties passed to a component |
| **State** | Data that changes over time and triggers re-renders |
| **Hook** | Function for adding features to components (`useState`, `useEffect`) |
| **Effect** | Side effect like API calls, timers (handled by `useEffect`) |
| **Render** | Converting component to visual output |

### Project-Specific Terms

| Term | Definition |
|------|------------|
| **Track** | A single SoundCloud audio file |
| **Playlist** | Collection of tracks |
| **Resolve** | Convert a URL to track/playlist metadata |
| **Stream URL** | Direct link to audio data |
| **Client ID** | SoundCloud's API authentication token |
| **Transcoding** | Audio format conversion |

---

## Quick Reference Card

### File Purposes
```
index.tsx      → Entry point, CLI parsing
app.tsx        → Main UI state machine
cli.ts         → Non-interactive mode
use-downloader → Download state management
soundcloud.ts  → API client
downloader.ts  → Download + FFmpeg conversion
concurrent.ts  → Parallel execution utility
types/index.ts → Zod schemas + TypeScript types
url-input.tsx  → URL input component
download-list  → Progress display component
```

### Key Commands
```bash
npm run dev    # Development with hot reload
npm run check  # Validate before commit
npm test       # Run tests
```

### Application Flow
```
URL → Resolve → Download (parallel) → Convert → Save
```

### State Progression
```
idle → resolving → downloading → complete
            └─────────────────→ error
```

---

*Generated for the SoundCloud Downloader project. Keep this file open as a reference while working on the codebase.*
