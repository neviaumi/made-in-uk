import { useFetcher, useResolvedPath } from '@remix-run/react';
import { initializeApp } from 'firebase/app';
import {
  type Auth,
  connectAuthEmulator,
  getAuth,
  inMemoryPersistence,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCustomToken,
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
      form.append('response_type', 'session_cookie');

      resolve(form);
      detachStateObserver();
    });
  });
}

async function handleExtendCurrentSession(authSDK: Auth, requestId: string) {
  const { customToken } = await fetch('/auth', {
    body: (() => {
      const form = new FormData();
      form.append('response_type', 'custom_token');
      return form;
    })(),
    headers: {
      'request-id': requestId,
    },
    method: 'POST',
  }).then(resp => {
    if (!resp.ok) {
      throw withErrorCode('ERR_UNAUTHENTICATED')(new Error(resp.statusText));
    }
    return resp.json();
  });
  await signInWithCustomToken(authSDK, customToken);
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
      form.append('response_type', 'session_cookie');
      resolve(form);
      detachStateObserver();
    });
  });
}

export function useAuth() {
  const fetcher = useFetcher();
  const authPath = useResolvedPath('/auth');
  const submitToAuthAction = useCallback(
    (requestId: string, form: FormData) =>
      fetch(authPath.pathname, {
        body: form,
        headers: {
          'request-id': requestId,
        },
        method: 'POST',
      }),
    [fetcher.submit, authPath.pathname],
  );
  useEffect(() => {
    (async () => {
      if (!fetcher.data) {
        fetcher.load(authPath.pathname);
        return;
      }
      const {
        ENV: {
          FIREBASE_AUTH_EMULATOR_HOST: firebaseAuthEmulatorHost,
          WEB_ENV: env,
        },
        isSignedIn,
        requestId,
        shouldExtendSession,
      } = fetcher.data as AuthLoaderResponse;
      const authSDK = await createFirebaseAuth({
        apiKey: 'unused',
        authEmulatorHost: firebaseAuthEmulatorHost,
        shouldUseEmulator: [AppEnvironment.DEV, AppEnvironment.TEST].includes(
          env,
        ),
      });
      if (shouldExtendSession && isSignedIn) {
        handleExtendCurrentSession(authSDK, requestId).then(formData =>
          submitToAuthAction(requestId, formData),
        );
        return;
      }
      if (isSignedIn) return;
      handleSignIn(authSDK).then(formData =>
        submitToAuthAction(requestId, formData),
      );
    })();
  }, [authPath.pathname, fetcher.data]);
}
