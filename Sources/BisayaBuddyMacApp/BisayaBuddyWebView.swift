import AVFoundation
import OSLog
import SwiftUI
import WebKit
#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

struct BisayaBuddyWebView {
  let fileURL: URL
  let htmlString: String?

  private static let nativePlatformName: String = {
    #if os(iOS)
      "ios"
    #else
      "macos"
    #endif
  }()

  private static let nativeBootstrapScript = """
    window.BISAYA_BUDDY_APP_SHELL = true;
    window.BISAYA_BUDDY_PLATFORM = "\(nativePlatformName)";
    window.BisayaBuddyNative = {
      log(level, message) {
        try {
          window.webkit.messageHandlers.bisayaLog.postMessage({ level, message });
        } catch (error) {}
      },
      playAudio(payload) {
        try {
          window.webkit.messageHandlers.bisayaAudio.postMessage(payload);
          return true;
        } catch (error) {
          return false;
        }
      }
    };

    window.addEventListener("error", (event) => {
      try {
        window.webkit.messageHandlers.bisayaLog.postMessage({
          level: "error",
          message: `JS error: ${event.message} @ ${event.filename || "inline"}:${event.lineno || 0}`
        });
      } catch (error) {}
    });

    window.addEventListener("unhandledrejection", (event) => {
      const reason = event.reason && event.reason.message ? event.reason.message : String(event.reason);
      try {
        window.webkit.messageHandlers.bisayaLog.postMessage({
          level: "error",
          message: `Unhandled promise rejection: ${reason}`
        });
      } catch (error) {}
    });
    """

  @MainActor
  func makeCoordinator() -> Coordinator {
    Coordinator()
  }

  final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
    private var audioPlayer: AVAudioPlayer?
    private let speechSynthesizer = AVSpeechSynthesizer()

    override init() {
      super.init()
      configureAudioSessionIfNeeded()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
      Logger.web.notice("Web view finished loading")
    }

    func webView(
      _ webView: WKWebView,
      didFail navigation: WKNavigation!,
      withError error: Error
    ) {
      Logger.web.error("Navigation failed: \(error.localizedDescription, privacy: .public)")
    }

    func webView(
      _ webView: WKWebView,
      didFailProvisionalNavigation navigation: WKNavigation!,
      withError error: Error
    ) {
      Logger.web.error("Provisional navigation failed: \(error.localizedDescription, privacy: .public)")
    }

    func userContentController(
      _ userContentController: WKUserContentController,
      didReceive message: WKScriptMessage
    ) {
      switch message.name {
      case "bisayaLog":
        handleLogMessage(message.body)
      case "bisayaAudio":
        handleAudioMessage(message.body)
      default:
        break
      }
    }

    private func handleLogMessage(_ body: Any) {
      guard
        let payload = body as? [String: Any],
        let level = payload["level"] as? String,
        let message = payload["message"] as? String
      else {
        Logger.web.warning("Received malformed JS log payload")
        return
      }

      switch level {
      case "error":
        Logger.web.error("\(message, privacy: .public)")
      case "warning":
        Logger.web.warning("\(message, privacy: .public)")
      case "debug":
        Logger.web.debug("\(message, privacy: .public)")
      default:
        Logger.web.notice("\(message, privacy: .public)")
      }
    }

    private func handleAudioMessage(_ body: Any) {
      guard let payload = body as? [String: Any] else {
        Logger.web.error("Received malformed native audio payload")
        return
      }

      let label = (payload["bisaya"] as? String) ?? (payload["id"] as? String) ?? "audio clip"

      if
        let audioValue = payload["audio"] as? String,
        let audioData = decodeAudioDataURI(audioValue)
      {
        do {
          audioPlayer = try AVAudioPlayer(data: audioData)
          audioPlayer?.prepareToPlay()

          if audioPlayer?.play() == true {
            Logger.web.notice("Played native audio for \(label, privacy: .public)")
            return
          }

          Logger.web.warning("Native audio player did not start for \(label, privacy: .public)")
        } catch {
          Logger.web.error(
            "Failed to create native audio player: \(error.localizedDescription, privacy: .public)"
          )
        }
      }

      if let tts = payload["tts"] as? String, !tts.isEmpty {
        let utterance = AVSpeechUtterance(string: tts)
        utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
        utterance.rate = 0.42
        speechSynthesizer.stopSpeaking(at: .immediate)
        speechSynthesizer.speak(utterance)
        Logger.web.notice("Used speech fallback for \(label, privacy: .public)")
        return
      }

      Logger.web.error("No usable audio payload found for \(label, privacy: .public)")
    }

