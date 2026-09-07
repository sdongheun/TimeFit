import Foundation

@main struct LearningHarness {
  static func main() throws {
    if CommandLine.arguments.count == 2 {
      do { _ = try TimeFitLearningEvidenceStore.readScope(at: URL(fileURLWithPath: CommandLine.arguments[1])); exit(2) }
      catch { exit(0) }
    }
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: root) }
    let p = TimeFitLearningProjection(schemaVersion: 1, courseRunId: "fixture-run", evidenceRef: UUID().uuidString, captureGeneration: 1, publicationToken: nil)
    let active = TimeFitLearningProjection(schemaVersion: 1, courseRunId: p.courseRunId, evidenceRef: p.evidenceRef, captureGeneration: 1, publicationToken: UUID().uuidString)
    try TimeFitLearningEvidenceStore.setActiveRun(p.courseRunId, at: root)
    _ = try TimeFitLearningEvidenceStore.storePrepared(p, at: root)
    let preparedRead = try TimeFitLearningEvidenceStore.readActive(p.courseRunId, at: root); assert(preparedRead == nil)
    _ = try TimeFitLearningEvidenceStore.activate(active, at: root)
    _ = try TimeFitLearningEvidenceStore.storePrepared(p, at: root)
    let activeRead = try TimeFitLearningEvidenceStore.readActive(p.courseRunId, at: root); assert(activeRead == active)
    try TimeFitLearningEvidenceStore.locked(at: root) {
      let child = Process(); child.executableURL = URL(fileURLWithPath: CommandLine.arguments[0]); child.arguments = [root.path]
      try child.run(); child.waitUntilExit(); assert(child.terminationStatus == 0)
    }
    try TimeFitLearningEvidenceStore.clearExact("unrelated", at: root)
    let preservedRead = try TimeFitLearningEvidenceStore.readActive(p.courseRunId, at: root); assert(preservedRead == active)
    try TimeFitLearningEvidenceStore.clearExact(p.courseRunId, at: root)
    do { _ = try TimeFitLearningEvidenceStore.activate(active, at: root); fatalError("late activation") } catch {}
    do { _ = try TimeFitLearningEvidenceStore.storePrepared(p, at: root); fatalError("late prepare") } catch {}
    try TimeFitLearningEvidenceStore.setActiveRun("next", at: root)
    try TimeFitLearningEvidenceStore.clearExact(p.courseRunId, at: root)
    let nextRead = try TimeFitLearningEvidenceStore.readScope(at: root); assert(nextRead == "next")
    print("PASS learning projection")
  }
}
