import { useFetcher } from '@remix-run/react';
import { initializeApp } from 'firebase/app';
import {
  type Auth,
  connectAuthEmulator,
  getAuth,
  inMemoryPersistence,
  onAuthStateChanged,
  signInAnonymously,
} from 'firebase/auth';
import { useCallback, useEffect } from 'react';

import { withErrorCode } from '@/error.server.ts';
import type { AuthLoaderResponse } from '@/routes/auth/types.ts';
import { AppEnvironment } from '@/types.ts';

async function createFirebaseAuth({
  apiKey,
  authEmulatorHost,
  shouldUseEmulator,
}: {
  apiKey: string;
  authEmulatorHost: string;
  shouldUseEmulator: boolean;
}) {
  const app = initializeApp({ apiKey });
  const auth = getAuth(app);
  await auth.setPersistence(inMemoryPersistence);
  if (shouldUseEmulator) {
    connectAuthEmulator(auth, authEmulatorHost);
  }
  return auth;
}

async function handleSignIn(authSDK: Auth) {
  await signInAnonymously(authSDK);
  return new Promise<FormData>((resolve, reject) => {
    const detachStateObserver = onAuthStateChanged(authSDK, async user => {
      if (!user) {
        return reject(
          withErrorCode('ERR_UNAUTHENTICATED')(
            new Error('User Signed in Failed'),
          ),
        );
      }
      const form = new FormData();
      form.append('id_token', await user.getIdToken());
      resolve(form);
      detachStateObserver();
    });
  });
}

export function useAuth() {
  const fetcher = useFetcher();

  const submitToAuthAction = useCallback(
    (form: FormData) =>
      fetcher.submit(form, {
        action: '/auth',
        method: 'POST',
        navigate: false,
      }),
    [fetcher.submit],
  );
  useEffect(() => {
    (async () => {
      if (!fetcher.data) {
        fetcher.load('/auth');
        return;
      }
      const {
        ENV: {
          FIREBASE_AUTH_EMULATOR_HOST: firebaseAuthEmulatorHost,
          WEB_ENV: env,
        },
        isSignedIn,
      } = fetcher.data as AuthLoaderResponse;
      const authSDK = await createFirebaseAuth({
        apiKey: 'unused',
        authEmulatorHost: firebaseAuthEmulatorHost,
        shouldUseEmulator: [AppEnvironment.DEV, AppEnvironment.TEST].includes(
          env,
        ),
      });
      if (isSignedIn) return;
      handleSignIn(authSDK).then(formData => submitToAuthAction(formData));
    })();
  }, [fetcher.data]);
}
