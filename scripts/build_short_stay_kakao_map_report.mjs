#!/usr/bin/env node
// 자투리 장소 병렬 카탈로그를 카카오맵 검토용 HTML로 생성한다.
// JavaScript 키가 포함되므로 생성 HTML은 .gitignore에만 둔다.
import fs from 'node:fs';
import path from 'node:path';

const INPUT = 'data/processed/review/부산_자투리장소_카탈로그_초안.json';
const OUTPUT = 'docs/reports/부산_자투리장소_분포지도.html';

function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=');
      return [line.slice(0, separator), line.slice(separator + 1).replace(/^['"]|['"]$/g, '')];
    }));
}

const env = { ...readEnv('.env'), ...readEnv('.env.local') };
const appKey = env.EXPO_PUBLIC_KAKAO_JAVASCRIPT_API_KEY || env.Kakao_JAVASCRIPT_API_KEY || '';
if (!appKey) throw new Error('Kakao JavaScript API 키가 필요합니다.');

const catalog = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
const places = catalog.data
  .filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lon))
  .map((place) => ({
    id: place.id,
    title: place.title,
    address: place.address,
    lat: place.lat,
    lon: place.lon,
    category: place.category,
    shortStayType: place.shortStayType,
    selectionStatus: place.selectionStatus,
    candidateTier: place.candidateTier ?? 'standard',
    minStayMin: place.minStayMin,
    recommendedStayMin: place.recommendedStayMin,
    maxStayMin: place.maxStayMin,
    hasOperatingHours: Boolean(place.selectionEvidence?.hasOperatingHours),
    operatingHours: place.operatingHours ?? [],
    notice: place.availabilityNotice ?? '운영시간과 체류 근거가 확인된 기본 후보입니다.',
    mapSearchUrl: place.mapSearchUrl ?? `https://map.kakao.com/link/search/${encodeURIComponent(place.title)}`,
    source: place.sourceEvidence?.map((source) => source.source).join(', ') ?? '',
  }));

