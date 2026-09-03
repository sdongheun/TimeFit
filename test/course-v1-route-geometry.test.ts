import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildReleaseOneStopRepresentativeCourseV1,
  buildRepresentativeCourseV1,
  COURSE_V1_ROUTE_GEOMETRY_PATH_LIMIT,
  continueReleaseOneStopRepresentativeCourseV1,
  type CourseV1Candidate,
  type CourseV1RouteGeometry,
  type CourseV1RouteReceiptAdapter,
} from '../src/engine/courseV1';

const now = new Date('2026-09-03T10:00:00+09:00');
const origin = { id: 'origin', lat: 35.15, lon: 129.06 };
const destination = { id: 'destination', lat: 35.16, lon: 129.07 };

function place(id: string): CourseV1Candidate {
  return {
    id, title: id, lat: 35.155, lon: 129.065, classification: 'representative_standard',
    minStayMin: 20, recommendedStayMin: 30, maxStayMin: 60,
    availability: { status: 'structured', alwaysAccessible: true, dayTypes: ['weekday', 'weekend'], windows: [] },
  };
}

const inbound: CourseV1RouteGeometry = {
  paths: [{ points: [{ lat: 35.15, lon: 129.06 }, { lat: 35.152, lon: 129.063 }, { lat: 35.155, lon: 129.065 }] }],
};
const outbound: CourseV1RouteGeometry = {
  paths: [
    { points: [{ lat: 35.155, lon: 129.065 }, { lat: 35.157, lon: 129.067 }] },
    { points: [{ lat: 35.157, lon: 129.067 }, { lat: 35.16, lon: 129.07 }] },
  ],
};

function geometryWithPathCount(pathCount: number): CourseV1RouteGeometry {
  return {
    paths: Array.from({ length: pathCount }, (_, index) => ({
      points: [
        { lat: 35.1 + index / 10_000, lon: 129.1 },
        { lat: 35.1001 + index / 10_000, lon: 129.1001 },
      ],
    })),
  };
}

function collectObjectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectObjectKeys(item, keys);
    return keys;
  }
  if (!value || typeof value !== 'object') return keys;
  for (const [key, child] of Object.entries(value)) {
    keys.add(key);
    collectObjectKeys(child, keys);
  }
  return keys;
}

function assertNoPrivateGeometryKeys(...values: unknown[]): void {
  const forbidden = new Set(['geometry', 'paths', 'points', 'lat', 'lon']);
  for (const value of values) {
    const found = [...collectObjectKeys(value)].filter((key) => forbidden.has(key));
    assert.deepEqual(found, []);
  }
}

function releaseInput(candidateList: CourseV1Candidate[], receiptRoutes: CourseV1RouteReceiptAdapter) {
  return {
    now, origin, destination, remainingMin: 120, arrivalBufferMin: 10,
    provider: { listRepresentativeCandidates: () => candidateList },
    routes: { async getRoute() { return null; } }, receiptRoutes,
  };
}

test('2-W: receipt의 walk/transit 두 geometry를 실제 leg 순서대로 snapshot에 복사한다', async () => {
  const result = await buildReleaseOneStopRepresentativeCourseV1(releaseInput([place('selected')], {
    async getRouteReceipt(from) {
      return from.id === 'origin'
        ? { result: 'exact', route: { mode: 'walk', min: 5, exact: true, geometry: inbound }, newProviderAttemptCount: 1, reused: false }
        : { result: 'exact', route: { mode: 'transit', min: 7, exact: true, geometry: outbound }, newProviderAttemptCount: 1, reused: false };
    },
  }));
  assert.deepEqual(result.representativeCourse?.legs, [
    { fromId: 'origin', toId: 'selected', mode: 'walk', min: 5, geometry: inbound },
    { fromId: 'selected', toId: 'destination', mode: 'transit', min: 7, geometry: outbound },
  ]);
});

test('2-W: geometry 없음·일부 손상·33 paths·513점·한 점·NaN·범위 밖은 geometry만 제거한다', async () => {
  const invalid: Array<CourseV1RouteGeometry | undefined> = [
    undefined,
    { paths: [{ points: inbound.paths[0]!.points }, { points: [{ lat: 35.1, lon: 129.1 }] }] },
    geometryWithPathCount(33),
    { paths: [{ points: Array.from({ length: 513 }, (_, index) => ({ lat: 35.1 + index / 100_000, lon: 129.1 })) }] },
    { paths: [{ points: [{ lat: 35.1, lon: 129.1 }] }] },
    { paths: [{ points: [{ lat: Number.NaN, lon: 129.1 }, { lat: 35.2, lon: 129.2 }] }] },
    { paths: [{ points: [{ lat: 91, lon: 129.1 }, { lat: 35.2, lon: 181 }] }] },
  ];
  for (const geometry of invalid) {
    const result = await buildReleaseOneStopRepresentativeCourseV1(releaseInput([place('selected')], {
      async getRouteReceipt(from) {
        return {
          result: 'exact', route: { mode: 'walk', min: from.id === 'origin' ? 5 : 7, exact: true, ...(geometry ? { geometry } : {}) },
          newProviderAttemptCount: 1, reused: false,
        };
      },
    }));
    assert.equal(result.representativeCourse?.id, 'selected');
    assert.equal(result.representativeCourse?.totalMin, 52);
    assert.ok(result.representativeCourse?.legs.every((leg) => leg.geometry === undefined));
  }
});

