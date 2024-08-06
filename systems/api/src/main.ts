import { createServer } from 'node:http';

import { APP_ENV, loadConfig } from '@/config.ts';
import { createLogger } from '@/logger.ts';

import { yoga } from './yoga.ts';

const config = loadConfig(APP_ENV);
const logger = createLogger(APP_ENV);

const server = createServer(yoga);

server.listen(config.get('port'), () => {
  logger.info(
    `Server is running on http://localhost:${config.get('port')}/graphql`,
  );
});
