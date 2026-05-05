import * as fs from 'fs';
import * as path from 'path';

// Misma ruta que usa Gradle (`android/app/google-services.json`). Descárgala desde la consola de Firebase (app Android `com.thinkia.mobile`).
const googleServicesPath = path.join(__dirname, 'android', 'app', 'google-services.json');
const hasGoogleServices = fs.existsSync(googleServicesPath);

export default () => ({
  name: 'Thinkia Mobile',
  slug: 'thinkia-mobile',
  version: '0.0.1',
  orientation: 'portrait' as const,
  scheme: 'thinkia',
  plugins: ['expo-asset', 'expo-font'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.thinkia.mobile',
    infoPlist: {
      NSMicrophoneUsageDescription: 'Thinkia usa el micrófono para llamadas de voz del call center.',
      UIBackgroundModes: ['audio', 'voip'],
    },
    entitlements: {
      'aps-environment': 'development',
    },
  },
  android: {
    package: 'com.thinkia.mobile',
    ...(hasGoogleServices ? { googleServicesFile: './android/app/google-services.json' as const } : {}),
    permissions: ['android.permission.RECORD_AUDIO', 'android.permission.MODIFY_AUDIO_SETTINGS'],
  },
});
