import assert from "node:assert/strict";
import test from "node:test";
import type { LatLon, Mode, Spot } from "../../src/engine";
import {
  evaluateCandidates,
  transportScenarioForCandidate,
} from "../../src/ui/recommendation/candidateEvaluation";
import { automaticTravelLegs, travelMin } from "../../src/engine";

const origin: LatLon = { lat: 35.1578, lon: 129.0594 };

function spot(contentId: string, title: string, overrides: Partial<Spot> = {}): Spot {
  return {
    contentId,
    title,
    typeId: "12",
    category: "문화시설",
    lat: 35.158,
    lon: 129.06,
    dwell: 30,
    dwellBase: 30,
    dwellSrc: "test",
    mult: 1,
    openNote: "test",
    confidence: "direct_match",
    strategy: "origin_area",
    ...overrides,
  };
}

const selected = spot("selected", "선택 장소", { siteGroupId: "same-place" });
const conflict = spot("conflict", "같은 단지", { siteGroupId: "same-place" });
const available = spot("available", "추가 장소", { siteGroupId: "other-place" });

const input = {
  spots: [selected, conflict, available],
  selected: [selected],
  selectedIds: [selected.contentId],
  origin,
  target: { lat: 35.16, lon: 129.062 },
  hasAppointment: true,
  remainingMin: 150,
  selectedArrivalModes: { selected: "walk" as Mode },
  recommendationById: new Map(),
};

test("후보 계산은 이미 담은 장소와 동일 단지 충돌을 분리하고 가능한 수단만 제안한다", () => {
  const candidates = evaluateCandidates(input);
  const selectedItem = candidates.find((item) => item.spot.contentId === "selected");
  const conflictItem = candidates.find((item) => item.spot.contentId === "conflict");
  const availableItem = candidates.find((item) => item.spot.contentId === "available");

  assert.equal(selectedItem?.status, "good");
  assert.equal(conflictItem?.siteConflict, true);
  assert.equal(conflictItem?.status, "over");
  assert.ok(availableItem?.availableModes.length);
  assert.ok(availableItem?.suggestedMode);
});

test("수단별 시나리오는 선택한 접근 수단과 다음 구간 수단을 각각 보존한다", () => {
  const scenario = transportScenarioForCandidate(input, available, "walk");

  assert.equal(scenario.mode, "walk");
  assert.ok(scenario.approachMin >= 0);
  assert.ok(scenario.onwardMin >= 0);
  assert.ok(["walk", "transit", "car"].includes(scenario.onwardMode));
});

test("장소 상세의 이동·체류·남는 시간은 같은 전체 코스 예산으로 합산된다", () => {
  const scenario = transportScenarioForCandidate(input, available, "walk");
  const trial = [...input.selected, available];
  const plan = automaticTravelLegs(
    trial,
    input.origin,
    input.target,
    { ...input.selectedArrivalModes, [available.contentId]: "walk" },
  );
  const expectedMove = plan.reduce(
    (sum, leg) => sum + travelMin(leg.from, leg.to, leg.mode),
    0,
  );

  assert.equal(scenario.totalMoveMin, expectedMove);
  assert.equal(
    scenario.totalMoveMin + scenario.totalStayMin + scenario.remainingAfterPlannedMin,
    input.remainingMin,
  );
  assert.ok(scenario.stayPossibleMin >= scenario.totalStayMin / trial.length);
});
