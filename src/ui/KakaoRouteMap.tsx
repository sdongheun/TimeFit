import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { LatLon } from '../engine';
import { C } from './theme';

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

type Props = {
  points: LatLon[];
  line: LatLon[];
  markers: RouteMapMarker[];
  style?: StyleProp<ViewStyle>;
};

export function KakaoRouteMap({ points, line, markers, style }: Props) {
  const ref = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const center = useMemo(() => centerOf([...points, ...line]), [points, line]);
  const html = useMemo(() => buildHtml(center), [center.lat, center.lon]);

  useEffect(() => {
    if (!ready) return;
    const route = JSON.stringify({ markers, line });
    ref.current?.injectJavaScript(`setRoute(${route});true;`);
  }, [ready, markers, line]);

  if (!KAKAO_JS_KEY) {
    return (
      <View style={[s.fallback, style]}>
        <Text style={s.fallbackTitle}>Kakao 지도 키가 필요합니다.</Text>
        <Text style={s.fallbackTxt}>EXPO_PUBLIC_KAKAO_JAVASCRIPT_API_KEY를 .env에 추가하세요.</Text>
      </View>
    );
  }

  return (
    <WebView
      ref={ref}
      style={[s.web, style]}
      source={{ html }}
      originWhitelist={['*']}
      javaScriptEnabled
      onMessage={(e) => {
        try {
          const m = JSON.parse(e.nativeEvent.data);
          if (m.type === 'ready') setReady(true);
        } catch {
          // WebView 지도 이벤트는 표시 상태만 사용한다.
        }
      }}
    />
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
</style>
<script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false"></script>
</head><body><div id="map"></div>
<script>
var map, overlays = [], polyline = null;
function post(m){ window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
function ll(p){ return new kakao.maps.LatLng(p.lat, p.lon); }
function markerText(m, i){
  if (m.kind === 'origin') return '출';
  if (m.kind === 'appointment') return '약';
  return String(i);
}
function clearRoute(){
  overlays.forEach(function(o){ o.setMap(null); });
  overlays = [];
  if (polyline) { polyline.setMap(null); polyline = null; }
}
function setRoute(data){
  if (!map) return;
  clearRoute();
  var bounds = new kakao.maps.LatLngBounds();
  var line = Array.isArray(data.line) ? data.line : [];
  var path = line.map(function(p){ var point = ll(p); bounds.extend(point); return point; });
  if (path.length > 1) {
    polyline = new kakao.maps.Polyline({
      map: map,
      path: path,
      strokeWeight: 5,
      strokeColor: '${C.accent}',
      strokeOpacity: 0.9,
      strokeStyle: 'solid'
    });
  }
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
kakao.maps.load(function(){
  map = new kakao.maps.Map(document.getElementById('map'), {
    center: new kakao.maps.LatLng(${center.lat}, ${center.lon}),
    level: 5
  });
  post({ type:'ready' });
});
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
  web: { flex: 1, backgroundColor: '#111820' },
  fallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#111820', padding: 16 },
  fallbackTitle: { color: C.txt, fontSize: 13, fontWeight: '800', marginBottom: 6 },
  fallbackTxt: { color: C.muted, fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
