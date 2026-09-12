import Foundation
@main struct Harness {
  static func main() throws {
    let folder = URL(fileURLWithPath: CommandLine.arguments[1])
    for _ in 0..<20 {
      try TimeFitDiagnosticFileOrder.withNextLocation(in: folder) { location in
        try Data("{}".utf8).write(to: location, options: .atomic)
      }
    }
  }
}
