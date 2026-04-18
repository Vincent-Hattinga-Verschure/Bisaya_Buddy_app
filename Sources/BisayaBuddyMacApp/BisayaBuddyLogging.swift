import OSLog

extension Logger {
  static let lifecycle = Logger(
    subsystem: "com.vincenth.bisayabuddy",
    category: "lifecycle"
  )
  static let web = Logger(
    subsystem: "com.vincenth.bisayabuddy",
    category: "webview"
  )
}
