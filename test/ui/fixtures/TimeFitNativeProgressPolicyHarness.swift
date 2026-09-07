import Foundation

@main
enum TimeFitNativeProgressPolicyHarness {
  static func main() {
    let now = 1_000_000.0
    let first = TimeFitNativeProgressPolicy.snooze(
      phase: "traveling", snoozeUsed: false, nowMs: now,
      promptAtMs: now + 60_000, requestedBoundaryAtMs: now + 600_000,
      storedBoundaryAtMs: now + 600_000
    )
    guard first == .scheduled(atMs: now + 360_000) else { fatalError("first snooze") }
    guard TimeFitNativeProgressPolicy.snooze(
      phase: "traveling", snoozeUsed: true, nowMs: now + 1,
      promptAtMs: now + 360_000, requestedBoundaryAtMs: now + 600_000,
      storedBoundaryAtMs: now + 600_000
    ) == .rejected else { fatalError("same stop second snooze") }
    guard TimeFitNativeProgressPolicy.snooze(
      phase: "traveling", snoozeUsed: false, nowMs: now,
      promptAtMs: now + 500_000, requestedBoundaryAtMs: now + 600_000,
      storedBoundaryAtMs: now + 600_000
    ) == .rejected else { fatalError("boundary") }
    guard TimeFitNativeProgressPolicy.snooze(
      phase: "dwelling", snoozeUsed: false, nowMs: now,
      promptAtMs: now + 60_000, requestedBoundaryAtMs: now + 600_000,
      storedBoundaryAtMs: now + 600_000
    ) == .rejected else { fatalError("terminal phase") }
    guard TimeFitNativeProgressPolicy.snooze(
      phase: "traveling", snoozeUsed: false, nowMs: now,
      promptAtMs: now + 60_000, requestedBoundaryAtMs: now + 600_000,
      storedBoundaryAtMs: now + 600_000
    ) != .rejected else { fatalError("next stop independent") }
    print("PASS native snooze policy")
  }
}
