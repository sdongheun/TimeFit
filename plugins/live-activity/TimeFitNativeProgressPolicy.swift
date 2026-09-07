import Foundation

enum TimeFitNativeSnoozeDecision: Equatable {
  case scheduled(atMs: Double)
  case rejected
}

enum TimeFitNativeProgressPolicy {
  static func snooze(
    phase: String,
    snoozeUsed: Bool,
    nowMs: Double,
    promptAtMs: Double?,
    requestedBoundaryAtMs: Double?,
    storedBoundaryAtMs: Double?
  ) -> TimeFitNativeSnoozeDecision {
    guard (phase == "traveling" || phase == "arrival_pending"), !snoozeUsed,
          nowMs.isFinite, let promptAtMs, promptAtMs.isFinite,
          let requestedBoundaryAtMs, requestedBoundaryAtMs.isFinite,
          let storedBoundaryAtMs, storedBoundaryAtMs.isFinite,
          requestedBoundaryAtMs == storedBoundaryAtMs else { return .rejected }
    let next = max(nowMs, promptAtMs) + 5 * 60 * 1000
    return next < storedBoundaryAtMs ? .scheduled(atMs: next) : .rejected
  }
}
