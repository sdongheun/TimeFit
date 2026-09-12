import ActivityKit
import Foundation

struct TimeFitActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    let activeStopId: String?
    let phase: String
    let revision: Int
    let targetTitle: String
    let arrivalPromptAtMs: Double?
    let nextBoundaryAtMs: Double?
    let departureReminderAtMs: Double?
    let snoozeUsed: Bool
    let completionEligible: Bool

    init(
      activeStopId: String?, phase: String, revision: Int, targetTitle: String,
      arrivalPromptAtMs: Double?, nextBoundaryAtMs: Double?, departureReminderAtMs: Double?,
      snoozeUsed: Bool = false, completionEligible: Bool = false
    ) {
      self.activeStopId = activeStopId
      self.phase = phase
      self.revision = revision
      self.targetTitle = targetTitle
      self.arrivalPromptAtMs = arrivalPromptAtMs
      self.nextBoundaryAtMs = nextBoundaryAtMs
      self.departureReminderAtMs = departureReminderAtMs
      self.snoozeUsed = snoozeUsed
      self.completionEligible = completionEligible
    }

    private enum CodingKeys: String, CodingKey {
      case activeStopId, phase, revision, targetTitle, arrivalPromptAtMs, nextBoundaryAtMs, departureReminderAtMs, snoozeUsed, completionEligible
    }

    init(from decoder: Decoder) throws {
      let values = try decoder.container(keyedBy: CodingKeys.self)
      activeStopId = try values.decodeIfPresent(String.self, forKey: .activeStopId)
      phase = try values.decode(String.self, forKey: .phase)
      revision = try values.decode(Int.self, forKey: .revision)
      targetTitle = try values.decode(String.self, forKey: .targetTitle)
      arrivalPromptAtMs = try values.decodeIfPresent(Double.self, forKey: .arrivalPromptAtMs)
      nextBoundaryAtMs = try values.decodeIfPresent(Double.self, forKey: .nextBoundaryAtMs)
      departureReminderAtMs = try values.decodeIfPresent(Double.self, forKey: .departureReminderAtMs)
      snoozeUsed = try values.decodeIfPresent(Bool.self, forKey: .snoozeUsed) ?? false
      completionEligible = try values.decodeIfPresent(Bool.self, forKey: .completionEligible) ?? false
    }
  }

  let schemaVersion: Int
  let courseRunId: String
  let purpose: String?
}

enum TimeFitActivityIdentityPolicy {
  static let schemaVersion = 1
  static let fixtureRunId = "timefit-a3-fixture-v1"
  static let legacyFixtureRunIds: Set<String> = ["a3-fixture-run"]

  static func purpose(_ attributes: TimeFitActivityAttributes) -> String {
    guard attributes.schemaVersion == schemaVersion else { return "unknown" }
    if attributes.purpose == "test_fixture", attributes.courseRunId == fixtureRunId { return "test_fixture" }
    if attributes.purpose == nil, legacyFixtureRunIds.contains(attributes.courseRunId) { return "test_fixture" }
    if attributes.purpose == "course_progress", !reservedFixtureRunId(attributes.courseRunId) { return "course_progress" }
    return "unknown"
  }

  static func reservedFixtureRunId(_ value: String) -> Bool {
    value == fixtureRunId || legacyFixtureRunIds.contains(value)
  }
}

struct TimeFitLiveActivityTarget: Codable, Hashable {
  let activityId: String
  let purpose: String
  let courseRunId: String
  let schemaVersion: Int
  let stopId: String
  let revision: Int
}

enum TimeFitLiveActivityTargetStore {
  enum CourseTargetResult {
    case found(Activity<TimeFitActivityAttributes>)
    case targetRecordMismatch
    case activityMissing
    case identityMismatch
  }
  private static let filename = "TimeFitLiveActivityTargets-v1.json"

