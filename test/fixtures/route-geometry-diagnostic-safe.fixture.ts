export const routeGeometryDiagnosticSafeResult = Object.freeze({
  providerCallCount: 2,
  preflight: {
    keyPresent: true,
    officialCoordinatesValid: true,
    publicPairPresent: true,
    publicPairDistinct: true,
    publicPairDistance: '3_15km',
  },
  c1: {
    httpStatus: 200, contentType: 'json', errorCode: null, status: 'OK', routeCount: 15,
    stepModeOrder: ['transit', 'transit'],
    steps: [{ type: 'BUS', validPointCount: 78 }, { type: 'BUS', validPointCount: 53 }],
    firstStepType: 'BUS', lastStepType: 'BUS', startEndpointGap: '101_250m', endEndpointGap: '101_250m',
  },
  c2: {
    httpStatus: 200, contentType: 'json', errorCode: null, status: 'OK', routeCount: 14,
    stepModeOrder: ['transit'],
    steps: [{ type: 'BUS', validPointCount: 157 }],
    firstStepType: 'BUS', lastStepType: 'BUS', startEndpointGap: 'over_250m', endEndpointGap: '101_250m',
  },
});

export const routeGeometryAllRoutesDiagnosticSafeResult = Object.freeze({
  providerCallCount: 1,
  httpStatus: 200,
  contentType: 'json',
  errorCode: null,
  status: 'OK',
  routeCount: 14,
  truncated: false,
  routeTypeCounts: { BUS: 9, SUBWAY: 1, BUS_AND_SUBWAY: 4 },
  totalMinRange: { min: 34, max: 49 },
  transferCounts: { zero: 6, one: 8 },
  leadingWalkingPathCount: 0,
  terminalWalkingPathCount: 0,
  interiorWalkingRouteIndexes: [2, 6, 8, 9, 10],
  terminalGapCounts: { '51_100m': 2, '101_250m': 12 },
  verdict: 'R3',
});
