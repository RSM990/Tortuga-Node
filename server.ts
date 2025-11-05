import 'dotenv/config';
import http from 'node:http';
import app from './app.js'; // TS rewrites to .js on build; tsx resolves .ts in dev

const port = Number(process.env.PORT || 3000);
http.createServer(app).listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
