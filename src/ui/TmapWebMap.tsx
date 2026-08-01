// TMAP 지도 (WebView + TMAP JS API v2) — 표시/마커/탭핀/중심추적
// TMAP 웹 지도 검색/선택용. ⚠️ react-native-webview 네이티브 모듈 → dev build 재빌드 필요.
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { LatLon } from '../engine';

const TMAP_KEY = process.env.EXPO_PUBLIC_TMAP_APP_KEY ?? '';

export type TmapMarker = { lat: number; lon: number; label: string };

type Props = {
  center: LatLon;                        // 초기 중심
  markers?: TmapMarker[];                // 번호 마커 (변경 시 자동 fitBounds)
  pin?: LatLon | null;                   // 직접 찍은 핀
  focus?: LatLon | null;                 // 선택 시 이동할 중심
  onMapTap?: (lat: number, lon: number) => void;
  onMarkerTap?: (index: number) => void;
  onCenterChange?: (lat: number, lon: number) => void; // 드래그 후 중심(검색 기준)
  style?: StyleProp<ViewStyle>;
};

function buildHtml(center: LatLon): string {
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%;background:#0f1419}</style>
<script src="https://apis.openapi.sk.com/tmap/jsv2?version=1&appKey=${TMAP_KEY}"></script>
</head><body><div id="map"></div>
<script>
var map, markers = [], pin = null;
function post(m){ window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
function ll(lat,lon){ return new Tmapv2.LatLng(lat,lon); }
function init(){
  map = new Tmapv2.Map('map', { center: ll(${center.lat},${center.lon}), zoom: 15, httpsMode: true });
  map.addListener('click', function(e){ post({ type:'tap', lat:e.latLng.lat(), lon:e.latLng.lng() }); });
  map.addListener('dragend', function(){ var c=map.getCenter(); post({ type:'center', lat:c.lat(), lon:c.lng() }); });
  post({ type:'ready' });
}
function setMarkers(list){
  markers.forEach(function(m){ m.setMap(null); }); markers = [];
  list.forEach(function(p,i){
    var mk = new Tmapv2.Marker({ position: ll(p.lat,p.lon), map: map, title: p.label, label: String(i+1) });
    mk.addListener('click', function(){ post({ type:'marker', index:i }); });
    markers.push(mk);
  });
  if (list.length > 1) {
    var b = new Tmapv2.LatLngBounds();
    list.forEach(function(p){ b.extend(ll(p.lat,p.lon)); });
    map.fitBounds(b);
  } else if (list.length === 1) { map.setCenter(ll(list[0].lat, list[0].lon)); map.setZoom(16); }
}
function setPin(lat,lon){
  if (pin) { pin.setMap(null); pin = null; }
  if (lat != null) { pin = new Tmapv2.Marker({ position: ll(lat,lon), map: map }); map.setCenter(ll(lat,lon)); }
}
function setCenter(lat,lon){ map.setCenter(ll(lat,lon)); map.setZoom(16); }
window.onload = init;
</script></body></html>`;
}

export function TmapWebMap({ center, markers = [], pin = null, focus = null, onMapTap, onMarkerTap, onCenterChange, style }: Props) {
  const ref = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const html = useMemo(() => buildHtml(center), []); // 초기 1회 (중심 이동은 setCenter로)

  const js = (code: string) => ref.current?.injectJavaScript(code + ';true;');

  useEffect(() => { if (ready) js(`setMarkers(${JSON.stringify(markers)})`); }, [ready, markers]);
  useEffect(() => { if (ready) js(pin ? `setPin(${pin.lat},${pin.lon})` : 'setPin(null)'); }, [ready, pin]);
  useEffect(() => { if (ready && focus) js(`setCenter(${focus.lat},${focus.lon})`); }, [ready, focus]);

  return (
    <WebView
      ref={ref}
      style={[{ flex: 1, backgroundColor: '#0f1419' }, style]}
      source={{ html }}
      originWhitelist={['*']}
      javaScriptEnabled
      onMessage={(e) => {
        try {
          const m = JSON.parse(e.nativeEvent.data);
          if (m.type === 'ready') setReady(true);
          else if (m.type === 'tap') onMapTap?.(m.lat, m.lon);
          else if (m.type === 'marker') onMarkerTap?.(m.index);
          else if (m.type === 'center') onCenterChange?.(m.lat, m.lon);
        } catch { /* 무시 */ }
      }}
    />
  );
}
