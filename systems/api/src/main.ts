import { createServer } from 'node:http';

import { APP_ENV, loadConfig } from '@/config.ts';
import { createLogger } from '@/logging/logger.ts';

import { yoga } from './yoga.ts';

const config = loadConfig(APP_ENV);
const logger = createLogger(APP_ENV);

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
