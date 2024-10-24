import { BrowserPool, PlaywrightPlugin } from '@crawlee/browser-pool';
import playwright from 'playwright';
import playwrightExtra from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';

const defaultBrowserPool = createBrowserPool({
  browserPlugins: [createBrowserPluginFroBrowserPool()],
});

export type Page = playwright.Page;

export function createBrowserPluginFroBrowserPool(
  options?: ConstructorParameters<typeof PlaywrightPlugin>[1],
) {
  const chromium = playwrightExtra.chromium;
  const antiDetection = stealth();
  antiDetection.enabledEvasions = new Set([
    'chrome.app',
    'chrome.runtime',
    'user-agent-override',
    'window.outerdimensions',
  ]);
  chromium.use(antiDetection);
  return new PlaywrightPlugin(chromium, options);
}

export function createBrowserPool(
  ...args: ConstructorParameters<typeof BrowserPool>
) {
  return new BrowserPool(...args);
}

export function createBrowserPage(
  browserPool: typeof defaultBrowserPool = defaultBrowserPool,
) {
  return (...args: Parameters<typeof browserPool.newPage>): Promise<Page> => {
    return browserPool.newPage(...args) as Promise<Page>;
  };
}

export function closeBrowserPool(
  browserPool: typeof defaultBrowserPool = defaultBrowserPool,
) {
  return browserPool.destroy();
}

export function closeBrowserPage(page: Page) {
  return page.close();
}
