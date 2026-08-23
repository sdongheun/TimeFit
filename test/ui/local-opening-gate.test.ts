import assert from "node:assert/strict";
import test from "node:test";
import { passesLocalOpeningGate } from "../../src/engine/localOpeningGate";
import type { Spot } from "../../src/engine/types";

const origin = { lat: 35.1578, lon: 129.0594 };

function spot(overrides: Partial<Spot> = {}): Spot {
  return {
    title: "테스트 카페",
    contentId: "local-opening-test",
    typeId: "39",
    category: "카페",
    availabilityProfile: "facility",
    lat: 35.158,
    lon: 129.06,
    dwell: 60,
    dwellBase: 60,
    dwellSrc: "test",
    mult: 1,
    openNote: "",
    confidence: "direct_match",
    strategy: "origin_area",
    ...overrides,
  };
}

test("시설형 장소는 도착 후 최소 체류까지 공식 운영시간 안에 있어야 지도 후보가 된다", () => {
  assert.equal(
    passesLocalOpeningGate({
      spot: spot({ operatingHours: ["10:00~22:00"] }),
      origin,
      mode: "walk",
      nowMin: 14 * 60,
      arrivalMarginMin: 10,
    }),
    true,
  );
  assert.equal(
    passesLocalOpeningGate({
      spot: spot({ operatingHours: ["10:00~14:20"] }),
      origin,
      mode: "walk",
      nowMin: 14 * 60,
      arrivalMarginMin: 10,
    }),
    false,
  );
});

test("운영시간이 없는 시설은 조건부 지도 후보로 남기되 자동 확정은 별도 검증에서 막는다", () => {
  assert.equal(
    passesLocalOpeningGate({
      spot: spot({ operatingHours: undefined }),
      origin,
      mode: "walk",
      nowMin: 14 * 60,
      arrivalMarginMin: 10,
    }),
    true,
  );
});

test("자연관광 야외 장소는 별도 운영시간이 없어도 지도 후보가 될 수 있다", () => {
  assert.equal(
    passesLocalOpeningGate({
      spot: spot({
        title: "해변 산책로",
        category: "자연관광지",
        availabilityProfile: "outdoor",
        operatingHours: undefined,
      }),
      origin,
      mode: "walk",
      nowMin: 14 * 60,
      arrivalMarginMin: 10,
    }),
    true,
  );
});

test("시간대 정책이 등록되지 않은 시장·거리·골목은 조건부 지도 후보로 남긴다", () => {
  assert.equal(
    passesLocalOpeningGate({
      spot: spot({
        title: "검증되지 않은 시장",
        contentId: "unknown-market",
        category: "상업지구",
        subCategory: "시장",
        availabilityProfile: "area",
      }),
      origin,
      mode: "walk",
      nowMin: 14 * 60,
      arrivalMarginMin: 10,
    }),
    true,
  );
});
