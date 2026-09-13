import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPlacePreviewKind } from '../../src/ui/recommendation/courseV1PlacePreviewModel';
import { buildPlaceDetailModel, buildPlaceDetailMarkers } from '../../src/ui/placeDetailModel';
import { buildNearbyBrowseDataset } from '../../src/ui/nearbyBrowseModel';
import catalog from '../../src/data/busan_poi_catalog.json';
import { approvedPlacePhoto } from '../../src/ui/placePhotoModel';
import { buildCourseV1CardSummary, buildCourseV1DetailModel, buildCourseV1DetailMarkers } from '../../src/ui/recommendation/courseV1CardDetailModel';

export const photoPlace = {contentId:'photo-1',title:'공식 사진 장소',lat:35.1,lon:129.1,classification:'representative_core',imageUrl:'https://example.org/approved.jpg',imageSource:'busan_official',imageEvidence:{usagePermission:{status:'verified',rightsHolder:'부산광역시',sourcePageUrl:'https://example.org/source',licenseName:'이용허락범위 제한 없음',licenseUrl:'https://example.org/license',attribution:'사진 제공: 부산광역시',commercialUseAllowed:true,modificationAllowed:true,verifiedAt:'2026-09-07'}}};
test('unapproved URL is not a display permission', () => {
  assert.equal(getPlacePreviewKind({...photoPlace,imageEvidence:undefined}, false).kind, 'placeholder');
});
test('approved, missing, failed and restricted photos are distinct inputs', () => {
  assert.equal(getPlacePreviewKind(photoPlace,false).kind,'image');
  assert.equal(getPlacePreviewKind({...photoPlace,imageUrl:null},false).kind,'placeholder');
  assert.equal(getPlacePreviewKind(photoPlace,true).kind,'placeholder');
  const restricted = {...photoPlace,imageEvidence:{usagePermission:{...photoPlace.imageEvidence.usagePermission,modificationAllowed:false}}};
  assert.equal(getPlacePreviewKind(restricted,false).kind,'placeholder');
  assert.equal(buildNearbyBrowseDataset(photoPlace,[restricted])[0].imageUrl,null);
  assert.equal(buildPlaceDetailModel(restricted,'first').image.kind,'category_fallback');
});
test('approved metadata reaches detail, nearby rows and marker source', () => {
  assert.equal(buildPlaceDetailModel(photoPlace,'first').image.kind,'remote');
  assert.equal(buildNearbyBrowseDataset(photoPlace,[photoPlace])[0].imageUrl,photoPlace.imageUrl);
  const session = {origin:{lat:35,lon:129},deviceLocationSnapshot:null} as any;
  const markers = buildPlaceDetailMarkers(session,photoPlace);
  assert.equal(markers.at(-1)?.imageUrl,photoPlace.imageUrl);
  assert.deepEqual((markers.at(-1) as any).imageEvidence,photoPlace.imageEvidence);
});
test('current public catalog photos resolve identically without resurrecting historical URLs', () => {
  const rows=[...catalog.matched.data,...catalog.unmatched.data];
  const photos=rows.filter(row=>approvedPlacePhoto(row));
  assert.ok(photos.length>0,'data handoff must restore at least one approved URL before actual recovery is claimed');
  for(const row of photos) {
    const approved=approvedPlacePhoto(row)!;
    const image=buildPlaceDetailModel(row,'first').image;
    assert.equal(image.kind==='remote' ? image.url : null,approved.url);
    assert.equal(getPlacePreviewKind(row,false).kind,'image');
    assert.equal(buildPlaceDetailModel(row,'first').image.kind,'remote');
    const nearby=buildNearbyBrowseDataset(row,[row]);
    if(nearby.length) assert.equal(nearby[0].imageUrl,approved.url);
  }
  assert.equal(approvedPlacePhoto(rows.find(row=>row.contentId==='historical-removed-place')),null);
});
test('data handoff fixed attraction/food/shopping/TourAPI fixtures agree across recommendation, course and maps', () => {
  const rows=new Map([...catalog.matched.data,...catalog.unmatched.data].map(row=>[row.contentId,row]));
  for(const [id,allowed] of [['poi_19',true],['poi_1047',true],['poi_13',false],['poi_1',false]] as const){
    const place=rows.get(id)!;assert.ok(place);
    const course:any={id,placeIds:[id],stops:[{placeId:id,stayMin:20,stayState:'normal'}],legs:[{fromId:'origin',toId:id,min:5,mode:'walk'},{fromId:id,toId:'destination',min:5,mode:'walk'}],travelMin:10,stayMin:20,totalMin:40,arrivalBufferMin:10};
    const session:any={origin:{lat:35,lon:129,label:'출발'},destination:null};
    const summary=buildCourseV1CardSummary(course,'추천',key=>rows.get(key))!;
    const detail=buildCourseV1DetailModel(course,session,key=>rows.get(key))!;
    const markers=buildCourseV1DetailMarkers(detail,session)!;
    assert.equal(!!approvedPlacePhoto(summary.place),allowed);
    assert.equal(!!approvedPlacePhoto(detail.stops[0].place),allowed);
    assert.equal(!!approvedPlacePhoto(markers.find(m=>m.kind==='spot')),allowed);
    assert.equal(buildPlaceDetailModel(place,'first').image.kind,allowed?'remote':'category_fallback');
    assert.equal(!!buildNearbyBrowseDataset(place,[place])[0].imageUrl,allowed);
  }
});
