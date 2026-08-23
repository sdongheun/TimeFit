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
  kind?: 'origin' | 'spot' | 'appointment';
  active?: boolean;
  imageUrl?: string;
};

type Props = {
  points: LatLon[];
  line: LatLon[];
  markers: RouteMapMarker[];
  segments?: RouteMapSegment[];
  showMarkerLabels?: boolean;
  usePhotoMarkers?: boolean;
  focusedMarkerOffsetY?: number;
  recenterPoint?: LatLon;
  recenterToken?: number;
  recenterOffsetY?: number;
  boundsPadding?: { top: number; right: number; bottom: number; left: number };
  onMarkerTap?: (index: number) => void;
  onMapTap?: (point: LatLon) => void;
  style?: StyleProp<ViewStyle>;
};

export function KakaoRouteMap({ points, line, markers, segments, showMarkerLabels = false, usePhotoMarkers = false, focusedMarkerOffsetY = 0, recenterPoint, recenterToken = 0, recenterOffsetY = 0, boundsPadding, onMarkerTap, onMapTap, style }: Props) {
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
    const route = JSON.stringify({
      markers,
      segments: routeSegments,
      showMarkerLabels,
      usePhotoMarkers,
      focusedMarkerOffsetY,
      boundsPadding,
      markerTapEnabled: Boolean(onMarkerTap),
      mapTapEnabled: Boolean(onMapTap),
    });
    ref.current?.injectJavaScript(`setRoute(${route});true;`);
  }, [ready, markers, routeSegments, showMarkerLabels, usePhotoMarkers, focusedMarkerOffsetY, boundsPadding, onMarkerTap]);

  useEffect(() => {
    if (!ready || !recenterPoint || recenterToken < 1) return;
    ref.current?.injectJavaScript(`focusMap(${JSON.stringify(recenterPoint)}, ${Math.round(recenterOffsetY)});true;`);
  }, [ready, recenterPoint, recenterToken, recenterOffsetY]);

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
            } else if (m.type === 'marker' && typeof m.index === 'number') {
              onMarkerTap?.(m.index);
            } else if (m.type === 'mapTap' && Number.isFinite(m.lat) && Number.isFinite(m.lon)) {
              onMapTap?.({ lat: m.lat, lon: m.lon });
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
.marker{display:flex;flex-direction:column;align-items:center;border:0;background:transparent;padding:0;margin:0}
.label{display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:14px;border:2px solid #fff;color:#081019;font:900 12px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;box-shadow:0 3px 10px rgba(0,0,0,.25)}
.origin .label{background:${C.accent}}
.spot .label{background:#f59e0b}
.appointment .label{background:${C.green}}
.marker.active .label{transform:scale(1.22);box-shadow:0 0 0 4px rgba(76,194,255,.28),0 3px 10px rgba(0,0,0,.25)}
.photo-marker{position:relative;width:40px;height:48px;justify-content:flex-start;filter:drop-shadow(0 3px 5px rgba(0,0,0,.3))}
.photo-marker .photo-frame{position:relative;z-index:1;width:36px;height:36px;overflow:hidden;border:3px solid #fff;border-radius:50%;background:#f59e0b;box-sizing:border-box}
.photo-marker .photo-frame img{display:block;width:100%;height:100%;object-fit:cover}
.photo-marker .photo-tail{position:relative;z-index:0;width:14px;height:14px;margin-top:-8px;background:#fff;transform:rotate(45deg);border-radius:2px}
.photo-marker.active .photo-frame{width:72px;height:72px;border-width:4px;box-shadow:0 0 0 5px rgba(76,194,255,.3)}
.photo-marker.active{width:78px;height:90px}
.photo-marker.active .photo-tail{width:20px;height:20px;margin-top:-12px}
.marker-name{max-width:112px;padding:4px 7px;border:1px solid rgba(22,27,34,.18);border-radius:6px;background:rgba(255,255,255,.96);color:#1c242d;font:800 10px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 6px rgba(0,0,0,.2);transform:translateY(8px)}
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
var map, overlays = [], hasInitialRoute = false, mapTapEnabled = false;
function ll(p){ return new kakao.maps.LatLng(p.lat, p.lon); }
function markerText(m, i){
  if (m.kind === 'origin') return '출';
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
  if (kind === 'origin') options.image = currentLocationImage(active);
  else if (kind !== 'spot') options.image = colorPinImage(markerColor(kind), active);
  // 이미지가 없는 장소는 카카오 SDK 기본 마커를 그대로 사용한다.
  return new kakao.maps.Marker(options);
}
function addSpotLabel(marker, point, index, enabled, active){
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
  mapTapEnabled = Boolean(data.mapTapEnabled);
  clearRoute();
  var bounds = new kakao.maps.LatLngBounds();
  var focusedPoint = null;
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
    if (m.active) focusedPoint = point;
    var kind = m.kind || 'spot';
    var hasPhoto = data.usePhotoMarkers && kind === 'spot' && /^https:\/\//.test(String(m.imageUrl || ''));
    if (kind === 'origin') {
      var originMarker = createMapMarker(point, m, kind, !!m.active);
      if (data.markerTapEnabled) {
        kakao.maps.event.addListener(originMarker, 'click', (function(index){
          return function(){ post({type:'marker', index:index}); };
        })(i));
      }
      overlays.push(originMarker);
      return;
    }
    if (hasPhoto) {
      var fallbackMarker = createMapMarker(point, m, kind, !!m.active);
      if (data.markerTapEnabled) {
        kakao.maps.event.addListener(fallbackMarker, 'click', (function(index){
          return function(){ post({type:'marker', index:index}); };
        })(i));
      }
      overlays.push(fallbackMarker);
      var activePhoto = m.active ? ' active' : '';
      var photoClick = data.markerTapEnabled ? ' onclick="post({type:&quot;marker&quot;,index:' + i + '})"' : '';
      var photoContent =
        '<button class="marker spot photo-marker' + activePhoto + '"' + photoClick + '>' +
          '<span class="photo-frame"><img src="' + escapeHtml(m.imageUrl) + '" onerror="this.parentNode.parentNode.style.display=&quot;none&quot;"></span>' +
          '<span class="photo-tail"></span>' +
        '</button>';
      var photoOverlay = new kakao.maps.CustomOverlay({
        map: map,
        position: point,
        content: photoContent,
        yAnchor: 1,
        xAnchor: 0.5,
        clickable: !!data.markerTapEnabled,
        zIndex: m.active ? 100 : 10
      });
      overlays.push(photoOverlay);
      var photoProbe = new Image();
      photoProbe.onload = function(){ fallbackMarker.setMap(null); };
      photoProbe.onerror = function(){ photoOverlay.setMap(null); };
      photoProbe.src = m.imageUrl;
      addSpotLabel(m, point, i, data.showMarkerLabels, !!m.active);
      return;
    }
    if (data.usePhotoMarkers) {
      var marker = createMapMarker(point, m, kind, !!m.active);
      if (data.markerTapEnabled) {
        kakao.maps.event.addListener(marker, 'click', (function(index){
          return function(){ post({type:'marker', index:index}); };
        })(i));
      }
      overlays.push(marker);
      if (kind === 'spot') addSpotLabel(m, point, i, data.showMarkerLabels, !!m.active);
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
    if (kind === 'spot') addSpotLabel(m, point, i, data.showMarkerLabels, !!m.active);
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
    map.setBounds(bounds, pad.top, pad.right, pad.bottom, pad.left);
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
