import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import twilio from 'twilio';

const app = express();
const PORT = process.env.PORT || 10000;

// ---- Sanity check des ENV ----
const { XI_API_KEY, AGENT_ID } = process.env;
console.log('XI_API_KEY length:', (XI_API_KEY || '').length);
console.log('AGENT_ID:', AGENT_ID || '(none)');

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Health check
app.get('/', (_req, res) => res.status(200).send('OK'));

// ---- Twilio webhook: renvoie le TwiML qui connecte un Stream WS vers CE service ----
app.post('/voice', (req, res) => {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  // agent_id prioritaire: query param > env
  const agentId = (req.query.agent_id && String(req.query.agent_id)) || AGENT_ID || '';

  // URL WS publique de ce service Render (Twilio va s’y connecter)
  const wsUrl = `wss://${req.headers.host}/ws${agentId ? `?agent_id=${encodeURIComponent(agentId)}` : ''}`;

  const connect = twiml.connect();
  connect.stream({ url: wsUrl });

  res.type('text/xml').send(twiml.toString());
});

// ---- HTTP + Upgrade → /ws ----
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

// ---- Bridge Twilio <-> ElevenLabs ConvAI ----
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

  // ✅ URL correcte pour l’Agents Platform (ConvAI)
  const elevenUrl = `wss://api.elevenlabs.io/v1/convai/ws?agent_id=${encodeURIComponent(agentId)}`;

  // Ouverture du WS vers ElevenLabs avec header d’auth
  const elWS = new WebSocket(elevenUrl, {
    headers: {
      'xi-api-key': XI_API_KEY,   // IMPORTANT: header exact (pas Authorization)
    },
    perMessageDeflate: false,
  });

  console.log('[INFO] Opening EL ws →', elevenUrl);

  // Keepalive simple
  const pingTimer = setInterval(() => {
    try { if (twilioWS.readyState === WebSocket.OPEN) twilioWS.ping(); } catch {}
    try { if (elWS.readyState === WebSocket.OPEN && typeof elWS.ping === 'function') elWS.ping(); } catch {}
  }, 20000);

  // --- Events EL ---
  elWS.on('open', () => console.log('[EL] ws open ✅'));
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

  // --- Pipe binaire (pass-through) ---
  twilioWS.on('message', (msg) => {
    if (elWS.readyState === WebSocket.OPEN) elWS.send(msg);
  });

  elWS.on('message', (msg) => {
    if (twilioWS.readyState === WebSocket.OPEN) twilioWS.send(msg);
  });
});
