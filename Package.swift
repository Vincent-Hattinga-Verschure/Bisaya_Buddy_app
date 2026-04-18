// swift-tools-version: 6.0
import PackageDescription

let package = Package(
  name: "BisayaBuddyMacApp",
  platforms: [
    .macOS(.v14),
  ],
  products: [
    .executable(
      name: "BisayaBuddyMacApp",
      targets: ["BisayaBuddyMacApp"]
    ),
  ],
  targets: [
    .executableTarget(
      name: "BisayaBuddyMacApp",
      path: "Sources/BisayaBuddyMacApp"
    ),
  ]
)
