import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nutriai.app',
  appName: 'NutriAI',
  webDir: 'out',
  server: {
    // Loads your live Vercel app so all API routes work
    url: 'https://nutriai-sigma.vercel.app',
    cleartext: false,
  },
  android: {
    backgroundColor: '#0B1612',
  },
  ios: {
    backgroundColor: '#0B1612',
  },
};

export default config;
