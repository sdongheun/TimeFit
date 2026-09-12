import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { C } from './theme';
import { approvedPlacePhoto } from './placePhotoModel';
import { parseNearbyMapMessage, type NearbyBrowsePlace, type NearbyMapFailureReason, type NearbyPoint } from './nearbyBrowseModel';

const BASE_URL = 'https://timefit.local';
const KAKAO_KEY = process.env.EXPO_PUBLIC_KAKAO_JAVASCRIPT_API_KEY
  ?? process.env.KAKAO_JAVASCRIPT_API_KEY
  ?? process.env.Kakao_JAVASCRIPT_API_KEY
  ?? '';

type Props = {
  cameraPoint?: NearbyPoint | null;
  center: NearbyPoint;
  places: readonly NearbyBrowsePlace[];
  selectedId: string | null;
  bottomInset: number;
  retryKey: number;
  onSelect(id: string): void;
  onCluster(ids: readonly string[]): void;
  onReady(): void;
  onError(): void;
  style?: StyleProp<ViewStyle>;
};

export function NearbyBrowseMap({ cameraPoint, center, places, selectedId, bottomInset, retryKey, onSelect, onCluster, onReady, onError, style }: Props) {
  const ref = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const ids = useMemo(() => new Set(places.map(place => place.id)), [places]);
  const document = useMemo(() => buildNearbyBrowseMapDocument(center), [center, retryKey]);
  const reportError = (reason: NearbyMapFailureReason) => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.info('[nearby-map-error]', { reason });
    onError();
  };
  useEffect(() => {
    setReady(false);
  }, [retryKey, center.lat, center.lon]);
  useEffect(() => {
    if (ready || !KAKAO_KEY) return;
    const timer = setTimeout(() => reportError('timeout'), 7000);
    return () => clearTimeout(timer);
  }, [ready, document, retryKey]);
  useEffect(() => {
    if (!ready) return;
    const payload = JSON.stringify({
      center,
      selectedId,
      bottomInset,
      places: places.map(({ id, title, lat, lon, source }) => ({ id, title, lat, lon, imageUrl: approvedPlacePhoto(source)?.url ?? null })),
    });
    ref.current?.injectJavaScript(`window.renderNearby(${payload});true;`);
  }, [ready, places, selectedId, bottomInset, center]);

  useEffect(() => {
    if (ready && cameraPoint) ref.current?.injectJavaScript(`window.focusNearbyCamera(${JSON.stringify(cameraPoint)});true;`);
  }, [ready, cameraPoint]);

  if (!KAKAO_KEY) return <View style={[s.fallback, style]}><Text style={s.title}>지도를 표시할 수 없어요</Text><Text style={s.copy}>아래 거리순 목록은 계속 확인할 수 있어요.</Text></View>;
  return <View style={[s.root, style]}>
    <WebView
      key={retryKey}
      ref={ref}
      style={s.web}
      source={{ html: document, baseUrl: BASE_URL }}
      originWhitelist={['*']}
      javaScriptEnabled
      domStorageEnabled
      mixedContentMode="always"
      onError={() => reportError('navigation')}
      onHttpError={() => reportError('http')}
      onMessage={(event) => {
        const message = parseNearbyMapMessage(event.nativeEvent.data, ids);
        if (!message) return;
        if (message.action === 'ready') { setReady(true); onReady(); }
        else if (message.action === 'error') reportError(message.reason ?? 'runtime');
        else if (message.action === 'select') onSelect(message.id);
        else onCluster(message.ids);
      }}
    />
  </View>;
}