  private static func url() throws -> URL {
    guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: TimeFitLocalProgressReceiptWriter.appGroupIdentifier) else {
      throw CocoaError(.fileNoSuchFile)
    }
    return container.appendingPathComponent(filename)
  }

  static func read() -> [TimeFitLiveActivityTarget] {
    guard let data = try? Data(contentsOf: try url()), let values = try? JSONDecoder().decode([TimeFitLiveActivityTarget].self, from: data) else { return [] }
    return values
  }

  static func upsert(_ target: TimeFitLiveActivityTarget) throws {
    var values = read().filter { $0.activityId != target.activityId }
    values.append(target)
    try JSONEncoder().encode(values).write(to: url(), options: .atomic)
  }

  static func remove(activityId: String, courseRunId: String, purpose: String) throws {
    let values = read().filter { !($0.activityId == activityId && $0.courseRunId == courseRunId && $0.purpose == purpose) }
    try JSONEncoder().encode(values).write(to: url(), options: .atomic)
  }

  static func permitsCourseReceipt(courseRunId: String, stopId: String, revision: Int) -> Bool {
    guard let target = read().first(where: {
      $0.purpose == "course_progress" && $0.courseRunId == courseRunId && $0.stopId == stopId && $0.revision == revision
    }) else { return false }
    return Activity<TimeFitActivityAttributes>.activities.contains {
      $0.id == target.activityId
        && TimeFitActivityIdentityPolicy.purpose($0.attributes) == "course_progress"
        && $0.attributes.courseRunId == courseRunId
        && $0.attributes.schemaVersion == target.schemaVersion
        && $0.content.state.activeStopId == stopId
        && $0.content.state.revision == revision
    }
  }

  static func resolveCourseTarget(courseRunId: String, stopId: String, revision: Int) -> Activity<TimeFitActivityAttributes>? {
    guard case let .found(activity) = courseTarget(courseRunId: courseRunId, stopId: stopId, revision: revision) else { return nil }
    return activity
  }

  static func courseTarget(courseRunId: String, stopId: String, revision: Int) -> CourseTargetResult {
    guard let target = read().first(where: {
      $0.purpose == "course_progress" && $0.courseRunId == courseRunId && $0.stopId == stopId && $0.revision == revision
    }) else { return .targetRecordMismatch }
    guard let activity = Activity<TimeFitActivityAttributes>.activities.first(where: { $0.id == target.activityId }) else { return .activityMissing }
    guard TimeFitActivityIdentityPolicy.purpose(activity.attributes) == "course_progress"
      && activity.attributes.courseRunId == courseRunId && activity.attributes.schemaVersion == target.schemaVersion
      && (activity.content.state.activeStopId ?? "final-destination") == stopId && activity.content.state.revision == revision else { return .identityMismatch }
    return .found(activity)
  }
}

private struct TimeFitSharedLocalProgressEnvelope: Decodable {
  let schemaVersion: Int
  let courseRunId: String
  let revision: Int
  let phase: String
  let updatedAtMs: Double
}

enum TimeFitLocalProgressStateStore {
  private static let filename = "TimeFitLocalProgress-v1.json"

  private static func url() throws -> URL {
    guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: TimeFitLocalProgressReceiptWriter.appGroupIdentifier) else {
      throw CocoaError(.fileNoSuchFile)
    }
    return container.appendingPathComponent(filename)
  }

  static func readRaw() throws -> String? {
    let location = try url()
    guard FileManager.default.fileExists(atPath: location.path) else { return nil }
    return String(data: try Data(contentsOf: location), encoding: .utf8)
  }

  static func writeRaw(_ raw: String) throws {
    guard let data = raw.data(using: .utf8),
          let envelope = try? JSONDecoder().decode(TimeFitSharedLocalProgressEnvelope.self, from: data),
          envelope.schemaVersion == 1, !envelope.courseRunId.isEmpty, envelope.courseRunId.count <= 200,
          envelope.revision >= 1, !envelope.phase.isEmpty, envelope.updatedAtMs > 0 else {
      throw CocoaError(.validationMissingMandatoryProperty)
    }
    try data.write(to: url(), options: .atomic)
  }

  static func clear() throws {
    let location = try url()
    if FileManager.default.fileExists(atPath: location.path) { try FileManager.default.removeItem(at: location) }
  }
}

struct TimeFitLocalProgressEventReceipt: Codable {
  var evidence: TimeFitLearningProjection? = nil
  let schemaVersion: Int
  let purpose: String
  let courseRunId: String
  let stopId: String
  let eventId: String
  let baseRevision: Int
  let source: String
  let type: String
  let occurredAtMs: Double
  let nextBoundaryAtMs: Double?
  let notificationId: String?
}

