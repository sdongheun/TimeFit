#!/usr/bin/env node
// 실제 TMAP 수집 전, 생활권별 의미 있는 출발·도착 거점과 1~3곳 후보를 명시적으로 검증한다.
import fs from 'node:fs';
const PROFILE='data/processed/review/부산_장소_근거프로필_재분류.json', AVAILABILITY='data/processed/review/부산_장소_구조화_운영시간.json', OUTPUT='data/processed/review/실경로_수집계획.json';
const boroughs=['중구','서구','동구','영도구','부산진구','동래구','남구','북구','해운대구','사하구','금정구','강서구','연제구','수영구','사상구','기장군'];
const plans=[
  ['중구','poi_13','관광·상권 진입점',['poi_165','poi_203','poi_745'],'poi_92','별도 약속 거점'],
  ['서구','poi_173','송도 해안 관광 진입점',['poi_193','poi_221'],'poi_620','박물관 약속 거점'],
  ['동구','poi_738','북항 수변 관광 진입점',['poi_225','poi_253','poi_616'],'poi_305','전통시장 약속 거점'],
  ['영도구','poi_107','영도 시장 상권 진입점',['poi_214','poi_223','poi_608'],'poi_220','노을 전망 약속 거점'],
  ['부산진구','poi_1051','서면 약속 진입점',['poi_213','poi_656','poi_711'],'poi_801','백화점 약속 거점'],
  ['동래구','poi_247','수안 역사 관광 진입점',['poi_246','poi_274','poi_450'],'poi_803','백화점 약속 거점'],
  ['남구','poi_229','UN평화공원 관광 진입점',['poi_241','poi_622','poi_150'],'poi_621','역사관 약속 거점'],
  ['북구','poi_287','구포시장 상권 진입점',['poi_740','poi_134'],'poi_265','문화예술회관 약속 거점'],
  ['해운대구','poi_174','마린시티 관광 진입점',['poi_19','poi_22','poi_37'],'poi_3','센텀 약속 거점'],
  ['사하구','poi_641','을숙도 관광 진입점',['poi_144','poi_630'],'poi_553','괴정 약속 거점'],
  ['금정구','poi_260','부산대 문화 진입점',['poi_306','poi_403','poi_89'],'poi_1052','부산대 상권 약속 거점'],
  ['강서구','poi_297','명지시장 상권 진입점',['poi_171','poi_252','poi_473'],'poi_713','대저 생태 약속 거점'],
  ['연제구','poi_258','연산도서관 문화 진입점',['poi_421'],'poi_1068','교대 약속 거점'],
  ['수영구','poi_79','광안리 해변 관광 진입점',['poi_125'],'poi_273','광안동 약속 거점'],
  ['사상구','poi_700','부산도서관 문화 진입점',['poi_264','poi_266','poi_185'],'poi_304','새벽시장 약속 거점'],
  ['기장군','poi_787','기장시장 상권 진입점',['poi_244','poi_554','poi_612'],'poi_231','학리항 약속 거점'],
];
const profile=JSON.parse(fs.readFileSync(PROFILE,'utf8')).data, byId=new Map(profile.map(p=>[p.id,p])), availability=new Map(JSON.parse(fs.readFileSync(AVAILABILITY,'utf8')).data.map(a=>[a.placeId,a]));
const borough=(address='')=>[...boroughs].sort((a,b)=>b.length-a.length).find(x=>address.includes(x))??'권역미확인';
const valid=(id, area)=>{const p=byId.get(id),a=availability.get(id);if(!p)return 'missing_place';if(borough(p.address)!==area)return `borough_mismatch:${borough(p.address)}`;if(!p.classification?.startsWith('representative'))return `not_representative:${p.classification}`;if(a?.status!=='structured')return 'availability_not_structured';if(!Number.isFinite(p.lat)||!Number.isFinite(p.lon))return 'invalid_coordinate';return null;};
const data=plans.map(([boroughName,originId,originReason,candidateIds,destinationId,destinationReason])=>{const all=[originId,...candidateIds,...(destinationId?[destinationId]:[])], errors=Object.fromEntries(all.map(id=>[id,valid(id,boroughName)]).filter(([,e])=>e));const duplicates=all.filter((id,i)=>all.indexOf(id)!==i),coordinateIds=new Map();for(const id of all){const p=byId.get(id),k=p?`${p.lat},${p.lon}`:id;coordinateIds.set(k,[...(coordinateIds.get(k)??[]),id]);}for(const ids of coordinateIds.values())if(ids.length>1)for(const id of ids)errors[id]='coordinate_duplicate_in_plan';return {borough:boroughName,origin:{placeId:originId,reason:originReason},candidatePlaceIds:candidateIds,destination:destinationId?{placeId:destinationId,reason:destinationReason}:null,plannedCourseSizes:[1,2,...(candidateIds.length>=3?[3]:[])],missingCourseSizes:[...(candidateIds.length<3?[3]:[])],status:Object.keys(errors).length||duplicates.length?'needs_review':'ready_for_tmap_snapshot',validationErrors:errors,duplicateIds:duplicates};});
const summary={total:data.length,ready:data.filter(x=>x.status==='ready_for_tmap_snapshot').length,needsReview:data.filter(x=>x.status!=='ready_for_tmap_snapshot').length};
fs.writeFileSync(OUTPUT,`${JSON.stringify({meta:{generatedAt:'2026-08-24',source:[PROFILE,AVAILABILITY],purpose:'전체 매트릭스 확장 전 실제 경로 수집 대상의 의미·동일성·운영시간 입력을 검증한다.'},summary,data},null,2)}\n`);
console.log(`실경로 수집계획: ready ${summary.ready}/${summary.total} -> ${OUTPUT}`);
