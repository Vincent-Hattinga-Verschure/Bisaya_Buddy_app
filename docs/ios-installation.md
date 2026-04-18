# iPhone Installation Guide

## What You Need

- a Mac
- `Xcode 26.4` or newer
- an iPhone running `iOS 26` or newer
- your Apple ID signed into Xcode
- a USB cable for first-time installation

## Open the Project

Open:

```text
BisayaBuddyIOS.xcodeproj
```

Then choose the `BisayaBuddyIOS` scheme.

## Install on Your iPhone

1. Connect your iPhone to your Mac.
2. Unlock the iPhone and tap `Trust This Computer` if prompted.
3. In Xcode, go to `Xcode > Settings > Accounts` and sign in with your Apple ID.
4. Select the `BisayaBuddyIOS` target.
5. Open `Signing & Capabilities`.
6. Turn on `Automatically manage signing`.
7. Choose your personal team under `Team`.
8. Select your iPhone as the run destination.
9. Press `Run` or use `Cmd + R`.

## If Developer Mode Is Required

On the iPhone:

1. open `Settings`
2. go to `Privacy & Security`
3. enable `Developer Mode`
4. restart the iPhone when asked

After the restart, run the app from Xcode again.

## Useful Build Commands

Generic device build:

```bash
./script/build_ios_sim.sh
```

Simulator build:

```bash
./script/build_ios_sim.sh sim
```

## Troubleshooting

### Signing Errors

- confirm `Automatically manage signing` is enabled
- confirm your Apple ID is selected as the team

### Device Not Available for Development

- keep the phone unlocked
- reconnect the cable
- wait for Xcode to finish preparing the device

### `node` Is Not Installed

The project can still build if `Bisaya Buddy Single File.html` already exists in
the repository root. `Node.js` is only needed when you want to regenerate that
bundled file.

### White Screen or Broken Layout

Try:

1. `Product > Clean Build Folder`
2. delete the app from the iPhone
3. install it again from Xcode

If you are changing the web UI, rebuild the bundled file before testing:

```bash
node build_single_file.js
```
