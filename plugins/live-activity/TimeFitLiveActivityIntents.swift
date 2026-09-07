import ActivityKit
import AppIntents
import Foundation
import UserNotifications

private enum TimeFitProgressIntentFailure: Error { case rejected }

@MainActor private func applyProgressIntent(
  type: String,
  courseRunId: String,
  stopId: String,
  revision: Int,
  nextBoundaryAtMs: Double? = nil,
  attemptId: String
) async throws {
  let diagnosticAction: TimeFitDiagnosticAction = type == "arrival_confirmed" ? .arrival : (type == "arrival_snoozed" ? .snooze : .departure)
  TimeFitLiveActivityDiagnosticStore.record(stream: .intent, action: diagnosticAction, attemptId: attemptId, stage: "intent_entered", result: .started, revision: revision)
  let target = TimeFitLiveActivityTargetStore.courseTarget(courseRunId: courseRunId, stopId: stopId, revision: revision)
  guard case let .found(activity) = target else {
    let error: TimeFitDiagnosticError
    let recordMatch: Bool
    let found: Bool
    switch target {
    case .targetRecordMismatch: error = .targetRecordMismatch; recordMatch = false; found = false
    case .activityMissing: error = .activityMissing; recordMatch = true; found = false
    case .identityMismatch: error = .identityMismatch; recordMatch = true; found = true
    case .found: error = .unknown; recordMatch = true; found = true
    }
    TimeFitLiveActivityDiagnosticStore.record(stream: .intent, action: diagnosticAction, attemptId: attemptId, stage: "target_lookup", result: .rejected, error: error, revision: revision, targetRecordMatch: recordMatch, activityFound: found, identityMatch: false)
    throw TimeFitProgressIntentFailure.rejected
  }
  TimeFitLiveActivityDiagnosticStore.record(stream: .intent, action: diagnosticAction, attemptId: attemptId, stage: "target_lookup", result: .succeeded, phase: activity.content.state.phase, revision: revision, targetRecordMatch: true, activityFound: true, identityMatch: true)
  let nowMs = Date().timeIntervalSince1970 * 1000
  let eventId = UUID().uuidString.lowercased()
  let ownedNotificationId = type == "arrival_snoozed" ? "timefit-course-snooze:\(UUID().uuidString.lowercased())" : nil
  var event = TimeFitLocalProgressEventReceipt(
    schemaVersion: 1, purpose: "course_progress", courseRunId: courseRunId, stopId: stopId,
    eventId: eventId, baseRevision: revision, source: "live_activity_intent", type: type,
    occurredAtMs: nowMs, nextBoundaryAtMs: nextBoundaryAtMs, notificationId: ownedNotificationId
  )
  // Snapshot at the action, not when JS later resumes. Optional storage failure never rejects progress.
  if type == "arrival_confirmed" {
    event.evidence = try? TimeFitLearningEvidenceStore.readActive(courseRunId, at: TimeFitLearningEvidenceStore.root())
    if event.evidence == nil { try? TimeFitLearningEvidenceStore.clearExact(courseRunId, at: TimeFitLearningEvidenceStore.root()) }
  }
  let current = activity.content.state
  var phase = current.phase
  var arrivalPromptAtMs = current.arrivalPromptAtMs
  var snoozeUsed = current.snoozeUsed
  if type == "arrival_confirmed" || type == "departure_confirmed" {
    guard let nextPhase = TimeFitNativeIntentPolicy.phase(after: type, current: current.phase) else {
      TimeFitLiveActivityDiagnosticStore.record(stream: .intent, action: diagnosticAction, attemptId: attemptId, stage: "phase_validation", result: .rejected, error: .identityMismatch, phase: current.phase, revision: revision, targetRecordMatch: true, activityFound: true, identityMatch: true)
      throw TimeFitProgressIntentFailure.rejected
    }
    phase = nextPhase
  }
  else if type == "arrival_snoozed" {
    guard case let .scheduled(snoozed) = TimeFitNativeProgressPolicy.snooze(
      phase: current.phase, snoozeUsed: current.snoozeUsed, nowMs: nowMs,
      promptAtMs: current.arrivalPromptAtMs, requestedBoundaryAtMs: nextBoundaryAtMs,
      storedBoundaryAtMs: current.nextBoundaryAtMs
    ) else {
      TimeFitLiveActivityDiagnosticStore.record(stream: .intent, action: diagnosticAction, attemptId: attemptId, stage: "phase_validation", result: .rejected, error: .identityMismatch, phase: current.phase, revision: revision, targetRecordMatch: true, activityFound: true, identityMatch: true)
      throw TimeFitProgressIntentFailure.rejected
    }
    arrivalPromptAtMs = snoozed
    snoozeUsed = true
  } else if type != "arrival_confirmed" && type != "departure_confirmed" {
    TimeFitLiveActivityDiagnosticStore.record(stream: .intent, action: diagnosticAction, attemptId: attemptId, stage: "phase_validation", result: .rejected, error: .identityMismatch, phase: current.phase, revision: revision)
    throw TimeFitProgressIntentFailure.rejected
  }

  let pending = type == "departure_confirmed" ? TimeFitPendingNavigationAction(
    schemaVersion: 1, purpose: "course_progress_navigation", actionId: eventId,
    courseRunId: courseRunId, stopId: stopId, baseRevision: revision, state: "pending"
  ) : nil
  if let pending {
    do {
      TimeFitLiveActivityDiagnosticStore.record(stream: .intent, action: diagnosticAction, attemptId: attemptId, stage: "pending_write_before", result: .started, phase: current.phase, revision: revision)
      let activeCourseRunIds = Set(Activity<TimeFitActivityAttributes>.activities.compactMap {
        TimeFitActivityIdentityPolicy.purpose($0.attributes) == "course_progress" ? $0.attributes.courseRunId : nil
      })
      let decision = try TimeFitPendingNavigationActionStore.create(pending, activeCourseRunIds: activeCourseRunIds)
      if decision == .replaceOrphan {
        TimeFitLiveActivityDiagnosticStore.record(stream: .intent, action: diagnosticAction, attemptId: attemptId, stage: "pending_orphan_replaced", result: .observed, phase: current.phase, revision: revision)
      }
      TimeFitLiveActivityDiagnosticStore.record(stream: .intent, action: diagnosticAction, attemptId: attemptId, stage: "pending_write_after", result: .succeeded, phase: current.phase, revision: revision)
    }
    catch {
      TimeFitLiveActivityDiagnosticStore.record(stream: .intent, action: diagnosticAction, attemptId: attemptId, stage: "pending_write_after", result: .failed, error: .pendingWriteFailed, phase: current.phase, revision: revision)
      throw error
    }
  }
  do {
    TimeFitLiveActivityDiagnosticStore.record(stream: .intent, action: diagnosticAction, attemptId: attemptId, stage: "receipt_write_before", result: .started, phase: current.phase, revision: revision)
    try TimeFitLocalProgressReceiptWriter.write(event)
    TimeFitLiveActivityDiagnosticStore.record(stream: .intent, action: diagnosticAction, attemptId: attemptId, stage: "receipt_write_after", result: .succeeded, phase: current.phase, revision: revision)
    if pending != nil { TimeFitPendingNavigationSignal.post() }
  }
  catch {
    if pending != nil { try? TimeFitPendingNavigationActionStore.clearExact(actionId: eventId, courseRunId: courseRunId) }
    TimeFitLiveActivityDiagnosticStore.record(stream: .intent, action: diagnosticAction, attemptId: attemptId, stage: "receipt_write_after", result: .failed, error: .receiptWriteFailed, phase: current.phase, revision: revision)
    throw error
  }

  if type == "arrival_snoozed", let atMs = arrivalPromptAtMs, let boundary = current.nextBoundaryAtMs, let notificationId = ownedNotificationId {
    let content = UNMutableNotificationContent()
    content.title = current.targetTitle
    content.body = "도착했다면 알려주세요."
    content.categoryIdentifier = "timefit-course-arrival-v1"
    content.userInfo = [
      "purpose": "course_progress", "courseRunId": courseRunId, "stopId": stopId,
      "revision": revision + 1, "nextBoundaryAtMs": boundary,
    ]
    let seconds = max(1, (atMs - nowMs) / 1000)
    let request = UNNotificationRequest(identifier: notificationId, content: content,
      trigger: UNTimeIntervalNotificationTrigger(timeInterval: seconds, repeats: false))
    try? await UNUserNotificationCenter.current().add(request)
  }
  let next = TimeFitActivityAttributes.ContentState(
    activeStopId: current.activeStopId, phase: phase, revision: revision + 1,
    targetTitle: current.targetTitle, arrivalPromptAtMs: arrivalPromptAtMs,
    nextBoundaryAtMs: current.nextBoundaryAtMs, departureReminderAtMs: current.departureReminderAtMs,
    snoozeUsed: snoozeUsed
  )
  TimeFitLiveActivityDiagnosticStore.record(stream: .intent, action: diagnosticAction, attemptId: attemptId, stage: "activity_update_requested", result: .started, phase: phase, revision: revision + 1)
  await activity.update(ActivityContent(state: next, staleDate: nil))
  // ActivityKit의 activity 인스턴스 snapshot은 update 반환 직후에도 이전 content를
  // 노출할 수 있다. 요청된 next를 이 intent의 단일 writer 결과로 사용하고,
  // 다음 intent의 target lookup에서 stable identity/revision을 다시 검증한다.
  TimeFitLiveActivityDiagnosticStore.record(stream: .intent, action: diagnosticAction, attemptId: attemptId, stage: "activity_update_completed", result: .succeeded, phase: phase, revision: revision + 1)
  do {
    TimeFitLiveActivityDiagnosticStore.record(stream: .intent, action: diagnosticAction, attemptId: attemptId, stage: "target_write_before", result: .started, phase: phase, revision: revision + 1)
    try TimeFitLiveActivityTargetStore.upsert(.init(
      activityId: activity.id, purpose: "course_progress", courseRunId: courseRunId,
      schemaVersion: activity.attributes.schemaVersion, stopId: stopId, revision: revision + 1
    ))
    TimeFitLiveActivityDiagnosticStore.record(stream: .intent, action: diagnosticAction, attemptId: attemptId, stage: "target_write_after", result: .succeeded, phase: phase, revision: revision + 1)
  } catch {
    TimeFitLiveActivityDiagnosticStore.record(stream: .intent, action: diagnosticAction, attemptId: attemptId, stage: "target_write_after", result: .failed, error: .targetUpdateFailed, phase: phase, revision: revision + 1)
    throw error
  }
  TimeFitLiveActivityDiagnosticStore.record(stream: .intent, action: diagnosticAction, attemptId: attemptId, stage: "perform_completed", result: .succeeded, phase: phase, revision: revision + 1)
}

