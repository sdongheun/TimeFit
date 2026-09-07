import Foundation
import Darwin

struct TimeFitLearningProjection: Codable, Equatable {
  let schemaVersion: Int
  let courseRunId: String
  let evidenceRef: String
  let captureGeneration: Int
  let publicationToken: String?

  var valid: Bool {
    schemaVersion == 1 && !courseRunId.isEmpty && courseRunId.count <= 200 && captureGeneration >= 0
      && UUID(uuidString: evidenceRef) != nil && (publicationToken == nil || UUID(uuidString: publicationToken!) != nil)
  }
  var dictionary: NSDictionary {
    ["schemaVersion": schemaVersion, "courseRunId": courseRunId, "evidenceRef": evidenceRef,
     "captureGeneration": captureGeneration, "publicationToken": publicationToken as Any? ?? NSNull()]
  }
  static func decode(_ value: NSDictionary) throws -> Self {
    guard Set(value.allKeys.compactMap { $0 as? String }) == Set(["schemaVersion", "courseRunId", "evidenceRef", "captureGeneration", "publicationToken"]) else { throw CocoaError(.coderInvalidValue) }
    let result = try JSONDecoder().decode(Self.self, from: JSONSerialization.data(withJSONObject: value))
    guard result.valid else { throw CocoaError(.coderInvalidValue) }; return result
  }
  func matchesPrepared(_ other: Self) -> Bool {
    schemaVersion == other.schemaVersion && courseRunId == other.courseRunId && evidenceRef == other.evidenceRef && captureGeneration == other.captureGeneration
  }
}

/** No credentials. Scope is the exact current UI run, not an owner/consent record.
 * Nonblocking process-wide file lock: optional contention excludes learning, never waits on networking.
 */
enum TimeFitLearningEvidenceStore {
  static func root() throws -> URL {
    guard let root = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "__APP_GROUP_IDENTIFIER__") else { throw CocoaError(.fileNoSuchFile) }
    return root
  }
  static func locked<T>(at root: URL, _ body: () throws -> T) throws -> T {
    let lockURL = root.appendingPathComponent("TimeFitLearningEvidence.lock")
    let fd = Darwin.open(lockURL.path, O_CREAT | O_RDWR, S_IRUSR | S_IWUSR)
    guard fd >= 0 else { throw CocoaError(.fileWriteUnknown) }
    defer { Darwin.close(fd) }
    #if os(iOS)
    try? FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: lockURL.path)
    #endif
    guard flock(fd, LOCK_EX | LOCK_NB) == 0 else { throw CocoaError(.fileLocking) }
    defer { flock(fd, LOCK_UN) }
    return try body()
  }
  private static func url(_ root: URL) -> URL { root.appendingPathComponent("TimeFitLearningProjection-v1.json") }
  private static func scopeURL(_ root: URL) -> URL { root.appendingPathComponent("TimeFitLearningScope-v1.json") }
  private static func scope(_ root: URL) -> String? { (try? Data(contentsOf: scopeURL(root))).flatMap { try? JSONDecoder().decode(String.self, from: $0) } }
  private static func projection(_ root: URL) throws -> TimeFitLearningProjection? {
    guard FileManager.default.fileExists(atPath: url(root).path) else { return nil }
    let p = try JSONDecoder().decode(TimeFitLearningProjection.self, from: Data(contentsOf: url(root)))
    guard p.valid else { throw CocoaError(.coderInvalidValue) }; return p
  }
  private static func write(_ data: Data, _ destination: URL) throws {
    #if os(iOS)
    try data.write(to: destination, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    #else
    try data.write(to: destination, options: .atomic)
    #endif
  }
  static func setActiveRun(_ run: String, at root: URL) throws {
    guard !run.isEmpty && run.count <= 200 else { throw CocoaError(.coderInvalidValue) }
    try locked(at: root) {
      if scope(root) == run { return }
      try write(JSONEncoder().encode(run), scopeURL(root))
      if FileManager.default.fileExists(atPath: url(root).path) { try FileManager.default.removeItem(at: url(root)) }
    }
  }
  static func readScope(at root: URL) throws -> String? { try locked(at: root) { try scope(root) ?? projection(root)?.courseRunId } }
  static func readActive(_ run: String, at root: URL) throws -> TimeFitLearningProjection? {
    try locked(at: root) {
      guard scope(root) == run, let p = try projection(root), p.courseRunId == run, p.publicationToken != nil else { return nil }
      return p
    }
  }
  static func storePrepared(_ p: TimeFitLearningProjection, at root: URL) throws -> TimeFitLearningProjection {
    try locked(at: root) {
      guard p.valid && p.publicationToken == nil && scope(root) == p.courseRunId else { throw CocoaError(.userCancelled) }
      if let existing = try projection(root) {
        guard existing.matchesPrepared(p) else { throw CocoaError(.userCancelled) }
        // Return exact null-token ack without demoting the existing active token.
      } else { try write(JSONEncoder().encode(p), url(root)) }
      return p
    }
  }
  static func activate(_ p: TimeFitLearningProjection, at root: URL) throws -> TimeFitLearningProjection {
    try locked(at: root) {
      guard p.valid && p.publicationToken != nil && scope(root) == p.courseRunId,
            let existing = try projection(root), existing.matchesPrepared(p),
            existing.publicationToken == nil || existing.publicationToken == p.publicationToken else { throw CocoaError(.userCancelled) }
      try write(JSONEncoder().encode(p), url(root)); return p
    }
  }
  static func clearExact(_ run: String, at root: URL) throws {
    try locked(at: root) {
      let currentScope = scope(root)
      let orphan = currentScope == nil ? try projection(root)?.courseRunId : nil
      guard currentScope == run || orphan == run else { return }
      // Remove scope first: a late activate/storePrepared cannot resurrect this run.
      if currentScope != nil { try FileManager.default.removeItem(at: scopeURL(root)) }
      if FileManager.default.fileExists(atPath: url(root).path) { try FileManager.default.removeItem(at: url(root)) }
    }
  }
}
