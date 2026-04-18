# Bisaya Buddy

Bisaya Buddy is an offline-first Bisaya learning app with a web version, a
native macOS wrapper, and a native iOS app shell. The project is designed to
keep the lesson content in one place while shipping it across browser, desktop,
and iPhone experiences.

## What It Includes

- 20 guided lesson blocks with vocabulary, phrases, and translations
- Pronunciation helpers with bundled audio clips
- Mini quizzes and typing practice
- A single-file export for offline sharing
- A native macOS app built with SwiftUI and WebKit
- A native iOS app flow with a welcome screen and lesson progression

## Project Structure

```text
.
├── index.html                    # Main web app markup
├── styles.css                    # Shared styling, including iOS-specific UI
├── app.js                        # Lesson flow, progress, quiz, and iOS shell logic
├── lesson-data.js                # Lesson catalog and entries
├── assets/                       # Icons and static assets
├── audio/                        # Generated pronunciation clips
├── build_single_file.js          # Bundles the web app into one self-contained HTML file
├── script/
│   ├── build_and_run.sh          # Builds and launches the macOS app
│   └── build_ios_sim.sh          # Builds the iOS project from Terminal
├── Sources/BisayaBuddyMacApp/    # Native macOS SwiftUI/WebKit wrapper
├── iOS/BisayaBuddyIOS/           # Native iOS app resources and entrypoint
└── BisayaBuddyIOS.xcodeproj/     # Xcode project for the iOS app
```

## Requirements

- `Node.js` for rebuilding the single-file HTML bundle
- `Python 3` if you want a quick local web server
- `Swift 6` / Xcode toolchain for the macOS app
- `Xcode 26.4` or newer for the iOS app
- `macOS 14` or newer for the native macOS wrapper
- `iOS 26` or newer for the current iPhone target

## Quick Start

### Web App

For a quick local preview, serve the project folder over HTTP:

```bash
python3 -m http.server 4173
```

Then open [http://localhost:4173](http://localhost:4173).

You can also double-click `index.html` for a basic offline preview, but install
prompts and service worker behavior work best on `localhost` or `https`.

### Single-File Offline Export

To build a self-contained HTML file with all lesson data, scripts, styles, and
audio embedded:

```bash
node build_single_file.js
```

This generates:

```text
Bisaya Buddy Single File.html
```

### Native macOS App

Build and run the macOS wrapper:

```bash
./script/build_and_run.sh
```

The generated app bundle is placed in:

```text
dist/Bisaya Buddy.app
```

### Native iOS App

Open `BisayaBuddyIOS.xcodeproj` in Xcode, choose the `BisayaBuddyIOS` scheme,
select your iPhone or a simulator, and run the app.

You can also build from Terminal:

```bash
./script/build_ios_sim.sh
```

For a simulator-targeted build:

```bash
./script/build_ios_sim.sh sim
```

If `node` is not available during the iOS build, the project falls back to the
already-generated `Bisaya Buddy Single File.html` in the repository root.

## Documentation

- [Development Guide](docs/development.md)
- [iPhone Installation Guide](docs/ios-installation.md)
- [Project Architecture](docs/project-architecture.md)

## Asset Generation

Rebuild pronunciation audio:

```bash
./generate_audio.sh
```

Regenerate app icons:

```bash
swift generate_icons.swift
```

## Notes

- The bundled audio clips are generated pronunciation helpers.
- The browser version, macOS app, and iOS app all use the same lesson content.
- The iOS experience intentionally presents one lesson at a time with a more
  app-like progression flow.
