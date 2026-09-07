import Foundation
import os

enum TimeFitDiagnosticStream: String, Codable { case intent, app }
enum TimeFitDiagnosticAction: String, Codable {
  case arrival, snooze, departure, boot, foreground, receipt, screen, pending, route
}
enum TimeFitDiagnosticResult: String, Codable { case started, succeeded, rejected, failed, observed, absent }
enum TimeFitDiagnosticError: String, Codable {
  case none, diagnosticStoreFailed = "diagnostic_store_failed", targetRecordMismatch = "target_record_mismatch"
  case activityMissing = "activity_missing", identityMismatch = "identity_mismatch"
  case receiptWriteFailed = "receipt_write_failed", pendingWriteFailed = "pending_write_failed"
  case activityUpdateFailed = "activity_update_failed", targetUpdateFailed = "target_update_failed"
  case storageUnreadable = "storage_unreadable", receiptRejected = "receipt_rejected"
  case pendingRejected = "pending_rejected", nativeUnavailable = "native_unavailable", unknown
  case invalidStage = "invalid_stage", appUnavailable = "app_unavailable", appOpenFailed = "app_open_failed"
  case webOpenFailed = "web_open_failed", browserDismissed = "browser_dismissed", browserOpenFailed = "browser_open_failed"
}

struct TimeFitDiagnosticEvent: Codable {
  let schemaVersion: Int
  let nativeSourceRevision: String
  let build: String
  let stream: TimeFitDiagnosticStream
  let action: TimeFitDiagnosticAction
  let attemptId: String
  let stage: String
  let result: TimeFitDiagnosticResult
  let error: TimeFitDiagnosticError
  let phase: String?
  let revision: Int?
  let targetRecordMatch: Bool?
  let activityFound: Bool?
  let identityMatch: Bool?
}

enum TimeFitLiveActivityDiagnosticStore {
  static let schemaVersion = 2
  static let nativeSourceRevision = "ula-button-diagnostic-2026-09-06.5"
  static let maximumEntries = 32
  private static let directoryName = "TimeFitLiveActivityDiagnostics-v2"
  private static let logger = Logger(subsystem: "com.dongheun.mobile", category: "live-activity-button")

  static func newAttemptId() -> String { UUID().uuidString.lowercased() }

  private static func buildIdentifier() -> String {
    let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "unknown"
    let number = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "unknown"
    return "\(version)(\(number))"
  }

  private static func rootURL() throws -> URL {
    guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: TimeFitLocalProgressReceiptWriter.appGroupIdentifier) else {
      logger.error("diagnostic_store_failed stage=container_unavailable")
      throw CocoaError(.fileNoSuchFile)
    }
    return container.appendingPathComponent(directoryName, isDirectory: true)
  }

  private static func streamURL(_ stream: TimeFitDiagnosticStream) throws -> URL {
    try rootURL().appendingPathComponent(stream.rawValue, isDirectory: true)
  }

  @discardableResult static func record(
    stream: TimeFitDiagnosticStream,
    action: TimeFitDiagnosticAction,
    attemptId: String,
    stage: String,
    result: TimeFitDiagnosticResult,
    error: TimeFitDiagnosticError = .none,
    phase: String? = nil,
    revision: Int? = nil,
    targetRecordMatch: Bool? = nil,
    activityFound: Bool? = nil,
    identityMatch: Bool? = nil
  ) -> Bool {
    let safeStage = stage.range(of: "^[a-z0-9_]{1,64}$", options: .regularExpression) != nil ? stage : "invalid_stage"
    let safeAttempt = attemptId.range(of: "^[a-z0-9-]{1,64}$", options: .regularExpression) != nil ? attemptId : newAttemptId()
    let safePhase = phase.flatMap { $0.range(of: "^[a-z_]{1,32}$", options: .regularExpression) != nil ? $0 : nil }
    let value = TimeFitDiagnosticEvent(
      schemaVersion: schemaVersion, nativeSourceRevision: nativeSourceRevision, build: buildIdentifier(), stream: stream,
      action: action, attemptId: safeAttempt, stage: safeStage, result: result, error: error,
      phase: safePhase, revision: revision, targetRecordMatch: targetRecordMatch,
      activityFound: activityFound, identityMatch: identityMatch
    )
    do {
      let folder = try streamURL(stream)
      try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
      let order = String(format: "%020llu", DispatchTime.now().uptimeNanoseconds)
      let location = folder.appendingPathComponent("\(order)-\(UUID().uuidString.lowercased()).json")
      // The filename is unique per event. Foundation rejects combining
      // .atomic and .withoutOverwriting, so atomic replacement is sufficient here.
      try JSONEncoder().encode(value).write(to: location, options: .atomic)
      try? FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: location.path)
      trim(folder)
      logger.info("stream=\(stream.rawValue, privacy: .public) action=\(action.rawValue, privacy: .public) stage=\(safeStage, privacy: .public) result=\(result.rawValue, privacy: .public) error=\(error.rawValue, privacy: .public)")
      return true
    } catch {
      logger.error("diagnostic_store_failed stream=\(stream.rawValue, privacy: .public) stage=\(safeStage, privacy: .public)")
      return false
    }
  }

  private static func eventURLs(_ folder: URL) -> [URL] {
    ((try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)) ?? [])
      .filter { $0.pathExtension == "json" }.sorted { $0.lastPathComponent < $1.lastPathComponent }
  }

  private static func trim(_ folder: URL) {
    let urls = eventURLs(folder)
    guard urls.count > maximumEntries else { return }
    for url in urls.prefix(urls.count - maximumEntries) { try? FileManager.default.removeItem(at: url) }
  }

  static func read() throws -> [TimeFitDiagnosticStream: [TimeFitDiagnosticEvent]] {
    var report: [TimeFitDiagnosticStream: [TimeFitDiagnosticEvent]] = [:]
    for stream in [TimeFitDiagnosticStream.intent, .app] {
      let values = eventURLs(try streamURL(stream)).suffix(maximumEntries).compactMap { url in
        try? JSONDecoder().decode(TimeFitDiagnosticEvent.self, from: Data(contentsOf: url))
      }
      report[stream] = Array(values)
    }
    return report
  }

  static func clear() throws {
    let root = try rootURL()
    if FileManager.default.fileExists(atPath: root.path) { try FileManager.default.removeItem(at: root) }
  }
}
