import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import twilio from 'twilio';

const app = express();
const PORT = process.env.PORT || 10000;

// ---- Sanity check des ENV ----
const { XI_API_KEY, AGENT_ID } = process.env;
if (!XI_API_KEY) console.warn('[WARN] XI_API_KEY manquante');
if (!AGENT_ID)  console.warn('[WARN] AGENT_ID manquante');

// ---- Middlewares ----
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Health check
app.get('/', (_req, res) => {
  res.status(200).send('OK');
});

// ---- Twilio webhook: génère le TwiML qui connecte un Stream WS vers notre serveur ----
app.post('/voice', (req, res) => {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  // agent_id prioritaire: query param > env
  const agentId = (req.query.agent_id && String(req.query.agent_id)) || AGENT_ID || '';

  // URL WS publique de ce service Render (Twilio va s'y connecter)
  // IMPORTANT: wss:// + host + /ws + ?agent_id=...
  const wsUrl = `wss://${req.headers.host}/ws${agentId ? `?agent_id=${encodeURIComponent(agentId)}` : ''}`;

  const connect = twiml.connect();
  connect.stream({ url: wsUrl });

  res.type('text/xml').send(twiml.toString());
});

// ---- Serveur HTTP + WS UPGRADE ----
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  try {
    if (req.url && req.url.startsWith('/ws')) {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    } else {
      socket.destroy();
    }
  } catch (e) {
    console.error('Upgrade error:', e);
    socket.destroy();
  }
});

// ---- Bridge Twilio <-> ElevenLabs ----
wss.on('connection', (twilioWS, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const agentId = url.searchParams.get('agent_id') || AGENT_ID;

  if (!agentId) {
    console.error('[ERR] Missing agent_id');
    try { twilioWS.close(1011, 'Missing agent_id'); } catch {}
    return;
  }

  if (!XI_API_KEY) {
    console.error('[ERR] Missing XI_API_KEY');
    try { twilioWS.close(1011, 'Missing XI_API_KEY'); } catch {}
    return;
  }

  const elevenUrl = `wss://api.elevenlabs.io/v1/telephony/ws?agent_id=${encodeURIComponent(agentId)}`;

  // Ouverture du WS vers ElevenLabs avec headers d’auth
  const elWS = new WebSocket(elevenUrl, {
    headers: {
      'xi-api-key': XI_API_KEY,
      'Origin': 'https://elevenlabs.io',
    },
    perMessageDeflate: false,
  });

  console.log('[INFO] Opening EL ws →', elevenUrl);

  // Keepalive simple
  const pingTimer = setInterval(() => {
    try { if (twilioWS.readyState === WebSocket.OPEN) twilioWS.ping(); } catch {}
    try { if (elWS.readyState === WebSocket.OPEN) elWS.ping?.(); } catch {}
  }, 20000);

  // --- Events EL ---
  elWS.on('open', () => console.log('[EL] ws open'));
  elWS.on('close', (code, reason) => {
    console.log('[EL] ws closed', code, reason?.toString?.());
    clearInterval(pingTimer);
    try { if (twilioWS.readyState === WebSocket.OPEN) twilioWS.close(); } catch {}
  });
  elWS.on('error', (e) => console.error('[EL] ws error', e?.message || e));

  // --- Events Twilio ---
  twilioWS.on('close', (code, reason) => {
    console.log('[Twilio] ws closed', code, reason?.toString?.());
    clearInterval(pingTimer);
    try { if (elWS.readyState === WebSocket.OPEN) elWS.close(); } catch {}
  });
  twilioWS.on('error', (e) => console.error('[Twilio] ws error', e?.message || e));

  // --- Pipe binaire ---
  twilioWS.on('message', (msg) => {
    // données audio + events Twilio → envoie à EL si ouvert
    if (elWS.readyState === WebSocket.OPEN) elWS.send(msg);
  });

  elWS.on('message', (msg) => {
    // audio/commands EL → renvoi à Twilio
    if (twilioWS.readyState === WebSocket.OPEN) twilioWS.send(msg);
  });
});
