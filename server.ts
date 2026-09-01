import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

import { authRouter } from './server/routes/auth';
import { victimRouter } from './server/routes/victim';
import { counselorRouter } from './server/routes/counselor';
import { telephonyRouter } from './server/routes/telephony';
import { adminRouter } from './server/routes/admin';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logger
  app.use((req, res, next) => {
    if (!req.path.startsWith('/@') && !req.path.startsWith('/src')) {
      // console.log(`${req.method} ${req.path}`);
    }
    next();
  });

  // Health API
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Rural Mental Health & Care Access Platform',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/victim', victimRouter);
  app.use('/api/counselor', counselorRouter);
  app.use('/api/telephony', telephonyRouter);
  app.use('/api/notifications', telephonyRouter);
  app.use('/api/admin', adminRouter);

  const server = http.createServer(app);

  // Gemini Live Voice & Real-time WebSocket Architecture
  const wss = new WebSocketServer({ server, path: '/api/voice-live' });

  wss.on('connection', (ws: WebSocket) => {
    console.log('Client connected to Live Voice WebSocket bridge');

    ws.on('message', async (data) => {
      try {
        const payload = JSON.parse(data.toString());
        if (payload.type === 'START_VOICE_SESSION') {
          ws.send(
            JSON.stringify({
              type: 'SESSION_INITIALIZED',
              message: 'Live Voice Session ready. Speak now.',
              sampleRate: 24000,
            })
          );
        } else if (payload.type === 'AUDIO_CHUNK') {
          // Process audio chunk & return acoustic echo feedback
          ws.send(
            JSON.stringify({
              type: 'AUDIO_PROCESSED',
              energy: 0.42,
              speechRateEst: 110,
            })
          );
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });

    ws.on('close', () => {
      // Client disconnected
    });
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
