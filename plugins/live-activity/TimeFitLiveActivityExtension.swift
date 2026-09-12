import ActivityKit
import SwiftUI
import WidgetKit

private struct TimeFitLiveStatus: View {
  let context: ActivityViewContext<TimeFitActivityAttributes>
  var body: some View {
    VStack(alignment: .leading, spacing: 5) {
      Text(context.state.targetTitle).font(.headline).fixedSize(horizontal: false, vertical: true)
      Text(context.state.phase == "dwelling" || context.state.phase == "departure_due" ? "머무는 중" : "이동 중")
        .font(.subheadline).foregroundStyle(.secondary)
      if let departure = context.state.departureReminderAtMs, context.state.phase == "dwelling" || context.state.phase == "departure_due" {
        Text("출발 권장 \(Date(timeIntervalSince1970: departure / 1000), style: .time)").font(.caption)
      } else if let arrival = context.state.arrivalPromptAtMs {
        Text("도착 확인 예정 \(Date(timeIntervalSince1970: arrival / 1000), style: .time)").font(.caption)
      }
    }
  }
}

private struct TimeFitLiveActions: View {
  let context: ActivityViewContext<TimeFitActivityAttributes>
  var body: some View {
    VStack(alignment: .trailing, spacing: 8) {
      if TimeFitNativeIntentPolicy.permitsCompletion(purpose: TimeFitActivityIdentityPolicy.purpose(context.attributes), phase: context.state.phase, activeStopId: context.state.activeStopId, eligible: context.state.completionEligible) {
        Button(intent: TimeFitCompletionIntent(courseRunId: context.attributes.courseRunId, revision: context.state.revision)) {
          Text("도착 후 코스 마치기").fixedSize(horizontal: false, vertical: true)
        }
      } else if let stopId = context.state.activeStopId {
        if context.state.phase == "traveling" || context.state.phase == "arrival_pending" {
          Button(intent: TimeFitArrivalIntent(courseRunId: context.attributes.courseRunId, stopId: stopId, revision: context.state.revision)) { Text("도착했어요") }
        } else if context.state.phase == "dwelling" || context.state.phase == "departure_due" {
          Button(intent: TimeFitDepartureIntent(courseRunId: context.attributes.courseRunId, stopId: stopId, revision: context.state.revision)) { Text("이제 출발해요") }
        }
      }
    }
    .font(.caption.weight(.semibold))
    .buttonStyle(.borderedProminent)
    .tint(.blue)
    .frame(maxWidth: 140, alignment: .trailing)
    .fixedSize(horizontal: false, vertical: true)
  }
}

private struct TimeFitLiveActivityView: View {
  let context: ActivityViewContext<TimeFitActivityAttributes>
  var body: some View {
    HStack(alignment: .center, spacing: 12) {
      TimeFitLiveStatus(context: context).frame(maxWidth: .infinity, alignment: .leading)
      TimeFitLiveActions(context: context)
    }
    .padding()
    .activityBackgroundTint(Color(red: 0.04, green: 0.07, blue: 0.14))
    .activitySystemActionForegroundColor(.white)
  }
}

struct TimeFitLiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: TimeFitActivityAttributes.self) { context in
      TimeFitLiveActivityView(context: context)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) { TimeFitLiveStatus(context: context) }
        DynamicIslandExpandedRegion(.trailing) { TimeFitLiveActions(context: context) }
      } compactLeading: {
        Image(systemName: "figure.walk")
      } compactTrailing: {
        Text(context.state.phase == "dwelling" || context.state.phase == "departure_due" ? "체류" : "이동")
      } minimal: {
        Image(systemName: "figure.walk")
      }
    }
  }
}

@main
struct TimeFitLiveActivityBundle: WidgetBundle {
  var body: some Widget {
    TimeFitLiveActivityWidget()
  }
}

#if DEBUG
private let timeFitPreviewAttributes = TimeFitActivityAttributes(
  schemaVersion: 1,
      courseRunId: TimeFitActivityIdentityPolicy.fixtureRunId,
  purpose: "test_fixture"
)
private let timeFitPreviewState = TimeFitActivityAttributes.ContentState(
  activeStopId: "stop:preview",
  phase: "traveling",
  revision: 1,
  targetTitle: "부산시민공원",
  arrivalPromptAtMs: Date().addingTimeInterval(15 * 60).timeIntervalSince1970 * 1000,
  nextBoundaryAtMs: Date().addingTimeInterval(45 * 60).timeIntervalSince1970 * 1000,
  departureReminderAtMs: nil,
  snoozeUsed: false
)

#Preview("잠금 화면", as: .content, using: timeFitPreviewAttributes) {
  TimeFitLiveActivityWidget()
} contentStates: {
  timeFitPreviewState
}

#Preview("Dynamic Island 확장", as: .dynamicIsland(.expanded), using: timeFitPreviewAttributes) {
  TimeFitLiveActivityWidget()
} contentStates: {
  timeFitPreviewState
}

#Preview("Dynamic Island 축소", as: .dynamicIsland(.compact), using: timeFitPreviewAttributes) {
  TimeFitLiveActivityWidget()
} contentStates: {
  timeFitPreviewState
}

#Preview("Dynamic Island 최소", as: .dynamicIsland(.minimal), using: timeFitPreviewAttributes) {
  TimeFitLiveActivityWidget()
} contentStates: {
  timeFitPreviewState
}
#endif
