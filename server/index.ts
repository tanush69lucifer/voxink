import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { WebSocketServer, WebSocket } from 'ws';
import { networkInterfaces } from 'node:os';
import type { IncomingMessage } from 'node:http';

/**
 * VoxInk server. Small on purpose:
 * - holds the paid API keys so they never reach a browser
 * - /api/director: the LLM director (any OpenAI-compatible endpoint: Groq, Cerebras, Gemini, OpenRouter, OpenAI)
 * - /api/photo: Pexels photo search, cached
 * - /api/image: AI image generation (fal.ai), cached
 * - /ws: relay so a phone remote or a second laptop can join the show
 * - /ws/stt: streams mic audio to Deepgram and streams words back
 */
try { process.loadEnvFile?.('.env'); } catch { /* no .env file: free engine only */ }

const env = (k: string) => process.env[k]?.trim() || '';
const PORT = Number(env('PORT') || 8787);
const LLM = { url: env('LLM_BASE_URL') || 'https://api.groq.com/openai/v1', key: env('LLM_API_KEY'), model: env('LLM_MODEL') || 'llama-3.3-70b-versatile' };
const IMAGE_URL = env('IMAGE_MODEL_URL') || 'https://fal.run/fal-ai/flux/schnell';

const lanUrls = () => {
  const port = process.env.NODE_ENV === 'production' ? PORT : 5173;
  return Object.values(networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => `http://${i!.address}:${port}/remote.html`);
};

const app = new Hono();

app.get('/api/config', (c) => c.json({
  llm: !!LLM.key, llmModel: LLM.key ? LLM.model : undefined,
  pexels: !!env('PEXELS_API_KEY'), images: !!env('FAL_KEY'), deepgram: !!env('DEEPGRAM_API_KEY'), lanUrls: lanUrls(),
}));

const SCENE_SPEC = `Allowed scenes (JSON objects):
{"kind":"counter","to":number,"from"?:number,"label"?:string,"prefix"?:"₹"|"$"}
{"kind":"ring","pct":number,"label"?:string}
{"kind":"split","old":string,"new":string}  // a contrast the speaker makes
{"kind":"question","text":string}
{"kind":"fact","value":string,"label":string,"source":string} // ONLY from the provided facts
{"kind":"icon","icon":string,"label":string} // icon = a Phosphor icon name like "drop","users-three","rocket-launch"
Also optional: "photo": a 1-3 word stock-photo search for a concrete thing the speaker describes; "image": a vivid one-line prompt for an illustration when no photo would fit.`;

app.post('/api/director', async (c) => {
  if (!LLM.key) return c.json({ error: 'LLM_API_KEY not set' }, 400);
  const body = await c.req.json().catch(() => ({}));
  const sentence = String(body.sentence || '').slice(0, 600);
  const facts = (Array.isArray(body.facts) ? body.facts : []).slice(0, 6).map(String);
  const topic = String(body.topic || '').slice(0, 200);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 4000);
  try {
    const r = await fetch(`${LLM.url.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST', signal: ctl.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${LLM.key}` },
      body: JSON.stringify({
        model: LLM.model, temperature: 0.2, max_tokens: 300, response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: `You are the visual director for a live talk. For the speaker's latest sentence, choose at most ONE scene that makes the audience feel it. Never invent numbers: use numbers the speaker said or the provided facts. If nothing fits, return {"scenes":[]}. Reply as JSON {"scenes":[...],"photo"?:string,"image"?:string}.\n${SCENE_SPEC}` },
          { role: 'user', content: `Talk topic: ${topic}\nKnown facts:\n${facts.join('\n') || '(none)'}\nSentence: "${sentence}"` },
        ],
      }),
    });
    const j: any = await r.json();
    const out = JSON.parse(j.choices?.[0]?.message?.content || '{}');
    const kinds = new Set(['counter', 'ring', 'split', 'question', 'fact', 'icon']);
    out.scenes = (Array.isArray(out.scenes) ? out.scenes : []).filter((s: any) => s && kinds.has(s.kind)).slice(0, 1);
    return c.json(out);
  } catch (e: any) {
    return c.json({ error: e?.name === 'AbortError' ? 'LLM timed out' : String(e?.message || e) }, 502);
  } finally { clearTimeout(timer); }
});

