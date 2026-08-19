import assert from "node:assert/strict";
import test from "node:test";
import type { Course, Spot } from "../../src/engine";
import {
  candidateRecommendations,
  diversifyCandidateGroup,
  evaluateCandidateStatus,
  uniqueCandidateSpots,
} from "../../src/ui/recommendation/candidateModel";
import type { CandidateEval } from "../../src/ui/recommendation/types";

function spot(contentId: string, category = "카페"): Spot {
  return {
    contentId,
    title: contentId,
    typeId: "39",
    category,
    lat: 35.15,
    lon: 129.06,
    dwell: 40,
    dwellBase: 40,
    dwellSrc: "test",
    mult: 1,
    openNote: "test",
    confidence: "direct_match",
    strategy: "origin_area",
  };
}

function course(spots: Spot[], rankingScore: number, strategy: Course["strategy"]): Course {
  return {
    type: spots.length > 1 ? "미니코스" : "단일",
    spots,
    totalMin: 90,
    legs: [],
    bufferLeftMin: 10,
    rankingScore,
    strategy,
  };
}

function candidate(contentId: string, category: string, score: number): CandidateEval {
  return {
    spot: spot(contentId, category),
    moveMin: 10,
    stayPossibleMin: 40,
    bufferLeftMin: 10,
    status: "good",
    siteConflict: false,
    reason: "test",
    recommendationRank: 0,
    rankingScore: score,
    availableModes: ["walk"],
    recommendationStrategy: "origin_area",
  };
}

test("같은 장소가 여러 추천 코스에 있어도 후보는 한 번만 남긴다", () => {
  const a = spot("a");
  const b = spot("b");
  const items = uniqueCandidateSpots([
    course([a, b], 10, "origin_area"),
    course([a], 20, "destination_area"),
  ]);

  assert.deepEqual(items.map((item) => item.contentId), ["a", "b"]);
});

test("장소의 추천 근거는 가장 높은 순위 코스의 점수와 전략을 사용한다", () => {
  const a = spot("a");
  const recommendations = candidateRecommendations([
    course([a], 91, "origin_area"),
    course([a], 99, "destination_area"),
  ]);

  assert.deepEqual(recommendations.get("a"), {
    rank: 0,
    score: 91,
    strategy: "origin_area",
    why: undefined,
  });
});

test("후보 상태는 최소 체류와 안전 여유를 하드 조건으로 처리한다", () => {
  assert.equal(evaluateCandidateStatus(29, 30, 40, 8, true, true), "over");
  assert.equal(evaluateCandidateStatus(40, 30, 40, 8, true, true), "good");
  assert.equal(evaluateCandidateStatus(34, 30, 60, 8, true, true), "short");
  assert.equal(evaluateCandidateStatus(31, 30, 60, 8, true, true), "tight");
  assert.equal(evaluateCandidateStatus(25, 20, 60, 8, true, true), "tight");
});

test("다양성 정렬은 낮은 점수 후보를 앞세우지 않고 같은 카테고리 반복을 완화한다", () => {
  const ordered = diversifyCandidateGroup([
    candidate("cafe-1", "카페", 100),
    candidate("cafe-2", "카페", 98),
    candidate("culture", "문화시설", 98),
  ]);

  assert.equal(ordered[0]?.spot.contentId, "cafe-1");
  assert.equal(ordered[1]?.spot.contentId, "culture");
  assert.equal(ordered[2]?.spot.contentId, "cafe-2");
});
