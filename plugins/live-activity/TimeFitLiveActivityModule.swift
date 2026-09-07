import ActivityKit
import Foundation
import React
import UIKit

private let timeFitPendingNavigationEventName = "timeFitPendingNavigationAvailable"

private func timeFitPendingNavigationDarwinCallback(
  _ center: CFNotificationCenter?,
  _ observer: UnsafeMutableRawPointer?,
  _ name: CFNotificationName?,
  _ object: UnsafeRawPointer?,
  _ userInfo: CFDictionary?
) {
  guard let observer else { return }
  let module = Unmanaged<TimeFitLiveActivityModule>.fromOpaque(observer).takeUnretainedValue()
  module.pendingNavigationSignalReceived()
}

private struct TimeFitDecodedActivityPayload {
  let purpose: String
  let schemaVersion: Int
  let courseRunId: String
  let stopId: String
  let revision: Int
  let phase: String
  let targetTitle: String
  let arrivalPromptAtMs: Double?
  let nextBoundaryAtMs: Double
  let departureReminderAtMs: Double?
  let snoozeUsed: Bool

  static func decode(_ value: NSDictionary, expectedPurpose: String) -> Self? {
    guard value["purpose"] as? String == expectedPurpose,
          let schemaVersion = value["schemaVersion"] as? Int, schemaVersion == TimeFitActivityIdentityPolicy.schemaVersion,
          let courseRunId = value["courseRunId"] as? String, !courseRunId.isEmpty, courseRunId.count <= 200,
          let stopId = value["stopId"] as? String, !stopId.isEmpty, stopId.count <= 200,
          let revision = value["revision"] as? Int, revision >= 1,
          let phase = value["phase"] as? String, ["traveling", "arrival_pending", "dwelling", "departure_due"].contains(phase),
          let targetTitle = value["targetTitle"] as? String, !targetTitle.isEmpty, targetTitle.count <= 200,
          let boundary = value["nextBoundaryAtMs"] as? NSNumber, boundary.doubleValue > 0 else { return nil }
    let arrival = value["arrivalPromptAtMs"] as? NSNumber
    if let arrival, arrival.doubleValue <= 0 { return nil }
    let reminder = value["departureReminderAtMs"] as? NSNumber
    let snoozeUsed = value["snoozeUsed"] as? Bool ?? false
    if expectedPurpose == "test_fixture" {
      guard courseRunId == TimeFitActivityIdentityPolicy.fixtureRunId,
            stopId == "stop:a3-busan-citizens-park", revision == 1, phase == "traveling", arrival != nil else { return nil }
    } else if TimeFitActivityIdentityPolicy.reservedFixtureRunId(courseRunId) { return nil }
    return .init(
      purpose: expectedPurpose, schemaVersion: schemaVersion, courseRunId: courseRunId,
      stopId: stopId, revision: revision, phase: phase, targetTitle: targetTitle,
      arrivalPromptAtMs: arrival?.doubleValue, nextBoundaryAtMs: boundary.doubleValue,
      departureReminderAtMs: reminder?.doubleValue, snoozeUsed: snoozeUsed
    )
  }

  var state: TimeFitActivityAttributes.ContentState {
    .init(
      activeStopId: stopId == "final-destination" ? nil : stopId, phase: phase, revision: revision, targetTitle: targetTitle,
      arrivalPromptAtMs: arrivalPromptAtMs, nextBoundaryAtMs: nextBoundaryAtMs,
      departureReminderAtMs: departureReminderAtMs, snoozeUsed: snoozeUsed
    )
  }
}

@objc(TimeFitLiveActivityModule)
final class TimeFitLiveActivityModule: RCTEventEmitter {
  @objc func setLearningEvidenceRun(_ run: String) -> NSNumber {
    do { try TimeFitLearningEvidenceStore.setActiveRun(run, at: TimeFitLearningEvidenceStore.root()); return true }
    catch { return false }
  }
  @objc func readLearningEvidence(_ run: String) -> NSDictionary? {
    (try? TimeFitLearningEvidenceStore.readActive(run, at: TimeFitLearningEvidenceStore.root()))?.dictionary
  }
  @objc func readLearningEvidenceScope() -> String? { try? TimeFitLearningEvidenceStore.readScope(at: TimeFitLearningEvidenceStore.root()) }
  @objc func storePreparedLearningEvidence(_ value: NSDictionary, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    do { resolve(try TimeFitLearningEvidenceStore.storePrepared(TimeFitLearningProjection.decode(value), at: TimeFitLearningEvidenceStore.root()).dictionary) }
    catch { reject("learning_unavailable", "Learning evidence unavailable", nil) }
  }
  @objc func activateLearningEvidence(_ value: NSDictionary, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    do { resolve(try TimeFitLearningEvidenceStore.activate(TimeFitLearningProjection.decode(value), at: TimeFitLearningEvidenceStore.root()).dictionary) }
    catch { reject("learning_unavailable", "Learning evidence unavailable", nil) }
  }
  @objc func clearLearningEvidence(_ run: String, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    do { try TimeFitLearningEvidenceStore.clearExact(run, at: TimeFitLearningEvidenceStore.root()); resolve(nil) }
    catch { reject("learning_unavailable", "Learning evidence unavailable", nil) }
  }
  @MainActor private var lifecycleTail: Task<Void, Never> = Task {}
  private var observingPendingNavigation = false

