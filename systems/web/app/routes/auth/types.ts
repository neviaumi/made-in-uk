import { AppEnvironment } from '@/types.ts';

export type AuthLoaderResponse = {
  ENV: {
    FIREBASE_AUTH_EMULATOR_HOST: string;
    WEB_ENV: AppEnvironment;
  };
  isSignedIn: boolean;
  requestId: string;
  shouldExtendSession: boolean;
};
