import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dronacharya.app',
  appName: 'dronACHARYA',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