  override func supportedEvents() -> [String]! { [timeFitPendingNavigationEventName] }

  override func startObserving() {
    guard !observingPendingNavigation else { return }
    observingPendingNavigation = true
    CFNotificationCenterAddObserver(
      CFNotificationCenterGetDarwinNotifyCenter(),
      Unmanaged.passUnretained(self).toOpaque(),
      timeFitPendingNavigationDarwinCallback,
      TimeFitPendingNavigationSignal.name.rawValue,
      nil,
      .deliverImmediately
    )
  }

  override func stopObserving() {
    guard observingPendingNavigation else { return }
    CFNotificationCenterRemoveObserver(
      CFNotificationCenterGetDarwinNotifyCenter(),
      Unmanaged.passUnretained(self).toOpaque(),
      TimeFitPendingNavigationSignal.name,
      nil
    )
    observingPendingNavigation = false
  }

  deinit {
    if observingPendingNavigation {
      CFNotificationCenterRemoveObserver(
        CFNotificationCenterGetDarwinNotifyCenter(),
        Unmanaged.passUnretained(self).toOpaque(),
        TimeFitPendingNavigationSignal.name,
        nil
      )
    }
  }

  fileprivate func pendingNavigationSignalReceived() {
    DispatchQueue.main.async { [weak self] in
      self?.sendEvent(withName: timeFitPendingNavigationEventName, body: ["reason": "available"])
    }
  }

  @MainActor
  private func enqueue(_ operation: @escaping @MainActor () async -> Void) {
    let previous = lifecycleTail
    let next = Task { @MainActor in
      await previous.value
      await operation()
    }
    lifecycleTail = next
  }

  @MainActor
  private func applicationStateName() -> String {
    switch UIApplication.shared.applicationState {
    case .active: return "active"
    case .inactive: return "inactive"
    case .background: return "background"
    @unknown default: return "unknown"
    }
  }

  private func identity(_ activity: Activity<TimeFitActivityAttributes>) -> [String: Any] {
    [
      "activityId": activity.id,
      "purpose": TimeFitActivityIdentityPolicy.purpose(activity.attributes),
      "courseRunId": activity.attributes.courseRunId,
      "schemaVersion": activity.attributes.schemaVersion,
      "revision": activity.content.state.revision,
    ]
  }

  private func diagnosticEvent(_ value: TimeFitDiagnosticEvent) -> [String: Any] {
    var result: [String: Any] = [
      "schemaVersion": value.schemaVersion, "nativeSourceRevision": value.nativeSourceRevision,
      "build": value.build, "stream": value.stream.rawValue, "action": value.action.rawValue,
      "attemptId": value.attemptId, "stage": value.stage, "result": value.result.rawValue,
      "error": value.error.rawValue,
    ]
    if let phase = value.phase { result["phase"] = phase }
    if let revision = value.revision { result["revision"] = revision }
    if let value = value.targetRecordMatch { result["targetRecordMatch"] = value }
    if let value = value.activityFound { result["activityFound"] = value }
    if let value = value.identityMatch { result["identityMatch"] = value }
    return result
  }

