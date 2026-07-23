#!/usr/bin/env node
// src/data/busan_poi_catalog.json matched -> docs/reports/busan_matched_tmap.html
// TMAP appKey는 .env에서 읽어 HTML에 주입한다. 생성된 HTML 외부 공유 주의.
import fs from 'node:fs';
import path from 'node:path';

const INPUT = path.resolve('src/data/busan_poi_catalog.json');
const OUTPUT = path.resolve('docs/reports/busan_matched_tmap.html');

const payload = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));
const envText = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf-8') : '';
const env = Object.fromEntries(envText
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#') && line.includes('='))
  .map((line) => {
    const i = line.indexOf('=');
    return [line.slice(0, i), line.slice(i + 1).replace(/^['"]|['"]$/g, '')];
  }));
const tmapKey = env.EXPO_PUBLIC_TMAP_APP_KEY || env.TMAP_APP_KEY || '';
const places = payload.matched.data.map((p) => ({
  contentId: p.contentId,
  title: p.title,
  contentTypeName: p.contentTypeName,
  category: p.category,
  addr1: p.addr1,
  lat: p.lat,
  lon: p.lon,
  aihubName: p.aihubName,
  aihubCategory: p.aihubCategory,
  matchType: p.matchType,
  matchDistanceM: p.matchDistanceM,
  dwell: p.dwell,
}));

const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TimeFit 부산 매칭 장소 TMAP</title>
  <style>
    :root {
      --bg: #0f1419;
      --panel: #171d26;
      --panel2: #1e2630;
      --line: #2a3340;
      --txt: #e6edf3;
      --txt2: #cdd9e5;
      --muted: #9aa7b4;
      --accent: #4cc2ff;
      --green: #7ee787;
      --amber: #e3b341;
      --red: #ff7b72;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 100%; height: 100%; background: var(--bg); color: var(--txt); font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Segoe UI", sans-serif; }
    body { overflow: hidden; }
    .wrap { display: grid; grid-template-columns: minmax(0, 1fr) 390px; height: 100%; }
    #map { width: 100%; height: 100%; background: #101820; }
    aside { border-left: 1px solid var(--line); background: var(--bg); display: flex; flex-direction: column; min-width: 0; }
    header { padding: 16px 16px 12px; border-bottom: 1px solid var(--line); background: rgba(15,20,25,0.96); }
    h1 { margin: 0; font-size: 18px; line-height: 1.25; }
    .sub { margin-top: 5px; color: var(--muted); font-size: 12.5px; line-height: 1.45; }
    .keyrow { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; margin-top: 12px; }
    input, button, select { border: 1px solid var(--line); background: var(--panel); color: var(--txt); border-radius: 9px; padding: 10px 11px; font-size: 13px; }
    button { cursor: pointer; color: white; background: #2ea043; border-color: #2ea043; font-weight: 700; white-space: nowrap; }
    button.secondary { background: var(--panel2); border-color: var(--line); color: var(--txt2); }
    .filters { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; }
    .stat { padding: 10px; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; }
    .stat b { display: block; color: var(--accent); font-size: 17px; }
    .stat span { color: var(--muted); font-size: 11px; }
    .list { overflow: auto; padding: 10px; }
    .card { border: 1px solid var(--line); background: var(--panel); border-radius: 10px; padding: 11px; margin-bottom: 8px; cursor: pointer; }
    .card.active { border-color: var(--accent); box-shadow: 0 0 0 1px rgba(76,194,255,0.35) inset; }
    .name { font-size: 14px; font-weight: 750; line-height: 1.35; }
    .meta { color: var(--muted); font-size: 12px; margin-top: 4px; line-height: 1.45; }
    .dwell { color: var(--green); font-weight: 750; }
    .match { color: var(--amber); }
    .empty { color: var(--amber); padding: 14px; font-size: 13px; }
    .badge { display: inline-block; color: var(--txt2); border: 1px solid var(--line); border-radius: 999px; padding: 2px 7px; font-size: 11px; margin-right: 4px; }
    .notice { position: absolute; left: 16px; top: 16px; z-index: 20; max-width: 420px; background: rgba(23,29,38,0.96); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; color: var(--txt2); font-size: 13px; line-height: 1.5; }
    .notice.error { border-color: rgba(255,123,114,0.65); color: var(--red); }
    .notice strong { color: var(--txt); }
    @media (max-width: 860px) {
      body { overflow: auto; }
      .wrap { display: flex; flex-direction: column; height: auto; min-height: 100%; }
      #map { height: 58vh; min-height: 420px; }
      aside { border-left: 0; border-top: 1px solid var(--line); min-height: 42vh; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <main style="position:relative">
      <div id="notice" class="notice">
        <strong>TMAP 지도를 불러오는 중입니다.</strong><br />
        .env의 TMAP appKey를 사용합니다. 생성된 HTML은 외부에 공유하지 마세요.
      </div>
      <div id="map"></div>
    </main>
    <aside>
      <header>
        <h1>TimeFit 부산 매칭 장소</h1>
        <div class="sub">TourAPI 부산 장소 중 AI-Hub 부산 방문 데이터와 매칭된 후보만 표시합니다. 음식점/숙박/축제/여행코스는 제외했습니다.</div>
        <div class="keyrow">
          <input id="key" type="password" placeholder="TMAP appKey" autocomplete="off" />
          <button id="load">지도 로드</button>
        </div>
        <div class="filters">
          <select id="typeFilter">
            <option value="">전체 타입</option>
          </select>
          <select id="matchFilter">
            <option value="">전체 매칭</option>
            <option value="name+coord">이름+좌표</option>
            <option value="coord">좌표</option>
            <option value="name">이름</option>
          </select>
        </div>
        <div class="summary">
          <div class="stat"><b id="countAll">0</b><span>전체</span></div>
          <div class="stat"><b id="countShown">0</b><span>표시</span></div>
          <div class="stat"><b id="countMedian">0</b><span>중앙 체류</span></div>
        </div>
      </header>
      <div id="list" class="list"></div>
    </aside>
  </div>
  <script>
    const PLACES = ${JSON.stringify(places)};
    const META = ${JSON.stringify(payload.summary)};
    const EMBEDDED_TMAP_KEY = ${JSON.stringify(tmapKey)};
    const STORE_KEY = 'timefit_tmap_app_key';
    const BUSAN = { lat: 35.1796, lon: 129.0756 };
    let map = null;
    let markers = [];
    let selectedContentId = null;
    let current = [...PLACES];

    const $ = (id) => document.getElementById(id);
    const fmt = (n) => Number.isFinite(n) ? Math.round(n).toLocaleString('ko-KR') : '-';
    const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

    function loadTmapScript(key) {
      return new Promise((resolve, reject) => {
        if (window.Tmapv2) return resolve();
        const script = document.createElement('script');
        script.async = true;
        // apis.openapi.sk.com/tmap/jsv2 는 document.write로 본체 SDK를 삽입하는 로더라
        // 동적 로드/Live Server 환경에서 LatLng가 준비되지 않는 경우가 있다. 본체를 직접 로드한다.
        script.src = 'https://topopentile1.tmap.co.kr/scriptSDKV2/tmapjs2.min.js?version=20231206';
        script.onload = () => {
          const started = Date.now();
          const wait = () => {
            if (
              window.Tmapv2 &&
              typeof Tmapv2.Map === 'function' &&
              typeof Tmapv2.Marker === 'function' &&
              typeof Tmapv2.LatLng === 'function'
            ) return resolve();
            if (Date.now() - started > 5000) return reject(new Error('TMAP SDK 객체(Tmapv2)를 찾지 못했습니다.'));
            setTimeout(wait, 80);
          };
          wait();
        };
        script.onerror = () => reject(new Error('TMAP SDK 스크립트 로드 실패'));
        document.head.appendChild(script);
      });
    }

    function latLng(lat, lon) {
      return new Tmapv2.LatLng(lat, lon);
    }

    function latLngBounds() {
      return typeof Tmapv2.LatLngBounds === 'function' ? new Tmapv2.LatLngBounds() : null;
    }

    async function initMap() {
      try {
        const key = $('key').value.trim() || EMBEDDED_TMAP_KEY;
        if (!key) return alert('TMAP appKey를 입력하세요.');
        localStorage.setItem(STORE_KEY, key);
        $('notice').className = 'notice';
        $('notice').innerHTML = '<strong>TMAP 지도를 불러오는 중입니다.</strong><br />SDK 로드와 지도 초기화를 진행합니다.';
        $('notice').style.display = 'block';
        await loadTmapScript(key);
        if (!map) {
          map = new Tmapv2.Map('map', {
            center: latLng(BUSAN.lat, BUSAN.lon),
            zoom: 11,
            httpsMode: true
          });
        }
        $('notice').style.display = 'none';
        render();
      } catch (err) {
        $('notice').className = 'notice error';
        $('notice').style.display = 'block';
        $('notice').innerHTML = '<strong>TMAP 로드 실패</strong><br />' + escapeHtml(err && err.message ? err.message : String(err)) + '<br />file://로 열었다면 아래 명령으로 로컬 서버를 띄운 뒤 http://localhost:8000/docs/reports/busan_matched_tmap.html 로 여세요.<br /><code>python3 -m http.server 8000</code>';
        console.error(err);
      }
    }

    function clearMarkers() {
      markers.forEach((m) => m.setMap(null));
      markers = [];
    }

    function markerLabel(index, place) {
      return String(index + 1);
    }

    function fitToPlaces(list) {
      if (!map || !list.length) return;
      if (list.length === 1) {
        map.setCenter(latLng(list[0].lat, list[0].lon));
        map.setZoom(16);
        return;
      }
      const bounds = latLngBounds();
      if (bounds && typeof bounds.extend === 'function') {
        list.forEach((p) => bounds.extend(latLng(p.lat, p.lon)));
        map.fitBounds(bounds);
      } else {
        map.setCenter(latLng(BUSAN.lat, BUSAN.lon));
        map.setZoom(11);
      }
    }

    function renderMarkers(list) {
      if (!map) return;
      clearMarkers();
      list.forEach((p, i) => {
        const marker = new Tmapv2.Marker({
          position: latLng(p.lat, p.lon),
          map,
          title: p.title,
          label: markerLabel(i, p)
        });
        marker.addListener('click', () => selectPlace(p.contentId, true));
        markers.push(marker);
      });
      fitToPlaces(list);
    }

    function selectPlace(contentId, pan = false) {
      selectedContentId = contentId;
      const p = PLACES.find((x) => x.contentId === contentId);
      if (p && pan && map) {
        map.setCenter(latLng(p.lat, p.lon));
        map.setZoom(16);
      }
      renderList(current);
    }

    function cardHtml(p, i) {
      const active = p.contentId === selectedContentId ? ' active' : '';
      return '<div class="card' + active + '" data-id="' + escapeHtml(p.contentId) + '">' +
        '<div class="name">' + (i + 1) + '. ' + escapeHtml(p.title) + '</div>' +
        '<div class="meta">' +
          '<span class="badge">' + escapeHtml(p.contentTypeName) + '</span>' +
          '<span class="badge">' + escapeHtml(p.category) + '</span>' +
          '<span class="badge match">' + escapeHtml(p.matchType) + ' · ' + fmt(p.matchDistanceM) + 'm</span>' +
        '</div>' +
        '<div class="meta">' + escapeHtml(p.addr1) + '</div>' +
        '<div class="meta">AI-Hub: ' + escapeHtml(p.aihubName) + ' · <span class="dwell">중앙 ' + fmt(p.dwell.median) + '분</span> · p25 ' + fmt(p.dwell.p25) + ' / p75 ' + fmt(p.dwell.p75) + ' · n=' + fmt(p.dwell.count) + '</div>' +
      '</div>';
    }

    function renderList(list) {
      const el = $('list');
      if (!list.length) {
        el.innerHTML = '<div class="empty">조건에 맞는 장소가 없습니다.</div>';
        return;
      }
      el.innerHTML = list.map(cardHtml).join('');
      el.querySelectorAll('.card').forEach((card) => {
        card.addEventListener('click', () => selectPlace(card.dataset.id, true));
      });
      const active = el.querySelector('.card.active');
      if (active) active.scrollIntoView({ block: 'nearest' });
    }

    function applyFilters() {
      const type = $('typeFilter').value;
      const match = $('matchFilter').value;
      current = PLACES.filter((p) => (!type || p.contentTypeName === type) && (!match || p.matchType === match));
      const med = current.length ? Math.round(current.reduce((n, p) => n + p.dwell.median, 0) / current.length) : 0;
      $('countShown').textContent = current.length;
      $('countMedian').textContent = med ? med + '분' : '-';
      renderList(current);
      renderMarkers(current);
    }

    function render() {
      applyFilters();
    }

    function initControls() {
      $('countAll').textContent = PLACES.length;
      const types = [...new Set(PLACES.map((p) => p.contentTypeName))].sort((a, b) => a.localeCompare(b, 'ko'));
      $('typeFilter').innerHTML += types.map((t) => '<option value="' + escapeHtml(t) + '">' + escapeHtml(t) + '</option>').join('');
      $('typeFilter').addEventListener('change', applyFilters);
      $('matchFilter').addEventListener('change', applyFilters);
      $('load').addEventListener('click', initMap);
      const saved = localStorage.getItem(STORE_KEY);
      if (saved) $('key').value = saved;
      else if (EMBEDDED_TMAP_KEY) $('key').value = EMBEDDED_TMAP_KEY;
      renderList(PLACES);
      $('countShown').textContent = PLACES.length;
      $('countMedian').textContent = Math.round(PLACES.reduce((n, p) => n + p.dwell.median, 0) / PLACES.length) + '분';
    }

    initControls();
    if (EMBEDDED_TMAP_KEY) initMap();
  </script>
</body>
</html>
`;

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, html);
console.log(`saved ${OUTPUT}`);
