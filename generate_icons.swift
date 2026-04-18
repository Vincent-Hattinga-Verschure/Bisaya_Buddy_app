import AppKit
import Foundation

enum IconError: Error {
  case bitmap
}

func drawIcon(size: CGFloat, destination: URL) throws {
  let canvas = NSRect(x: 0, y: 0, width: size, height: size)
  let image = NSImage(size: canvas.size)

  image.lockFocus()

  let background = NSBezierPath(
    roundedRect: canvas.insetBy(dx: size * 0.04, dy: size * 0.04),
    xRadius: size * 0.22,
    yRadius: size * 0.22
  )
  let gradient = NSGradient(
    colors: [
      NSColor(calibratedRed: 1.0, green: 0.96, blue: 0.87, alpha: 1.0),
      NSColor(calibratedRed: 0.95, green: 0.71, blue: 0.57, alpha: 1.0),
    ]
  )!
  gradient.draw(in: background, angle: -45)

  NSColor(calibratedRed: 1.0, green: 0.82, blue: 0.73, alpha: 0.7).setFill()
  NSBezierPath(ovalIn: NSRect(x: size * 0.67, y: size * 0.69, width: size * 0.18, height: size * 0.18)).fill()

  NSColor(calibratedRed: 1.0, green: 0.95, blue: 0.88, alpha: 0.85).setFill()
  NSBezierPath(ovalIn: NSRect(x: size * 0.14, y: size * 0.12, width: size * 0.24, height: size * 0.24)).fill()

  let cardRect = NSRect(x: size * 0.19, y: size * 0.19, width: size * 0.62, height: size * 0.62)
  NSColor(calibratedWhite: 1.0, alpha: 0.94).setFill()
  NSBezierPath(
    roundedRect: cardRect,
    xRadius: size * 0.08,
    yRadius: size * 0.08
  ).fill()

  let headerRect = NSRect(x: size * 0.25, y: size * 0.66, width: size * 0.50, height: size * 0.08)
  NSColor(calibratedRed: 0.86, green: 0.43, blue: 0.27, alpha: 1.0).setFill()
  NSBezierPath(
    roundedRect: headerRect,
    xRadius: size * 0.04,
    yRadius: size * 0.04
  ).fill()

  let lineColor = NSColor(calibratedRed: 0.95, green: 0.76, blue: 0.66, alpha: 1.0)
  lineColor.setFill()
  for row in 0..<2 {
    let y = size * (0.56 - CGFloat(row) * 0.08)
    let width = row == 0 ? size * 0.38 : size * 0.30
    NSBezierPath(
      roundedRect: NSRect(x: size * 0.25, y: y, width: width, height: size * 0.035),
      xRadius: size * 0.018,
      yRadius: size * 0.018
    ).fill()
  }

  let badgeRect = NSRect(x: size * 0.25, y: size * 0.28, width: size * 0.24, height: size * 0.16)
  NSColor(calibratedRed: 0.86, green: 0.43, blue: 0.27, alpha: 1.0).setFill()
  NSBezierPath(
    roundedRect: badgeRect,
    xRadius: size * 0.05,
    yRadius: size * 0.05
  ).fill()

  let paragraph = NSMutableParagraphStyle()
  paragraph.alignment = .center

  let badgeText = NSAttributedString(
    string: "BB",
    attributes: [
      .font: NSFont.systemFont(ofSize: size * 0.09, weight: .bold),
      .foregroundColor: NSColor.white,
      .paragraphStyle: paragraph,
    ]
  )
  badgeText.draw(in: badgeRect.insetBy(dx: 0, dy: size * 0.02))

  let footerText = NSAttributedString(
    string: "Bisaya Buddy",
    attributes: [
      .font: NSFont.systemFont(ofSize: size * 0.06, weight: .bold),
      .foregroundColor: NSColor(calibratedRed: 0.55, green: 0.24, blue: 0.16, alpha: 1.0),
      .paragraphStyle: paragraph,
    ]
  )
  footerText.draw(
    in: NSRect(x: size * 0.10, y: size * 0.06, width: size * 0.80, height: size * 0.08)
  )

  image.unlockFocus()

  guard
    let tiffData = image.tiffRepresentation,
    let bitmap = NSBitmapImageRep(data: tiffData),
    let pngData = bitmap.representation(using: .png, properties: [:])
  else {
    throw IconError.bitmap
  }

  try pngData.write(to: destination)
}

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let assets = root.appendingPathComponent("assets", isDirectory: true)
try FileManager.default.createDirectory(at: assets, withIntermediateDirectories: true)

try drawIcon(size: 180, destination: assets.appendingPathComponent("icon-180.png"))
try drawIcon(size: 192, destination: assets.appendingPathComponent("icon-192.png"))
try drawIcon(size: 512, destination: assets.appendingPathComponent("icon-512.png"))
try drawIcon(size: 1024, destination: assets.appendingPathComponent("icon-1024.png"))

print("Generated icons in \(assets.path)")
