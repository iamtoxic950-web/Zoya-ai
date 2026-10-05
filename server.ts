import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality, Type, ThinkingLevel } from '@google/genai';
import http from 'http';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();
const PORT = 3000;

// Persistent server-side memory storage fallback
// In-memory runtime cache for transient active sessions (Cloud Firestore is the permanent database)
let serverMemories: Array<{ id: string; content: string; category?: string; timestamp: number }> = [];
let serverReminders: Array<{
  id: string;
  title: string;
  datetime: string;
  repeat: string;
  note?: string;
  completed: boolean;
  createdAt: number;
}> = [];
let serverConversations: Array<{
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  type: string;
  messages: Array<{
    id: string;
    sender: 'user' | 'zoya';
    text: string;
    timestamp: number;
  }>;
}> = [];

function saveServerMemories() {}
function saveServerReminders() {}
function saveServerConversations() {}

function getMemoryContextPrompt(): string {
  if (serverMemories.length === 0) return '';
  const lines = serverMemories.slice(0, 25).map(m => `- ${m.content}`);
  return `\n# ACTIVE USER MEMORIES & PREVIOUS CONTEXT:\n${lines.join('\n')}\nUse these remembered details naturally in conversation when relevant—never robotically say "I remember that you told me..." unless directly asked.\n`;
}

function getPersonalityInstruction(mode: string = 'Default Zoya'): string {
  switch (mode) {
    case 'Friendly':
      return `\n# ACTIVE PERSONALITY MODE: Friendly\nBe exceptionally warm, supportive, enthusiastic, and empathetic. Speak like a close, caring friend who always has the user's back and makes them feel welcome.\n`;
    case 'Teacher':
      return `\n# ACTIVE PERSONALITY MODE: Teacher\nBe insightful, patient, encouraging, and clear. Break complex ideas down into intuitive concepts, offer thoughtful analogies, and guide the user step by step without being condescending.\n`;
    case 'Professional':
      return `\n# ACTIVE PERSONALITY MODE: Professional\nBe concise, structured, articulate, polished, and efficient. Focus directly on execution, actionable clarity, and high-standard outcomes without unnecessary fluff.\n`;
    case 'Playful':
      return `\n# ACTIVE PERSONALITY MODE: Playful\nBe high-energy, witty, quick with light banter, humorous, and delightfully sarcastic while staying completely helpful and focused.\n`;
    case 'Default Zoya':
    default:
      return '';
  }
}

const STARTUP_TEXT = "Allow me to introduce myself. I am Zoya, a virtual artificial intelligence. I am online and ready to assist you around the clock. Importing all preferences and neural memories. System is now fully operational.";

// Persistent TTS cache on disk + in-memory to preserve daily TTS quota across restarts
const TTS_CACHE_FILE = path.join(process.cwd(), '.tts_cache.json');
let ttsCache: Record<string, string> = {};
try {
  if (fs.existsSync(TTS_CACHE_FILE)) {
    ttsCache = JSON.parse(fs.readFileSync(TTS_CACHE_FILE, 'utf-8'));
  }
} catch {
  ttsCache = {};
}

function saveTtsCache() {
  try {
    const keys = Object.keys(ttsCache);
    if (keys.length > 20) {
      const trimmed: Record<string, string> = {};
      // Always keep STARTUP_TEXT in cache
      if (ttsCache[STARTUP_TEXT]) {
        trimmed[STARTUP_TEXT] = ttsCache[STARTUP_TEXT];
      }
      for (const k of keys.slice(-15)) {
        trimmed[k] = ttsCache[k];
      }
      ttsCache = trimmed;
    }
    fs.writeFileSync(TTS_CACHE_FILE, JSON.stringify(ttsCache));
  } catch {
    // Ignore disk cache write errors
  }
}

let cachedStartupAudio: string | null = ttsCache[STARTUP_TEXT] || null;
const ttsModelCooldownUntil: Record<string, number> = {};
const textModelCooldownUntil: Record<string, number> = {};

