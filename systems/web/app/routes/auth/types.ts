import { AppEnvironment } from '@/types.ts';

export type AuthLoaderResponse = {
  ENV: {
    FIREBASE_AUTH_EMULATOR_HOST: string;
    WEB_ENV: AppEnvironment;
    WEB_FIREBASE_API_KEY: string;
  };
  isSignedIn: boolean;
  requestId: string;
  shouldExtendSession: boolean;
};
