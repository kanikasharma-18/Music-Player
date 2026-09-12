# 🎵 Terminal Music Player

> A lightweight terminal-based music player built with Node.js — play your MP3 collection straight from the command line.

---

## Overview

Terminal Music Player is a Node.js application that runs entirely in your terminal. It scans a local `songs/` directory for MP3 files, displays them as a navigable playlist, and plays audio through your system's speakers. You control everything with keyboard keys — no GUI required.

---

## Features

- 📂 **Song discovery** — automatically scans the `songs/` directory and lists all `.mp3` files
- 🎧 **MP3 decoding & playback** — decodes MP3 audio and streams it to your system speakers
- ▶️ **Play / Pause / Resume / Stop** — full playback state management
- ⏭️ **Auto-advance** — automatically plays the next song when the current one finishes
- 🎹 **Keyboard controls** — navigate and control playback without leaving the terminal
- 📊 **Progress bar** — live progress display with elapsed and total time (`MM:SS` format)
- 🖥️ **Terminal UI** — box-drawn interface with a library panel, now-playing panel, and controls panel
- ⚠️ **Error handling** — gracefully handles missing directories, empty libraries, unreadable files, and audio errors
- 🚪 **Graceful exit** — cleans up audio resources and restores the terminal on quit

---

## Tech Stack

| Technology | Purpose |
|---|---|
| [Node.js](https://nodejs.org) | Runtime environment |
| JavaScript (ESM) | Application logic (`type: "module"`) |
| [`@audio/decode-mp3`](https://www.npmjs.com/package/@audio/decode-mp3) | Decodes MP3 files to raw PCM audio |
| [`speaker`](https://www.npmjs.com/package/speaker) | Streams PCM audio to the system sound output |
| Node.js `fs`, `path`, `readline` | File I/O, path resolution, raw keypress input |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm (bundled with Node.js)
- A system audio output (speakers or headphones)

### Clone the repository

```bash
git clone https://github.com/kanikasharma-18/Music-Player.git
cd Music-Player
```

### Install dependencies

```bash
npm install
```

> **Note:** The `speaker` package compiles a native add-on. You may need build tools installed:
> - **macOS:** Xcode Command Line Tools (`xcode-select --install`)
> - **Linux:** `build-essential` and `libasound2-dev`
> - **Windows:** Windows Build Tools

### Add music

Place your `.mp3` files in the `songs/` directory at the root of the project:

```
Music-Player/
└── songs/
    ├── your-song.mp3
    └── another-track.mp3
```

The player only reads `.mp3` files. Other file types (e.g., `.jpeg`, `.wav`) are ignored automatically.

### Run the application

```bash
node src/index.js
```

---

## Controls

| Key | Action |
|---|---|
| `↑` / `↓` | Navigate through the song list |
| `Enter` | Play the selected song |
| `Space` | Pause / Resume playback |
| `Q` | Quit the player |
| `Ctrl+C` | Exit the player |

> **Note:** Space only acts when a song is currently playing or paused. Navigation with arrow keys does not interrupt active playback.

---

## Project Structure

```text
Music-Player/
├── src/
│   ├── index.js      # Entry point — starts the UI, handles keyboard input
│   ├── player.js     # Audio engine — MP3 decoding, playback state, speaker I/O
│   └── ui.js         # Terminal renderer — box-drawn panels, progress bar, formatting
├── songs/            # Place your .mp3 files here
├── package.json
├── package-lock.json
├── .gitignore
└── README.md
```

### Key files

- **`src/index.js`** — initialises the app, loads the song list, sets up raw keypress listeners, and wires the player to the UI.
- **`src/player.js`** — manages all audio state (`STOPPED`, `PLAYING`, `PAUSED`), decodes MP3 to PCM via `@audio/decode-mp3`, and streams chunks to the `speaker` at a controlled rate. Exposes `playSong`, `pauseSong`, `resumeSong`, `stopCurrentSong`, and `getPlaybackInfo`.
- **`src/ui.js`** — renders the header, library panel (with track count and selection marker), now-playing panel (song name, status, progress bar, timestamps), and controls panel using Unicode box-drawing characters.

---

## How It Works

1. **Startup** — the app loads all `.mp3` files from the `songs/` directory.
2. **Display** — the terminal UI renders the library and a now-playing panel.
3. **Navigation** — `↑`/`↓` moves the selection cursor through the list.
4. **Playback** — pressing `Enter` decodes the selected MP3 and begins streaming audio to the speakers. The UI refreshes every 250 ms to update the progress bar.
5. **Pause / Resume** — `Space` freezes or restarts the audio stream, preserving the exact playback position.
6. **Auto-advance** — when a song ends naturally, the player automatically starts the next one.
7. **Exit** — `Q` or `Ctrl+C` stops playback, closes the audio stream, disables raw mode, and exits cleanly.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| `songs/` directory not found | Displays a warning message and exits gracefully |
| `songs/` directory is empty | Displays "No MP3 files found" and exits gracefully |
| File is not a valid MP3 | Displays an error in the UI and stops playback |
| Audio loading / decoding error | Catches the exception and shows the error message in the terminal |
| Speaker / audio output error | Handled via the `error` event on the `Speaker` stream |
| Keyboard input unavailable (non-TTY) | Detected at startup; player exits without crashing |

---

## Screenshots / Demo

> Screenshots and a demo GIF will be added after the final UI walkthrough.

---

## Future Improvements

These are ideas for future development and are **not** part of the current release:

- Volume control
- Shuffle and repeat modes
- Search / filter within the library
- Support for additional audio formats
- Configurable songs directory via CLI argument or config file

---

## License

This project is licensed under the **ISC License**, as specified in [`package.json`](./package.json).