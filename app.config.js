const base = require('./app.json');

const kakaoNativeKey =
  process.env.EXPO_PUBLIC_KAKAO_NATIVE_API_KEY
  || process.env.KAKAO_NATIVE_API_KEY
  || process.env.Kakao_NATIVE_API_KEY
  || '';

module.exports = {
  ...base,
  expo: {
    ...base.expo,
    plugins: kakaoNativeKey
      ? [
        [
          '@react-native-kakao/core',
          {
            nativeAppKey: kakaoNativeKey,
            android: {},
            ios: {},
          },
        ],
      ]
      : [],
  },
};
