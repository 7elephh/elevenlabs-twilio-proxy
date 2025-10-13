// server.js
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import twilio from 'twilio';

const app = express();
const PORT = process.env.PORT || 10000;

const { XI_API_KEY, AGENT_ID } = process.env;
console.log('[BOOT] XI_API_KEY length =', (XI_API_KEY || '').length);
console.log('[BOOT] AGENT_ID =', AGENT_ID || '(none)');

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Healthcheck
app.get('/', (_req, res) => res.status(200).send('OK'));

// Twilio webhook -> renvoie du TwiML pour streamer vers ce service
app.post('/voice', (req, res) => {
  console.log('[Twilio] /voice hit from', req.ip, 'host=', req.headers.host);
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  const agentId = (req.query.agent_id && String(req.query.agent_id)) || AGENT_ID || '';
  const wsUrl = `wss://${req.headers.host}/ws${agentId ? `?agent_id=${encodeURIComponent(agentId)}` : ''}`;
  console.log('[Twilio] will stream to', wsUrl);

  const connect = twiml.connect();
  connect.stream({ url: wsUrl });

  res.type('text/xml').send(twiml.toString());
});

const server = app.listen(PORT, () => {
  console.log(`[BOOT] Server running on port ${PORT}`);
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  try {
    console.log('[WS] upgrade request', req.url);
    if (req.url && req.url.startsWith('/ws')) {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    } else {
      socket.destroy();
    }
  } catch (e) {
    console.error('[WS] upgrade error:', e);
    socket.destroy();
  }
});

// ---------- Bridge Twilio <-> ElevenLabs ConvAI avec fallback ----------
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

  const endpoints = [
    `wss://api.elevenlabs.io/v1/convai/ws?agent_id=${encodeURIComponent(agentId)}`,
    `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${encodeURIComponent(agentId)}`, // fallback
  ];

  let elWS;
  let endpointIndex = 0;

  const commonHeaders = {
    'xi-api-key': XI_API_KEY,                 // header officiel
    'Authorization': `Bearer ${XI_API_KEY}`,  // au cas où tenant exige Bearer
    'Origin': 'https://elevenlabs.io',        // certains tenants le demandent
    'User-Agent': 'twilio-bridge/1.0',        // neutre
  };

  const openEL = (idx) => {
    const elevenUrl = endpoints[idx];
    console.log('[INFO] Opening EL ws →', elevenUrl);

    elWS = new WebSocket(elevenUrl, {
      headers: commonHeaders,
      perMessageDeflate: false,
    });

    // piping binaire
    twilioWS.on('message', (msg) => {
      if (elWS?.readyState === WebSocket.OPEN) elWS.send(msg);
    });
    elWS.on('message', (msg) => {
      if (twilioWS.readyState === WebSocket.OPEN) twilioWS.send(msg);
    });

    // keepalive
    var pingTimer = setInterval(() => {
      try { if (twilioWS.readyState === WebSocket.OPEN) twilioWS.ping(); } catch {}
      try { if (elWS?.readyState === WebSocket.OPEN && typeof elWS.ping === 'function') elWS.ping(); } catch {}
    }, 20000);

    elWS.on('open', () => console.log('[EL] ws open ✅'));
    elWS.on('close', (code, reason) => {
      console.log('[EL] ws closed', code, reason?.toString?.());
      clearInterval(pingTimer);
      try { if (twilioWS.readyState === WebSocket.OPEN) twilioWS.close(); } catch {}
    });
    elWS.on('error', (e) => {
      console.error('[EL] ws error', e?.message || e);
      // si 1er endpoint échoue immédiatement (ex. 403), on tente le fallback une seule fois
      if (idx === 0 && endpointIndex === 0) {
        endpointIndex = 1;
        try { elWS.terminate?.(); } catch {}
        console.log('[INFO] Retrying with fallback endpoint …');
        openEL(endpointIndex);
      }
    });

    twilioWS.on('close', (code, reason) => {
      console.log('[Twilio] ws closed', code, reason?.toString?.());
      clearInterval(pingTimer);
      try { elWS?.close(); } catch {}
    });
    twilioWS.on('error', (e) => console.error('[Twilio] ws error', e?.message || e));
  };

  openEL(endpointIndex);
});
