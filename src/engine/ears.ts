/**
 * Ears: speech to text. Two engines behind one interface.
 * - free: the browser's built-in Web Speech API (Chrome/Edge), no key.
 * - paid: Deepgram Nova-3 streaming, proxied through our server so the key never reaches the browser.
 *   Brain names are sent as key terms so "AquaSun" is heard as "AquaSun".
 */
export type OnText = (text: string, isFinal: boolean, key: string) => void;
export interface Ears { start(): Promise<void>; stop(): void; running(): boolean; name: string }

type SR = { new (): any };
const SpeechRec: SR | undefined = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
export const hasWebSpeech = !!SpeechRec;

export function webSpeechEars(lang: string, onText: OnText, onError: (msg: string) => void): Ears {
  let rec: any = null, on = false, sess = 0;
  return {
    name: 'Chrome speech',
    running: () => on,
    async start() {
      if (!SpeechRec) { onError('This browser has no built-in speech recognition. Use Chrome or Edge, or switch to the paid engine.'); return; }
      rec = new SpeechRec();
      rec.continuous = true; rec.interimResults = true; rec.lang = lang;
      rec.onresult = (e: any) => {
        for (let i = e.resultIndex; i < e.results.length; i++) onText(e.results[i][0].transcript, e.results[i].isFinal, `w${sess}-${i}`);
      };
      rec.onerror = (e: any) => {
        if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(e.error)) { on = false; onError('Microphone blocked. Allow mic access for this page and try again.'); }
      };
      rec.onend = () => { if (on) { sess++; try { rec.start(); } catch { /* already started */ } } };
      on = true; rec.start();
    },
    stop() { on = false; try { rec?.stop(); } catch { /* noop */ } },
  };
}

export function deepgramEars(lang: string, keyterms: string[], onText: OnText, onError: (msg: string) => void): Ears {
  let ws: WebSocket | null = null, rec: MediaRecorder | null = null, stream: MediaStream | null = null, on = false, utter = 0;
  return {
    name: 'Deepgram Nova-3',
    running: () => on,
    async start() {
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
      catch { onError('Microphone blocked. Allow mic access for this page and try again.'); return; }
      const q = new URLSearchParams({ lang, keyterms: keyterms.slice(0, 40).join(',') });
      ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/stt?${q}`);
      ws.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data);
          if (d.error) { onError(d.error); return; }
          const text = d.channel?.alternatives?.[0]?.transcript || '';
          if (!text) return;
          onText(text, !!d.is_final, `d${utter}`);
          if (d.is_final) utter++;
        } catch { /* ignore non-JSON */ }
      };
      ws.onclose = () => { if (on) onError('Paid speech connection closed. Check DEEPGRAM_API_KEY on the server.'); on = false; rec?.stop(); };
      ws.onopen = () => {
        rec = new MediaRecorder(stream!, { mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '' });
        rec.ondataavailable = (e) => { if (e.data.size && ws?.readyState === WebSocket.OPEN) ws.send(e.data); };
        rec.start(250);
      };
      on = true;
    },
    stop() {
      on = false;
      try { rec?.stop(); } catch { /* noop */ }
      stream?.getTracks().forEach((t) => t.stop());
      ws?.close();
    },
  };
}
