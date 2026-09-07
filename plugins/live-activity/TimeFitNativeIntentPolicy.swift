import Foundation

enum TimeFitPendingCreationDecision: Equatable { case reuse, replaceOrphan, reject }

enum TimeFitNativeIntentPolicy {
  static func phase(after action: String, current: String) -> String? {
    if action == "arrival_confirmed", current == "traveling" || current == "arrival_pending" { return "dwelling" }
    if action == "departure_confirmed", current == "dwelling" || current == "departure_due" { return "traveling" }
    return nil
  }

  static func permitsPendingTransition(from: String, to: String) -> Bool {
    (from == "pending" && to == "executing")
      || (from == "executing" && (to == "success" || to == "failure" || to == "executing"))
      || (from == "failure" && to == "executing")
  }

  static func pendingCreation(
    existingActionId: String,
    existingCourseRunId: String,
    requestedActionId: String,
    requestedCourseRunId: String,
    activeCourseRunIds: Set<String>
  ) -> TimeFitPendingCreationDecision {
    if existingActionId == requestedActionId && existingCourseRunId == requestedCourseRunId { return .reuse }
    if existingCourseRunId != requestedCourseRunId && !activeCourseRunIds.contains(existingCourseRunId) { return .replaceOrphan }
    return .reject
  }
}
