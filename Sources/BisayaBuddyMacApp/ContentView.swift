import Foundation
import SwiftUI

struct BundledHTMLDocument {
  let url: URL
  let htmlString: String?
}

enum BundledHTMLLocator {
  static func document() -> BundledHTMLDocument? {
    guard let url = htmlURL() else {
      return nil
    }

    let htmlString = try? String(contentsOf: url, encoding: .utf8)
    return BundledHTMLDocument(url: url, htmlString: htmlString)
  }

  static func htmlURL() -> URL? {
    if let directResource = Bundle.main.url(
      forResource: "Bisaya Buddy Single File",
      withExtension: "html"
    ) {
      return directResource
    }

    guard let resourceRoot = Bundle.main.resourceURL else {
      return nil
    }

    let fallback = resourceRoot.appendingPathComponent(
      "Bisaya Buddy Single File.html"
    )

    return FileManager.default.fileExists(atPath: fallback.path) ? fallback : nil
  }
}

struct ContentView: View {
  private let bundledHTMLDocument = BundledHTMLLocator.document()

  var body: some View {
    Group {
      if let bundledHTMLDocument {
        BisayaBuddyWebView(
          fileURL: bundledHTMLDocument.url,
          htmlString: bundledHTMLDocument.htmlString
        )
      } else {
        MissingResourceView()
      }
    }
    #if os(iOS)
      .ignoresSafeArea()
    #else
      .frame(minWidth: 980, minHeight: 720)
    #endif
  }
}

private struct MissingResourceView: View {
  var body: some View {
    ZStack {
      LinearGradient(
        colors: [
          Color(red: 0.97, green: 0.93, blue: 0.89),
          Color(red: 0.87, green: 0.90, blue: 0.97),
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
      .ignoresSafeArea()

      VStack(alignment: .leading, spacing: 16) {
        Text("Bisaya Buddy")
          .font(.system(size: 28, weight: .semibold, design: .rounded))

        Text("The bundled lesson file is missing.")
          .font(.title3.weight(.medium))

        Text(
          "Run `node build_single_file.js` from the project root so the latest lesson bundle is available to both the iOS project and the macOS wrapper."
        )
        .foregroundStyle(.secondary)
        .fixedSize(horizontal: false, vertical: true)
      }
      .padding(28)
      .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 28))
      .padding(40)
    }
  }
}
