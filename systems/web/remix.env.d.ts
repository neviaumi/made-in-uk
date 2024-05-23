/// <reference types="@remix-run/dev" />
/// <reference types="@remix-run/node" />

type Env = {
  WEB_API_HOST: string;
  WEB_ENV: string;
};

declare global {
  export const ENV: Env;
  interface Window {
    ENV: Env;
  }
}
