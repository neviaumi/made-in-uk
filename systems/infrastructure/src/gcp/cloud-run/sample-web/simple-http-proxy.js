import { createServer } from 'node:http';

import { GoogleAuth } from 'google-auth-library';

const backendHost = process.env['WEB_API_HOST'];
const port = process.env['PORT'] || 8080;
if (!backendHost) throw new Error('environment variable not set.');
const auth = new GoogleAuth();

createServer(async (req, res) => {
  const client = await auth.getIdTokenClient(backendHost);
  const response = await client.request({
    url: new URL(req.url, backendHost).toString(),
  });

  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(response.data));
}).listen(port);
