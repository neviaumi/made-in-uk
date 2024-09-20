import playwright from 'playwright';
import playwrightExtra from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';

export function createAntiDetectionChromiumBrowser(
  browserLaunchOptions?: playwright.LaunchOptions,
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
  return chromium.launch(browserLaunchOptions);
}

export function createChromiumBrowser(
  browserLaunchOptions?: playwright.LaunchOptions,
) {
  const chromium = playwright.chromium;
  return chromium.launch(browserLaunchOptions);
}

export function createBrowserPage(
  browser: playwright.Browser | playwright.BrowserContext,
) {
  return (pageOptions?: playwright.BrowserContextOptions) => {
    return browser.newPage(pageOptions);
  };
}

export function closeBrowser(browser: playwright.Browser) {
  return browser.close();
}

export function closePage(page: playwright.Page) {
  return page.close();
}

export { type Browser } from 'playwright';
