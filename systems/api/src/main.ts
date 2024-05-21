import { createServer } from 'node:http';

import { loadConfig } from '@/config.ts';
import { createLogger } from '@/logging/logger.ts';

import { APP_ENV, loadEnvFileByAppEnv } from './config/app-env.ts';
import { yoga } from './yoga.ts';

const appEnv = loadEnvFileByAppEnv(APP_ENV);

const config = loadConfig(appEnv);
const logger = createLogger(appEnv);

const server = createServer(yoga);

server.listen(config.get('port'), () => {
  logger.info(
    `Server is running on http://localhost:${config.get('port')}/graphql`,
  );
  if (import.meta.hot) {
    function killServer() {
      server.close(err => {
        if (err) {
          throw err;
        }
      });
    }
    import.meta.hot.on('vite:beforeFullReload', () => {
      logger.debug('vite:beforeFullReload');
      killServer();
    });
    import.meta.hot.dispose(() => {
      logger.debug('dispose');
      killServer();
    });
  }
});