  private func installedBuildIdentity() -> [String: Any] {
    let mainVersion = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "unknown"
    let mainBuild = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "unknown"
    var result: [String: Any] = [
      "mainBundle": Bundle.main.bundleIdentifier ?? "unknown", "mainVersion": mainVersion,
      "mainBuild": mainBuild, "nativeSourceRevision": TimeFitLiveActivityDiagnosticStore.nativeSourceRevision,
    ]
    if let root = Bundle.main.builtInPlugInsURL,
       let url = try? FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil).first(where: { $0.pathExtension == "appex" }),
       let extensionBundle = Bundle(url: url) {
      result["extensionBundle"] = extensionBundle.bundleIdentifier ?? "unknown"
      result["extensionVersion"] = extensionBundle.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "unknown"
      result["extensionBuild"] = extensionBundle.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "unknown"
    }
    return result
  }

  @MainActor
  private func start(_ payload: TimeFitDecodedActivityPayload) async throws -> Activity<TimeFitActivityAttributes> {
    let attributes = TimeFitActivityAttributes(
      schemaVersion: payload.schemaVersion,
      courseRunId: payload.courseRunId,
      purpose: payload.purpose
    )
    let activity = try Activity<TimeFitActivityAttributes>.request(
      attributes: attributes,
      content: ActivityContent(state: payload.state, staleDate: nil),
      pushType: nil
    )
    do {
      try TimeFitLiveActivityTargetStore.upsert(.init(
        activityId: activity.id, purpose: payload.purpose, courseRunId: payload.courseRunId,
        schemaVersion: payload.schemaVersion, stopId: payload.stopId, revision: payload.revision
      ))
      return activity
    } catch {
      await activity.end(nil, dismissalPolicy: .immediate)
      throw error
    }
  }

  @objc
  func activitySupport(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in
      resolve([
        "supported": true,
        "enabled": ActivityAuthorizationInfo().areActivitiesEnabled,
        "appGroupIdentifier": "__APP_GROUP_IDENTIFIER__",
        "applicationState": applicationStateName(),
      ])
    }
  }

  @objc
  func listActivities(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in
      enqueue { resolve(Activity<TimeFitActivityAttributes>.activities.map(self.identity)) }
    }
  }

  @objc
  func readLocalProgress(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in enqueue {
      do { resolve(try TimeFitLocalProgressStateStore.readRaw() ?? NSNull()) }
      catch { reject("live_progress_read_failed", "Local progress could not be read", error) }
    } }
  }

  @objc
  func writeLocalProgress(
    _ raw: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in enqueue {
      do { try TimeFitLocalProgressStateStore.writeRaw(raw); resolve(nil) }
      catch { reject("live_progress_write_failed", "Local progress could not be written", error) }
    } }
  }

  @objc
  func clearLocalProgress(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in enqueue {
      do { try TimeFitLocalProgressStateStore.clear(); resolve(nil) }
      catch { reject("live_progress_clear_failed", "Local progress could not be cleared", error) }
    } }
  }

  @objc
  func listLocalProgressReceipts(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in enqueue {
      do { resolve(try TimeFitLocalProgressReceiptWriter.listCourseReceipts()) }
      catch { reject("live_progress_receipt_read_failed", "Local progress receipts could not be read", error) }
    } }
  }

  @objc
  func acknowledgeLocalProgressReceipt(
    _ eventId: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in enqueue {
      do { try TimeFitLocalProgressReceiptWriter.acknowledgeCourseReceipt(eventId: eventId); resolve(nil) }
      catch { reject("live_progress_receipt_ack_failed", "Local progress receipt could not be acknowledged", error) }
    } }
  }

  @objc
  func readPendingNavigationAction(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in enqueue {
      guard let value = TimeFitPendingNavigationActionStore.read() else { resolve(NSNull()); return }
      resolve([
        "schemaVersion": value.schemaVersion, "purpose": value.purpose, "actionId": value.actionId,
        "courseRunId": value.courseRunId, "stopId": value.stopId, "baseRevision": value.baseRevision, "state": value.state,
      ])
    } }
  }

  @objc
  func transitionPendingNavigationAction(
    _ value: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in enqueue {
      guard let actionId = value["actionId"] as? String, let courseRunId = value["courseRunId"] as? String,
            let from = value["from"] as? String, let to = value["to"] as? String else { resolve(false); return }
      do { resolve(try TimeFitPendingNavigationActionStore.transition(actionId: actionId, courseRunId: courseRunId, from: from, to: to)) }
      catch { reject("live_navigation_transition_failed", "Pending navigation could not be updated", error) }
    } }
  }

  @objc
  func clearPendingNavigationAction(
    _ value: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in enqueue {
      guard let actionId = value["actionId"] as? String, let courseRunId = value["courseRunId"] as? String else { resolve(nil); return }
      do { try TimeFitPendingNavigationActionStore.clearExact(actionId: actionId, courseRunId: courseRunId); resolve(nil) }
      catch { reject("live_navigation_clear_failed", "Pending navigation could not be cleared", error) }
    } }
  }

  @objc
  func recordAppDiagnostic(
    _ value: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let rawAction = value["action"] as? String, let action = TimeFitDiagnosticAction(rawValue: rawAction),
          [.boot, .foreground, .receipt, .screen, .pending, .route].contains(action),
          let attemptId = value["attemptId"] as? String, let stage = value["stage"] as? String,
          let rawResult = value["result"] as? String, let result = TimeFitDiagnosticResult(rawValue: rawResult),
          let rawError = value["error"] as? String, let diagnosticError = TimeFitDiagnosticError(rawValue: rawError) else {
      resolve(false); return
    }
    resolve(TimeFitLiveActivityDiagnosticStore.record(
      stream: .app, action: action, attemptId: attemptId, stage: stage, result: result, error: diagnosticError,
      phase: value["phase"] as? String, revision: value["revision"] as? Int
    ))
  }

  @objc
  func readLiveActivityDiagnostics(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in enqueue {
      do {
        let report = try TimeFitLiveActivityDiagnosticStore.read()
        resolve(["schemaVersion": TimeFitLiveActivityDiagnosticStore.schemaVersion, "build": self.installedBuildIdentity(),
          "intent": (report[.intent] ?? []).map(self.diagnosticEvent), "app": (report[.app] ?? []).map(self.diagnosticEvent)])
      } catch { reject("live_activity_diagnostics_read_failed", "Diagnostics could not be read", error) }
    } }
  }

  @objc
  func copyLiveActivityDiagnostics(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in enqueue {
      do {
        let report = try TimeFitLiveActivityDiagnosticStore.read()
        let payload: [String: Any] = ["schemaVersion": TimeFitLiveActivityDiagnosticStore.schemaVersion,
          "build": self.installedBuildIdentity(), "intent": (report[.intent] ?? []).map(self.diagnosticEvent),
          "app": (report[.app] ?? []).map(self.diagnosticEvent)]
        let data = try JSONSerialization.data(withJSONObject: payload, options: [.prettyPrinted, .sortedKeys])
        UIPasteboard.general.string = String(data: data, encoding: .utf8)
        resolve(["status": "copied", "entryCount": (report[.intent]?.count ?? 0) + (report[.app]?.count ?? 0)])
      } catch { reject("live_activity_diagnostics_copy_failed", "Diagnostics could not be copied", error) }
    } }
  }

  @objc
  func clearLiveActivityDiagnostics(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    do { try TimeFitLiveActivityDiagnosticStore.clear(); resolve(nil) }
    catch { reject("live_activity_diagnostics_clear_failed", "Diagnostics could not be cleared", error) }
  }

