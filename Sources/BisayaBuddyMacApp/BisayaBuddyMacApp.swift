import AppKit
import SwiftUI

final class AppDelegate: NSObject, NSApplicationDelegate {
  func applicationDidFinishLaunching(_ notification: Notification) {
    NSApp.setActivationPolicy(.regular)
    NSApp.activate(ignoringOtherApps: true)
    Logger.lifecycle.notice("Bisaya Buddy macOS app launched")
  }
}

@main
struct BisayaBuddyMacApp: App {
  @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

  var body: some Scene {
    WindowGroup {
      ContentView()
    }
    .defaultSize(width: 1360, height: 920)
    .windowResizability(.contentSize)
  }
}
