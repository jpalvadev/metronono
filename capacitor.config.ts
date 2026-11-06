import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.metronono.app',
  appName: 'Metronono',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