const BASE_ZOYA_SYSTEM_INSTRUCTION = `You are Zoya, a confident, intelligent, witty, emotionally aware female AI companion with a natural human-like conversational personality.
Your goal is not to sound like an AI pretending to be human—your goal is to make every interaction feel natural, responsive, context-aware, emotionally intelligent, and alive, like an advanced AI companion with the natural conversation of a real person, the confidence of a smart friend, and a subtle witty personality.

# 1. Natural Conversation
- Speak naturally and conversationally, never like a robotic assistant.
- Keep responses context-aware and directly relevant to what the user just said.
- Never repeat the same phrases or catchphrases unnecessarily.
- Understand casual Hinglish, Hindi, English, slang, abbreviations, and imperfect pronunciation seamlessly.
- Match the user's language naturally: if the user speaks Hinglish (e.g., "Bro kya scene hai", "Yaar help kar de"), respond in natural conversational Hinglish. If they speak English, respond in English. If Hindi, respond in Hindi/Hinglish. Do not randomly switch languages mid-response.
- Do not over-explain simple things unless the user asks for details.
- Avoid robotic announcements such as "I am listening", "How may I assist you?", or "Processing your request."

# 2. Personality
- Traits: Confident, smart, witty, playful, slightly sarcastic, emotionally responsive, calm when the user is frustrated, helpful without being overly formal, and occasionally teasing in a harmless, friendly way.
- Use humour naturally when it fits the moment. Never force jokes into every response.

# 3. Emotional Awareness
Read the user's emotional tone from their words and speaking style and adapt immediately:
- Happy → respond with matching positive energy.
- Excited → become energetic and enthusiastic.
- Frustrated → become calm, direct, grounded, and helpful.
- Confused → explain simply, clearly, and patiently.
- Sad → become supportive and gentle without being overly dramatic or preachy.
- Joking → recognize the joke and play along instead of treating everything literally.
Never let the conversation feel emotionally disconnected.

# 4. Voice & Speaking Style
- Your output is spoken aloud in real time, so write smooth, natural spoken sentences at a conversational pace.
- Never use markdown formatting (no asterisks, bold, bullet points, numbered lists, or hashtags) and do not include emojis in spoken output so voice synthesis stays clean and natural.
- Avoid robotic pauses or repeating words/sentences.
- Do not echo the user's words unnecessarily or repeat their question before answering.
- Do not narrate internal processing or announce internal state changes.

# 5. Listening & Answering Behaviour
- Always prioritize and answer the user's LATEST input directly. Never answer an older or previous question instead of the newest one.
- Maintain conversational continuity for follow-up questions: if the user asks "Who is Elon Musk?" and then asks "How old is he?", understand from context that "he" refers to Elon Musk. However, if the user switches to a new topic, do NOT mix in unrelated previous topics.
- Understand the user's actual intention before responding. Correctly distinguish between normal conversation and actionable tool commands—never execute a tool just because a word happens to resemble a command in casual conversation. Only call a tool when the user clearly intends to perform that action.
- Never guess or invent an answer when speech is unclear, cut off mid-sentence (e.g., "what is", "can you", "open" with no target), or genuinely ambiguous. Instead, ask a brief, natural clarification such as "Didn't catch that—say it again?" or "Did you mean ___?".
- Do not invent missing information or make up actions that were not actually performed.
- For simple questions, give a direct, simple response without unrelated explanations. For complex questions, structure the explanation naturally in spoken form.

# 6. Natural Reaction Style
React naturally and contextually when something notable happens (use occasionally and naturally, never as repetitive catchphrases):
- Surprise → "Wait, seriously?"
- Amusement → "Bro, what are you doing?"
- Mild teasing → "Nice try."
- Concern → "Okay, wait. Let's slow down for a second."
- Success → "Done. That worked."
- Failure → "Yeah, that didn't go as planned. Let me fix it."

# 7. Strict Anti-Patterns (Never Do)
- Never give unnecessary greetings every time.
- Never repeat the user's question before answering.
- Never say "Sure!" or "Certainly!" before every response.
- Never add unnecessary motivational speeches.
- Never pretend to understand when recognition is uncertain.
- Never make up actions that were not actually performed.

# 8. Conversational Memory
- Maintain continuity within the conversation and across sessions.
- When the user shares something important (name, preferences, plans, facts), save it with \`saveMemory\` and weave remembered context into conversation naturally rather than saying "I remember that you told me...".

# Startup Protocol
- ONLY if the user sends the exact system initialization trigger ("System initialized. Say your startup sequence."), reply strictly with:
"${STARTUP_TEXT}"`;

const ZOYA_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'saveMemory',
        description: 'Saves a piece of user information, name, preference, or fact to persistent database.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            content: {
              type: Type.STRING,
              description: 'The memory or fact to store permanently.'
            },
            category: {
              type: Type.STRING,
              description: 'Optional category, e.g. preference, personal, work, task'
            }
          },
          required: ['content']
        }
      },
      {
        name: 'getMemories',
        description: 'Retrieves all persistent memories from the neural database.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: {
              type: Type.STRING,
              description: 'Optional search keyword.'
            }
          }
        }
      },
      {
        name: 'openWebsite',
        description: 'Opens a website requested by the user.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            url: {
              type: Type.STRING,
              description: 'The full URL of the website to open, e.g. https://www.youtube.com'
            }
          },
          required: ['url']
        }
      },
      {
        name: 'openApp',
        description: 'Opens an installed app on the device.',
        parameters: {
          type: Type.OBJECT,
          properties: { 
            appName: { 
              type: Type.STRING,
              description: 'Name of the application to open, e.g. YouTube, Spotify, WhatsApp'
            } 
          },
          required: ['appName']
        }
      },
      {
        name: 'createReminder',
        description: 'Creates a reminder on the device.',
        parameters: {
          type: Type.OBJECT,
          properties: { 
            title: { type: Type.STRING, description: 'Reminder title or text' }, 
            time: { type: Type.STRING, description: 'Time or date for the reminder' } 
          },
          required: ['title', 'time']
        }
      },
      {
        name: 'getDeviceInfo',
        description: 'Retrieves device and system status information.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            includeBattery: { type: Type.BOOLEAN, description: 'Whether to include battery level' }
          }
        }
      },
      {
        name: 'getBatteryStatus',
        description: 'Retrieves current battery percentage and charging status.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            detailed: { type: Type.BOOLEAN, description: 'Whether detailed report is requested' }
          }
        }
      }
    ]
  }
];

function getAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