#if DEBUG
  @objc
  func startFixture(
    _ value: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in
      enqueue {
        guard let payload = TimeFitDecodedActivityPayload.decode(value, expectedPurpose: "test_fixture") else {
          resolve(["status": "invalid_input"]); return
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
          resolve(["status": "disabled"]); return
        }
        if Activity<TimeFitActivityAttributes>.activities.contains(where: {
          TimeFitActivityIdentityPolicy.purpose($0.attributes) == "test_fixture"
        }) {
          resolve(["status": "cleanup_required"]); return
        }
        do {
          let activity = try await self.start(payload)
          resolve([
            "status": "started", "activityId": activity.id,
            "activity": self.identity(activity), "applicationState": self.applicationStateName(),
          ])
        } catch { reject("live_activity_start_failed", "Test Live Activity could not start", error) }
      }
    }
  }

  @objc
  func endFixtureExact(
    _ value: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    endExact(value, expectedPurpose: "test_fixture", resolve: resolve, reject: reject)
  }
#endif

  @objc
  func startCourseProgress(
    _ value: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in
      enqueue {
        guard let payload = TimeFitDecodedActivityPayload.decode(value, expectedPurpose: "course_progress") else {
          resolve(["status": "invalid_input"]); return
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
          resolve(["status": "disabled"]); return
        }
        let courses = Activity<TimeFitActivityAttributes>.activities.filter {
          TimeFitActivityIdentityPolicy.purpose($0.attributes) == "course_progress"
        }
        if let conflict = courses.first(where: { $0.attributes.courseRunId != payload.courseRunId }) {
          resolve(["status": "conflict", "conflictingRunId": conflict.attributes.courseRunId]); return
        }
        if let same = courses.first(where: { $0.attributes.courseRunId == payload.courseRunId }) {
          resolve([
            "status": "already_active", "activity": self.identity(same),
            "applicationState": self.applicationStateName(),
          ]); return
        }
        do {
          let activity = try await self.start(payload)
          resolve([
            "status": "started", "activity": self.identity(activity),
            "applicationState": self.applicationStateName(),
          ])
        } catch { reject("live_activity_start_failed", "Course Live Activity could not start", error) }
      }
    }
  }

  @objc
  func updateCourseProgress(
    _ value: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in
      enqueue {
        guard let payload = TimeFitDecodedActivityPayload.decode(value, expectedPurpose: "course_progress"),
              let activityId = value["activityId"] as? String, !activityId.isEmpty else {
          resolve(["status": "invalid_input"]); return
        }
        let courses = Activity<TimeFitActivityAttributes>.activities.filter {
          TimeFitActivityIdentityPolicy.purpose($0.attributes) == "course_progress"
        }
        if let conflict = courses.first(where: { $0.attributes.courseRunId != payload.courseRunId }) {
          resolve(["status": "conflict", "conflictingRunId": conflict.attributes.courseRunId]); return
        }
        guard let activity = courses.first(where: { $0.id == activityId && $0.attributes.courseRunId == payload.courseRunId }) else {
          resolve(["status": "not_found"]); return
        }
        guard payload.revision > activity.content.state.revision else {
          resolve(["status": "ignored_old_revision", "activity": self.identity(activity)]); return
        }
        await activity.update(ActivityContent(state: payload.state, staleDate: nil))
        do {
          try TimeFitLiveActivityTargetStore.upsert(.init(
            activityId: activity.id, purpose: payload.purpose, courseRunId: payload.courseRunId,
            schemaVersion: payload.schemaVersion, stopId: payload.stopId, revision: payload.revision
          ))
          resolve(["status": "updated", "activity": self.identity(activity)])
        } catch { reject("live_activity_update_failed", "Course Live Activity could not update", error) }
      }
    }
  }

  @objc
  func endCourseProgress(
    _ value: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    endExact(value, expectedPurpose: "course_progress", resolve: resolve, reject: reject)
  }

  private func endExact(
    _ value: NSDictionary,
    expectedPurpose: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in
      enqueue {
        guard let activityId = value["activityId"] as? String, !activityId.isEmpty,
              let courseRunId = value["courseRunId"] as? String, !courseRunId.isEmpty,
              let revision = value["revision"] as? Int, revision >= 1,
              value["purpose"] as? String == expectedPurpose,
              value["schemaVersion"] as? Int == TimeFitActivityIdentityPolicy.schemaVersion else {
          resolve(["status": "invalid_input"]); return
        }
        if expectedPurpose == "test_fixture", !TimeFitActivityIdentityPolicy.reservedFixtureRunId(courseRunId) {
          resolve(["status": "identity_mismatch"]); return
        }
        let activities = Activity<TimeFitActivityAttributes>.activities
        guard let activity = activities.first(where: { $0.id == activityId }) else {
          do {
            if expectedPurpose == "test_fixture" {
              try TimeFitLocalProgressReceiptWriter.removeDecodedFixtureReceipts(courseRunId: courseRunId)
            }
            try TimeFitLiveActivityTargetStore.remove(activityId: activityId, courseRunId: courseRunId, purpose: expectedPurpose)
            if expectedPurpose == "course_progress" { try TimeFitPendingNavigationActionStore.clearCourseRun(courseRunId) }
            resolve(["status": "already_ended"])
          } catch { resolve(["status": "end_failed"]) }
          return
        }
        guard activity.attributes.courseRunId == courseRunId,
              TimeFitActivityIdentityPolicy.purpose(activity.attributes) == expectedPurpose,
              activity.content.state.revision == revision else {
          resolve(["status": "identity_mismatch"]); return
        }
        do {
          await activity.end(nil, dismissalPolicy: .immediate)
          let remains = Activity<TimeFitActivityAttributes>.activities.contains(where: { $0.id == activityId })
          guard !remains else { resolve(["status": "end_failed"]); return }
          if expectedPurpose == "test_fixture" {
            try TimeFitLocalProgressReceiptWriter.removeDecodedFixtureReceipts(courseRunId: courseRunId)
          }
          try TimeFitLiveActivityTargetStore.remove(activityId: activityId, courseRunId: courseRunId, purpose: expectedPurpose)
          if expectedPurpose == "course_progress" { try TimeFitPendingNavigationActionStore.clearCourseRun(courseRunId) }
          resolve(["status": "ended"])
        } catch {
          resolve(["status": "end_failed"])
        }
      }
    }
  }
}
