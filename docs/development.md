# Development Guide

## Overview

Bisaya Buddy is centered around one shared lesson experience:

- `lesson-data.js` contains the lesson catalog and all lesson entries
- `index.html`, `styles.css`, and `app.js` power the browser experience
- `build_single_file.js` converts the web app into one bundled HTML file
- the macOS and iOS wrappers load that same bundled content inside WebKit

This keeps the educational content and learning flow synchronized across
platforms.

## Local Development

### Browser Development

Use a local HTTP server:

```bash
python3 -m http.server 4173
```

Then open:

```text
http://localhost:4173
```

This is the easiest way to iterate on HTML, CSS, and JavaScript changes.

### Single-File Rebuild

Whenever you change `index.html`, `styles.css`, `app.js`, `lesson-data.js`, or
audio files, rebuild the bundled export:

```bash
node build_single_file.js
```

That output is used by the native app wrappers.

## Native Targets

### macOS

The macOS app lives in `Sources/BisayaBuddyMacApp/`.

Build and launch it with:

```bash
./script/build_and_run.sh
```

What this script does:

1. rebuilds the bundled HTML file
2. runs `swift build`
3. creates `dist/Bisaya Buddy.app`
4. launches the app

### iOS

The iOS project lives in `BisayaBuddyIOS.xcodeproj` and `iOS/BisayaBuddyIOS/`.

Build from Terminal:

```bash
./script/build_ios_sim.sh
```

Build for Simulator:

```bash
./script/build_ios_sim.sh sim
```

For regular development, Xcode is the preferred workflow because signing and
device deployment are managed there.

## Important Files

- `index.html`: app shell markup and iOS-specific UI containers
- `styles.css`: shared layout, theming, responsive rules, and iOS styling
- `app.js`: lesson rendering, progress state, quizzes, unlock flow, and native
  shell integration
- `lesson-data.js`: source data for lessons and phrases
- `build_single_file.js`: bundle pipeline that inlines lessons, styles, scripts,
  icon, and audio
- `Sources/BisayaBuddyMacApp/BisayaBuddyWebView.swift`: WebKit host for the
  macOS and iOS wrappers

## Recommended Workflow

1. edit lesson content or UI
2. test in the browser
3. rebuild the single-file export
4. test the macOS or iOS wrapper if the change affects native presentation

## Repository Hygiene

Generated build folders are ignored through `.gitignore`, including:

- `.build/`
- `dist/`
- `.swiftpm/`
- Xcode user state files

Private local Codex workspace files are also excluded.