    private func decodeAudioDataURI(_ rawValue: String) -> Data? {
      guard rawValue.hasPrefix("data:audio") else {
        return nil
      }

      let parts = rawValue.split(separator: ",", maxSplits: 1).map(String.init)
      guard parts.count == 2 else {
        return nil
      }

      return Data(base64Encoded: parts[1])
    }

    private func configureAudioSessionIfNeeded() {
      #if os(iOS)
      let session = AVAudioSession.sharedInstance()

      do {
        try session.setCategory(.playback, mode: .spokenAudio, options: [.mixWithOthers])
        try session.setActive(true)
      } catch {
        Logger.web.error(
          "Failed to configure iOS audio session: \(error.localizedDescription, privacy: .public)"
        )
      }
      #endif
    }
  }
}

#if os(iOS)
extension BisayaBuddyWebView: UIViewRepresentable {
  func makeUIView(context: Context) -> WKWebView {
    makeWebView(context: context)
  }

  func updateUIView(_ uiView: WKWebView, context: Context) {
    // The bundled lesson file is immutable for the lifetime of this view.
  }
}
#elseif os(macOS)
extension BisayaBuddyWebView: NSViewRepresentable {
  func makeNSView(context: Context) -> WKWebView {
    makeWebView(context: context)
  }

  func updateNSView(_ nsView: WKWebView, context: Context) {
    // The bundled lesson file is immutable for the lifetime of this view.
  }
}
#endif

private extension BisayaBuddyWebView {
  @MainActor
  func makeWebView(context: Context) -> WKWebView {
    let configuration = WKWebViewConfiguration()
    configuration.defaultWebpagePreferences.allowsContentJavaScript = true
    configuration.mediaTypesRequiringUserActionForPlayback = []
    configuration.allowsInlineMediaPlayback = true
    configuration.userContentController.add(context.coordinator, name: "bisayaLog")
    configuration.userContentController.add(context.coordinator, name: "bisayaAudio")
    configuration.userContentController.addUserScript(
      WKUserScript(
        source: Self.nativeBootstrapScript,
        injectionTime: .atDocumentStart,
        forMainFrameOnly: true
      )
    )

    let webView = WKWebView(frame: .zero, configuration: configuration)
    webView.navigationDelegate = context.coordinator
    webView.isOpaque = false
    #if os(iOS)
    webView.backgroundColor = .clear
    webView.scrollView.backgroundColor = .clear
    webView.scrollView.contentInsetAdjustmentBehavior = .never
    #else
    webView.setValue(false, forKey: "drawsBackground")
    #endif
    webView.isInspectable = true

    loadInitialContent(into: webView)
    return webView
  }

  @MainActor
  func loadInitialContent(into webView: WKWebView) {
    if let htmlString, !htmlString.isEmpty {
      Logger.web.notice(
        "Loading bundled HTML string from \(fileURL.lastPathComponent, privacy: .public)"
      )
      #if os(iOS)
      webView.loadHTMLString(htmlString, baseURL: nil)
      #else
      webView.loadHTMLString(
        htmlString,
        baseURL: fileURL.deletingLastPathComponent()
      )
      #endif
      return
    }

    let accessRoot = fileURL.deletingLastPathComponent()
    Logger.web.notice("Loading bundled HTML file at \(fileURL.path, privacy: .public)")
    webView.loadFileURL(fileURL, allowingReadAccessTo: accessRoot)
  }
}
