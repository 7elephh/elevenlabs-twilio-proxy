import express from "express";
import axios from "axios";
import { WebSocketServer } from "ws";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("✅ ElevenLabs <-> Twilio proxy is running!");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
