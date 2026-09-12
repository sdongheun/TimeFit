import Foundation

@main
enum TimeFitNativeIntentPolicyHarness {
  static func main() {
    guard TimeFitNativeIntentPolicy.permitsCompletion(purpose: "course_progress", phase: "traveling", activeStopId: nil, eligible: true) else { fatalError("final completion") }
    for phase in ["dwelling", "departure_due", "completed", "cancelled"] {
      guard !TimeFitNativeIntentPolicy.permitsCompletion(purpose: "course_progress", phase: phase, activeStopId: nil, eligible: true) else { fatalError("non-final completion") }
    }
    guard !TimeFitNativeIntentPolicy.permitsCompletion(purpose: "test_fixture", phase: "traveling", activeStopId: nil, eligible: true),
      !TimeFitNativeIntentPolicy.permitsCompletion(purpose: "course_progress", phase: "traveling", activeStopId: "stop", eligible: true),
      !TimeFitNativeIntentPolicy.permitsCompletion(purpose: "course_progress", phase: "traveling", activeStopId: nil, eligible: false) else { fatalError("unsafe completion") }
    guard TimeFitNativeIntentPolicy.phase(after: "arrival_confirmed", current: "traveling") == "dwelling" else { fatalError("early arrival") }
    guard TimeFitNativeIntentPolicy.phase(after: "arrival_confirmed", current: "dwelling") == nil else { fatalError("duplicate arrival") }
    guard TimeFitNativeIntentPolicy.phase(after: "departure_confirmed", current: "dwelling") == "traveling" else { fatalError("departure") }
    guard TimeFitNativeIntentPolicy.phase(after: "departure_confirmed", current: "traveling") == nil else { fatalError("duplicate departure") }
    guard TimeFitNativeIntentPolicy.permitsPendingTransition(from: "pending", to: "executing") else { fatalError("claim") }
    guard !TimeFitNativeIntentPolicy.permitsPendingTransition(from: "executing", to: "pending") else { fatalError("rewind") }
    guard TimeFitNativeIntentPolicy.permitsPendingTransition(from: "executing", to: "failure") else { fatalError("failure") }
    guard TimeFitNativeIntentPolicy.permitsPendingTransition(from: "failure", to: "executing") else { fatalError("retry") }
    guard TimeFitNativeIntentPolicy.pendingCreation(
      existingActionId: "old", existingCourseRunId: "old-run", requestedActionId: "new",
      requestedCourseRunId: "new-run", activeCourseRunIds: ["new-run"]
    ) == .replaceOrphan else { fatalError("replace orphan pending") }
    guard TimeFitNativeIntentPolicy.pendingCreation(
      existingActionId: "old", existingCourseRunId: "old-run", requestedActionId: "new",
      requestedCourseRunId: "new-run", activeCourseRunIds: ["old-run", "new-run"]
    ) == .reject else { fatalError("preserve active run conflict") }
    guard TimeFitNativeIntentPolicy.pendingCreation(
      existingActionId: "same", existingCourseRunId: "run", requestedActionId: "same",
      requestedCourseRunId: "run", activeCourseRunIds: ["run"]
    ) == .reuse else { fatalError("idempotent same action") }
    guard TimeFitNativeIntentPolicy.pendingCreation(
      existingActionId: "old", existingCourseRunId: "run", requestedActionId: "new",
      requestedCourseRunId: "run", activeCourseRunIds: ["run"]
    ) == .reject else { fatalError("same run duplicate action") }
    print("PASS native intent policy")
  }
}
