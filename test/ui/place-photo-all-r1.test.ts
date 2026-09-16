import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import catalog from '../../src/data/busan_poi_catalog.json';
import { approvedPlacePhoto } from '../../src/ui/placePhotoModel';
import { screenRuntime } from './support/screenRuntime.mjs';

const operatorPlace = {
  contentId: 'operator-photo',
  imageUrl: 'https://example.test/operator.jpg',
  imageSource: 'tourapi',
  imageEvidence: {
    source: 'tourapi',
    sourceId: '1234',
    finalUrl: 'https://example.test/operator.jpg',
    usagePermission: {
      basis: 'operator_decision',
      status: 'operator_approved',
      sourceName: '한국관광공사 TourAPI',
      attribution: '사진 출처: 한국관광공사 TourAPI',
      displayConditions: '앱 운영자 표시 결정. 개별 권리·라이선스·변경 허용은 확인되지 않음.',
      approvedAt: '2026-09-16',
    },
  },
};

test('R1 consumes 101 verified and 102 operator-approved photos without inventing license metadata', () => {
  const rows = [...catalog.matched.data, ...catalog.unmatched.data];
  const photos = rows.map(row => approvedPlacePhoto(row)).filter(Boolean);
  assert.equal(photos.length, 203);
  assert.equal(photos.filter(photo => photo?.status === 'verified').length, 101);
  assert.equal(photos.filter(photo => photo?.status === 'operator_approved').length, 102);

  const operator = approvedPlacePhoto(operatorPlace);
  assert.equal(operator?.attribution, '사진 출처: 한국관광공사 TourAPI');
  assert.equal(operator?.licenseName, null);
  assert.equal(operator?.sourcePageUrl, null);
  assert.equal(operator?.licenseUrl, null);
  assert.equal(approvedPlacePhoto({ ...operatorPlace, imageUrl: 'https://example.test/mismatch.jpg' }), null);
  assert.equal(approvedPlacePhoto({ ...operatorPlace, imageUrl: 'http://example.test/operator.jpg' }), null);

  const runtime = screenRuntime();
  const { PlacePhotoCredit } = runtime.load('src/ui/PlacePhoto.tsx');
  const screen = runtime.mount(PlacePhotoCredit, { place: operatorPlace, links: true });
  assert.match(JSON.stringify(screen.get('place-photo-credit')), /사진 출처: 한국관광공사 TourAPI/);
  assert.equal(screen.nodes((node: { props: Record<string, unknown> }) => node.props.accessibilityRole === 'link').length, 0);
  screen.unmount();
});

test('R1 photo surface uses contain for portrait, landscape and square inputs without rounded clipping', () => {
  for (const suffix of ['portrait', 'landscape', 'square']) {
    const runtime = screenRuntime();
    const { PlacePhoto } = runtime.load('src/ui/PlacePhoto.tsx');
    const screen = runtime.mount(PlacePhoto, {
      place: { ...operatorPlace, imageUrl: `https://example.test/${suffix}.jpg`, imageEvidence: { ...operatorPlace.imageEvidence, finalUrl: `https://example.test/${suffix}.jpg` } },
      fallback: '기본 이미지',
    });
    const image = screen.nodes((node: { type: unknown }) => node.type === 'Image')[0];
    assert.equal(image.props.resizeMode, 'contain');
    assert.equal(image.props.style.flat().some((style: Record<string, unknown>) => 'borderRadius' in style || style.overflow === 'hidden'), false);
    screen.unmount();
  }
  const source = fs.readFileSync('src/ui/PlacePhoto.tsx', 'utf8');
  assert.doesNotMatch(source, /resizeMode="cover"|frame:\{[^}]*overflow:'hidden'/);
});

