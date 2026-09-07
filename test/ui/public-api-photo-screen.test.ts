import test from 'node:test';
import assert from 'node:assert/strict';
import { screenRuntime } from './support/screenRuntime.mjs';
import { approvedPhotoEvidence } from './fixtures/approvedPhoto.mjs';
import { buildNearbyBrowseDataset } from '../../src/ui/nearbyBrowseModel';
const place = {contentId:'photo',title:'사진 장소',category:'문화시설',lat:35,lon:129,imageUrl:'https://example.test/photo.jpg',imageEvidence:approvedPhotoEvidence};
const isImage = (node: {type: unknown}) => node.type === 'Image';

test('production recommendation card loads, fails safely and preserves selection without retries', t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const runtime=screenRuntime();
  const { CourseV1SummaryCard }=runtime.load('src/ui/recommendation/CourseV1SummaryCard.tsx');
  let taps=0;
  const screen=runtime.mount(CourseV1SummaryCard,{summary:{place,course:{id:'a'},label:'추천',activityLabel:'전시',accessibilityLabel:'장소 확인',courseMin:30},onPress:()=>taps++});
  try {
    assert.equal(screen.nodes(isImage).length,1);
    assert.equal(screen.nodes(isImage)[0].props.style.at(-1).opacity,0);
    screen.nodes(isImage)[0].props.onLoad();
    assert.equal(screen.nodes(isImage)[0].props.style.at(-1).opacity,1);
    screen.nodes(isImage)[0].props.onError();
    assert.equal(screen.nodes(isImage).length,0);
    t.mock.timers.tick(24000);
    assert.equal(screen.nodes(isImage).length,0);
    screen.press('verified-course-card-a');assert.equal(taps,1);
    assert.equal(screen.nodes((n:{props:any})=>n.props.testID==='place-photo-credit').length,1);
  } finally {screen.unmount();}
});
test('production photo times out to fallback and ignores late success', t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const runtime=screenRuntime(), {PlacePhoto}=runtime.load('src/ui/PlacePhoto.tsx');
  const screen=runtime.mount(PlacePhoto,{place,fallback:'기본 이미지'});
  const late=screen.nodes(isImage)[0].props.onLoad;
  t.mock.timers.tick(12000);assert.equal(screen.nodes(isImage).length,0);
  late();assert.equal(screen.nodes(isImage).length,0);
  screen.unmount();
});
test('visible credit links use approved source and license; link failure is contained', async () => {
  const runtime=screenRuntime(), urls:string[]=[];
  Object.assign(runtime.native.Linking,{openURL:async (url:string)=>{urls.push(url);}});
  const {PlacePhotoCredit}=runtime.load('src/ui/PlacePhoto.tsx');
  const screen=runtime.mount(PlacePhotoCredit,{place,links:true});
  const links=()=>screen.nodes((n:{props:any})=>n.props.accessibilityRole==='link');
  await links()[0].props.onPress();await links()[1].props.onPress();
  assert.deepEqual(urls,['https://example.test/source','https://example.test/license']);
  Object.assign(runtime.native.Linking,{openURL:async ()=>{throw Error('offline');}});
  await links()[0].props.onPress();await Promise.resolve();
  assert.equal(screen.nodes((n:{props:any})=>n.props.accessibilityRole==='alert').length,1);
  screen.unmount();
});
test('photo-less, unapproved historical, unknown and no-modification inputs never mount Image', () => {
  for(const input of [{}, {...place,imageEvidence:undefined},{...place,imageEvidence:{usagePermission:{...approvedPhotoEvidence.usagePermission,modificationAllowed:false}}},{...place,imageEvidence:{usagePermission:{...approvedPhotoEvidence.usagePermission,modificationAllowed:undefined}}}]){
    const runtime=screenRuntime(), {PlacePhoto}=runtime.load('src/ui/PlacePhoto.tsx');
    const screen=runtime.mount(PlacePhoto,{place:input,fallback:'기본 아이콘'});
    assert.equal(screen.nodes(isImage).length,0);screen.unmount();
  }
});

test('both production WebView bridges strip unapproved/restricted URLs and preserve approved photos', () => {
  const inputs=[place,{...place,contentId:'blocked',imageEvidence:undefined},{...place,contentId:'restricted',imageEvidence:{usagePermission:{...approvedPhotoEvidence.usagePermission,modificationAllowed:false}}}];
  for(const kind of ['route','nearby']) {
    const scripts:string[]=[];
    const runtime=screenRuntime({__process:{env:{EXPO_PUBLIC_KAKAO_JAVASCRIPT_API_KEY:'fixture-key'}},'react-native-webview':{WebView:'WebView'}});
    const component=kind==='route'?runtime.load('src/ui/KakaoRouteMap.tsx').KakaoRouteMap:runtime.load('src/ui/NearbyBrowseMap.tsx').NearbyBrowseMap;
    const props=kind==='route'?{points:[place],line:[],markers:inputs.map(p=>({...p,label:p.title,kind:'spot'})),usePhotoMarkers:true}
      :{center:place,places:buildNearbyBrowseDataset(place,inputs.map(p=>({...p,classification:'representative_core'}))),selectedId:null,bottomInset:100,retryKey:0,onSelect(){},onCluster(){},onError(){},onReady(){}};
    const screen=runtime.mount(component,props);
    const web=screen.nodes((n:{type:unknown})=>n.type==='WebView')[0];
    web.props.ref.current={injectJavaScript:(script:string)=>scripts.push(script)};
    web.props.onMessage({nativeEvent:{data:JSON.stringify(kind==='route'?{type:'ready'}:{action:'ready'})}});
    screen.render();
    const script=scripts.at(-1)!;
    const payload=JSON.parse(script.slice(script.indexOf('(')+1,script.lastIndexOf(');true;')));
    const photos=kind==='route'?payload.markers:payload.places;
    assert.equal(photos.filter((p:{imageUrl:string|null})=>p.imageUrl===place.imageUrl).length,1);
    assert.equal(photos.filter((p:{imageUrl:string|null})=>p.imageUrl===null).length,2);
    screen.unmount();
  }
});
