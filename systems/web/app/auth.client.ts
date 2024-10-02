import { useActionData, useSubmit } from '@remix-run/react';
import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  inMemoryPersistence,
  onAuthStateChanged,
  signInAnonymously,
} from 'firebase/auth';
import { useEffect } from 'react';

import { AppEnvironment } from '@/config.server.ts';

export function useAuth<T>({
  env,
  firebaseAuthEmulatorHost,
  isSignedIn,
}: {
  env: AppEnvironment;
  firebaseAuthEmulatorHost: string;
  isSignedIn: boolean;
}) {
  const data = useActionData<T>();
  const submit = useSubmit();
  useEffect(() => {
    (async () => {
      if (isSignedIn) return;
      const app = initializeApp({});
      const auth = getAuth(app);
      await auth.setPersistence(inMemoryPersistence);
      if ([AppEnvironment.DEV, AppEnvironment.TEST].includes(env)) {
        connectAuthEmulator(auth, firebaseAuthEmulatorHost);
      }
      await signInAnonymously(auth);
      const detachStateObserver = onAuthStateChanged(auth, async user => {
        if (!user) {
          return;
        }
        const form = new FormData();
        form.append('id_token', await user.getIdToken());
        submit(form);
        detachStateObserver();
      });
    })();
  }, [env, isSignedIn]);
  return data;
}