extension TimeFitLocalProgressEventReceipt {
  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    schemaVersion = try c.decode(Int.self, forKey: .schemaVersion)
    purpose = try c.decode(String.self, forKey: .purpose)
    courseRunId = try c.decode(String.self, forKey: .courseRunId)
    stopId = try c.decode(String.self, forKey: .stopId)
    eventId = try c.decode(String.self, forKey: .eventId)
    baseRevision = try c.decode(Int.self, forKey: .baseRevision)
    source = try c.decode(String.self, forKey: .source)
    type = try c.decode(String.self, forKey: .type)
    occurredAtMs = try c.decode(Double.self, forKey: .occurredAtMs)
    nextBoundaryAtMs = try c.decodeIfPresent(Double.self, forKey: .nextBoundaryAtMs)
    notificationId = try c.decodeIfPresent(String.self, forKey: .notificationId)
    // Malformed optional evidence must not hide an otherwise valid progress receipt.
    evidence = try? c.decodeIfPresent(TimeFitLearningProjection.self, forKey: .evidence)
  }
}

enum TimeFitLocalProgressReceiptWriter {
  static let appGroupIdentifier = "__APP_GROUP_IDENTIFIER__"

  private static func inboxURL() throws -> URL {
    guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) else {
      throw CocoaError(.fileNoSuchFile)
    }
    return container.appendingPathComponent("LocalProgressEvents", isDirectory: true)
  }

  static func write(_ receipt: TimeFitLocalProgressEventReceipt) throws {
    guard TimeFitLiveActivityTargetStore.permitsCourseReceipt(courseRunId: receipt.courseRunId, stopId: receipt.stopId, revision: receipt.baseRevision) else {
      throw CocoaError(.userCancelled)
    }
    let inbox = try inboxURL()
    try FileManager.default.createDirectory(at: inbox, withIntermediateDirectories: true)
    let safeEventId = receipt.eventId.replacingOccurrences(of: "/", with: "_")
    let destination = inbox.appendingPathComponent("\(safeEventId).json")
    let staged = inbox.appendingPathComponent(".\(safeEventId)-\(UUID().uuidString.lowercased()).tmp")
    let data = try JSONEncoder().encode(receipt)
    defer { try? FileManager.default.removeItem(at: staged) }
    try data.write(to: staged, options: .atomic)
    // Moving a same-volume staged file preserves the complete write and fails
    // if the immutable event destination already exists.
    try FileManager.default.moveItem(at: staged, to: destination)
  }

  static func removeDecodedFixtureReceipts(courseRunId: String) throws {
    guard TimeFitActivityIdentityPolicy.reservedFixtureRunId(courseRunId),
          FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) != nil else { return }
    let inbox = try inboxURL()
    guard let urls = try? FileManager.default.contentsOfDirectory(at: inbox, includingPropertiesForKeys: nil) else { return }
    for url in urls {
      guard let data = try? Data(contentsOf: url),
            let receipt = try? JSONDecoder().decode(TimeFitLocalProgressEventReceipt.self, from: data),
            receipt.purpose == "test_fixture",
            receipt.courseRunId == courseRunId else { continue }
      try FileManager.default.removeItem(at: url)
    }
  }

  static func listCourseReceipts() throws -> [[String: String]] {
    let inbox = try inboxURL()
    guard let urls = try? FileManager.default.contentsOfDirectory(at: inbox, includingPropertiesForKeys: nil) else { return [] }
    return urls.compactMap { url in
      guard let data = try? Data(contentsOf: url),
            let receipt = try? JSONDecoder().decode(TimeFitLocalProgressEventReceipt.self, from: data),
            receipt.purpose == "course_progress",
            let raw = String(data: data, encoding: .utf8) else { return nil }
      return ["receiptId": receipt.eventId, "raw": raw]
    }
  }

  static func acknowledgeCourseReceipt(eventId: String) throws {
    guard !eventId.isEmpty, eventId.count <= 200 else { throw CocoaError(.validationMissingMandatoryProperty) }
    let inbox = try inboxURL()
    guard let urls = try? FileManager.default.contentsOfDirectory(at: inbox, includingPropertiesForKeys: nil) else { return }
    for url in urls {
      guard let data = try? Data(contentsOf: url),
            let receipt = try? JSONDecoder().decode(TimeFitLocalProgressEventReceipt.self, from: data),
            receipt.purpose == "course_progress", receipt.eventId == eventId else { continue }
      try FileManager.default.removeItem(at: url)
    }
  }
}

struct TimeFitPendingNavigationAction: Codable {
  let schemaVersion: Int
  let purpose: String
  let actionId: String
  let courseRunId: String
  let stopId: String
  let baseRevision: Int
  let state: String
}

enum TimeFitPendingNavigationSignal {
  static let name = CFNotificationName("com.dongheun.mobile.timefit.pending-navigation" as CFString)

