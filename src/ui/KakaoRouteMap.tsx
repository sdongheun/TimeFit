import { MapCameraButton } from './MapCameraButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { LatLon } from '../engine';
import { C } from './theme';
import {
  buildRouteMapSegments,
  type RouteMapSegment,
} from './map/routeSegments';

export { buildRouteMapSegments } from './map/routeSegments';
export type { RouteMapSegment } from './map/routeSegments';

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
  kind?: 'origin' | 'spot' | 'appointment' | 'current' | 'selected' | 'candidate';
  active?: boolean;
};

function withoutPhotoFields(marker: RouteMapMarker): RouteMapMarker {
  const {
    imageUrl: _imageUrl,
    imageSource: _imageSource,
    imageEvidence: _imageEvidence,
    ...safeMarker
  } = marker as RouteMapMarker & {
    imageUrl?: unknown;
    imageSource?: unknown;
    imageEvidence?: unknown;
  };
  return safeMarker;
}

type Props = {
  points: LatLon[];
  line: LatLon[];
  markers: RouteMapMarker[];
  segments?: readonly RouteMapSegment[];
  highlightedLegIndex?: number;
  showMarkerLabels?: boolean;
  showRouteLegend?: boolean;
  safeErrorPresentation?: boolean;
  focusedMarkerOffsetY?: number;
  initialCenter?: LatLon;
  cameraControl?: boolean;
  cameraTop?: number;
  recenterPoint?: LatLon;
  recenterToken?: number;
  recenterOffsetY?: number;
  boundsPadding?: { top: number; right: number; bottom: number; left: number };
  onMarkerTap?: (index: number) => void;
  onMapTap?: (point: LatLon) => void;
  onMapCenterChange?: (point: LatLon) => void;
  onMapReady?: () => void;
  onMapError?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function KakaoRouteMap({ points, line, markers, segments, highlightedLegIndex, showMarkerLabels = false, showRouteLegend = true, safeErrorPresentation = false, focusedMarkerOffsetY = 0, cameraControl = true, cameraTop, initialCenter, recenterPoint, recenterToken = 0, recenterOffsetY = 0, boundsPadding, onMarkerTap, onMapTap, onMapCenterChange, onMapReady, onMapError, style }: Props) {
  const ref = useRef<WebView>(null);
  const cameraInsets = useSafeAreaInsets();
  const errorReported = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const routeSegments = useMemo(
    () => segments !== undefined ? segments : [{ points: line, quality: 'fallback' as const }],
    [segments, line],
  );
  const routePoints = useMemo(() => routeSegments.flatMap((seg) => seg.points), [routeSegments]);
  const hasApprox = routeSegments.some((seg) => seg.quality === 'approx');
  const hasFallback = routeSegments.some((seg) => seg.quality === 'fallback');
  // Keep the WebView document stable; setRoute handles genuine geometry/layout changes.
  const center = useRef(initialCenter ?? centerOf([...points, ...routePoints])).current;
  const html = useMemo(() => buildHtml(center), [center]);

  const reportMapError = () => {
    if (errorReported.current) return;
    errorReported.current = true;
    onMapError?.();
  };

  useEffect(() => {
    if (!KAKAO_JS_KEY) {
      setError('Kakao 지도 키가 없습니다.');
      reportMapError();
      return;
    }
    if (ready) return;
    const timeout = setTimeout(() => {
      setError('Kakao 지도 준비 시간이 초과됐어요.');
      reportMapError();
    }, 7000);
    return () => clearTimeout(timeout);
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    const route = JSON.stringify({
      markers: (markers ?? []).map(withoutPhotoFields),
      segments: routeSegments,
      highlightedLegIndex,
      showMarkerLabels,
      focusedMarkerOffsetY,
      boundsPadding,
      markerTapEnabled: Boolean(onMarkerTap),
      mapTapEnabled: Boolean(onMapTap),
    });
    ref.current?.injectJavaScript(`setRoute(${route});true;`);
  }, [ready, markers, routeSegments, highlightedLegIndex, showMarkerLabels, focusedMarkerOffsetY, boundsPadding, onMarkerTap]);

  useEffect(() => {
    if (!ready || !recenterPoint || recenterToken < 1) return;
    ref.current?.injectJavaScript(`focusMap(${JSON.stringify(recenterPoint)}, ${Math.round(recenterOffsetY)});true;`);
  }, [ready, recenterPoint, recenterToken, recenterOffsetY]);

  if (!KAKAO_JS_KEY) {
    return (
      <View style={[s.fallback, style]}>
        <Text style={s.fallbackTitle}>{safeErrorPresentation ? '지도를 표시할 수 없어요' : 'Kakao 지도 키가 필요합니다.'}</Text>
        <Text style={s.fallbackTxt}>{safeErrorPresentation ? '아래 코스 정보는 계속 확인할 수 있어요.' : 'EXPO_PUBLIC_KAKAO_JAVASCRIPT_API_KEY를 .env에 추가하세요.'}</Text>
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
        onError={(e) => { setError(e.nativeEvent.description); reportMapError(); }}
        onHttpError={(e) => { setError(`HTTP ${e.nativeEvent.statusCode}`); reportMapError(); }}
        onMessage={(e) => {
          try {
            const m = JSON.parse(e.nativeEvent.data);
            if (m.type === 'ready') {
              setReady(true);
              setError('');
              onMapReady?.();
            } else if (m.type === 'error') {
              setError(m.message || 'Kakao 지도 로드 실패');
              reportMapError();
            } else if (m.type === 'marker' && typeof m.index === 'number') {
              onMarkerTap?.(m.index);
            } else if (m.type === 'mapTap' && Number.isFinite(m.lat) && Number.isFinite(m.lon)) {
              onMapTap?.({ lat: m.lat, lon: m.lon });
            } else if (m.type === 'mapCenter' && Number.isFinite(m.lat) && Number.isFinite(m.lon)) {
              onMapCenterChange?.({ lat: m.lat, lon: m.lon });
            }
          } catch {
            // WebView 지도 이벤트는 표시 상태만 사용한다.
          }
        }}
      />
      {cameraControl && ready && !error ? <MapCameraButton point={recenterPoint ?? initialCenter ?? points[0]} scopeKey={JSON.stringify(points)} style={{ position: 'absolute', right: Math.max(12, cameraInsets.right), top: cameraTop ?? cameraInsets.top + 12 }} onCamera={point => ref.current?.injectJavaScript(`focusMap(${JSON.stringify(point)}, ${Math.round(recenterOffsetY)});true;`)} /> : null}
      {showRouteLegend ? <View pointerEvents="none" style={s.legend}>
        <View style={s.legendRow}><View style={[s.legendLine, s.legendPrecise]} /><Text style={s.legendTxt}>실경로</Text></View>
        {hasApprox ? <View style={s.legendRow}><View style={[s.legendLine, s.legendApprox]} /><Text style={s.legendTxt}>약식 경로</Text></View> : null}
        {hasFallback ? <View style={s.legendRow}><View style={[s.legendLine, s.legendFallback]} /><Text style={s.legendTxt}>직선 추정</Text></View> : null}
      </View> : null}
      {error ? (
        <View pointerEvents="none" style={s.errorBox}>
          <Text style={s.errorTitle}>{safeErrorPresentation ? '지도를 표시할 수 없어요' : 'Kakao 지도 로드 실패'}</Text>
          {safeErrorPresentation ? <Text style={s.errorTxt}>아래 코스 정보는 계속 확인할 수 있어요.</Text> : <><Text style={s.errorTxt}>{error}</Text><Text style={s.errorTxt}>카카오 개발자 콘솔 JavaScript 플랫폼에 {KAKAO_WEBVIEW_BASE_URL} 등록이 필요할 수 있습니다.</Text></>}
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
.marker{display:flex;flex-direction:column;align-items:center;border:0;background:transparent;padding:0;margin:0}
.label{display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:14px;border:2px solid #fff;color:#081019;font:900 12px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;box-shadow:0 3px 10px rgba(0,0,0,.25)}
.origin .label{background:${C.accent}}
.current .label{background:#ef4444}
.selected .label{background:#8b5cf6}
.candidate .label{background:#f59e0b}
.spot .label{background:#f59e0b}
.appointment .label{background:${C.green}}
.marker.active .label{transform:scale(1.22);box-shadow:0 0 0 4px rgba(76,194,255,.28),0 3px 10px rgba(0,0,0,.25)}
.marker-name{max-width:112px;padding:4px 7px;border:1px solid rgba(22,27,34,.18);border-radius:6px;background:rgba(255,255,255,.96);color:#1c242d;font:800 10px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 6px rgba(0,0,0,.2);transform:translateY(8px)}
.route-arrow{width:12px;height:12px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 1px 1px rgba(0,0,0,.28))}
.route-arrow svg{width:12px;height:12px;overflow:visible}
.route-arrow path.body{fill:none;stroke:#fff;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
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
var map, overlays = [], hasInitialRoute = false, mapTapEnabled = false;
function ll(p){ return new kakao.maps.LatLng(p.lat, p.lon); }
function markerText(m, i){
  if (m.kind === 'origin') return '출';
  if (m.kind === 'current') return '현';
  if (m.kind === 'selected') return '선';
  if (m.kind === 'candidate') return '후';
  if (m.kind === 'appointment') return '약';
  return String(i);
}
function escapeHtml(value){
  return String(value || '').replace(/[&<>'"]/g, function(char){
    return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char];
  });
}
function clearRoute(){
  overlays.forEach(function(o){ o.setMap(null); });
  overlays = [];
}
function focusCenter(point, offsetY){
  var offset = Number(offsetY || 0);
  if (!offset || !map || !map.getProjection) return point;
  try {
    var projection = map.getProjection();
    var containerPoint = projection.containerPointFromCoords(point);
    // 시트가 덮은 높이의 절반만큼 남쪽을 중심으로 잡으면 대상은 가시 지도 영역의 중앙에 놓인다.
    return projection.coordsFromContainerPoint(
      new kakao.maps.Point(containerPoint.x, containerPoint.y + offset)
    );
  } catch (error) {
    return point;
  }
}
function markerColor(kind){
  if (kind === 'origin') return '${C.accent}';
  if (kind === 'current') return '#ef4444';
  if (kind === 'selected') return '#8b5cf6';
  if (kind === 'appointment') return '${C.green}';
  return '#f59e0b';
}
function colorPinImage(color, active){
  var width = active ? 52 : 36;
  var height = active ? 68 : 48;
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">' +
    '<path d="M18 2C9.7 2 3 8.7 3 17c0 11.3 15 27.6 15 27.6S33 28.3 33 17C33 8.7 26.3 2 18 2Z" fill="' + color + '" stroke="#fff" stroke-width="3"/>' +
    '<circle cx="18" cy="17" r="5" fill="#fff" fill-opacity=".9"/>' +
    '</svg>';
  return new kakao.maps.MarkerImage(
    'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    new kakao.maps.Size(width, height),
    { offset: new kakao.maps.Point(width / 2, height - 2) }
  );
}
function currentLocationImage(active){
  var size = active ? 48 : 38;
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">' +
    '<circle cx="24" cy="24" r="20" fill="#ef4444" fill-opacity=".18"/>' +
    '<circle cx="24" cy="24" r="12" fill="#fff" fill-opacity=".96"/>' +
    '<circle cx="24" cy="24" r="8" fill="#ef4444"/>' +
    '<circle cx="24" cy="24" r="3" fill="#fff" fill-opacity=".9"/>' +
    '</svg>';
  return new kakao.maps.MarkerImage(
    'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    new kakao.maps.Size(size, size),
    { offset: new kakao.maps.Point(size / 2, size / 2) }
  );
}
function createMapMarker(point, marker, kind, active){
  var options = {
    map: map,
    position: point,
    title: marker.label,
    zIndex: active ? 100 : 10
  };
  if (kind === 'current') options.image = currentLocationImage(active);
  else if (kind !== 'spot') options.image = colorPinImage(markerColor(kind), active);
  // 이미지가 없는 장소는 카카오 SDK 기본 마커를 그대로 사용한다.
  return new kakao.maps.Marker(options);
}
function addMarkerLabel(marker, point, index, enabled, active){
  if (!enabled) return;
  var click = ' onclick="post({type:&quot;marker&quot;,index:' + index + '})"';
  var overlay = new kakao.maps.CustomOverlay({
    map: map,
    position: point,
    content: '<button class="marker-name"' + click + '>' + escapeHtml(marker.label) + '</button>',
    yAnchor: 0,
    xAnchor: 0.5,
    clickable: true,
    zIndex: active ? 110 : 30
  });
  overlays.push(overlay);
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
function turnAngle(points, index){
  if (index <= 0 || index >= points.length - 1) return 0;
  var incoming = bearing(points[index - 1], points[index]);
  var outgoing = bearing(points[index], points[index + 1]);
  return Math.abs(((outgoing - incoming + 540) % 360) - 180);
}
function arrowMarks(points){
  if (points.length < 2) return [];
  var total = 0;
  for (var i = 1; i < points.length; i++) total += distanceM(points[i - 1], points[i]);
  // Small chevrons need a repeated rhythm to make A→B direction readable.
  // Keep roughly 110m spacing, while capping overlays on long overview routes.
  var desired = total < 70 ? 1 : Math.max(2, Math.min(12, Math.round(total / 110)));
  var targets = [];
  for (var m = 1; m <= desired; m++) targets.push(total * m / (desired + 1));
  var marks = [], walked = 0, next = 0;
  for (var j = 1; j < points.length && next < targets.length; j++) {
    var prev = points[j - 1];
    var cur = points[j];
    var d = distanceM(points[j - 1], points[j]);
    while (next < targets.length && walked + d >= targets[next]) {
      var ratio = d <= 0 ? 0 : (targets[next] - walked) / d;
      var along = Math.max(0, Math.min(d, targets[next] - walked));
      var nearSharpStart = j > 1 && turnAngle(points, j - 1) >= 30 && along < 28;
      var nearSharpEnd = j < points.length - 1 && turnAngle(points, j) >= 30 && d - along < 28;
      var nearRouteEnd = targets[next] < 20 || total - targets[next] < 20;
      if (!nearSharpStart && !nearSharpEnd && !nearRouteEnd) {
        marks.push({
          point: interpolate(prev, cur, Math.max(0, Math.min(1, ratio))),
          angle: bearing(prev, cur) - 90
        });
      }
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
      '<div class="route-arrow ' + kind + '" style="transform:rotate(' + mark.angle + 'deg)">' +
      '<svg viewBox="0 0 12 12" aria-hidden="true">' +
      '<path class="body" d="M3 2 L8 6 L3 10"></path>' +
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
var lastBoundsKey = null;
function setRoute(data){
  if (!map) return;
  mapTapEnabled = Boolean(data.mapTapEnabled);
  clearRoute();
  var bounds = new kakao.maps.LatLngBounds();
  var focusedPoint = null;
  var segments = Array.isArray(data.segments) ? data.segments : [];
  var hasHighlight = Number.isInteger(data.highlightedLegIndex);
  var orderedSegments = segments.slice().sort(function(a, b){
    if (!hasHighlight) return 0;
    return Number(a.legIndex === data.highlightedLegIndex) - Number(b.legIndex === data.highlightedLegIndex);
  });
  orderedSegments.forEach(function(seg){
    var path = (seg.points || []).map(function(p){ var point = ll(p); bounds.extend(point); return point; });
    if (path.length <= 1) return;
    var highlighted = !hasHighlight || seg.legIndex === data.highlightedLegIndex;
    var isApprox = seg.quality === 'approx';
    var isFallback = seg.quality === 'fallback';
    var isWalk = seg.mode === 'walk';
    var isTransit = seg.mode === 'transit';
    var strokeStyle = isTransit ? 'dash' : isFallback ? 'shortdash' : isApprox ? 'dash' : 'solid';
    var outline = new kakao.maps.Polyline({
      map: map,
      path: path,
      strokeWeight: highlighted ? (isFallback ? 8 : 11) : 7,
      strokeColor: '#ffffff',
      strokeOpacity: highlighted ? (isFallback ? 0.48 : 0.82) : 0.18,
      strokeStyle: strokeStyle
    });
    var line = new kakao.maps.Polyline({
      map: map,
      path: path,
      strokeWeight: highlighted ? (isFallback ? 5 : 7) : 4,
      strokeColor: isWalk ? '${C.accent}' : isTransit ? '${C.amber}' : isFallback ? '#94a3b8' : isApprox ? '#38bdf8' : '${C.accent}',
      strokeOpacity: highlighted ? (isFallback ? 0.65 : isApprox ? 0.75 : 0.92) : 0.28,
      strokeStyle: strokeStyle
    });
    overlays.push(outline, line);
    if (highlighted) addDirectionArrows(seg.points || [], seg.mode || seg.quality);
  });
  (data.markers || []).forEach(function(m, i){
    var point = ll(m);
    bounds.extend(point);
    if (m.active) focusedPoint = point;
    var kind = m.kind || 'spot';
    if (kind === 'origin') {
      var originMarker = createMapMarker(point, m, kind, !!m.active);
      if (data.markerTapEnabled) {
        kakao.maps.event.addListener(originMarker, 'click', (function(index){
          return function(){ post({type:'marker', index:index}); };
        })(i));
      }
      overlays.push(originMarker);
      addMarkerLabel(m, point, i, data.showMarkerLabels, !!m.active);
      return;
    }
    var active = m.active ? ' active' : '';
    var click = data.markerTapEnabled ? ' onclick="post({type:&quot;marker&quot;,index:' + i + '})"' : '';
    var content = '<button class="marker ' + kind + active + '"' + click + '><span class="label">' + markerText(m, i) + '</span></button>';
    var overlay = new kakao.maps.CustomOverlay({
      map: map,
      position: point,
      content: content,
      yAnchor: 0.5,
      xAnchor: 0.5,
      clickable: !!data.markerTapEnabled,
      zIndex: m.active ? 100 : 10
    });
    overlays.push(overlay);
    addMarkerLabel(m, point, i, data.showMarkerLabels, !!m.active);
  });
  if (focusedPoint) {
    // 첫 진입만 현재 위치를 기준으로 잡고, 이후에는 사용자가 옮긴 지도 위치를 보존한다.
    if (!hasInitialRoute) {
      var focusOffsetY = Number(data.focusedMarkerOffsetY || 0);
      map.setCenter(focusCenter(focusedPoint, focusOffsetY));
    }
    hasInitialRoute = true;
  } else if (!bounds.isEmpty()) {
    var pad = data.boundsPadding || { top:40, right:40, bottom:40, left:40 };
    var boundsKey = JSON.stringify([(data.markers || []).map(function(m){return [m.lat,m.lon];}), (data.segments || []).map(function(s){return s.points;}), pad]);
    if (boundsKey !== lastBoundsKey) {
      map.setBounds(bounds, pad.top, pad.right, pad.bottom, pad.left);
      lastBoundsKey = boundsKey;
    }
  }
}
function focusMap(point, offsetY){
  if (!map || !point) return;
  map.panTo(focusCenter(ll(point), offsetY));
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
    kakao.maps.event.addListener(map, 'click', function(mouseEvent){
      if (!mapTapEnabled) return;
      var point = mouseEvent.latLng;
      post({ type:'mapTap', lat:point.getLat(), lon:point.getLng() });
    });
    kakao.maps.event.addListener(map, 'idle', function(){
      var point = map.getCenter();
      post({ type:'mapCenter', lat:point.getLat(), lon:point.getLng() });
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
    right: 10,
    bottom: 10,
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