test('2-W: route당 32 paths는 보존하고 33 paths는 geometry만 제거한다', async () => {
  assert.equal(COURSE_V1_ROUTE_GEOMETRY_PATH_LIMIT, 32);
  const verify = async (geometry: CourseV1RouteGeometry) => buildReleaseOneStopRepresentativeCourseV1(releaseInput([place('selected')], {
    async getRouteReceipt(from) {
      return {
        result: 'exact', route: { mode: 'walk', min: from.id === 'origin' ? 5 : 7, exact: true, geometry },
        newProviderAttemptCount: 1, reused: false,
      };
    },
  }));
  const atLimit = await verify(geometryWithPathCount(32));
  const aboveLimit = await verify(geometryWithPathCount(33));
  assert.ok(atLimit.representativeCourse?.legs.every((leg) => leg.geometry?.paths.length === 32));
  assert.equal(aboveLimit.representativeCourse?.id, atLimit.representativeCourse?.id);
  assert.equal(aboveLimit.representativeCourse?.totalMin, atLimit.representativeCourse?.totalMin);
  assert.ok(aboveLimit.representativeCourse?.legs.every((leg) => leg.geometry === undefined));
});

test('2-W: legacy exact route도 검증된 geometry를 leg에 보존한다', async () => {
  const selected = place('selected');
  const result = await buildRepresentativeCourseV1({
    now, origin, destination, remainingMin: 120, arrivalBufferMin: 10, candidates: [selected],
    routes: {
      async getRoute(from) {
        return from.id === 'origin'
          ? { mode: 'walk', min: 5, exact: true, geometry: inbound }
          : { mode: 'transit', min: 7, exact: true, geometry: outbound };
      },
    },
  });
  assert.deepEqual(result.representativeCourse?.legs.map((leg) => leg.geometry), [inbound, outbound]);
});

test('2-W: geometry 유무는 ID·시간·attempt·continuation signature와 page 결과를 바꾸지 않는다', async () => {
  const list = Array.from({ length: 10 }, (_, index) => place(`p${String(index).padStart(2, '0')}`));
  const adapter = (withGeometry: boolean): CourseV1RouteReceiptAdapter => ({
    async getRouteReceipt(from) {
      return {
        result: 'exact',
        route: { mode: 'walk', min: 5, exact: true, ...(withGeometry ? { geometry: from.id === 'origin' ? inbound : outbound } : {}) },
        newProviderAttemptCount: 1, reused: false,
      };
    },
  });
  const without = await buildReleaseOneStopRepresentativeCourseV1(releaseInput(list, adapter(false)));
  const withGeometry = await buildReleaseOneStopRepresentativeCourseV1(releaseInput(list, adapter(true)));
  assert.deepEqual(
    [withGeometry.representativeCourse, ...withGeometry.alternativeCourses].map((course) => course?.id),
    [without.representativeCourse, ...without.alternativeCourses].map((course) => course?.id),
  );
  assert.equal(withGeometry.representativeCourse?.totalMin, without.representativeCourse?.totalMin);
  assert.equal(withGeometry.diagnostics.newProviderAttemptCount, without.diagnostics.newProviderAttemptCount);
  assert.equal(withGeometry.continuation?.candidateSetSignature, without.continuation?.candidateSetSignature);
  assertNoPrivateGeometryKeys(withGeometry.diagnostics, withGeometry.continuation);

  const withoutPage = await continueReleaseOneStopRepresentativeCourseV1({ ...releaseInput(list, adapter(false)), continuation: without.continuation! });
  const geometryPage = await continueReleaseOneStopRepresentativeCourseV1({ ...releaseInput(list, adapter(true)), continuation: withGeometry.continuation! });
  assert.deepEqual(geometryPage.appendedCourses.map((course) => course.id), withoutPage.appendedCourses.map((course) => course.id));
  assert.ok(geometryPage.appendedCourses.every((course) => course.legs.every((leg) => leg.geometry)));
  assert.equal(geometryPage.diagnostics.newProviderAttemptCount, withoutPage.diagnostics.newProviderAttemptCount);
  assertNoPrivateGeometryKeys(geometryPage.diagnostics, geometryPage.continuation);
  const serialized = JSON.stringify(withGeometry);
  assert.deepEqual(JSON.parse(serialized), withGeometry);
});