  static func post() {
    CFNotificationCenterPostNotification(CFNotificationCenterGetDarwinNotifyCenter(), name, nil, nil, true)
  }
}

enum TimeFitPendingNavigationActionStore {
  // Revoked completion capability, not account identity or learning evidence.
  // Only one real course may be active; retain its revocation across app restart.
  private static func completionRevocationURL() throws -> URL {
    try url().deletingLastPathComponent().appendingPathComponent("TimeFitCompletionRevokedRun-v1.json")
  }
  static func completionRevoked(_ run: String) -> Bool {
    guard let location = try? completionRevocationURL() else { return true }
    if !FileManager.default.fileExists(atPath: location.path) { return false }
    guard let data = try? Data(contentsOf: location), let revoked = try? JSONDecoder().decode(String.self, from: data) else { return true }
    return revoked == run
  }
  static func revokeCompletion(_ run: String) throws {
    let location = try completionRevocationURL()
    try JSONEncoder().encode(run).write(to: location, options: .atomic)
    try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: location.path)
    if let pending = read(), pending.courseRunId == run, pending.purpose == "course_progress_completion" {
      try clearExact(actionId: pending.actionId, courseRunId: run)
    }
  }
  private static let filename = "TimeFitPendingNavigation-v1.json"
  private static let states: Set<String> = ["pending", "executing", "success", "failure"]
  private static func url() throws -> URL {
    guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: TimeFitLocalProgressReceiptWriter.appGroupIdentifier) else {
      throw CocoaError(.fileNoSuchFile)
    }
    return container.appendingPathComponent(filename)
  }
  static func valid(_ value: TimeFitPendingNavigationAction) -> Bool {
    value.schemaVersion == 1 && ["course_progress_navigation", "course_progress_completion"].contains(value.purpose)
      && !value.actionId.isEmpty && value.actionId.count <= 200
      && !value.courseRunId.isEmpty && value.courseRunId.count <= 200
      && !value.stopId.isEmpty && value.stopId.count <= 200
      && value.baseRevision >= 1 && states.contains(value.state)
  }
  static func read() -> TimeFitPendingNavigationAction? {
    guard let location = try? url(), let data = try? Data(contentsOf: location),
          let value = try? JSONDecoder().decode(TimeFitPendingNavigationAction.self, from: data), valid(value) else { return nil }
    return value
  }
  static func write(_ value: TimeFitPendingNavigationAction) throws {
    guard valid(value) else { throw CocoaError(.validationMissingMandatoryProperty) }
    let location = try url()
    try JSONEncoder().encode(value).write(to: location, options: .atomic)
    try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: location.path)
  }
  static func create(_ value: TimeFitPendingNavigationAction, activeCourseRunIds: Set<String>) throws -> TimeFitPendingCreationDecision {
    if let existing = read() {
      let decision = TimeFitNativeIntentPolicy.pendingCreation(
        existingActionId: existing.actionId, existingCourseRunId: existing.courseRunId,
        requestedActionId: value.actionId, requestedCourseRunId: value.courseRunId,
        activeCourseRunIds: activeCourseRunIds
      )
      switch decision {
      case .reuse: return .reuse
      case .replaceOrphan: try write(value); return .replaceOrphan
      case .reject: throw CocoaError(.fileWriteFileExists)
      }
    }
    try write(value)
    return .reuse
  }
  static func transition(actionId: String, courseRunId: String, from: String, to: String) throws -> Bool {
    guard states.contains(from), states.contains(to), let current = read(), current.actionId == actionId,
          current.courseRunId == courseRunId, current.state == from else { return false }
    guard TimeFitNativeIntentPolicy.permitsPendingTransition(from: from, to: to) else { return false }
    try write(.init(schemaVersion: current.schemaVersion, purpose: current.purpose, actionId: current.actionId,
                    courseRunId: current.courseRunId, stopId: current.stopId, baseRevision: current.baseRevision, state: to))
    return true
  }
  static func clearExact(actionId: String, courseRunId: String) throws {
    guard let current = read(), current.actionId == actionId, current.courseRunId == courseRunId else { return }
    let location = try url()
    if FileManager.default.fileExists(atPath: location.path) { try FileManager.default.removeItem(at: location) }
  }
  static func clearCourseRun(_ courseRunId: String) throws {
    guard let current = read(), current.courseRunId == courseRunId else { return }
    try clearExact(actionId: current.actionId, courseRunId: courseRunId)
  }
}