const photoCache = new Map<string, any>();
app.get('/api/photo', async (c) => {
  const q = (c.req.query('q') || '').trim().slice(0, 60);
  if (!q) return c.json({ error: 'q required' }, 400);
  if (!env('PEXELS_API_KEY')) return c.json({ error: 'PEXELS_API_KEY not set' }, 400);
  if (photoCache.has(q)) return c.json(photoCache.get(q));
  const r = await fetch(`https://api.pexels.com/v1/search?per_page=5&orientation=landscape&query=${encodeURIComponent(q)}`, { headers: { authorization: env('PEXELS_API_KEY') } });
  const j: any = await r.json().catch(() => ({}));
  const p = j.photos?.[0];
  const out = p ? { url: p.src.large2x || p.src.large, credit: `${p.photographer} / Pexels`, alt: p.alt || q } : { error: 'no photo' };
  photoCache.set(q, out);
  return c.json(out);
});

const imageCache = new Map<string, any>();
app.post('/api/image', async (c) => {
  if (!env('FAL_KEY')) return c.json({ error: 'FAL_KEY not set' }, 400);
  const { prompt } = await c.req.json().catch(() => ({ prompt: '' }));
  const p = String(prompt || '').slice(0, 300);
  if (!p) return c.json({ error: 'prompt required' }, 400);
  if (imageCache.has(p)) return c.json(imageCache.get(p));
  const r = await fetch(IMAGE_URL, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Key ${env('FAL_KEY')}` },
    body: JSON.stringify({ prompt: `${p}, bold editorial illustration, high contrast, no text`, image_size: 'landscape_16_9', num_inference_steps: 4, enable_safety_checker: true }),
  });
  const j: any = await r.json().catch(() => ({}));
  const out = j.images?.[0]?.url ? { url: j.images[0].url } : { error: j.detail || 'image failed' };
  if (out.url) imageCache.set(p, out);
  return c.json(out);
});

if (process.env.NODE_ENV === 'production') app.use('/*', serveStatic({ root: './dist' }));

const server = serve({ fetch: app.fetch, port: PORT, hostname: '0.0.0.0' }, () => {
  console.log(`VoxInk server on http://localhost:${PORT}`);
  console.log(`  paid parts: llm=${!!LLM.key} pexels=${!!env('PEXELS_API_KEY')} images=${!!env('FAL_KEY')} deepgram=${!!env('DEEPGRAM_API_KEY')}`);
});

// --- WebSockets: relay + speech proxy ---
const relay = new WebSocketServer({ noServer: true });
const stt = new WebSocketServer({ noServer: true });

relay.on('connection', (ws) => {
  ws.on('message', (data) => { for (const peer of relay.clients) if (peer !== ws && peer.readyState === WebSocket.OPEN) peer.send(data.toString()); });
});

stt.on('connection', (client, req: IncomingMessage) => {
  const key = env('DEEPGRAM_API_KEY');
  if (!key) { client.send(JSON.stringify({ error: 'DEEPGRAM_API_KEY not set on the server' })); client.close(); return; }
  const q = new URL(req.url || '', 'http://x').searchParams;
  const params = new URLSearchParams({ model: 'nova-3', interim_results: 'true', smart_format: 'true', punctuate: 'true', endpointing: '300', language: (q.get('lang') || 'en-IN').startsWith('en') ? 'en' : 'multi' });
  for (const t of (q.get('keyterms') || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 40)) params.append('keyterm', t);
  const dg = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, { headers: { authorization: `Token ${key}` } });
  const pending: Buffer[] = [];
  dg.on('open', () => { pending.splice(0).forEach((b) => dg.send(b)); });
  dg.on('message', (m) => { if (client.readyState === WebSocket.OPEN) client.send(m.toString()); });
  dg.on('error', (e) => { if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({ error: 'Deepgram: ' + e.message })); });
  dg.on('close', () => client.close());
  client.on('message', (b: Buffer) => { if (dg.readyState === WebSocket.OPEN) dg.send(b); else pending.push(b); });
  client.on('close', () => { try { dg.send(JSON.stringify({ type: 'CloseStream' })); } catch { /* noop */ } dg.close(); });
});

(server as any).on('upgrade', (req: IncomingMessage, sock: any, head: Buffer) => {
  const path = (req.url || '').split('?')[0];
  if (path === '/ws') relay.handleUpgrade(req, sock, head, (ws) => relay.emit('connection', ws, req));
  else if (path === '/ws/stt') stt.handleUpgrade(req, sock, head, (ws) => stt.emit('connection', ws, req));
  else sock.destroy();
});
