import ActivityKit
import SwiftUI
import WidgetKit

private struct TimeFitLiveActivityView: View {
  let context: ActivityViewContext<TimeFitActivityAttributes>

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      Text(context.state.targetTitle).font(.headline).lineLimit(2)
      Text(context.state.phase == "dwelling" ? "머무는 중" : "이동 중")
        .font(.subheadline).foregroundStyle(.secondary)
      if context.state.phase == "dwelling", let departure = context.state.departureReminderAtMs {
        HStack(spacing: 4) {
          Text("출발 권장")
          Text(Date(timeIntervalSince1970: departure / 1000), style: .time)
        }
        .font(.caption).foregroundStyle(.secondary)
      } else if let arrival = context.state.arrivalPromptAtMs {
        HStack(spacing: 4) {
          Text("도착 확인 예정")
          Text(Date(timeIntervalSince1970: arrival / 1000), style: .time)
        }
        .font(.caption).foregroundStyle(.secondary)
      }
      if let stopId = context.state.activeStopId {
        HStack(spacing: 8) {
          if context.state.phase == "traveling" || context.state.phase == "arrival_pending" {
            Button(intent: TimeFitArrivalIntent(courseRunId: context.attributes.courseRunId, stopId: stopId, revision: context.state.revision)) {
              Text("도착했어요")
            }
            if !context.state.snoozeUsed, let nextBoundaryAtMs = context.state.nextBoundaryAtMs {
              Button(intent: TimeFitSnoozeIntent(courseRunId: context.attributes.courseRunId, stopId: stopId, revision: context.state.revision, nextBoundaryAtMs: nextBoundaryAtMs)) {
                Text("5분 뒤")
              }
            }
          } else if context.state.phase == "dwelling" || context.state.phase == "departure_due" {
            Button(intent: TimeFitDepartureIntent(courseRunId: context.attributes.courseRunId, stopId: stopId, revision: context.state.revision)) {
              Text("이제 출발해요")
            }
          }
        }.font(.caption.weight(.semibold))
      }
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
        DynamicIslandExpandedRegion(.leading) { Image(systemName: "figure.walk") }
        DynamicIslandExpandedRegion(.trailing) { Text("TimeFit").font(.caption) }
        DynamicIslandExpandedRegion(.bottom) {
          Text(context.state.targetTitle).lineLimit(1)
        }
      } compactLeading: {
        Image(systemName: "figure.walk")
      } compactTrailing: {
        Text(context.state.phase == "dwelling" ? "체류" : "이동")
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
