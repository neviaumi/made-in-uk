import {
  closeBrowser,
  closePage,
  createAntiDetectionChromiumBrowser,
  createBrowserPage,
  createChromiumBrowser,
} from '@/browser.ts';
import * as error from '@/error.ts';
import * as lilysKitchen from '@/lilys-kitchen.ts';
import type { Logger } from '@/logger.ts';
import * as ocado from '@/ocado.ts';
import * as petsAtHome from '@/pets-at-home.ts';
import * as sainsbury from '@/sainsbury.ts';
import { type Product, PRODUCT_SOURCE } from '@/types.ts';
import * as vetShop from '@/vet-shop.ts';
import * as zooplus from '@/zooplus.ts';

type TaskInput = {
  options: {
    logger: Logger;
  };
  productId: string;
  productUrl: string;
  requestId: string;
  source: PRODUCT_SOURCE;
};

class Queue {
  private tasks: (() => Promise<any>)[] = [];

  private running: number = 0;

  private concurrent: number;

  constructor({ concurrent = 1 }: { concurrent: number }) {
    this.concurrent = concurrent;
  }

  // Method to add a task to the queue
  async push(taskInput: { taskInput: TaskInput }): Promise<Product> {
    return new Promise((resolve, reject) => {
      const task = async () => {
        try {
          const result = await this.processTask(taskInput.taskInput);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };

      this.tasks.push(task);
      this.runNext();
    });
  }

  // Method to run the next task in the queue
  private runNext() {
    if (this.running >= this.concurrent || this.tasks.length === 0) {
      return;
    }

    this.running++;
    const task = this.tasks.shift()!;

    task().finally(() => {
      this.running--;
      this.runNext();
    });
  }

  // This function simulates processing the task
  private async processTask(taskInput: TaskInput): Promise<Product> {
    const {
      options: { logger },
      productId,
      productUrl,
      requestId,
      source,
    } = taskInput;
    logger.info(`Start crawling for ${productId} on ${source}`);
    const browser =
      source === PRODUCT_SOURCE.SAINSBURY
        ? await createAntiDetectionChromiumBrowser()
        : await createChromiumBrowser();
    const page = await createBrowserPage(browser)();
    const fetchers: {
      [key in PRODUCT_SOURCE]: {
        createProductDetailsFetcher: typeof ocado.createProductDetailsFetcher;
      };
    } = {
      [PRODUCT_SOURCE.LILYS_KITCHEN]: lilysKitchen,
      [PRODUCT_SOURCE.OCADO]: ocado,
      [PRODUCT_SOURCE.PETS_AT_HOME]: petsAtHome,
      [PRODUCT_SOURCE.ZOOPLUS]: zooplus,
      [PRODUCT_SOURCE.VET_SHOP]: vetShop,
      [PRODUCT_SOURCE.SAINSBURY]: sainsbury,
    };
    const productInfo = await fetchers[source]
      .createProductDetailsFetcher(page, {
        logger: logger,
        requestId: requestId,
      })(productUrl)
      .finally(async () => {
        logger.info(`Closing the browser for ${productId} on ${source}`);
        await closePage(page);
        await closeBrowser(browser);
      });
    if (!productInfo.ok) {
      throw error.withHTTPError(500, 'Failed to fetch product details', {
        retryAble: true,
      })(
        error.withErrorCode('ERR_UNEXPECTED_ERROR')(
          new Error('Failed to fetch product details'),
        ),
      );
    }
    return productInfo.data;
  }
}

// Temporary solution for limit number of concurrent tasks
export default new Queue({ concurrent: 1 });
