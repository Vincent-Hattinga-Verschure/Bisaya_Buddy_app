# Project Architecture

## Shared Core

The main product is a static learning app built from:

- `index.html`
- `styles.css`
- `app.js`
- `lesson-data.js`

This layer contains:

- the lesson UI
- progression logic
- quizzes and typing exercises
- audio playback
- iOS-specific in-app course flow

## Bundled Export

`build_single_file.js` creates `Bisaya Buddy Single File.html`.

That build step:

1. reads the HTML template
2. inlines CSS
3. loads lesson data
4. converts audio clips into base64 data URIs
5. injects the main app JavaScript

The result is a portable offline artifact that native wrappers can load without
depending on an external web server.

## Native macOS Wrapper

The macOS wrapper is a Swift Package located in `Sources/BisayaBuddyMacApp/`.

Key responsibilities:

- open the bundled HTML inside WebKit
- package the HTML and icon into a `.app`
- expose logging for runtime debugging

## Native iOS Wrapper

The iOS wrapper is defined by:

- `BisayaBuddyIOS.xcodeproj`
- `iOS/BisayaBuddyIOS/`

It uses SwiftUI plus `WKWebView` to host the bundled lesson experience. The app
is intentionally tailored for iPhone with:

- a welcome screen
- one active lesson at a time
- full-screen lesson presentation
- completion popups that unlock the next lesson

## Why This Structure Works

This hybrid setup makes it easy to:

- keep the lesson content in one place
- ship fast UI updates across platforms
- support offline usage
- retain a native installation experience on macOS and iPhone
