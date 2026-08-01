import { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { KakaoMap, KakaoMapView } from '@react-native-kakao/map';
import { LatLon } from '../engine';
import { C } from './theme';

const KAKAO_NATIVE_KEY =
  process.env.EXPO_PUBLIC_KAKAO_NATIVE_API_KEY
  ?? process.env.KAKAO_NATIVE_API_KEY
  ?? process.env.Kakao_NATIVE_API_KEY
  ?? '';

let initPromise: Promise<void> | null = null;

export type RouteMapMarker = {
  lat: number;
  lon: number;
  label: string;
  kind?: 'origin' | 'spot' | 'appointment';
};

type Props = {
  points: LatLon[];
  line: LatLon[];
  markers: RouteMapMarker[];
  style?: StyleProp<ViewStyle>;
};

export function KakaoRouteMap({ points, line, markers, style }: Props) {
  const [ready, setReady] = useState(false);
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const viewport = useMemo(() => makeViewport([...points, ...line]), [points, line]);

  useEffect(() => {
    let alive = true;
    if (!KAKAO_NATIVE_KEY) return;
    if (!initPromise) initPromise = KakaoMap.initializeKakaoMapSDK(KAKAO_NATIVE_KEY);
    initPromise
      .then(() => { if (alive) setReady(true); })
      .catch(() => { if (alive) setReady(false); });
    return () => { alive = false; };
  }, []);

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setLayout({ width, height });
  }

  if (!KAKAO_NATIVE_KEY) {
    return (
      <View style={[s.fallback, style]}>
        <Text style={s.fallbackTxt}>Kakao Native 키가 필요합니다.</Text>
      </View>
    );
  }

  return (
    <View style={[s.wrap, style]} onLayout={onLayout}>
      {ready ? (
        <KakaoMapView
          style={StyleSheet.absoluteFill}
          initialCamera={{ lat: viewport.center.lat, lng: viewport.center.lon, zoomLevel: viewport.zoomLevel }}
          camera={{ lat: viewport.center.lat, lng: viewport.center.lon, zoomLevel: viewport.zoomLevel }}
          cameraAnimationDuration={0}
          poiEnabled
          poiClickable={false}
          isShowCompass={false}
          isShowScaleBar={false}
        />
      ) : (
        <View style={s.loading}><Text style={s.fallbackTxt}>Kakao 지도 로드 중</Text></View>
      )}

      {layout.width > 0 && layout.height > 0 ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {lineToSegments(line, viewport, layout).map((seg, i) => (
            <View
              key={i}
              style={[
                s.segment,
                {
                  left: seg.x,
                  top: seg.y,
                  width: seg.length,
                  transform: [{ rotate: `${seg.angle}rad` }],
                },
              ]}
            />
          ))}
          {markers.map((m, i) => {
            const p = project({ lat: m.lat, lon: m.lon }, viewport, layout);
            return (
              <View key={`${m.label}-${i}`} style={[s.marker, markerStyle(m.kind), { left: p.x - 13, top: p.y - 13 }]}>
                <Text style={s.markerTxt}>{m.kind === 'origin' ? '출' : m.kind === 'appointment' ? '약' : String(i)}</Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

type Viewport = {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  center: LatLon;
  zoomLevel: number;
};

function makeViewport(points: LatLon[]): Viewport {
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const minLatRaw = Math.min(...lats);
  const maxLatRaw = Math.max(...lats);
  const minLonRaw = Math.min(...lons);
  const maxLonRaw = Math.max(...lons);
  const latPad = Math.max(0.003, (maxLatRaw - minLatRaw) * 0.35);
  const lonPad = Math.max(0.003, (maxLonRaw - minLonRaw) * 0.35);
  const minLat = minLatRaw - latPad;
  const maxLat = maxLatRaw + latPad;
  const minLon = minLonRaw - lonPad;
  const maxLon = maxLonRaw + lonPad;
  const span = Math.max(maxLat - minLat, maxLon - minLon);
  return {
    minLat,
    maxLat,
    minLon,
    maxLon,
    center: {
      lat: (minLat + maxLat) / 2,
      lon: (minLon + maxLon) / 2,
    },
    zoomLevel: zoomLevelFor(span),
  };
}

function zoomLevelFor(span: number): number {
  if (span < 0.01) return 3;
  if (span < 0.025) return 5;
  if (span < 0.06) return 7;
  if (span < 0.12) return 9;
  return 11;
}

function project(p: LatLon, viewport: Viewport, layout: { width: number; height: number }): { x: number; y: number } {
  const x = ((p.lon - viewport.minLon) / Math.max(viewport.maxLon - viewport.minLon, 0.00001)) * layout.width;
  const y = ((viewport.maxLat - p.lat) / Math.max(viewport.maxLat - viewport.minLat, 0.00001)) * layout.height;
  return { x, y };
}

function lineToSegments(line: LatLon[], viewport: Viewport, layout: { width: number; height: number }) {
  const pts = line.map((p) => project(p, viewport, layout));
  const segs: Array<{ x: number; y: number; length: number; angle: number }> = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length < 2) continue;
    segs.push({ x: a.x, y: a.y, length, angle: Math.atan2(dy, dx) });
  }
  return segs;
}

function markerStyle(kind: RouteMapMarker['kind']) {
  if (kind === 'origin') return { backgroundColor: C.accent };
  if (kind === 'appointment') return { backgroundColor: C.green };
  return { backgroundColor: '#f59e0b' };
}

const s = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: '#111820' },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111820' },
  fallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#111820' },
  fallbackTxt: { color: C.muted, fontSize: 12 },
  segment: {
    position: 'absolute',
    height: 4,
    borderRadius: 4,
    backgroundColor: C.accent,
    transformOrigin: '0px 2px',
  },
  marker: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  markerTxt: { color: '#081019', fontSize: 11, fontWeight: '900' },
});
