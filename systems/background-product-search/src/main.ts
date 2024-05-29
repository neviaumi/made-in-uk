import { createServer } from 'node:http';

import { APP_ENV, loadConfig } from '@/config.ts';
import { createLogger } from '@/logging/logger.ts';

const config = loadConfig(APP_ENV);
const logger = createLogger(APP_ENV);

const server = createServer(async (req, res) => {
  if (req.method === 'GET') {
    res.statusCode = 400;
    res.end('Bad request');
    return;
  }
  const body = (await req.toArray()).join('');
  if (!body) {
    res.statusCode = 400;
    res.end('Bad request');
    return;
  }
  if (
    (content => {
      try {
        JSON.parse(content);
        return false;
      } catch (e) {
        return true;
      }
    })(body)
  ) {
    res.statusCode = 400;
    res.end('Bad request');
    return;
  }
  const jsonBody = JSON.parse(body);
  if (!jsonBody.message) {
    res.statusCode = 400;
    res.end('Bad request');
    return;
  }
  const { attributes, data } = {
    attributes: jsonBody.message.attributes,
    data: JSON.parse(
      Buffer.from(jsonBody.message.data, 'base64').toString('utf-8'),
    ),
  };
  logger.debug(`Data i got`, { attributes, data });
  res.statusCode = 204;
  res.end();
});

server.listen(config.get('port'), () => {
  logger.info(`Server is running on http://localhost:${config.get('port')}/`);
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