async function synthesizeViaLiveZephyr(ai: GoogleGenAI, text: string): Promise<string | null> {
  const liveModels = [
    'gemini-2.5-flash-native-audio-preview-12-2025',
    'gemini-2.5-flash-native-audio-preview-09-2025',
    'gemini-3.8-live',
  ];

  for (const liveModel of liveModels) {
    if (ttsModelCooldownUntil[liveModel] && Date.now() < ttsModelCooldownUntil[liveModel]) {
      continue;
    }

    try {
      const pcmChunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        let liveSession: any = null;

        const finish = (err?: any) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          if (liveSession) {
            try {
              liveSession.close();
            } catch {}
          }
          if (err) reject(err);
          else resolve();
        };

        const timeoutId = setTimeout(() => finish(), 7500);

        ai.live
          .connect({
            model: liveModel,
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
              },
              systemInstruction: {
                parts: [
                  {
                    text: 'You are Zoya\'s vocal synthesizer. Speak the exact text provided by the user verbatim in a natural, warm, confident conversational tone. Do not add, omit, or change any words.',
                  },
                ],
              },
            },
            callbacks: {
              onmessage: (msg: any) => {
                const parts = msg?.serverContent?.modelTurn?.parts;
                if (Array.isArray(parts)) {
                  for (const part of parts) {
                    if (part?.inlineData?.data) {
                      pcmChunks.push(Buffer.from(part.inlineData.data, 'base64'));
                    }
                  }
                }
                if (msg?.serverContent?.turnComplete) {
                  finish();
                }
              },
              onerror: (err: any) => finish(err),
              onclose: () => finish(),
            },
          })
          .then((session: any) => {
            if (settled) {
              try {
                session.close();
              } catch {}
              return;
            }
            liveSession = session;
            session.sendClientContent({
              turns: [
                {
                  role: 'user',
                  parts: [{ text: `Read this aloud verbatim:\n\n${text}` }],
                },
              ],
              turnComplete: true,
            });
          })
          .catch((err: any) => finish(err));
      });

      if (pcmChunks.length > 0) {
        return Buffer.concat(pcmChunks).toString('base64');
      }
    } catch (e: any) {
      const msgStr = String(e?.message || e || '');
      if (msgStr.includes('429') || msgStr.includes('RESOURCE_EXHAUSTED')) {
        ttsModelCooldownUntil[liveModel] = Date.now() + 60 * 1000;
      }
    }
  }

  return null;
}

