import { handleApiRequest } from '../server/apiHandler.mjs';

export default async function handler(req, res) {
  try {
    const handled = await handleApiRequest(req, res);
    if (!handled && !res.writableEnded) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Endpoint not found' }));
    }
  } catch (error) {
    console.error('Unhandled Serverless Function Error:', error);
    if (!res.writableEnded) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: error?.message || 'Internal Server Error' }));
    }
  }
}
