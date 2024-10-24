import { playwrightUtils } from '@crawlee/playwright';

import type { Page } from '@/browser.ts';

export const closeCookieModals = playwrightUtils.closeCookieModals;

/**
 * Scrolls to the bottom of a page, or until it times out.
 * Loads dynamic content when it hits the bottom of a page, and then continues scrolling.
 * @param page Playwright [`Page`](https://playwright.dev/docs/api/class-page) object.
 * @param [options]
 */
export async function infiniteScroll(
  page: Page,
  options: playwrightUtils.InfiniteScrollOptions & {
    scrollHeight?: number | ((page: Page) => Promise<number>);
  } = {},
): Promise<void> {
  const {
    buttonSelector,
    maxScrollHeight = 0,
    scrollDownAndUp = false,
    scrollHeight = () => page.evaluate(() => document.body.scrollHeight),
    stopScrollCallback,
    timeoutSecs = 0,
    waitForSecs = 4,
  } = options;

  let finished;
  const startTime = Date.now();
  const CHECK_INTERVAL_MILLIS = 1000;
  const SCROLL_HEIGHT_IF_ZERO = 10000;
  let scrolledDistance = 0;
  const maybeResourceTypesInfiniteScroll = [
    'xhr',
    'fetch',
    'websocket',
    'other',
  ];
  const resourcesStats = {
    matchNumber: 0,
    newRequested: 0,
    oldRequested: 0,
  };

  page.on('request', msg => {
    if (maybeResourceTypesInfiniteScroll.includes(msg.resourceType())) {
      resourcesStats.newRequested++;
    }
  });

  const checkFinished = setInterval(() => {
    if (resourcesStats.oldRequested === resourcesStats.newRequested) {
      resourcesStats.matchNumber++;
      if (resourcesStats.matchNumber >= waitForSecs) {
        clearInterval(checkFinished);
        finished = true;
        return;
      }
    } else {
      resourcesStats.matchNumber = 0;
      resourcesStats.oldRequested = resourcesStats.newRequested;
    }
    // check if timeout has been reached
    if (timeoutSecs !== 0 && (Date.now() - startTime) / 1000 > timeoutSecs) {
      clearInterval(checkFinished);
      finished = true;
    }

    // check if max scroll height has been reached
    if (maxScrollHeight > 0 && scrolledDistance >= maxScrollHeight) {
      clearInterval(checkFinished);
      finished = true;
    }
  }, CHECK_INTERVAL_MILLIS);

  const doScroll = async () => {
    const delta = await (async () => {
      const nextScrollHeight =
        typeof scrollHeight === 'function'
          ? await scrollHeight(page)
          : scrollHeight;
      return nextScrollHeight === 0 ? SCROLL_HEIGHT_IF_ZERO : nextScrollHeight;
    })();

    await page.mouse.wheel(0, delta);
    scrolledDistance += delta;
  };

  const maybeClickButton = async () => {
    const button = await page.$(buttonSelector!);
    // Box model returns null if the button is not visible
    if (button && (await button.boundingBox())) {
      await button.click({ delay: 10 });
    }
  };

  while (!finished) {
    await doScroll();
    await page.waitForTimeout(250);
    if (scrollDownAndUp) {
      await page.mouse.wheel(0, -100);
    }
    if (buttonSelector) {
      await maybeClickButton();
    }
    if (stopScrollCallback) {
      if (await stopScrollCallback()) {
        clearInterval(checkFinished);
        break;
      }
    }
  }
}
