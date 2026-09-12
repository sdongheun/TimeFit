import Foundation
import Darwin

// App Group-local ordering, not time measurement. Lock spans allocation and write.
enum TimeFitDiagnosticFileOrder {
  static func withNextLocation<T>(in folder: URL, write: (URL) throws -> T) throws -> T {
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    let fd = open(folder.appendingPathComponent(".order.lock").path, O_CREAT | O_RDWR | O_NOFOLLOW, S_IRUSR | S_IWUSR)
    guard fd >= 0 else { throw CocoaError(.fileWriteUnknown) }
    defer { close(fd) }
    try? FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: folder.appendingPathComponent(".order.lock").path)
    // Validate only metadata of our own lock file; no outside-container inspection.
    var metadata = stat()
    guard fstat(fd, &metadata) == 0, metadata.st_mode & S_IFMT == S_IFREG,
          flock(fd, LOCK_EX) == 0 else { throw CocoaError(.fileWriteUnknown) }
    defer { flock(fd, LOCK_UN) }
    let files = try FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)
    let latest = files.filter { $0.pathExtension == "json" }.compactMap { url -> UInt64? in
      let name = url.lastPathComponent
      guard name.count > 21, name.dropFirst(20).first == "-" else { return nil }
      return UInt64(name.prefix(20))
    }.max() ?? 0
    guard latest < UInt64.max else { throw CocoaError(.fileWriteUnknown) }
    let order = String(format: "%020llu", latest + 1)
    return try write(folder.appendingPathComponent("\(order)-\(UUID().uuidString.lowercased()).json"))
  }
}