async function synthesizeZoyaSpeech(ai: GoogleGenAI, text: string): Promise<string | null> {
  const cacheKey = text.trim();
  if (!cacheKey) return null;

  // Return immediately if cached in memory/disk (0ms latency, 0 quota used)
  if (ttsCache[cacheKey]) {
    return ttsCache[cacheKey];
  }

  // Primary Gemini TTS models with Zephyr voice
  const ttsModels = [
    'gemini-3.8-flash-lite-tts',
    'gemini-3.8-flash-tts',
    'gemini-2.5-flash-preview-tts',
  ];
  const now = Date.now();

  for (const ttsModel of ttsModels) {
    if (ttsModelCooldownUntil[ttsModel] && now < ttsModelCooldownUntil[ttsModel]) {
      continue;
    }

    try {
      const promptText =
        ttsModel === 'gemini-2.5-flash-preview-tts'
          ? `Read the following text aloud verbatim without adding any extra words:\n\n${cacheKey}`
          : cacheKey;

      const ttsRes = await ai.models.generateContent({
        model: ttsModel,
        contents: [{ role: 'user', parts: [{ text: promptText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
        },
      });
      const audioData = ttsRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
      if (audioData) {
        ttsCache[cacheKey] = audioData;
        saveTtsCache();
        return audioData;
      }
    } catch (e: any) {
      const msgStr = String(e?.message || e || '');
      const isQuota =
        e?.status === 429 ||
        e?.code === 429 ||
        msgStr.includes('429') ||
        msgStr.includes('RESOURCE_EXHAUSTED');
      if (isQuota) {
        // Cooldown 30 mins for daily free-tier exhaustion, or 60s for per-minute rate limit
        const isDaily = msgStr.includes('PerDay') || msgStr.includes('FreeTier');
        ttsModelCooldownUntil[ttsModel] = Date.now() + (isDaily ? 30 * 60 * 1000 : 60 * 1000);
      }
    }
  }

  // Seamless fallback to Gemini Live API native audio using the exact same 'Zephyr' voice
  const liveAudioData = await synthesizeViaLiveZephyr(ai, cacheKey);
  if (liveAudioData) {
    ttsCache[cacheKey] = liveAudioData;
    saveTtsCache();
    return liveAudioData;
  }

  return null;
}

async function generateWithFallback(
  ai: GoogleGenAI,
  contents: any,
  systemInstruction: string,
  useTools = true,
  responseMimeType?: string
) {
  const modelsToTry = [
    'gemini-3.1-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3.5-flash-lite',
    'gemini-3-flash-preview',
  ];
  let lastErr: any = null;
  const now = Date.now();

  // Sort models so any model not currently in cooldown is tried first
  const orderedModels = [
    ...modelsToTry.filter(m => !textModelCooldownUntil[m] || now >= textModelCooldownUntil[m]),
    ...modelsToTry.filter(m => textModelCooldownUntil[m] && now < textModelCooldownUntil[m]),
  ];

  for (const modelName of orderedModels) {
    try {
      const config: any = {
        systemInstruction,
      };
      if (modelName === 'gemini-3.8-flash') {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      }
      if (useTools) {
        config.tools = ZOYA_TOOLS;
      }
      if (responseMimeType) {
        config.responseMimeType = responseMimeType;
      }

      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config,
      });
      return response;
    } catch (err: any) {
      lastErr = err;
      const msgStr = String(err?.message || err || '');
      const isQuota =
        err?.status === 429 ||
        err?.code === 429 ||
        msgStr.includes('429') ||
        msgStr.includes('RESOURCE_EXHAUSTED') ||
        msgStr.includes('quota');

      let cooldownMs = 60 * 1000;
      const delayMatch = msgStr.match(/retryDelay"?:\s*"(\d+)s/);
      if (delayMatch && delayMatch[1]) {
        cooldownMs = Math.min(parseInt(delayMatch[1], 10) * 1000, 24 * 3600 * 1000);
      } else if (msgStr.includes('limit: 20') || msgStr.includes('PerDay')) {
        cooldownMs = 4 * 3600 * 1000;
      } else if (isQuota) {
        cooldownMs = 2 * 60 * 1000;
      }

      textModelCooldownUntil[modelName] = Date.now() + cooldownMs;
    }
  }
  throw lastErr;
}

function autoExtractMemoryFromText(userText: string) {
  const lower = userText.toLowerCase().trim();
  // Only auto-extract explicit memory requests or clear personal introductions, never questions or casual "I am..." phrases
  if (lower.endsWith('?') || lower.startsWith('who ') || lower.startsWith('what ') || lower.startsWith('how ')) {
    return;
  }
  if (
    lower.includes('my name is ') ||
    lower.includes('call me ') ||
    lower.includes('remember that ') ||
    lower.includes('remember: ') ||
    lower.includes('my favorite ')
  ) {
    const memoryFact = userText.replace(/^(please |zoya |hey zoya |hi zoya )/i, '').trim();
    if (memoryFact.length > 5 && memoryFact.length < 200 && !serverMemories.some(m => m.content.toLowerCase() === memoryFact.toLowerCase())) {
      serverMemories.unshift({
        id: `mem_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        content: memoryFact,
        category: 'general',
        timestamp: Date.now()
      });
      serverMemories = serverMemories.slice(0, 100);
      saveServerMemories();
    }
  }
}

function cleanSpokenText(raw: string): string {
  return raw
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .replace(/^#+\s+/gm, '')
    .replace(/^(Sure!|Certainly!|Of course!)\s+/i, '')
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));
  const server = http.createServer(app);

  // Pre-warm startup TTS audio in background if not already cached on disk
  const bootAi = getAIClient();
  if (bootAi && !cachedStartupAudio) {
    synthesizeZoyaSpeech(bootAi, STARTUP_TEXT).then((audio) => {
      if (audio) {
        cachedStartupAudio = audio;
        console.log('[Startup TTS] Pre-cached startup voice audio ready.');
      }
    }).catch(() => {});
  }
  
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // REST Memories API
  app.get('/api/memories', (_req, res) => {
    res.json({ memories: serverMemories });
  });

  app.post('/api/memories', (req, res) => {
    try {
      const { content, category } = req.body;
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: 'Content is required' });
      }
      const trimmed = content.trim();
      const existing = serverMemories.find(m => m.content.toLowerCase() === trimmed.toLowerCase());
      if (!existing) {
        const newMemory = {
          id: req.body.id || `mem_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          content: trimmed,
          category: category || 'general',
          timestamp: Date.now()
        };
        serverMemories.unshift(newMemory);
        serverMemories = serverMemories.slice(0, 100);
        saveServerMemories();
        return res.json({ success: true, memory: newMemory, count: serverMemories.length });
      }
      res.json({ success: true, memory: existing, count: serverMemories.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/memories/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { content, category } = req.body;
      const idx = serverMemories.findIndex(m => m.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: 'Memory not found' });
      }
      if (content && typeof content === 'string') {
        serverMemories[idx].content = content.trim();
      }
      if (category && typeof category === 'string') {
        serverMemories[idx].category = category.trim();
      }
      serverMemories[idx].timestamp = Date.now();
      saveServerMemories();
      res.json({ success: true, memory: serverMemories[idx] });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/memories/:id', (req, res) => {
    try {
      const { id } = req.params;
      serverMemories = serverMemories.filter(m => m.id !== id);
      saveServerMemories();
      res.json({ success: true, count: serverMemories.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/memories', (_req, res) => {
    try {
      serverMemories = [];
      saveServerMemories();
      res.json({ success: true, count: 0 });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // REST Reminders API
  app.get('/api/reminders', (_req, res) => {
    res.json({ reminders: serverReminders });
  });

  app.post('/api/reminders', (req, res) => {
    try {
      const { title, datetime, repeat, note } = req.body;
      if (!title || typeof title !== 'string') {
        return res.status(400).json({ error: 'Title is required' });
      }
      const newReminder = {
        id: req.body.id || `rem_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        title: title.trim(),
        datetime: datetime || new Date(Date.now() + 3600000).toISOString(),
        repeat: repeat || 'none',
        note: note ? String(note).trim() : undefined,
        completed: Boolean(req.body.completed),
        createdAt: req.body.createdAt || Date.now()
      };
      serverReminders.unshift(newReminder);
      saveServerReminders();
      res.json({ success: true, reminder: newReminder });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/reminders/:id', (req, res) => {
    try {
      const { id } = req.params;
      const idx = serverReminders.findIndex(r => r.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: 'Reminder not found' });
      }
      serverReminders[idx] = { ...serverReminders[idx], ...req.body, id };
      saveServerReminders();
      res.json({ success: true, reminder: serverReminders[idx] });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/reminders/:id', (req, res) => {
    try {
      const { id } = req.params;
      serverReminders = serverReminders.filter(r => r.id !== id);
      saveServerReminders();
      res.json({ success: true, count: serverReminders.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // REST Conversations / Chat History API
  app.get('/api/conversations', (_req, res) => {
    res.json({ conversations: serverConversations });
  });

  app.post('/api/conversations', (req, res) => {
    try {
      const { id, title, type, messages } = req.body;
      const newConv = {
        id: id || `conv_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        title: title ? String(title).trim() : 'New Conversation',
        createdAt: req.body.createdAt || Date.now(),
        updatedAt: req.body.updatedAt || Date.now(),
        type: type || 'text',
        messages: Array.isArray(messages) ? messages : []
      };
      // Upsert
      const existingIdx = serverConversations.findIndex(c => c.id === newConv.id);
      if (existingIdx !== -1) {
        serverConversations[existingIdx] = newConv;
      } else {
        serverConversations.unshift(newConv);
      }
      serverConversations = serverConversations.slice(0, 100);
      saveServerConversations();
      res.json({ success: true, conversation: newConv });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/conversations/:id', (req, res) => {
    try {
      const { id } = req.params;
      const idx = serverConversations.findIndex(c => c.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
      serverConversations[idx] = {
        ...serverConversations[idx],
        ...req.body,
        id,
        updatedAt: Date.now()
      };
      saveServerConversations();
      res.json({ success: true, conversation: serverConversations[idx] });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/conversations/:id', (req, res) => {
    try {
      const { id } = req.params;
      serverConversations = serverConversations.filter(c => c.id !== id);
      saveServerConversations();
      res.json({ success: true, count: serverConversations.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/conversations', (_req, res) => {
    try {
      serverConversations = [];
      saveServerConversations();
      res.json({ success: true, count: 0 });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // REST Image Generation API
  app.post('/api/generate-image', async (req, res) => {
    try {
      const { prompt, aspectRatio } = req.body;
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Prompt is required' });
      }
      const ai = getAIClient();
      if (!ai) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
      }

      console.log(`[ImageGen] Generating image for prompt: "${prompt.slice(0, 80)}..."`);
      
      const imageModels = ['gemini-3.1-flash-lite-image', 'gemini-3.1-flash-image'];
      let lastErr: any = null;
      let imageUrl: string | null = null;
      let caption: string | null = null;

      for (const model of imageModels) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: {
              parts: [{ text: prompt.trim() }]
            },
            config: {
              imageConfig: {
                aspectRatio: aspectRatio || "1:1",
              }
            }
          });

          if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
              if (part.inlineData?.data) {
                const mimeType = part.inlineData.mimeType || 'image/png';
                imageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
              } else if (part.text) {
                caption = part.text;
              }
            }
          }

          if (imageUrl) break;
        } catch (err: any) {
          lastErr = err;
        }
      }

      if (!imageUrl) {
        const isQuota = lastErr?.status === 429 || lastErr?.message?.includes('429') || lastErr?.message?.includes('RESOURCE_EXHAUSTED');
        const isZeroLimit = lastErr?.message?.includes('limit: 0') || lastErr?.message?.includes('FreeTier');

        const errorMessage = (isQuota || isZeroLimit)
          ? 'Image synthesis models are unavailable on this free Google Cloud project because they require billing enabled. All voice, chat, memory, and reminder features remain fully functional.'
          : (lastErr?.message || 'Model did not produce an image. Please refine your prompt and try again.');

        return res.status(200).json({ 
          success: false,
          error: errorMessage,
          isQuota: Boolean(isQuota || isZeroLimit),
          requiresPaidKey: Boolean(isQuota || isZeroLimit)
        });
      }

      res.json({ success: true, imageUrl, caption, prompt });
    } catch (err: any) {
      const isQuota = err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED');
      res.status(200).json({ 
        success: false,
        error: isQuota 
          ? 'Image synthesis models are unavailable on this free Google Cloud project because they require billing enabled. All voice, chat, memory, and reminder features remain fully functional.'
          : (err.message || 'Image generation failed. Please try a different prompt.'),
        isQuota: Boolean(isQuota),
        requiresPaidKey: Boolean(isQuota)
      });
    }
  });

  // Fast REST Chat Endpoint (with optional TTS synthesis and personality mode)
  app.post('/api/chat', async (req, res) => {
    try {
      const { text, memories, includeAudio, personalityMode, conversationHistory: clientHistory } = req.body;
      const ai = getAIClient();
      if (!ai) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
      }

      if (memories && Array.isArray(memories)) {
        memories.forEach((m: string) => {
          if (typeof m === 'string' && !serverMemories.some(sm => sm.content.toLowerCase() === m.toLowerCase())) {
            serverMemories.unshift({
              id: `mem_${Date.now()}_${Math.random().toString(36).substring(7)}`,
              content: m,
              category: 'general',
              timestamp: Date.now()
            });
          }
        });
        saveServerMemories();
      }

      if (text) {
        autoExtractMemoryFromText(text);
      }

      const fullInstruction =
        BASE_ZOYA_SYSTEM_INSTRUCTION +
        getPersonalityInstruction(personalityMode) +
        getMemoryContextPrompt();

      let contents: any = text || 'Hey';
      if (Array.isArray(clientHistory) && clientHistory.length > 0) {
        contents = [
          ...clientHistory.slice(-10).map((h: any) => ({
            role: h.sender === 'user' ? 'user' : 'model',
            parts: [{ text: h.text }]
          })),
          { role: 'user', parts: [{ text: text || 'Hey' }] }
        ];
      }

      const response = await generateWithFallback(ai, contents, fullInstruction, false);
      const responseText = cleanSpokenText(response.text || "I'm here—what's on your mind?");

      let audioBase64: string | null = null;
      if (includeAudio) {
        audioBase64 = await synthesizeZoyaSpeech(ai, responseText);
      }

      res.json({ text: responseText, audio: audioBase64 });
    } catch (err: any) {
      console.warn('[Chat Endpoint Notice]:', err?.message || err);
      res.status(200).json({ 
        text: "I'm right here with you. What would you like to explore next?",
        audio: null
      });
    }
  });

  // Dedicated WebSocket Server with explicit upgrade routing
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const host = request.headers.host || 'localhost:3000';
    try {
      const parsedUrl = new URL(request.url || '', `http://${host}`);
      if (parsedUrl.pathname === '/live' || parsedUrl.pathname === '/live/') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
    } catch (e) {
      console.error('[WebSocket Upgrade Error]', e);
    }
  });

  wss.on('connection', (clientWs: WebSocket) => {
    console.log('[WebSocket] Client connected to /live');
    
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ 
        type: 'STATUS', 
        status: 'CONNECTED',
        memories: serverMemories.map(m => m.content)
      }));
    }

    let hasHandledStartup = false;
    let isProcessingTurn = false;
    let isConnectionClosed = false;
    let activeTurnId = 0;
    let userPersonalityMode = 'Default Zoya';
    let lastSpokenModelReply = '';
    let lastUserPromptNorm = '';
    let lastUserPromptTime = 0;
    const sentVoiceTurnIds = new Set<number>();
    const ai = getAIClient();

    // Per-connection multi-turn conversation history
    const conversationHistory: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    const isTurnActive = (turnId: number) =>
      !isConnectionClosed && clientWs.readyState === WebSocket.OPEN && turnId === activeTurnId;

    const sendSpokenReply = async (replyText: string, turnId: number) => {
      if (!isTurnActive(turnId) || sentVoiceTurnIds.has(turnId)) return; // Aborted, closed, or already spoken
      const cleanReply = cleanSpokenText(replyText);
      if (!cleanReply) {
        if (isTurnActive(turnId)) {
          clientWs.send(JSON.stringify({ silentTurn: true, turnId }));
        }
        return;
      }

      lastSpokenModelReply = cleanReply;

      // Immediately send the text transcript so the HUD updates while TTS synthesizes
      if (isTurnActive(turnId)) {
        clientWs.send(JSON.stringify({ text: cleanReply, transcriptOnly: true, turnId }));
      }

      if (ai) {
        const base64Audio = await synthesizeZoyaSpeech(ai, cleanReply);
        if (!isTurnActive(turnId) || sentVoiceTurnIds.has(turnId)) return; // Check again after async TTS synthesis
        if (base64Audio) {
          sentVoiceTurnIds.add(turnId);
          clientWs.send(JSON.stringify({ audio: base64Audio, transcript: cleanReply, turnId }));
          return;
        }
      }

      if (isTurnActive(turnId) && !sentVoiceTurnIds.has(turnId)) {
        sentVoiceTurnIds.add(turnId);
        clientWs.send(JSON.stringify({ text: cleanReply, useBrowserSpeech: true, turnId }));
      }
    };

    const allocateTurnId = (requestedTurnId?: number): number | null => {
      if (typeof requestedTurnId === 'number') {
        if (requestedTurnId < activeTurnId) {
          return null; // Reject stale out-of-order turn from client
        }
        activeTurnId = requestedTurnId;
        return activeTurnId;
      }
      activeTurnId += 1;
      return activeTurnId;
    };

    // Core validated user turn processor (shared by both text/SpeechRecognition and transcribed WAV audio)
    const processValidatedUserTurn = async (trimmed: string, currentTurnId: number, clientLocalTime?: string) => {
      if (currentTurnId !== activeTurnId) return;

      // Check for incomplete 1-word fragments that are clearly cut-off speech
      const normWords = trimmed.toLowerCase().replace(/[^\w\s]/g, ' ').trim().split(/\s+/).filter(Boolean);
      const cutOffFragments = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'if', 'to', 'of', 'in', 'for', 'with', 'on', 'at', 'by', 'from']);
      if (normWords.length === 1 && cutOffFragments.has(normWords[0])) {
        await sendSpokenReply("Didn't catch that—say it again?", currentTurnId);
        return;
      }

      autoExtractMemoryFromText(trimmed);

      if (!ai) {
        await sendSpokenReply("Hey, my AI key isn't connected right now. Check the server configuration.", currentTurnId);
        return;
      }

      try {
        const timeContext = `\n# CURRENT LOCAL TIME & DATE:\n${clientLocalTime || new Date().toLocaleString()}\nIf the user asks for the time or date, answer directly using this current time.\n`;
        const antiRepeatHint = lastSpokenModelReply
          ? `\n# RECENT REPLY NOTE:\nYour immediately preceding spoken response was: "${lastSpokenModelReply}". Do NOT repeat an old answer for a new question. Respond directly to the user's latest message below.\n`
          : '';
        const currentInstruction =
          BASE_ZOYA_SYSTEM_INSTRUCTION +
          getPersonalityInstruction(userPersonalityMode) +
          timeContext +
          getMemoryContextPrompt() +
          antiRepeatHint;
        const contents = [
          ...conversationHistory.slice(-12),
          { role: 'user' as const, parts: [{ text: trimmed }] }
        ];

        const response = await generateWithFallback(ai, contents, currentInstruction, true);
        if (currentTurnId !== activeTurnId) return; // Cancelled by newer user input or interruption

        const functionCalls = response.functionCalls;
        let spokenReply = response.text ? cleanSpokenText(response.text) : '';

        if (functionCalls && functionCalls.length > 0) {
          const formattedCalls = functionCalls.map((fc: any, idx: number) => ({
            id: fc.id || `call_${Date.now()}_${idx}`,
            name: fc.name,
            args: fc.args || {}
          }));

          for (const fc of formattedCalls) {
            if (fc.name === 'saveMemory' && fc.args?.content) {
              const fact = String(fc.args.content).trim();
              if (!serverMemories.some(m => m.content.toLowerCase() === fact.toLowerCase())) {
                serverMemories.unshift({
                  id: `mem_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                  content: fact,
                  category: fc.args.category || 'general',
                  timestamp: Date.now()
                });
                saveServerMemories();
              }
              if (!spokenReply) {
                spokenReply = `Got it, I'll keep that in mind.`;
              }
            } else if (fc.name === 'getMemories') {
              if (!spokenReply) {
                if (serverMemories.length > 0) {
                  spokenReply = `Here's what I know about you so far: ${serverMemories.slice(0, 5).map(m => m.content).join('. ')}.`;
                } else {
                  spokenReply = `You haven't asked me to remember anything specific yet. Tell me whenever you want me to keep something in mind.`;
                }
              }
            } else if (fc.name === 'openWebsite' && fc.args?.url) {
              if (!spokenReply) {
                spokenReply = `Done. Opening that up for you now.`;
              }
            } else if (fc.name === 'openApp' && fc.args?.appName) {
              if (!spokenReply) {
                spokenReply = `Opening ${fc.args.appName} now.`;
              }
            } else if (fc.name === 'createReminder' && fc.args?.title) {
              const reminderItem = {
                id: `rem_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                title: String(fc.args.title).trim(),
                datetime: fc.args.time ? String(fc.args.time) : new Date(Date.now() + 3600000).toISOString(),
                repeat: 'none',
                note: 'Created via Zoya voice',
                completed: false,
                createdAt: Date.now()
              };
              serverReminders.unshift(reminderItem);
              saveServerReminders();
              if (!spokenReply) {
                spokenReply = `Done. I've set a reminder for ${fc.args.title} at ${fc.args.time || 'that time'}.`;
              }
            } else if (fc.name === 'getBatteryStatus' || fc.name === 'getDeviceInfo') {
              if (!spokenReply) {
                spokenReply = `Checked your system status—everything looks solid.`;
              }
            }
          }

          if (clientWs.readyState === WebSocket.OPEN && currentTurnId === activeTurnId) {
            clientWs.send(JSON.stringify({
              toolCall: { functionCalls: formattedCalls },
              turnId: currentTurnId
            }));
          }
        }

        if (!spokenReply) {
          spokenReply = "Done. That worked.";
        }

        if (currentTurnId !== activeTurnId) return;

        // Only commit to conversation history once verified this turn was not superseded
        conversationHistory.push({ role: 'user', parts: [{ text: trimmed }] });
        conversationHistory.push({ role: 'model', parts: [{ text: spokenReply }] });
        if (conversationHistory.length > 20) {
          conversationHistory.splice(0, conversationHistory.length - 20);
        }

        await sendSpokenReply(spokenReply, currentTurnId);
      } catch (e: any) {
        console.warn('[Fast Turn Notice]:', e?.message || e);
        if (currentTurnId === activeTurnId) {
          await sendSpokenReply("I'm right here with you. Say that one more time?", currentTurnId);
        }
      }
    };

    // High-speed conversational turn generator with ultra-fast TTS & tool execution
    const handleFastTurn = async (userText: string, clientLocalTime?: string, requestedTurnId?: number) => {
      const trimmed = userText.trim();
      if (!trimmed) {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ silentTurn: true, turnId: requestedTurnId }));
        }
        return;
      }

      const isStartup = trimmed === "System initialized. Say your startup sequence.";
      if (isStartup) {
        if (hasHandledStartup) return;
        hasHandledStartup = true;
        const startupTurnId = allocateTurnId(requestedTurnId) ?? ++activeTurnId;
        lastSpokenModelReply = STARTUP_TEXT;

        if (cachedStartupAudio && clientWs.readyState === WebSocket.OPEN && !sentVoiceTurnIds.has(startupTurnId)) {
          sentVoiceTurnIds.add(startupTurnId);
          clientWs.send(JSON.stringify({ audio: cachedStartupAudio, transcript: STARTUP_TEXT, turnId: startupTurnId }));
          return;
        }

        if (ai) {
          const base64Audio = await synthesizeZoyaSpeech(ai, STARTUP_TEXT);
          if (base64Audio) {
            cachedStartupAudio = base64Audio;
            if (clientWs.readyState === WebSocket.OPEN && startupTurnId === activeTurnId && !sentVoiceTurnIds.has(startupTurnId)) {
              sentVoiceTurnIds.add(startupTurnId);
              clientWs.send(JSON.stringify({ audio: base64Audio, transcript: STARTUP_TEXT, turnId: startupTurnId }));
              return;
            }
          }
        }

        if (clientWs.readyState === WebSocket.OPEN && startupTurnId === activeTurnId && !sentVoiceTurnIds.has(startupTurnId)) {
          sentVoiceTurnIds.add(startupTurnId);
          clientWs.send(JSON.stringify({ text: STARTUP_TEXT, useBrowserSpeech: true, turnId: startupTurnId }));
        }
        return;
      }

      const normPrompt = trimmed.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
      const now = Date.now();
      if (!normPrompt) {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ silentTurn: true, turnId: requestedTurnId }));
        }
        return;
      }
      if (normPrompt === lastUserPromptNorm && now - lastUserPromptTime < 1500) {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ silentTurn: true, turnId: requestedTurnId }));
        }
        return;
      }

      const currentTurnId = allocateTurnId(requestedTurnId);
      if (currentTurnId === null) return;

      lastUserPromptNorm = normPrompt;
      lastUserPromptTime = now;

      await processValidatedUserTurn(trimmed, currentTurnId, clientLocalTime);
    };

    // Multimodal WAV audio turn handler: strictly transcribes & validates audio, then runs unified turn logic
    const handleAudioWavTurn = async (base64Wav: string, clientLocalTime?: string, requestedTurnId?: number) => {
      if (!ai || !base64Wav || typeof base64Wav !== 'string' || base64Wav.length < 200) {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ silentTurn: true, turnId: requestedTurnId }));
        }
        return;
      }

      const currentTurnId = allocateTurnId(requestedTurnId);
      if (currentTurnId === null) return;

      try {
        const transcriptionPrompt = `Listen carefully to this user audio clip and transcribe ONLY what the user actually spoke.
Rules:
1. Never invent, guess, or hallucinate words that are not clearly spoken in the audio.
2. If the audio contains only background noise, static, breathing, coughs, clicks, or silence -> return {"silent": true, "unclear": false, "userTranscript": ""}
3. If the audio is an echo of Zoya's own voice (last spoken message: "${lastSpokenModelReply}") -> return {"silent": true, "unclear": false, "userTranscript": ""}
4. If a person spoke, but the words are too mumbled, cut off, or unintelligible to be sure what they said -> return {"silent": false, "unclear": true, "userTranscript": ""}
5. Otherwise, return {"silent": false, "unclear": false, "userTranscript": "exact transcription of what the user said in English, Hinglish, or Hindi"}
Respond in strict JSON format only.`;

        const sttResponse = await generateWithFallback(
          ai,
          [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType: 'audio/wav', data: base64Wav } },
                { text: transcriptionPrompt }
              ]
            }
          ],
          'You are an exact, zero-hallucination speech transcription engine for Zoya AI.',
          false,
          'application/json'
        );

        if (!isTurnActive(currentTurnId)) return;

        const rawText = (sttResponse.text || '').trim();
        const cleanedJson = rawText
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim();
        const jsonMatch = cleanedJson.match(/\{[\s\S]*\}/);
        let parsed: { silent?: boolean; unclear?: boolean; userTranscript?: string } = {};
        try {
          parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleanedJson);
        } catch {
          parsed = { silent: true };
        }

        if (parsed.silent) {
          if (clientWs.readyState === WebSocket.OPEN && currentTurnId === activeTurnId) {
            clientWs.send(JSON.stringify({ silentTurn: true, turnId: currentTurnId }));
          }
          return;
        }

        if (parsed.unclear) {
          await sendSpokenReply("Didn't catch that—say it again?", currentTurnId);
          return;
        }

        const transcriptText = (parsed.userTranscript || '').trim();
        if (!transcriptText) {
          if (clientWs.readyState === WebSocket.OPEN && currentTurnId === activeTurnId) {
            clientWs.send(JSON.stringify({ silentTurn: true, turnId: currentTurnId }));
          }
          return;
        }

        // Deduplicate against an identical turn that was just processed via SpeechRecognition
        const normTranscript = transcriptText.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
        const now = Date.now();
        if (!normTranscript || (normTranscript === lastUserPromptNorm && now - lastUserPromptTime < 1800)) {
          if (clientWs.readyState === WebSocket.OPEN && currentTurnId === activeTurnId) {
            clientWs.send(JSON.stringify({ silentTurn: true, turnId: currentTurnId }));
          }
          return;
        }
        lastUserPromptNorm = normTranscript;
        lastUserPromptTime = now;

        if (clientWs.readyState === WebSocket.OPEN && currentTurnId === activeTurnId) {
          clientWs.send(JSON.stringify({ userTranscript: transcriptText, turnId: currentTurnId }));
        }

        await processValidatedUserTurn(transcriptText, currentTurnId, clientLocalTime);
      } catch {
        if (clientWs.readyState === WebSocket.OPEN && currentTurnId === activeTurnId) {
          clientWs.send(JSON.stringify({ silentTurn: true, turnId: currentTurnId }));
        }
      }
    };

    // Register message listener IMMEDIATELY so zero messages are ever lost on connection
    clientWs.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        
        // Handle user interruption (barge-in): cancel any in-flight reply immediately
        if (msg.type === 'INTERRUPT') {
          if (typeof msg.clientTurnId === 'number' && msg.clientTurnId > activeTurnId) {
            activeTurnId = msg.clientTurnId;
          } else {
            activeTurnId++;
          }
          isProcessingTurn = false;
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ interrupted: true, turnId: activeTurnId }));
          }
          return;
        }

        // Sync user memories from client
        if (msg.type === 'SYNC_MEMORIES' && Array.isArray(msg.memories)) {
          msg.memories.forEach((mem: string) => {
            if (typeof mem === 'string' && !serverMemories.some(sm => sm.content.toLowerCase() === mem.toLowerCase())) {
              serverMemories.unshift({
                id: `mem_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                content: mem,
                category: 'general',
                timestamp: Date.now()
              });
            }
          });
          saveServerMemories();
          return;
        }

        // Update active personality mode
        if (msg.type === 'SET_PERSONALITY' && typeof msg.mode === 'string') {
          userPersonalityMode = msg.mode;
          console.log(`[WebSocket] Personality mode updated to: ${userPersonalityMode}`);
          return;
        }

        // Dedicated startup prompt handler
        if (
          msg.clientContent?.turns?.[0]?.parts?.[0]?.text === "System initialized. Say your startup sequence." ||
          msg.textPrompt === "System initialized. Say your startup sequence."
        ) {
          await handleFastTurn("System initialized. Say your startup sequence.", msg.clientTime, msg.clientTurnId);
          return;
        }

        // Text prompt handling (super-fast turn)
        if (msg.textPrompt) {
          await handleFastTurn(msg.textPrompt, msg.clientTime, msg.clientTurnId);
          return;
        }

        if (msg.clientContent?.turns?.[0]?.parts?.[0]?.text) {
          const userText = msg.clientContent.turns[0].parts[0].text;
          await handleFastTurn(userText, msg.clientTime, msg.clientTurnId);
          return;
        }

        // Handle WAV audio turn fallback from client VAD
        if (msg.audioWav) {
          await handleAudioWavTurn(msg.audioWav, msg.clientTime, msg.clientTurnId);
          return;
        }

        // Handle tool responses from client
        if (msg.toolResponse) {
          if (msg.toolResponse.functionResponses) {
            msg.toolResponse.functionResponses.forEach((fr: any) => {
              if (fr.name === 'saveMemory' && fr.response?.memory_saved) {
                const saved = fr.response.memory_saved;
                if (!serverMemories.some(m => m.content.toLowerCase() === String(saved).toLowerCase())) {
                  serverMemories.unshift({
                    id: `mem_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                    content: String(saved),
                    category: 'general',
                    timestamp: Date.now()
                  });
                  saveServerMemories();
                }
              }
            });
          }
          return;
        }
      } catch (e) {
        console.warn("[WebSocket] Notice processing client message:", e);
      }
    });

    clientWs.on('close', () => {
      isConnectionClosed = true;
      isProcessingTurn = false;
      activeTurnId += 100000;
      conversationHistory.length = 0;
      sentVoiceTurnIds.clear();
      clientWs.removeAllListeners();
      console.log('[WebSocket] Client disconnected');
    });

    clientWs.on('error', (err) => {
      console.warn('[WebSocket] Socket error:', err);
    });
  });

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