test('R1 recommendation photo fills its fixed media slot instead of collapsing to zero size', () => {
  const runtime = screenRuntime();
  const { CourseV1SummaryCard } = runtime.load('src/ui/recommendation/CourseV1SummaryCard.tsx');
  const screen = runtime.mount(CourseV1SummaryCard, {
    summary: {
      place: operatorPlace,
      course: { id: 'operator-course' },
      activityLabel: '둘러보기',
      accessibilityLabel: '운영자 승인 사진 장소',
      courseMin: 30,
      short: false,
    },
    onPress() {},
  });
  const photoSlot = screen.get('recommendation-place-photo');
  const style = photoSlot.props.style.flat().reduce((merged: Record<string, unknown>, value: Record<string, unknown>) => ({ ...merged, ...value }), {});
  assert.equal(style.flex, 1);
  assert.equal(screen.nodes((node: { type: unknown }) => node.type === 'Image').length, 1);
  screen.unmount();
});

test('R1 photo letterbox blends into the dark card surface without cropping or image processing', () => {
  const runtime = screenRuntime();
  const { PlacePhoto } = runtime.load('src/ui/PlacePhoto.tsx');
  const { C } = runtime.load('src/ui/theme.ts');
  const screen = runtime.mount(PlacePhoto, { place: operatorPlace, fallback: '기본 이미지' });
  const root = screen.render();
  const style = root.props.style.flat().reduce((merged: Record<string, unknown>, value: Record<string, unknown>) => ({ ...merged, ...value }), {});
  const image = screen.nodes((node: { type: unknown }) => node.type === 'Image')[0];
  assert.equal(style.backgroundColor, C.panel);
  assert.equal(image.props.resizeMode, 'contain');
  assert.equal(image.props.blurRadius, undefined);
  screen.unmount();
});

test('R1 maps receive no photo URL and contain no image-marker compatibility branch', () => {
  const nearby = fs.readFileSync('src/ui/NearbyBrowseMap.tsx', 'utf8');
  const route = fs.readFileSync('src/ui/KakaoRouteMap.tsx', 'utf8');
  const detailModel = fs.readFileSync('src/ui/placeDetailModel.ts', 'utf8');
  const courseModel = fs.readFileSync('src/ui/recommendation/courseV1CardDetailModel.ts', 'utf8');
  const detailScreen = fs.readFileSync('src/ui/PlaceDetailScreen.tsx', 'utf8');
  const courseScreen = fs.readFileSync('src/ui/CourseConfirmScreen.tsx', 'utf8');

  assert.doesNotMatch(nearby, /approvedPlacePhoto|imageUrl|\.pin img/);
  assert.doesNotMatch(route, /approvedPlacePhoto|usePhotoMarkers|photo-marker|photo-frame|m\.imageUrl/);
  assert.doesNotMatch(detailModel, /photoMarkerFields/);
  assert.doesNotMatch(courseModel, /photoMarkerFields/);
  assert.doesNotMatch(detailScreen, /usePhotoMarkers/);
  assert.doesNotMatch(courseScreen, /usePhotoMarkers/);
});

test('R1 public card and detail photo slots do not round or clip actual photos', () => {
  const files = [
    'src/ui/PlaceDetailScreen.tsx',
    'src/ui/NearbyBrowseScreen.tsx',
    'src/ui/recommendation/CourseV1SummaryCard.tsx',
    'src/ui/recommendation/CourseV1VerticalDetail.tsx',
    'src/ui/recommendation/TwoStopSelectionPanel.tsx',
    'src/ui/recommendation/TwoStopSelectionTray.tsx',
  ];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /<PlacePhoto[^>]*borderRadius/);
  }
  assert.doesNotMatch(fs.readFileSync(files[2], 'utf8'), /media: \{[^}]*overflow: 'hidden'|media: \{[^}]*borderRadius/);
  assert.doesNotMatch(fs.readFileSync(files[3], 'utf8'), /media: \{[^}]*overflow: 'hidden'|media: \{[^}]*borderRadius/);
  assert.doesNotMatch(fs.readFileSync(files[4], 'utf8'), /media: \{[^}]*overflow: 'hidden'|media: \{[^}]*borderRadius/);
});