@MainActor private func performProgressIntent(type: String, courseRunId: String, stopId: String, revision: Int, nextBoundaryAtMs: Double? = nil) async throws {
  let attemptId = TimeFitLiveActivityDiagnosticStore.newAttemptId()
  let action: TimeFitDiagnosticAction = type == "arrival_confirmed" ? .arrival : (type == "arrival_snoozed" ? .snooze : .departure)
  do {
    try await applyProgressIntent(type: type, courseRunId: courseRunId, stopId: stopId, revision: revision, nextBoundaryAtMs: nextBoundaryAtMs, attemptId: attemptId)
  } catch {
    TimeFitLiveActivityDiagnosticStore.record(stream: .intent, action: action, attemptId: attemptId, stage: "perform_failed", result: .failed, error: .unknown, revision: revision)
    throw error
  }
}

struct TimeFitArrivalIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "도착 확인"
  @Parameter(title: "Course Run") var courseRunId: String
  @Parameter(title: "Stop") var stopId: String
  @Parameter(title: "Revision") var revision: Int
  init() {}
  init(courseRunId: String, stopId: String, revision: Int) { self.courseRunId = courseRunId; self.stopId = stopId; self.revision = revision }
  func perform() async throws -> some IntentResult {
    try await performProgressIntent(type: "arrival_confirmed", courseRunId: courseRunId, stopId: stopId, revision: revision)
    return .result()
  }
}

