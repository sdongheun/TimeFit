import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { LatLon } from '../engine';
import { C } from './theme';

const KAKAO_WEBVIEW_BASE_URL = 'https://timefit.local';
const KAKAO_JS_KEY =
  process.env.EXPO_PUBLIC_KAKAO_JAVASCRIPT_API_KEY
  ?? process.env.KAKAO_JAVASCRIPT_API_KEY
  ?? process.env.Kakao_JAVASCRIPT_API_KEY
  ?? '';

export type RouteMapMarker = {
  lat: number;
  lon: number;
  label: string;
  kind?: 'origin' | 'spot' | 'appointment';
};

export type RouteMapSegment = {
  points: LatLon[];
  quality: 'precise' | 'approx' | 'fallback';
};

export function buildRouteMapSegments(points: LatLon[], travelLegs: Array<{ geo?: LatLon[]; src?: string }>): RouteMapSegment[] {
  return travelLegs.map((leg, i) => {
    const geo = normalizeRoutePoints(leg.geo);
    const hasGeo = geo.length > 1;
    const quality: RouteMapSegment['quality'] =
      leg.src === 'TMAP' && geo.length >= 4 ? 'precise' : hasGeo ? 'approx' : 'fallback';
    return {
      points: hasGeo ? geo : [points[i], points[i + 1]].filter(Boolean),
      quality,
    };
  }).filter((seg) => seg.points.length > 1);
}

function normalizeRoutePoints(points?: LatLon[]): LatLon[] {
  if (!points) return [];
  const out: LatLon[] = [];
  for (const p of points) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) continue;
    const last = out[out.length - 1];
    if (last && Math.abs(last.lat - p.lat) < 0.00001 && Math.abs(last.lon - p.lon) < 0.00001) continue;
    out.push(p);
  }
  return out;
}

type Props = {
  points: LatLon[];
  line: LatLon[];
  markers: RouteMapMarker[];
  segments?: RouteMapSegment[];
  style?: StyleProp<ViewStyle>;
};