const safeJson = JSON.stringify(places).replace(/<\//g, '<\\/');
const safeSummary = JSON.stringify(catalog.summary).replace(/<\//g, '<\\/');

const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TimeFit 부산 자투리 장소 분포</title>
  <style>
    :root { --ink:#17212b; --muted:#627080; --line:#d7dfe6; --paper:#fff; --bg:#eef2f5; --blue:#1467c5; --orange:#dd6b20; --green:#177c4b; }
    * { box-sizing:border-box; }
    html,body { width:100%; height:100%; margin:0; font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif; color:var(--ink); background:var(--bg); }
    body { overflow:hidden; }
    .layout { height:100%; display:grid; grid-template-columns:minmax(0,1fr) 360px; }
    .map-wrap { position:relative; min-height:0; }
    #map { width:100%; height:100%; background:#d9e5ea; }
    .map-header { position:absolute; left:18px; top:18px; z-index:5; padding:13px 15px; border:1px solid rgba(21,37,52,.16); border-radius:8px; background:rgba(255,255,255,.96); box-shadow:0 4px 18px rgba(26,42,55,.13); }
    .map-header strong { display:block; font-size:16px; }
    .map-header span { display:block; margin-top:3px; font-size:12px; color:var(--muted); }
    .legend { display:flex; gap:10px; margin-top:9px; font-size:11px; color:var(--muted); }
    .dot { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:4px; vertical-align:1px; }
    .dot.standard { background:var(--blue); }.dot.conditional { background:var(--orange); }
    .map-error { display:none; position:absolute; inset:18px auto auto 18px; z-index:10; max-width:460px; padding:14px; border:1px solid #b8544b; border-radius:8px; color:#812b24; background:#fff7f5; line-height:1.5; font-size:13px; }
    aside { min-width:0; display:flex; flex-direction:column; background:var(--paper); border-left:1px solid var(--line); }
    header { padding:18px; border-bottom:1px solid var(--line); }
    h1 { margin:0; font-size:18px; letter-spacing:0; }
    .sub { margin:5px 0 14px; color:var(--muted); line-height:1.45; font-size:12px; }
    .stats { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
    .stat { border:1px solid var(--line); border-radius:6px; padding:9px 8px; }
    .stat b { display:block; font-size:17px; color:var(--blue); }.stat small { color:var(--muted); font-size:10px; }
    .filters { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:12px; }
    select { min-width:0; border:1px solid var(--line); border-radius:6px; padding:9px; color:var(--ink); background:white; font-size:12px; }
    .list { overflow:auto; padding:10px; }
    .place { width:100%; border:1px solid var(--line); border-radius:7px; background:#fff; padding:11px; margin:0 0 8px; text-align:left; cursor:pointer; }
    .place:hover,.place.active { border-color:var(--blue); box-shadow:0 0 0 1px rgba(20,103,197,.18); }
    .topline { display:flex; align-items:center; justify-content:space-between; gap:8px; }
    .name { font-size:14px; font-weight:700; line-height:1.35; }.meta { margin-top:5px; color:var(--muted); font-size:11px; line-height:1.45; }
    .pill { flex:none; border-radius:999px; padding:3px 7px; font-size:10px; font-weight:700; }.pill.standard { color:#0754aa; background:#e8f1ff; }.pill.conditional { color:#96420e; background:#fff0e4; }
    .empty { padding:20px 10px; color:var(--muted); font-size:13px; }
    .overlay { min-width:200px; max-width:270px; padding:11px; border:1px solid #bac7d0; border-radius:7px; background:white; box-shadow:0 5px 18px rgba(16,34,47,.2); transform:translateY(-42px); }
    .overlay strong { display:block; font-size:13px; line-height:1.35; }.overlay p { margin:5px 0 0; color:var(--muted); font-size:11px; line-height:1.45; }.overlay a { display:inline-block; margin-top:8px; color:#0754aa; font-size:11px; text-decoration:none; font-weight:700; }
    @media (max-width:820px) { body{overflow:auto}.layout{display:flex; flex-direction:column; height:auto; min-height:100%;}.map-wrap{height:58vh; min-height:420px;} aside{border-left:0;border-top:1px solid var(--line);min-height:42vh;}.list{max-height:52vh;} }
  </style>
</head>
<body>
  <div class="layout">
    <main class="map-wrap">
      <div id="map"></div>
      <div class="map-header"><strong>부산 자투리 장소 분포</strong><span>초안 카탈로그의 기본·조건부 후보만 표시</span><div class="legend"><span><i class="dot standard"></i>기본 후보</span><span><i class="dot conditional"></i>조건부 후보</span></div></div>
      <div id="mapError" class="map-error"></div>
    </main>
    <aside>
      <header>
        <h1>장소 후보</h1>
        <div class="sub">조건부 후보는 운영시간 또는 체류 근거가 부족합니다. 지도에서 위치를 보고 카카오맵으로 확인한 뒤 선택하는 용도입니다.</div>
        <div class="stats"><div class="stat"><b id="total">0</b><small>전체 후보</small></div><div class="stat"><b id="standard">0</b><small>기본</small></div><div class="stat"><b id="conditional">0</b><small>조건부</small></div></div>
        <div class="filters"><select id="tier"><option value="">전체 상태</option><option value="standard">기본 후보</option><option value="conditional">조건부 후보</option></select><select id="category"><option value="">전체 카테고리</option></select></div>
      </header>
      <div id="list" class="list"></div>
    </aside>
  </div>
  <script>
    const PLACES = ${safeJson};
    const SUMMARY = ${safeSummary};
    const KAKAO_APP_KEY = ${JSON.stringify(appKey)};
    const BUSAN = { lat:35.1796, lon:129.0756 };
    let map, overlay, markers = [], selectedId = null, shown = [...PLACES];
    const $ = (id) => document.getElementById(id);
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const label = (place) => place.candidateTier === 'standard' ? '기본' : '조건부';
    const color = (place) => place.candidateTier === 'standard' ? '#1467c5' : '#dd6b20';

    function markerImage(place) {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="38" viewBox="0 0 30 38"><path fill="'+color(place)+'" stroke="#fff" stroke-width="2" d="M15 1C7.8 1 2 6.8 2 14c0 9.7 13 22 13 22s13-12.3 13-22C28 6.8 22.2 1 15 1z"/><circle cx="15" cy="14" r="5" fill="#fff"/></svg>';
      return new kakao.maps.MarkerImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), new kakao.maps.Size(30, 38), { offset:new kakao.maps.Point(15, 38) });
    }
    function init() {
      try {
        map = new kakao.maps.Map($('map'), { center:new kakao.maps.LatLng(BUSAN.lat,BUSAN.lon), level:9 });
        overlay = new kakao.maps.CustomOverlay({ zIndex:20 });
        const categories = [...new Set(PLACES.map(p=>p.category))].sort((a,b)=>a.localeCompare(b,'ko'));
        $('category').innerHTML += categories.map(c=>'<option value="'+escapeHtml(c)+'">'+escapeHtml(c)+'</option>').join('');
        $('tier').addEventListener('change', filter); $('category').addEventListener('change', filter);
        $('total').textContent = PLACES.length; $('standard').textContent = PLACES.filter(p=>p.candidateTier==='standard').length; $('conditional').textContent = PLACES.filter(p=>p.candidateTier==='conditional').length;
        render();
      } catch (error) { fail(error); }
    }
    function fail(error) { const box=$('mapError'); box.style.display='block'; box.innerHTML='<b>카카오 지도 로드 실패</b><br>'+escapeHtml(error?.message||error)+'<br>카카오 개발자 콘솔에 현재 로컬 주소를 JavaScript 플랫폼으로 등록한 뒤, 로컬 서버 주소로 여세요.'; }
    function filter() { const tier=$('tier').value, category=$('category').value; shown=PLACES.filter(p=>(!tier||p.candidateTier===tier)&&(!category||p.category===category)); selectedId=null; overlay.setMap(null); render(); }
    function clearMarkers() { markers.forEach(marker=>marker.setMap(null)); markers=[]; }
    function render() { clearMarkers(); shown.forEach(place=>{ const marker=new kakao.maps.Marker({map,position:new kakao.maps.LatLng(place.lat,place.lon),title:place.title,image:markerImage(place)}); kakao.maps.event.addListener(marker,'click',()=>select(place.id,true)); markers.push(marker); }); renderList(); }
    function select(id, move) { selectedId=id; const place=PLACES.find(p=>p.id===id); if(!place) return; const position=new kakao.maps.LatLng(place.lat,place.lon); if(move) map.panTo(position); const range=place.minStayMin+'~'+place.recommendedStayMin+'~'+place.maxStayMin+'분'; overlay.setPosition(position); overlay.setContent('<div class="overlay"><strong>'+escapeHtml(place.title)+'</strong><p>'+escapeHtml(place.category)+' · '+escapeHtml(place.shortStayType||'분류 보류')+'<br>체류 최소·권장·최대: '+range+'<br>'+escapeHtml(place.notice)+'</p><a target="_blank" rel="noreferrer" href="'+escapeHtml(place.mapSearchUrl)+'">카카오맵에서 확인</a></div>'); overlay.setMap(map); renderList(); }
    function renderList() { const list=$('list'); if(!shown.length){list.innerHTML='<div class="empty">조건에 맞는 장소가 없습니다.</div>';return;} list.innerHTML=shown.map(place=>'<button class="place '+(place.id===selectedId?'active':'')+'" data-id="'+escapeHtml(place.id)+'"><div class="topline"><span class="name">'+escapeHtml(place.title)+'</span><span class="pill '+place.candidateTier+'">'+label(place)+'</span></div><div class="meta">'+escapeHtml(place.category)+' · '+place.minStayMin+'~'+place.recommendedStayMin+'~'+place.maxStayMin+'분<br>'+escapeHtml(place.address||'주소 미기재')+'</div></button>').join(''); list.querySelectorAll('.place').forEach(button=>button.addEventListener('click',()=>select(button.dataset.id,true))); }
    const script=document.createElement('script'); script.src='https://dapi.kakao.com/v2/maps/sdk.js?appkey='+encodeURIComponent(KAKAO_APP_KEY)+'&autoload=false'; script.onload=()=>kakao.maps.load(init); script.onerror=()=>fail(new Error('Kakao Maps SDK를 불러오지 못했습니다.')); document.head.appendChild(script);
  </script>
</body>
</html>`;

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, html);
console.log(`카카오 지도 보고서 ${places.length}개 -> ${OUTPUT}`);