export function buildNearbyBrowseMapDocument(center: NearbyPoint): string {
  const key = encodeURIComponent(KAKAO_KEY);
  return String.raw`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>
html,body,#map{width:100%;height:100%;margin:0;background:#eef1f4;overflow:hidden}.pin,.cluster{border:0;font-family:-apple-system,sans-serif;box-shadow:0 3px 12px rgba(0,0,0,.28);cursor:pointer}.pin{position:relative;width:42px;height:42px;border-radius:21px;background:#0066ff;border:3px solid #fff;padding:0;overflow:hidden}.pin img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.pin.fallback:after{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;content:'●';color:#fff;font-size:18px}.pin.selected{width:54px;height:54px;border-radius:27px;border-color:#171719;outline:3px solid #0066ff}.name{position:absolute;left:50%;top:58px;transform:translateX(-50%);white-space:nowrap;background:#171719;color:#fff;border-radius:8px;padding:5px 8px;font-size:12px;font-weight:700}.cluster{min-width:44px;height:44px;border-radius:22px;background:#171719;color:#fff;border:3px solid #4cc2ff;font-size:14px;font-weight:800}
</style><script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false" onerror="window.__nearbySdkFailed=true"></script></head><body><div id="map"></div><script>
var map = null;
var overlays = [];
var data = { places: [] };

function post(value) {
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(value));
}

function fail(reason) {
  post({ action: 'error', reason: reason });
}

function clearOverlays() {
  overlays.forEach(function (overlay) { overlay.setMap(null); });
  overlays = [];
}

function markerGroups() {
  var result = [];
  (data.places || []).forEach(function (place) {
    var point = map.getProjection().pointFromCoords(new kakao.maps.LatLng(place.lat, place.lon));
    var group = place.id === data.selectedId ? null : result.find(function (item) {
      return !item.selected && Math.hypot(item.x - point.x, item.y - point.y) <= 46;
    });
    if (group) group.items.push(place);
    else result.push({ x: point.x, y: point.y, selected: place.id === data.selectedId, items: [place] });
  });
  return result;
}

function createMarker(place) {
  var selected = place.id === data.selectedId;
  var hasPhoto = /^https:\/\//.test(String(place.imageUrl || ''));
  var root = document.createElement('div');
  root.style.position = 'relative';
  var button = document.createElement('button');
  button.className = 'pin fallback' + (selected ? ' selected' : '');
  button.setAttribute('aria-label', String(place.title || '장소'));
  button.addEventListener('click', function () { post({ action: 'select', id: place.id }); });
  if (hasPhoto) {
    var image = document.createElement('img');
    image.loading = 'lazy';
    image.alt = '';
    image.style.opacity = '0';
    var photoTimer = setTimeout(failPhoto, 12000);
    function failPhoto() {
      if (image.dataset.failed === '1') return;
      image.dataset.failed = '1';
      button.classList.add('fallback');
      if (image.parentNode) image.parentNode.removeChild(image);
      clearTimeout(photoTimer);
    }
    image.addEventListener('error', failPhoto, { once: true });
    image.addEventListener('load', function () { clearTimeout(photoTimer); if (image.dataset.failed === '1') return; image.style.opacity = '1'; button.className = button.className.replace('fallback', ''); }, { once: true });
    button.appendChild(image);
    image.src = place.imageUrl;
  }
  root.appendChild(button);
  if (selected) {
    var name = document.createElement('span');
    name.className = 'name';
    name.textContent = String(place.title || '장소');
    root.appendChild(name);
  }
  overlays.push(new kakao.maps.CustomOverlay({
    map: map,
    position: new kakao.maps.LatLng(place.lat, place.lon),
    content: root,
    xAnchor: 0.5,
    yAnchor: 0.5,
    zIndex: selected ? 100 : 10,
    clickable: true
  }));
}

function createCluster(group) {
  var ids = group.items.map(function (place) { return place.id; });
  var first = group.items[0];
  var button = document.createElement('button');
  button.className = 'cluster';
  button.setAttribute('aria-label', '겹친 장소 ' + ids.length + '곳');
  button.textContent = String(ids.length);
  button.addEventListener('click', function () {
    var sameCoordinates = group.items.every(function (place) {
      return place.lat === first.lat && place.lon === first.lon;
    });
    if (sameCoordinates || map.getLevel() <= 1) {
      post({ action: 'cluster', ids: ids });
      return;
    }
    var bounds = new kakao.maps.LatLngBounds();
    group.items.forEach(function (place) { bounds.extend(new kakao.maps.LatLng(place.lat, place.lon)); });
    map.setBounds(bounds, 70, 70, Math.max(70, Number(data.bottomInset || 0)), 70);
  });
  overlays.push(new kakao.maps.CustomOverlay({
    map: map,
    position: new kakao.maps.LatLng(first.lat, first.lon),
    content: button,
    xAnchor: 0.5,
    yAnchor: 0.5,
    zIndex: 50,
    clickable: true
  }));
}

function draw() {
  if (!map) return;
  try {
    clearOverlays();
    markerGroups().forEach(function (group) {
      if (group.items.length > 1) createCluster(group);
      else createMarker(group.items[0]);
    });
  } catch (_) {
    fail('runtime');
  }
}

window.focusNearbyCamera = function (point) { if (map && point) map.panTo(new kakao.maps.LatLng(point.lat, point.lon)); };
window.renderNearby = function (next) {
  if (!map) return;
  try {
    var oldIds = JSON.stringify((data.places || []).map(function (place) { return place.id; }));
    var changed = oldIds !== JSON.stringify((next.places || []).map(function (place) { return place.id; }));
    var selectedChanged = data.selectedId !== next.selectedId;
    data = next;
    if (changed) {
      var all = new kakao.maps.LatLngBounds();
      all.extend(new kakao.maps.LatLng(next.center.lat, next.center.lon));
      (next.places || []).forEach(function (place) { all.extend(new kakao.maps.LatLng(place.lat, place.lon)); });
      map.setBounds(all, 70, 70, Math.max(70, Number(next.bottomInset || 0)), 70);
    } else if (selectedChanged && next.selectedId) {
      var picked = (next.places || []).find(function (place) { return place.id === next.selectedId; });
      if (picked) {
        var focus = new kakao.maps.LatLngBounds();
        focus.extend(new kakao.maps.LatLng(next.center.lat, next.center.lon));
        focus.extend(new kakao.maps.LatLng(picked.lat, picked.lon));
        map.setBounds(focus, 70, 70, Math.max(70, Number(next.bottomInset || 0)), 70);
      }
    }
    draw();
  } catch (_) {
    fail('runtime');
  }
};

function init() {
  if (window.__nearbySdkFailed) { fail('sdk_load'); return; }
  if (!window.kakao || !window.kakao.maps) { fail('sdk_unavailable'); return; }
  try {
    window.kakao.maps.load(function () {
      try {
        map = new window.kakao.maps.Map(document.getElementById('map'), {
          center: new window.kakao.maps.LatLng(${center.lat}, ${center.lon}),
          level: 6
        });
        window.kakao.maps.event.addListener(map, 'idle', draw);
        post({ action: 'ready' });
      } catch (_) {
        fail('sdk_init');
      }
    });
  } catch (_) {
    fail('sdk_init');
  }
}

init();
</script></body></html>`;
}

const s = StyleSheet.create({
  root: { overflow: 'hidden', backgroundColor: '#eef1f4' }, web: { flex: 1, backgroundColor: '#eef1f4' },
  fallback: { alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: C.panel2 },
  title: { color: C.txt, fontSize: 16, fontWeight: '900' }, copy: { color: C.muted, fontSize: 13, marginTop: 5, textAlign: 'center' },
});
