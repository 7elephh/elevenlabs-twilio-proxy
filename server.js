import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import twilio from 'twilio';

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Quand un appel arrive sur /voice
app.post('/voice', (req, res) => {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  const agentId = process.env.AGENT_ID || (req.query.agent_id || '');
  const wsUrl = `wss://${req.headers.host}/ws${agentId ? `?agent_id=${encodeURIComponent(agentId)}` : ''}`;

  const connect = twiml.connect();
  connect.stream({ url: wsUrl });

  res.type('text/xml').send(twiml.toString());
});

// Création du serveur et du WebSocket
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const wss = new WebSocketServer({ noServer: true });

// Quand Twilio tente d’ouvrir un flux /ws
server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/ws')) {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

// Pont entre Twilio et ElevenLabs
wss.on('connection', (twilioWS, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const agentId = url.searchParams.get('agent_id') || process.env.AGENT_ID;

  if (!agentId) {
    console.error('Missing agent_id');
    twilioWS.close(1011, 'Missing agent_id');
    return;
  }

  const elevenUrl = `wss://api.elevenlabs.io/v1/telephony/ws?agent_id=${encodeURIComponent(agentId)}`;

  // Connexion à ElevenLabs avec la clé API
  const elWS = new WebSocket(elevenUrl, {
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }
  });

  // Garde la connexion vivante
  const pingTimer = setInterval(() => {
    try { twilioWS.ping(); elWS.ping?.(); } catch {}
  }, 20000);

  // Événements
  elWS.on('open', () => console.log('EL ws open'));
  elWS.on('close', (code, reason) => {
    console.log('EL ws closed', code, reason?.toString());
    clearInterval(pingTimer);
    if (twilioWS.readyState === WebSocket.OPEN) twilioWS.close();
  });
  elWS.on('error', (e) => console.error('EL ws error', e));

  twilioWS.on('message', (msg) => {
    if (elWS.readyState === WebSocket.OPEN) elWS.send(msg);
  });
  elWS.on('message', (msg) => {
    if (twilioWS.readyState === WebSocket.OPEN) twilioWS.send(msg);
  });

  twilioWS.on('close', (code, reason) => {
    console.log('Twilio ws closed', code, reason?.toString());
    clearInterval(pingTimer);
    if (elWS.readyState === WebSocket.OPEN) elWS.close();
  });
  twilioWS.on('error', (e) => console.error('Twilio ws error', e));
});