struct TimeFitSnoozeIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "5분 뒤 다시 알림"
  @Parameter(title: "Course Run") var courseRunId: String
  @Parameter(title: "Stop") var stopId: String
  @Parameter(title: "Revision") var revision: Int
  @Parameter(title: "Next boundary") var nextBoundaryAtMs: Double
  init() {}
  init(courseRunId: String, stopId: String, revision: Int, nextBoundaryAtMs: Double) {
    self.courseRunId = courseRunId; self.stopId = stopId; self.revision = revision; self.nextBoundaryAtMs = nextBoundaryAtMs
  }
  func perform() async throws -> some IntentResult {
    try await performProgressIntent(type: "arrival_snoozed", courseRunId: courseRunId, stopId: stopId, revision: revision, nextBoundaryAtMs: nextBoundaryAtMs)
    return .result()
  }
}

struct TimeFitDepartureIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "출발 확인"
  static var openAppWhenRun: Bool { true }
  @Parameter(title: "Course Run") var courseRunId: String
  @Parameter(title: "Stop") var stopId: String
  @Parameter(title: "Revision") var revision: Int
  init() {}
  init(courseRunId: String, stopId: String, revision: Int) { self.courseRunId = courseRunId; self.stopId = stopId; self.revision = revision }
  func perform() async throws -> some IntentResult {
    try await performProgressIntent(type: "departure_confirmed", courseRunId: courseRunId, stopId: stopId, revision: revision)
    return .result()
  }
}
