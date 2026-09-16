import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = file => fs.readFileSync(file, 'utf8');

test('public text actions use white text while blue remains a surface or icon emphasis', () => {
  const results = read('src/ui/ResultsScreen.tsx');
  const pair = read('src/ui/recommendation/TwoStopSelectionPanel.tsx');
  const records = read('src/ui/AccountRecordsPanel.tsx');
  const guestImport = read('src/ui/GuestImportPanel.tsx');
  const completedMap = read('src/ui/CompletedPlacesMapButton.tsx');
  const login = read('src/ui/LoginScreen.tsx');
  const photo = read('src/ui/PlacePhoto.tsx');

  assert.match(results, /moreButtonText: \{ color: C\.txt,/);
  assert.match(pair, /moreText: \{ color: C\.txt,/);
  assert.match(records, /recordPlaceAction: \{ color: C\.txt,/);
  assert.match(guestImport, /guest-import-approve[\s\S]*?color: C\.txt/);
  assert.match(completedMap, /link: \{ color: C\.txt,/);
  assert.match(login, /documentLinkText: \{ color: C\.txt,/);
  assert.match(login, /retryText: \{ color: C\.txt,/);
  assert.match(photo, /linkText:\{color:C\.txt,[^}]*textDecorationLine:'underline'/);
});

test('public controls keep the shared minimum touch and primary action measurements', () => {
  const nearby = read('src/ui/NearbyBrowseScreen.tsx');
  const mapPicker = read('src/ui/MapPlacePicker.tsx');
  const profile = read('src/ui/ProfileScreen.tsx');
  const emptyRecord = read('src/ui/RecordEmptyState.tsx');
  const records = read('src/ui/ActivityRecordScreen.tsx');

  assert.match(nearby, /allButton: \{[^}]*minHeight: 44/);
  assert.match(mapPicker, /secondary: \{[^}]*minHeight: 44/);
  assert.match(profile, /primaryButton: \{ minHeight: 52,[^}]*borderRadius: 12/);
  assert.match(profile, /primaryButtonText: \{ color: C\.onAccent, fontSize: 16/);
  assert.match(emptyRecord, /button: \{[^}]*minHeight: 52,[^}]*borderRadius: 12/);
  assert.match(records, /retry: \{ minHeight: 52,[^}]*borderRadius: 12/);
  assert.match(records, /retryText: \{ color: C\.onAccent, fontSize: 16/);
  assert.match(nearby, /kakao: \{ backgroundColor: C\.accent, minHeight: 52, borderRadius: 12/);
  assert.match(nearby, /kakaoText: \{ color: C\.txt, fontSize: 16/);
});

test('screen rhythm and contextual headers follow the current public hierarchy', () => {
  const records = read('src/ui/ActivityRecordScreen.tsx');
  const course = read('src/ui/CourseConfirmScreen.tsx');
  const mapPicker = read('src/ui/MapPlacePicker.tsx');
  const nearby = read('src/ui/NearbyBrowseScreen.tsx');

  assert.match(records, /scroll: \{ paddingHorizontal: 22,/);
  assert.doesNotMatch(course, /선택한 구간만 방향 표시/);
  assert.match(mapPicker, /close: \{[^}]*borderWidth: 1, borderColor: C\.line,[^}]*backgroundColor: C\.panel2/);
  assert.match(mapPicker, /mapError: \{ color: C\.red,/);
  assert.match(nearby, /detailError: \{ color: C\.red,/);
});