export function KakaoRouteMap({ points, line, markers, segments, style }: Props) {
  const ref = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const routeSegments = useMemo(
    () => segments?.length ? segments : [{ points: line, quality: 'fallback' as const }],
    [segments, line],
  );
  const routePoints = useMemo(() => routeSegments.flatMap((seg) => seg.points), [routeSegments]);
  const hasApprox = routeSegments.some((seg) => seg.quality === 'approx');
  const hasFallback = routeSegments.some((seg) => seg.quality === 'fallback');
  const center = useMemo(() => centerOf([...points, ...routePoints]), [points, routePoints]);
  const html = useMemo(() => buildHtml(center), []);

  useEffect(() => {
    if (!ready) return;
    const route = JSON.stringify({ markers, segments: routeSegments });
    ref.current?.injectJavaScript(`setRoute(${route});true;`);
  }, [ready, markers, routeSegments]);

  if (!KAKAO_JS_KEY) {
    return (
      <View style={[s.fallback, style]}>
        <Text style={s.fallbackTitle}>Kakao 지도 키가 필요합니다.</Text>
        <Text style={s.fallbackTxt}>EXPO_PUBLIC_KAKAO_JAVASCRIPT_API_KEY를 .env에 추가하세요.</Text>
      </View>
    );
  }

  return (
    <View style={[s.wrap, style]}>
      <WebView
        ref={ref}
        style={s.web}
        source={{ html, baseUrl: KAKAO_WEBVIEW_BASE_URL }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        onError={(e) => setError(e.nativeEvent.description)}
        onHttpError={(e) => setError(`HTTP ${e.nativeEvent.statusCode}`)}
        onMessage={(e) => {
          try {
            const m = JSON.parse(e.nativeEvent.data);
            if (m.type === 'ready') {
              setReady(true);
              setError('');
            } else if (m.type === 'error') {
              setError(m.message || 'Kakao 지도 로드 실패');
            }
          } catch {
            // WebView 지도 이벤트는 표시 상태만 사용한다.
          }
        }}
      />
      <View pointerEvents="none" style={s.legend}>
        <View style={s.legendRow}><View style={[s.legendLine, s.legendPrecise]} /><Text style={s.legendTxt}>실경로</Text></View>
        {hasApprox ? <View style={s.legendRow}><View style={[s.legendLine, s.legendApprox]} /><Text style={s.legendTxt}>약식 경로</Text></View> : null}
        {hasFallback ? <View style={s.legendRow}><View style={[s.legendLine, s.legendFallback]} /><Text style={s.legendTxt}>직선 추정</Text></View> : null}
      </View>
      {error ? (
        <View pointerEvents="none" style={s.errorBox}>
          <Text style={s.errorTitle}>Kakao 지도 로드 실패</Text>
          <Text style={s.errorTxt}>{error}</Text>
          <Text style={s.errorTxt}>카카오 개발자 콘솔 JavaScript 플랫폼에 {KAKAO_WEBVIEW_BASE_URL} 등록이 필요할 수 있습니다.</Text>
        </View>
      ) : null}
    </View>
  );
}

function buildHtml(center: LatLon): string {
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>
html,body,#map{margin:0;padding:0;width:100%;height:100%;background:#111820}
.label{display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:14px;border:2px solid #fff;color:#081019;font:900 12px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;box-shadow:0 3px 10px rgba(0,0,0,.25)}
.origin{background:${C.accent}}
.spot{background:#f59e0b}
.appointment{background:${C.green}}
.arrow{width:26px;height:20px;display:flex;align-items:center;justify-content:center;border-radius:999px;background:rgba(255,255,255,.92);box-shadow:0 2px 7px rgba(0,0,0,.22)}
.arrow svg{width:18px;height:18px;overflow:visible}
.arrow path.body{fill:none;stroke:${C.accent};stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round}
.arrow.approx{background:rgba(240,249,255,.88)}
.arrow.approx path.body{stroke:#38bdf8}
.arrow.fallback{background:rgba(248,250,252,.82)}
.arrow.fallback path.body{stroke:#94a3b8;stroke-dasharray:2 2}
</style>
<script>
function post(m){ window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
window.onerror = function(message, source, lineno, colno){
  post({ type:'error', message:String(message || 'JavaScript error') + ' @' + lineno + ':' + colno });
};
setTimeout(function(){
  if (!window.kakao || !window.kakao.maps) post({ type:'error', message:'Kakao Maps SDK 응답 없음. JavaScript 키와 플랫폼 도메인을 확인하세요.' });
}, 5000);
</script>
<script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false" onerror="post({type:'error',message:'Kakao Maps SDK 스크립트 로드 실패'})"></script>
</head><body><div id="map"></div>
<script>
var map, overlays = [];
function ll(p){ return new kakao.maps.LatLng(p.lat, p.lon); }
function markerText(m, i){
  if (m.kind === 'origin') return '출';
  if (m.kind === 'appointment') return '약';
  return String(i);
}
function clearRoute(){
  overlays.forEach(function(o){ o.setMap(null); });
  overlays = [];
}
function toRad(deg){ return deg * Math.PI / 180; }
function bearing(a, b){
  var lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  var dLon = toRad(b.lon - a.lon);
  var y = Math.sin(dLon) * Math.cos(lat2);
  var x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
function distanceM(a, b){
  var r = 6371000;
  var dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  var lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  var h = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return 2 * r * Math.asin(Math.sqrt(h));
}
function interpolate(a, b, ratio){
  return {
    lat: a.lat + (b.lat - a.lat) * ratio,
    lon: a.lon + (b.lon - a.lon) * ratio
  };
}
function arrowMarks(points){
  if (points.length < 2) return [];
  var total = 0;
  for (var i = 1; i < points.length; i++) total += distanceM(points[i - 1], points[i]);
  var desired = total < 160 ? 1 : Math.max(2, Math.min(8, Math.floor(total / 260)));
  var targets = [];
  for (var m = 1; m <= desired; m++) targets.push(total * m / (desired + 1));
  var marks = [], walked = 0, next = 0;
  for (var j = 1; j < points.length && next < targets.length; j++) {
    var prev = points[j - 1];
    var cur = points[j];
    var d = distanceM(points[j - 1], points[j]);
    while (next < targets.length && walked + d >= targets[next]) {
      var ratio = d <= 0 ? 0 : (targets[next] - walked) / d;
      marks.push({
        point: interpolate(prev, cur, Math.max(0, Math.min(1, ratio))),
        angle: bearing(prev, cur) - 90
      });
      next++;
    }
    walked += d;
  }
  return marks;
}
function addDirectionArrows(points, quality){
  arrowMarks(points).forEach(function(mark){
    var kind = quality || 'fallback';
    var content =
      '<div class="arrow ' + kind + '" style="transform:rotate(' + mark.angle + 'deg)">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path class="body" d="M9 5 L16 12 L9 19"></path>' +
      '</svg>' +
      '</div>';
    var overlay = new kakao.maps.CustomOverlay({
      map: map,
      position: ll(mark.point),
      content: content,
      yAnchor: 0.5,
      xAnchor: 0.5,
      clickable: false,
      zIndex: 5
    });
    overlays.push(overlay);
  });
}
function setRoute(data){
  if (!map) return;
  clearRoute();
  var bounds = new kakao.maps.LatLngBounds();
  var segments = Array.isArray(data.segments) ? data.segments : [];
  segments.forEach(function(seg){
    var path = (seg.points || []).map(function(p){ var point = ll(p); bounds.extend(point); return point; });
    if (path.length <= 1) return;
    var isApprox = seg.quality === 'approx';
    var isFallback = seg.quality === 'fallback';
    var line = new kakao.maps.Polyline({
      map: map,
      path: path,
      strokeWeight: isFallback ? 4 : 5,
      strokeColor: isFallback ? '#94a3b8' : isApprox ? '#38bdf8' : '${C.accent}',
      strokeOpacity: isFallback ? 0.65 : isApprox ? 0.75 : 0.92,
      strokeStyle: isFallback ? 'shortdash' : isApprox ? 'dash' : 'solid'
    });
    overlays.push(line);
    addDirectionArrows(seg.points || [], seg.quality);
  });
  (data.markers || []).forEach(function(m, i){
    var point = ll(m);
    bounds.extend(point);
    var kind = m.kind || 'spot';
    var content = '<div class="label ' + kind + '">' + markerText(m, i) + '</div>';
    var overlay = new kakao.maps.CustomOverlay({
      map: map,
      position: point,
      content: content,
      yAnchor: 0.5,
      xAnchor: 0.5,
      clickable: false
    });
    overlays.push(overlay);
  });
  if (!bounds.isEmpty()) map.setBounds(bounds, 40, 40, 40, 40);
}
function initMap(){
  if (!window.kakao || !window.kakao.maps) {
    post({ type:'error', message:'Kakao Maps SDK가 초기화되지 않았습니다.' });
    return;
  }
  kakao.maps.load(function(){
    map = new kakao.maps.Map(document.getElementById('map'), {
      center: new kakao.maps.LatLng(${center.lat}, ${center.lon}),
      level: 5
    });
    post({ type:'ready' });
  });
}
initMap();
</script></body></html>`;
}

function centerOf(points: LatLon[]): LatLon {
  if (!points.length) return { lat: 35.1796, lon: 129.0756 };
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  return {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lon: (Math.min(...lons) + Math.max(...lons)) / 2,
  };
}

const s = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: '#111820' },
  web: { flex: 1, backgroundColor: '#111820' },
  fallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#111820', padding: 16 },
  fallbackTitle: { color: C.txt, fontSize: 13, fontWeight: '800', marginBottom: 6 },
  fallbackTxt: { color: C.muted, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  errorBox: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.red,
    backgroundColor: 'rgba(17,24,32,0.94)',
  },
  errorTitle: { color: C.red, fontSize: 12, fontWeight: '900', marginBottom: 4 },
  errorTxt: { color: C.txt2, fontSize: 11, lineHeight: 16 },
  legend: {
    position: 'absolute',
    left: 10,
    top: 10,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(17,24,32,0.88)',
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendLine: { width: 24, height: 4, borderRadius: 4 },
  legendPrecise: { backgroundColor: C.accent },
  legendApprox: { backgroundColor: '#38bdf8', opacity: 0.75 },
  legendFallback: { backgroundColor: '#94a3b8', opacity: 0.8 },
  legendTxt: { color: C.txt2, fontSize: 11, fontWeight: '700' },
});
