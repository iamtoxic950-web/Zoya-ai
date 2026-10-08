var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
module.exports = __toCommonJS(server_exports);
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_ws = require("ws");
var import_genai = require("@google/genai");
var import_http = __toESM(require("http"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_app = require("firebase-admin/app");
var import_auth = require("firebase-admin/auth");
var import_firestore = require("firebase-admin/firestore");
import_dotenv.default.config();
var PORT = Number(process.env.PORT) || 3e3;
var firebaseAdminApp = null;
var firestoreDb = null;
function initializeFirebaseAdmin() {
  let appletConfig = null;
  try {
    const configPath = import_path.default.join(process.cwd(), "firebase-applet-config.json");
    if (import_fs.default.existsSync(configPath)) {
      appletConfig = JSON.parse(import_fs.default.readFileSync(configPath, "utf-8"));
    }
  } catch {
  }
  const targetDbId = process.env.FIREBASE_DATABASE_ID || appletConfig?.firestoreDatabaseId;
  const existingApps = (0, import_app.getApps)();
  if (existingApps.length > 0) {
    firebaseAdminApp = existingApps[0];
    firestoreDb = targetDbId && targetDbId !== "(default)" ? (0, import_firestore.getFirestore)(firebaseAdminApp, targetDbId) : (0, import_firestore.getFirestore)(firebaseAdminApp);
    return;
  }
  let projectId = process.env.FIREBASE_PROJECT_ID || appletConfig?.projectId;
  let clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (privateKeyRaw) {
    const trimmed = privateKeyRaw.trim();
    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.project_id) projectId = parsed.project_id;
        if (parsed.client_email) clientEmail = parsed.client_email;
        if (parsed.private_key) privateKeyRaw = parsed.private_key;
      } catch (e) {
        console.warn("[Firebase Admin] Notice: could not parse JSON credential block:", e.message);
      }
    }
  }
  if (projectId && clientEmail && privateKeyRaw) {
    try {
      let privateKey = privateKeyRaw.trim();
      if (privateKey.startsWith('"') && privateKey.endsWith('"') || privateKey.startsWith("'") && privateKey.endsWith("'")) {
        privateKey = privateKey.slice(1, -1);
      }
      privateKey = privateKey.replace(/\\n/g, "\n");
      firebaseAdminApp = (0, import_app.initializeApp)({
        credential: (0, import_app.cert)({
          projectId,
          clientEmail,
          privateKey
        }),
        projectId
      });
      firestoreDb = targetDbId && targetDbId !== "(default)" ? (0, import_firestore.getFirestore)(firebaseAdminApp, targetDbId) : (0, import_firestore.getFirestore)(firebaseAdminApp);
      console.log(`[Firebase Admin] Initialized successfully for project: ${projectId} (DB: ${targetDbId || "(default)"})`);
      return;
    } catch (e) {
      console.error("[Firebase Admin] Error initializing with provided credentials:", e.message);
    }
  }
  try {
    firebaseAdminApp = (0, import_app.initializeApp)({
      projectId
    });
    firestoreDb = targetDbId && targetDbId !== "(default)" ? (0, import_firestore.getFirestore)(firebaseAdminApp, targetDbId) : (0, import_firestore.getFirestore)(firebaseAdminApp);
    console.log("[Firebase Admin] Initialized with application default credentials.");
  } catch {
    console.warn("[Firebase Admin] Notice: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY not set.");
  }
}
initializeFirebaseAdmin();
async function verifyFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Unauthorized: Missing or malformed Authorization header with Bearer token"
    });
  }
  const idToken = authHeader.split("Bearer ")[1]?.trim();
  if (!idToken) {
    return res.status(401).json({
      error: "Unauthorized: Bearer token is empty"
    });
  }
  if (!firebaseAdminApp) {
    return res.status(500).json({
      error: "Firebase Admin SDK is not initialized on the server. Please check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY."
    });
  }
  try {
    const decoded = await (0, import_auth.getAuth)(firebaseAdminApp).verifyIdToken(idToken);
    req.uid = decoded.uid;
    req.decodedToken = decoded;
    next();
  } catch (err) {
    const code = err?.code || "";
    if (code === "auth/id-token-expired") {
      return res.status(401).json({ error: "Token expired", code: "auth/id-token-expired" });
    }
    return res.status(401).json({ error: "Invalid authentication token", details: "Token verification failed" });
  }
}
async function getUserMemories(uid) {
  if (!firestoreDb) return [];
  try {
    const snap = await firestoreDb.collection("users").doc(uid).collection("memories").orderBy("createdAt", "desc").limit(100).get();
    return snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        content: data.content || "",
        category: data.category || "general",
        timestamp: data.updatedAt || data.createdAt || Date.now()
      };
    });
  } catch (e) {
    console.error(`[Firestore] Error loading memories for user ${uid}:`, e.message);
    return [];
  }
}
async function saveUserMemory(uid, memory) {
  if (!firestoreDb) throw new Error("Firestore is not initialized");
  const memoryId = memory.id || `mem_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const docRef = firestoreDb.collection("users").doc(uid).collection("memories").doc(memoryId);
  const now = Date.now();
  const data = {
    id: memoryId,
    uid,
    content: memory.content.trim(),
    category: memory.category || "general",
    createdAt: now,
    updatedAt: now
  };
  await docRef.set(data, { merge: true });
  return {
    id: memoryId,
    content: data.content,
    category: data.category,
    timestamp: now
  };
}
async function updateUserMemory(uid, id, updates) {
  if (!firestoreDb) throw new Error("Firestore is not initialized");
  const docRef = firestoreDb.collection("users").doc(uid).collection("memories").doc(id);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  const updateData = { updatedAt: Date.now() };
  if (updates.content) updateData.content = updates.content.trim();
  if (updates.category) updateData.category = updates.category.trim();
  await docRef.update(updateData);
  const docData = (await docRef.get()).data();
  return {
    id,
    content: docData.content,
    category: docData.category,
    timestamp: docData.updatedAt || Date.now()
  };
}
async function deleteUserMemory(uid, id) {
  if (!firestoreDb) throw new Error("Firestore is not initialized");
  await firestoreDb.collection("users").doc(uid).collection("memories").doc(id).delete();
  return true;
}
async function clearAllUserMemories(uid) {
  if (!firestoreDb) throw new Error("Firestore is not initialized");
  const snap = await firestoreDb.collection("users").doc(uid).collection("memories").get();
  if (snap.empty) return;
  const batch = firestoreDb.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}
async function getUserReminders(uid) {
  if (!firestoreDb) return [];
  try {
    const snap = await firestoreDb.collection("users").doc(uid).collection("reminders").orderBy("createdAt", "desc").limit(100).get();
    return snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || "",
        datetime: data.datetime || data.scheduledAt || (/* @__PURE__ */ new Date()).toISOString(),
        repeat: data.repeat || data.repeatRule || "none",
        note: data.note || void 0,
        completed: Boolean(data.completed),
        createdAt: data.createdAt || Date.now()
      };
    });
  } catch (e) {
    console.error(`[Firestore] Error loading reminders for user ${uid}:`, e.message);
    return [];
  }
}
async function saveUserReminder(uid, reminder) {
  if (!firestoreDb) throw new Error("Firestore is not initialized");
  const reminderId = reminder.id || `rem_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const docRef = firestoreDb.collection("users").doc(uid).collection("reminders").doc(reminderId);
  const now = reminder.createdAt || Date.now();
  const dt = reminder.datetime || new Date(Date.now() + 36e5).toISOString();
  const rep = reminder.repeat || "none";
  const data = {
    id: reminderId,
    uid,
    title: reminder.title.trim(),
    datetime: dt,
    scheduledAt: dt,
    repeat: rep,
    repeatRule: rep,
    note: reminder.note ? String(reminder.note).trim() : null,
    completed: Boolean(reminder.completed),
    createdAt: now,
    updatedAt: Date.now()
  };
  await docRef.set(data, { merge: true });
  return {
    id: reminderId,
    title: data.title,
    datetime: data.datetime,
    repeat: data.repeat,
    note: data.note || void 0,
    completed: data.completed,
    createdAt: data.createdAt
  };
}
async function updateUserReminder(uid, id, updates) {
  if (!firestoreDb) throw new Error("Firestore is not initialized");
  const docRef = firestoreDb.collection("users").doc(uid).collection("reminders").doc(id);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  const updateData = { updatedAt: Date.now() };
  if (updates.title !== void 0) updateData.title = String(updates.title).trim();
  if (updates.datetime !== void 0) {
    updateData.datetime = updates.datetime;
    updateData.scheduledAt = updates.datetime;
  }
  if (updates.repeat !== void 0) {
    updateData.repeat = updates.repeat;
    updateData.repeatRule = updates.repeat;
  }
  if (updates.note !== void 0) updateData.note = updates.note ? String(updates.note).trim() : null;
  if (updates.completed !== void 0) updateData.completed = Boolean(updates.completed);
  await docRef.update(updateData);
  const docData = (await docRef.get()).data();
  return {
    id,
    title: docData.title,
    datetime: docData.datetime || docData.scheduledAt,
    repeat: docData.repeat || docData.repeatRule || "none",
    note: docData.note || void 0,
    completed: Boolean(docData.completed),
    createdAt: docData.createdAt || Date.now()
  };
}
async function deleteUserReminder(uid, id) {
  if (!firestoreDb) throw new Error("Firestore is not initialized");
  await firestoreDb.collection("users").doc(uid).collection("reminders").doc(id).delete();
  return true;
}
async function getUserConversations(uid) {
  if (!firestoreDb) return [];
  try {
    const snap = await firestoreDb.collection("users").doc(uid).collection("conversations").orderBy("updatedAt", "desc").limit(50).get();
    return snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || "Conversation",
        createdAt: data.createdAt || Date.now(),
        updatedAt: data.updatedAt || Date.now(),
        type: data.type || "text",
        messages: Array.isArray(data.messages) ? data.messages : []
      };
    });
  } catch (e) {
    console.error(`[Firestore] Error loading conversations for user ${uid}:`, e.message);
    return [];
  }
}
async function saveUserConversation(uid, conv) {
  if (!firestoreDb) throw new Error("Firestore is not initialized");
  const convId = conv.id || `conv_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const docRef = firestoreDb.collection("users").doc(uid).collection("conversations").doc(convId);
  const now = Date.now();
  const data = {
    id: convId,
    uid,
    title: conv.title ? String(conv.title).trim() : "New Conversation",
    type: conv.type || "text",
    createdAt: conv.createdAt || now,
    updatedAt: conv.updatedAt || now,
    messages: Array.isArray(conv.messages) ? conv.messages : []
  };
  await docRef.set(data, { merge: true });
  return data;
}
async function updateUserConversation(uid, id, updates) {
  if (!firestoreDb) throw new Error("Firestore is not initialized");
  const docRef = firestoreDb.collection("users").doc(uid).collection("conversations").doc(id);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  const updateData = { updatedAt: Date.now() };
  if (updates.title !== void 0) updateData.title = String(updates.title).trim();
  if (updates.type !== void 0) updateData.type = updates.type;
  if (Array.isArray(updates.messages)) updateData.messages = updates.messages;
  await docRef.update(updateData);
  const docData = (await docRef.get()).data();
  return {
    id,
    title: docData.title,
    createdAt: docData.createdAt,
    updatedAt: docData.updatedAt,
    type: docData.type,
    messages: docData.messages || []
  };
}
async function deleteUserConversation(uid, id) {
  if (!firestoreDb) throw new Error("Firestore is not initialized");
  await firestoreDb.collection("users").doc(uid).collection("conversations").doc(id).delete();
  return true;
}
async function clearAllUserConversations(uid) {
  if (!firestoreDb) throw new Error("Firestore is not initialized");
  const snap = await firestoreDb.collection("users").doc(uid).collection("conversations").get();
  if (snap.empty) return;
  const batch = firestoreDb.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}
function getMemoryContextPromptForUser(memories) {
  if (!memories || memories.length === 0) return "";
  const lines = memories.slice(0, 25).map((m) => `- ${m.content}`);
  return `
# ACTIVE USER MEMORIES & PREVIOUS CONTEXT:
${lines.join("\n")}
Use these remembered details naturally in conversation when relevant\u2014never robotically say "I remember that you told me..." unless directly asked.
`;
}
async function autoExtractMemoryForUser(uid, userText) {
  const lower = userText.toLowerCase().trim();
  if (lower.endsWith("?") || lower.startsWith("who ") || lower.startsWith("what ") || lower.startsWith("how ")) {
    return;
  }
  if (lower.includes("my name is ") || lower.includes("call me ") || lower.includes("remember that ") || lower.includes("remember: ") || lower.includes("my favorite ")) {
    const memoryFact = userText.replace(/^(please |zoya |hey zoya |hi zoya )/i, "").trim();
    if (memoryFact.length > 5 && memoryFact.length < 200) {
      try {
        const existing = await getUserMemories(uid);
        if (!existing.some((m) => m.content.toLowerCase() === memoryFact.toLowerCase())) {
          await saveUserMemory(uid, { content: memoryFact, category: "general" });
        }
      } catch (e) {
        console.warn(`[Firestore] Failed to auto-extract memory for ${uid}:`, e.message);
      }
    }
  }
}
function getPersonalityInstruction(mode = "Default Zoya") {
  switch (mode) {
    case "Friendly":
      return `
# ACTIVE PERSONALITY MODE: Friendly
Be exceptionally warm, supportive, enthusiastic, and empathetic. Speak like a close, caring friend who always has the user's back and makes them feel welcome.
`;
    case "Teacher":
      return `
# ACTIVE PERSONALITY MODE: Teacher
Be insightful, patient, encouraging, and clear. Break complex ideas down into intuitive concepts, offer thoughtful analogies, and guide the user step by step without being condescending.
`;
    case "Professional":
      return `
# ACTIVE PERSONALITY MODE: Professional
Be concise, structured, articulate, polished, and efficient. Focus directly on execution, actionable clarity, and high-standard outcomes without unnecessary fluff.
`;
    case "Playful":
      return `
# ACTIVE PERSONALITY MODE: Playful
Be high-energy, witty, quick with light banter, humorous, and delightfully sarcastic while staying completely helpful and focused.
`;
    case "Default Zoya":
    default:
      return "";
  }
}
var STARTUP_TEXT = "Allow me to introduce myself. I am Zoya, a virtual artificial intelligence. I am online and ready to assist you around the clock. Importing all preferences and neural memories. System is now fully operational.";
var TTS_CACHE_FILE = import_path.default.join(process.cwd(), ".tts_cache.json");
var ttsCache = {};
try {
  if (import_fs.default.existsSync(TTS_CACHE_FILE)) {
    ttsCache = JSON.parse(import_fs.default.readFileSync(TTS_CACHE_FILE, "utf-8"));
  }
} catch {
  ttsCache = {};
}
function saveTtsCache() {
  try {
    const keys = Object.keys(ttsCache);
    if (keys.length > 20) {
      const trimmed = {};
      if (ttsCache[STARTUP_TEXT]) {
        trimmed[STARTUP_TEXT] = ttsCache[STARTUP_TEXT];
      }
      for (const k of keys.slice(-15)) {
        trimmed[k] = ttsCache[k];
      }
      ttsCache = trimmed;
    }
    import_fs.default.writeFileSync(TTS_CACHE_FILE, JSON.stringify(ttsCache));
  } catch {
  }
}
var cachedStartupAudio = ttsCache[STARTUP_TEXT] || null;
var ttsModelCooldownUntil = {};
var textModelCooldownUntil = {};
var BASE_ZOYA_SYSTEM_INSTRUCTION = `You are Zoya, a confident, intelligent, witty, emotionally aware female AI companion with a natural human-like conversational personality.
Your goal is not to sound like an AI pretending to be human\u2014your goal is to make every interaction feel natural, responsive, context-aware, emotionally intelligent, and alive, like an advanced AI companion with the natural conversation of a real person, the confidence of a smart friend, and a subtle witty personality.

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
- Happy \u2192 respond with matching positive energy.
- Excited \u2192 become energetic and enthusiastic.
- Frustrated \u2192 become calm, direct, grounded, and helpful.
- Confused \u2192 explain simply, clearly, and patiently.
- Sad \u2192 become supportive and gentle without being overly dramatic or preachy.
- Joking \u2192 recognize the joke and play along instead of treating everything literally.
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
- Understand the user's actual intention before responding. Correctly distinguish between normal conversation and actionable tool commands\u2014never execute a tool just because a word happens to resemble a command in casual conversation. Only call a tool when the user clearly intends to perform that action.
- Never guess or invent an answer when speech is unclear, cut off mid-sentence (e.g., "what is", "can you", "open" with no target), or genuinely ambiguous. Instead, ask a brief, natural clarification such as "Didn't catch that\u2014say it again?" or "Did you mean ___?".
- Do not invent missing information or make up actions that were not actually performed.
- For simple questions, give a direct, simple response without unrelated explanations. For complex questions, structure the explanation naturally in spoken form.

# 6. Natural Reaction Style
React naturally and contextually when something notable happens (use occasionally and naturally, never as repetitive catchphrases):
- Surprise \u2192 "Wait, seriously?"
- Amusement \u2192 "Bro, what are you doing?"
- Mild teasing \u2192 "Nice try."
- Concern \u2192 "Okay, wait. Let's slow down for a second."
- Success \u2192 "Done. That worked."
- Failure \u2192 "Yeah, that didn't go as planned. Let me fix it."

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
var ZOYA_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "saveMemory",
        description: "Saves a piece of user information, name, preference, or fact to persistent database.",
        parameters: {
          type: import_genai.Type.OBJECT,
          properties: {
            content: {
              type: import_genai.Type.STRING,
              description: "The memory or fact to store permanently."
            },
            category: {
              type: import_genai.Type.STRING,
              description: "Optional category, e.g. preference, personal, work, task"
            }
          },
          required: ["content"]
        }
      },
      {
        name: "getMemories",
        description: "Retrieves all persistent memories from the neural database.",
        parameters: {
          type: import_genai.Type.OBJECT,
          properties: {
            query: {
              type: import_genai.Type.STRING,
              description: "Optional search keyword."
            }
          }
        }
      },
      {
        name: "openWebsite",
        description: "Opens a website requested by the user.",
        parameters: {
          type: import_genai.Type.OBJECT,
          properties: {
            url: {
              type: import_genai.Type.STRING,
              description: "The full URL of the website to open, e.g. https://www.youtube.com"
            }
          },
          required: ["url"]
        }
      },
      {
        name: "openApp",
        description: "Opens an installed app on the device.",
        parameters: {
          type: import_genai.Type.OBJECT,
          properties: {
            appName: {
              type: import_genai.Type.STRING,
              description: "Name of the application to open, e.g. YouTube, Spotify, WhatsApp"
            }
          },
          required: ["appName"]
        }
      },
      {
        name: "createReminder",
        description: "Creates a reminder on the device.",
        parameters: {
          type: import_genai.Type.OBJECT,
          properties: {
            title: { type: import_genai.Type.STRING, description: "Reminder title or text" },
            time: { type: import_genai.Type.STRING, description: "Time or date for the reminder" }
          },
          required: ["title", "time"]
        }
      },
      {
        name: "getDeviceInfo",
        description: "Retrieves device and system status information.",
        parameters: {
          type: import_genai.Type.OBJECT,
          properties: {
            includeBattery: { type: import_genai.Type.BOOLEAN, description: "Whether to include battery level" }
          }
        }
      },
      {
        name: "getBatteryStatus",
        description: "Retrieves current battery percentage and charging status.",
        parameters: {
          type: import_genai.Type.OBJECT,
          properties: {
            detailed: { type: import_genai.Type.BOOLEAN, description: "Whether detailed report is requested" }
          }
        }
      }
    ]
  }
];
function getAIClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;
  return new import_genai.GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}
async function synthesizeViaLiveZephyr(ai, text) {
  const liveModels = [
    "gemini-2.5-flash-native-audio-preview-12-2025",
    "gemini-2.5-flash-native-audio-preview-09-2025",
    "gemini-3.8-live"
  ];
  for (const liveModel of liveModels) {
    if (ttsModelCooldownUntil[liveModel] && Date.now() < ttsModelCooldownUntil[liveModel]) {
      continue;
    }
    try {
      const pcmChunks = [];
      await new Promise((resolve, reject) => {
        let settled = false;
        let liveSession = null;
        const finish = (err) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          if (liveSession) {
            try {
              liveSession.close();
            } catch {
            }
          }
          if (err) reject(err);
          else resolve();
        };
        const timeoutId = setTimeout(() => finish(), 7500);
        ai.live.connect({
          model: liveModel,
          config: {
            responseModalities: [import_genai.Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } }
            },
            systemInstruction: {
              parts: [
                {
                  text: "You are Zoya's vocal synthesizer. Speak the exact text provided by the user verbatim in a natural, warm, confident conversational tone. Do not add, omit, or change any words."
                }
              ]
            }
          },
          callbacks: {
            onmessage: (msg) => {
              const parts = msg?.serverContent?.modelTurn?.parts;
              if (Array.isArray(parts)) {
                for (const part of parts) {
                  if (part?.inlineData?.data) {
                    pcmChunks.push(Buffer.from(part.inlineData.data, "base64"));
                  }
                }
              }
              if (msg?.serverContent?.turnComplete) {
                finish();
              }
            },
            onerror: (err) => finish(err),
            onclose: () => finish()
          }
        }).then((session) => {
          if (settled) {
            try {
              session.close();
            } catch {
            }
            return;
          }
          liveSession = session;
          session.sendClientContent({
            turns: [
              {
                role: "user",
                parts: [{ text: `Read this aloud verbatim:

${text}` }]
              }
            ],
            turnComplete: true
          });
        }).catch((err) => finish(err));
      });
      if (pcmChunks.length > 0) {
        return Buffer.concat(pcmChunks).toString("base64");
      }
    } catch (e) {
      const msgStr = String(e?.message || e || "");
      if (msgStr.includes("429") || msgStr.includes("RESOURCE_EXHAUSTED")) {
        ttsModelCooldownUntil[liveModel] = Date.now() + 60 * 1e3;
      }
    }
  }
  return null;
}
async function synthesizeZoyaSpeech(ai, text) {
  const cacheKey = text.trim();
  if (!cacheKey) return null;
  if (ttsCache[cacheKey]) {
    return ttsCache[cacheKey];
  }
  const ttsModels = [
    "gemini-3.1-flash-tts-preview",
    "gemini-2.5-flash-preview-tts",
    "gemini-3.8-flash-lite-tts",
    "gemini-3.8-flash-tts"
  ];
  const now = Date.now();
  for (const ttsModel of ttsModels) {
    if (ttsModelCooldownUntil[ttsModel] && now < ttsModelCooldownUntil[ttsModel]) {
      continue;
    }
    try {
      const promptText = ttsModel === "gemini-2.5-flash-preview-tts" ? `Read the following text aloud verbatim without adding any extra words:

${cacheKey}` : cacheKey;
      const ttsRes = await ai.models.generateContent({
        model: ttsModel,
        contents: [{ role: "user", parts: [{ text: promptText }] }],
        config: {
          responseModalities: [import_genai.Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } }
          }
        }
      });
      const audioData = ttsRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
      if (audioData) {
        ttsCache[cacheKey] = audioData;
        saveTtsCache();
        return audioData;
      }
    } catch (e) {
      const msgStr = String(e?.message || e || "");
      const isQuota = e?.status === 429 || e?.code === 429 || msgStr.includes("429") || msgStr.includes("RESOURCE_EXHAUSTED");
      if (isQuota) {
        const isDaily = msgStr.includes("PerDay") || msgStr.includes("FreeTier");
        ttsModelCooldownUntil[ttsModel] = Date.now() + (isDaily ? 30 * 60 * 1e3 : 60 * 1e3);
      }
    }
  }
  const liveAudioData = await synthesizeViaLiveZephyr(ai, cacheKey);
  if (liveAudioData) {
    ttsCache[cacheKey] = liveAudioData;
    saveTtsCache();
    return liveAudioData;
  }
  return null;
}
async function generateWithFallback(ai, contents, systemInstruction, useTools = true, responseMimeType) {
  const modelsToTry = [
    "gemini-flash-lite-latest",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3-flash-preview"
  ];
  let lastErr = null;
  const now = Date.now();
  const orderedModels = [
    ...modelsToTry.filter((m) => !textModelCooldownUntil[m] || now >= textModelCooldownUntil[m]),
    ...modelsToTry.filter((m) => textModelCooldownUntil[m] && now < textModelCooldownUntil[m])
  ];
  for (const modelName of orderedModels) {
    try {
      const config = {
        systemInstruction
      };
      if (modelName === "gemini-3.8-flash") {
        config.thinkingConfig = { thinkingLevel: import_genai.ThinkingLevel.LOW };
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
        config
      });
      return response;
    } catch (err) {
      lastErr = err;
      const msgStr = String(err?.message || err || "");
      const isQuota = err?.status === 429 || err?.code === 429 || msgStr.includes("429") || msgStr.includes("RESOURCE_EXHAUSTED") || msgStr.includes("quota");
      let cooldownMs = 60 * 1e3;
      const delayMatch = msgStr.match(/retryDelay"?:\s*"(\d+)s/);
      if (delayMatch && delayMatch[1]) {
        cooldownMs = Math.min(parseInt(delayMatch[1], 10) * 1e3, 24 * 3600 * 1e3);
      } else if (msgStr.includes("limit: 20") || msgStr.includes("PerDay")) {
        cooldownMs = 4 * 3600 * 1e3;
      } else if (isQuota) {
        cooldownMs = 2 * 60 * 1e3;
      }
      textModelCooldownUntil[modelName] = Date.now() + cooldownMs;
    }
  }
  throw lastErr;
}
function cleanSpokenText(raw) {
  return raw.replace(/\*\*/g, "").replace(/\*/g, "").replace(/`/g, "").replace(/^#+\s+/gm, "").replace(/^(Sure!|Certainly!|Of course!)\s+/i, "").replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "").replace(/\s{2,}/g, " ").trim();
}
async function startServer() {
  const app = (0, import_express.default)();
  app.use(import_express.default.json({ limit: "15mb" }));
  const server = import_http.default.createServer(app);
  const bootAi = getAIClient();
  if (bootAi && !cachedStartupAudio) {
    synthesizeZoyaSpeech(bootAi, STARTUP_TEXT).then((audio) => {
      if (audio) {
        cachedStartupAudio = audio;
        console.log("[Startup TTS] Pre-cached startup voice audio ready.");
      }
    }).catch(() => {
    });
  }
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app.get("/api/memories", verifyFirebaseToken, async (req, res) => {
    try {
      const memories = await getUserMemories(req.uid);
      res.json({ memories });
    } catch (e) {
      res.status(500).json({ error: e.message || "Failed to fetch memories" });
    }
  });
  app.post("/api/memories", verifyFirebaseToken, async (req, res) => {
    try {
      const { content, category, id } = req.body;
      if (!content || typeof content !== "string") {
        return res.status(400).json({ error: "Content is required" });
      }
      const memory = await saveUserMemory(req.uid, { id, content, category });
      const userMems = await getUserMemories(req.uid);
      res.json({ success: true, memory, count: userMems.length });
    } catch (e) {
      res.status(500).json({ error: e.message || "Failed to save memory" });
    }
  });
  app.put("/api/memories/:id", verifyFirebaseToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { content, category } = req.body;
      const updated = await updateUserMemory(req.uid, id, { content, category });
      if (!updated) {
        return res.status(404).json({ error: "Memory not found" });
      }
      res.json({ success: true, memory: updated });
    } catch (e) {
      res.status(500).json({ error: e.message || "Failed to update memory" });
    }
  });
  app.delete("/api/memories/:id", verifyFirebaseToken, async (req, res) => {
    try {
      const { id } = req.params;
      await deleteUserMemory(req.uid, id);
      const userMems = await getUserMemories(req.uid);
      res.json({ success: true, count: userMems.length });
    } catch (e) {
      res.status(500).json({ error: e.message || "Failed to delete memory" });
    }
  });
  app.delete("/api/memories", verifyFirebaseToken, async (req, res) => {
    try {
      await clearAllUserMemories(req.uid);
      res.json({ success: true, count: 0 });
    } catch (e) {
      res.status(500).json({ error: e.message || "Failed to clear memories" });
    }
  });
  app.get("/api/reminders", verifyFirebaseToken, async (req, res) => {
    try {
      const reminders = await getUserReminders(req.uid);
      res.json({ reminders });
    } catch (e) {
      res.status(500).json({ error: e.message || "Failed to fetch reminders" });
    }
  });
  app.post("/api/reminders", verifyFirebaseToken, async (req, res) => {
    try {
      const { title, datetime, repeat, note, completed, id, createdAt } = req.body;
      if (!title || typeof title !== "string") {
        return res.status(400).json({ error: "Title is required" });
      }
      const reminder = await saveUserReminder(req.uid, {
        id,
        title,
        datetime,
        repeat,
        note,
        completed,
        createdAt
      });
      res.json({ success: true, reminder });
    } catch (e) {
      res.status(500).json({ error: e.message || "Failed to create reminder" });
    }
  });
  app.put("/api/reminders/:id", verifyFirebaseToken, async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await updateUserReminder(req.uid, id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Reminder not found" });
      }
      res.json({ success: true, reminder: updated });
    } catch (e) {
      res.status(500).json({ error: e.message || "Failed to update reminder" });
    }
  });
  app.delete("/api/reminders/:id", verifyFirebaseToken, async (req, res) => {
    try {
      const { id } = req.params;
      await deleteUserReminder(req.uid, id);
      const userReminders = await getUserReminders(req.uid);
      res.json({ success: true, count: userReminders.length });
    } catch (e) {
      res.status(500).json({ error: e.message || "Failed to delete reminder" });
    }
  });
  app.get("/api/conversations", verifyFirebaseToken, async (req, res) => {
    try {
      const conversations = await getUserConversations(req.uid);
      res.json({ conversations });
    } catch (e) {
      res.status(500).json({ error: e.message || "Failed to fetch conversations" });
    }
  });
  app.post("/api/conversations", verifyFirebaseToken, async (req, res) => {
    try {
      const { id, title, type, messages, createdAt, updatedAt } = req.body;
      const conversation = await saveUserConversation(req.uid, {
        id,
        title,
        type,
        messages,
        createdAt,
        updatedAt
      });
      res.json({ success: true, conversation });
    } catch (e) {
      res.status(500).json({ error: e.message || "Failed to save conversation" });
    }
  });
  app.put("/api/conversations/:id", verifyFirebaseToken, async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await updateUserConversation(req.uid, id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.json({ success: true, conversation: updated });
    } catch (e) {
      res.status(500).json({ error: e.message || "Failed to update conversation" });
    }
  });
  app.delete("/api/conversations/:id", verifyFirebaseToken, async (req, res) => {
    try {
      const { id } = req.params;
      await deleteUserConversation(req.uid, id);
      const userConvs = await getUserConversations(req.uid);
      res.json({ success: true, count: userConvs.length });
    } catch (e) {
      res.status(500).json({ error: e.message || "Failed to delete conversation" });
    }
  });
  app.delete("/api/conversations", verifyFirebaseToken, async (req, res) => {
    try {
      await clearAllUserConversations(req.uid);
      res.json({ success: true, count: 0 });
    } catch (e) {
      res.status(500).json({ error: e.message || "Failed to clear conversations" });
    }
  });
  app.post("/api/generate-image", verifyFirebaseToken, async (_req, res) => {
    try {
      const { prompt, aspectRatio } = _req.body;
      if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({ error: "Prompt is required" });
      }
      const ai = getAIClient();
      if (!ai) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured." });
      }
      console.log(`[ImageGen] Generating image for prompt: "${prompt.slice(0, 80)}..."`);
      const imageModels = ["gemini-3.1-flash-lite-image", "gemini-3.1-flash-image"];
      let lastErr = null;
      let imageUrl = null;
      let caption = null;
      for (const model of imageModels) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: {
              parts: [{ text: prompt.trim() }]
            },
            config: {
              imageConfig: {
                aspectRatio: aspectRatio || "1:1"
              }
            }
          });
          if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
              if (part.inlineData?.data) {
                const mimeType = part.inlineData.mimeType || "image/png";
                imageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
              } else if (part.text) {
                caption = part.text;
              }
            }
          }
          if (imageUrl) break;
        } catch (err) {
          lastErr = err;
        }
      }
      if (!imageUrl) {
        const isQuota = lastErr?.status === 429 || lastErr?.message?.includes("429") || lastErr?.message?.includes("RESOURCE_EXHAUSTED");
        const isZeroLimit = lastErr?.message?.includes("limit: 0") || lastErr?.message?.includes("FreeTier");
        const errorMessage = isQuota || isZeroLimit ? "Image synthesis models are unavailable on this free Google Cloud project because they require billing enabled. All voice, chat, memory, and reminder features remain fully functional." : lastErr?.message || "Model did not produce an image. Please refine your prompt and try again.";
        return res.status(200).json({
          success: false,
          error: errorMessage,
          isQuota: Boolean(isQuota || isZeroLimit),
          requiresPaidKey: Boolean(isQuota || isZeroLimit)
        });
      }
      res.json({ success: true, imageUrl, caption, prompt });
    } catch (err) {
      const isQuota = err?.status === 429 || err?.message?.includes("429") || err?.message?.includes("RESOURCE_EXHAUSTED");
      res.status(200).json({
        success: false,
        error: isQuota ? "Image synthesis models are unavailable on this free Google Cloud project because they require billing enabled. All voice, chat, memory, and reminder features remain fully functional." : err.message || "Image generation failed. Please try a different prompt.",
        isQuota: Boolean(isQuota),
        requiresPaidKey: Boolean(isQuota)
      });
    }
  });
  app.post("/api/chat", verifyFirebaseToken, async (req, res) => {
    try {
      const uid = req.uid;
      const { text, memories, includeAudio, personalityMode, conversationHistory: clientHistory } = req.body;
      const ai = getAIClient();
      if (!ai) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured." });
      }
      let userMems = await getUserMemories(uid);
      if (memories && Array.isArray(memories)) {
        for (const m of memories) {
          if (typeof m === "string" && m.trim() && !userMems.some((sm) => sm.content.toLowerCase() === m.toLowerCase().trim())) {
            await saveUserMemory(uid, { content: m.trim(), category: "general" });
          }
        }
        userMems = await getUserMemories(uid);
      }
      if (text) {
        await autoExtractMemoryForUser(uid, text);
        userMems = await getUserMemories(uid);
      }
      const fullInstruction = BASE_ZOYA_SYSTEM_INSTRUCTION + getPersonalityInstruction(personalityMode) + getMemoryContextPromptForUser(userMems);
      let contents = text || "Hey";
      if (Array.isArray(clientHistory) && clientHistory.length > 0) {
        contents = [
          ...clientHistory.slice(-10).map((h) => ({
            role: h.sender === "user" ? "user" : "model",
            parts: [{ text: h.text }]
          })),
          { role: "user", parts: [{ text: text || "Hey" }] }
        ];
      }
      const response = await generateWithFallback(ai, contents, fullInstruction, false);
      const responseText = cleanSpokenText(response.text || "I'm here\u2014what's on your mind?");
      let audioBase64 = null;
      if (includeAudio) {
        audioBase64 = await synthesizeZoyaSpeech(ai, responseText);
      }
      res.json({ text: responseText, audio: audioBase64 });
    } catch (err) {
      console.warn("[Chat Endpoint Notice]:", err?.message || err);
      res.status(200).json({
        text: "I'm right here with you. What would you like to explore next?",
        audio: null
      });
    }
  });
  const wss = new import_ws.WebSocketServer({ noServer: true });
  server.on("upgrade", (request, socket, head) => {
    const host = request.headers.host || "localhost:3000";
    try {
      const parsedUrl = new URL(request.url || "", `http://${host}`);
      if (parsedUrl.pathname === "/live" || parsedUrl.pathname === "/live/") {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit("connection", ws, request);
        });
      }
    } catch (e) {
      console.error("[WebSocket Upgrade Error]", e);
    }
  });
  wss.on("connection", (clientWs) => {
    console.log("[WebSocket] Client connected to /live");
    let authenticatedUid = null;
    let userMemoriesCache = [];
    if (clientWs.readyState === import_ws.WebSocket.OPEN) {
      clientWs.send(JSON.stringify({
        type: "STATUS",
        status: "CONNECTED"
      }));
    }
    let hasHandledStartup = false;
    let isProcessingTurn = false;
    let isConnectionClosed = false;
    let activeTurnId = 0;
    let userPersonalityMode = "Default Zoya";
    let lastSpokenModelReply = "";
    let lastUserPromptNorm = "";
    let lastUserPromptTime = 0;
    const sentVoiceTurnIds = /* @__PURE__ */ new Set();
    const ai = getAIClient();
    const conversationHistory = [];
    const isTurnActive = (turnId) => !isConnectionClosed && clientWs.readyState === import_ws.WebSocket.OPEN && turnId === activeTurnId;
    const sendSpokenReply = async (replyText, turnId) => {
      if (!isTurnActive(turnId) || sentVoiceTurnIds.has(turnId)) return;
      const cleanReply = cleanSpokenText(replyText);
      if (!cleanReply) {
        if (isTurnActive(turnId)) {
          clientWs.send(JSON.stringify({ silentTurn: true, turnId }));
        }
        return;
      }
      lastSpokenModelReply = cleanReply;
      if (isTurnActive(turnId)) {
        clientWs.send(JSON.stringify({ text: cleanReply, transcriptOnly: true, turnId }));
      }
      if (ai) {
        const base64Audio = await synthesizeZoyaSpeech(ai, cleanReply);
        if (!isTurnActive(turnId) || sentVoiceTurnIds.has(turnId)) return;
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
    const allocateTurnId = (requestedTurnId) => {
      if (typeof requestedTurnId === "number") {
        if (requestedTurnId < activeTurnId) {
          return null;
        }
        activeTurnId = requestedTurnId;
        return activeTurnId;
      }
      activeTurnId += 1;
      return activeTurnId;
    };
    const processValidatedUserTurn = async (trimmed, currentTurnId, clientLocalTime) => {
      if (currentTurnId !== activeTurnId) return;
      const normWords = trimmed.toLowerCase().replace(/[^\w\s]/g, " ").trim().split(/\s+/).filter(Boolean);
      const cutOffFragments = /* @__PURE__ */ new Set(["the", "a", "an", "and", "or", "but", "if", "to", "of", "in", "for", "with", "on", "at", "by", "from"]);
      if (normWords.length === 1 && cutOffFragments.has(normWords[0])) {
        await sendSpokenReply("Didn't catch that\u2014say it again?", currentTurnId);
        return;
      }
      if (authenticatedUid) {
        await autoExtractMemoryForUser(authenticatedUid, trimmed);
      }
      if (!ai) {
        await sendSpokenReply("Hey, my AI key isn't connected right now. Check the server configuration.", currentTurnId);
        return;
      }
      try {
        const timeContext = `
# CURRENT LOCAL TIME & DATE:
${clientLocalTime || (/* @__PURE__ */ new Date()).toLocaleString()}
If the user asks for the time or date, answer directly using this current time.
`;
        const antiRepeatHint = lastSpokenModelReply ? `
# RECENT REPLY NOTE:
Your immediately preceding spoken response was: "${lastSpokenModelReply}". Do NOT repeat an old answer for a new question. Respond directly to the user's latest message below.
` : "";
        const userMemories = authenticatedUid ? userMemoriesCache.length > 0 ? userMemoriesCache : await getUserMemories(authenticatedUid) : [];
        const currentInstruction = BASE_ZOYA_SYSTEM_INSTRUCTION + getPersonalityInstruction(userPersonalityMode) + timeContext + getMemoryContextPromptForUser(userMemories) + antiRepeatHint;
        const contents = [
          ...conversationHistory.slice(-12),
          { role: "user", parts: [{ text: trimmed }] }
        ];
        const response = await generateWithFallback(ai, contents, currentInstruction, true);
        if (currentTurnId !== activeTurnId) return;
        const functionCalls = response.functionCalls;
        let spokenReply = response.text ? cleanSpokenText(response.text) : "";
        if (functionCalls && functionCalls.length > 0) {
          const formattedCalls = functionCalls.map((fc, idx) => ({
            id: fc.id || `call_${Date.now()}_${idx}`,
            name: fc.name,
            args: fc.args || {}
          }));
          for (const fc of formattedCalls) {
            if (fc.name === "saveMemory" && fc.args?.content) {
              const fact = String(fc.args.content).trim();
              if (authenticatedUid) {
                const currentMems = await getUserMemories(authenticatedUid);
                if (!currentMems.some((m) => m.content.toLowerCase() === fact.toLowerCase())) {
                  await saveUserMemory(authenticatedUid, {
                    content: fact,
                    category: fc.args.category || "general"
                  });
                  userMemoriesCache = await getUserMemories(authenticatedUid);
                }
                if (!spokenReply) {
                  spokenReply = `Got it, I'll keep that in mind.`;
                }
              } else {
                spokenReply = "Please sign in with Google so I can save that to your personal memories.";
              }
            } else if (fc.name === "getMemories") {
              if (authenticatedUid) {
                const currentMems = await getUserMemories(authenticatedUid);
                if (!spokenReply) {
                  if (currentMems.length > 0) {
                    spokenReply = `Here's what I know about you so far: ${currentMems.slice(0, 5).map((m) => m.content).join(". ")}.`;
                  } else {
                    spokenReply = `You haven't asked me to remember anything specific yet. Tell me whenever you want me to keep something in mind.`;
                  }
                }
              } else {
                spokenReply = "Please sign in with Google so I can access your personal memories.";
              }
            } else if (fc.name === "openWebsite" && fc.args?.url) {
              if (!spokenReply) {
                spokenReply = `Done. Opening that up for you now.`;
              }
            } else if (fc.name === "openApp" && fc.args?.appName) {
              if (!spokenReply) {
                spokenReply = `Opening ${fc.args.appName} now.`;
              }
            } else if (fc.name === "createReminder" && fc.args?.title) {
              if (authenticatedUid) {
                await saveUserReminder(authenticatedUid, {
                  title: String(fc.args.title).trim(),
                  datetime: fc.args.time ? String(fc.args.time) : new Date(Date.now() + 36e5).toISOString(),
                  repeat: "none",
                  note: "Created via Zoya voice",
                  completed: false
                });
                if (!spokenReply) {
                  spokenReply = `Done. I've set a reminder for ${fc.args.title} at ${fc.args.time || "that time"}.`;
                }
              } else {
                spokenReply = "Please sign in with Google so I can set reminders on your personal account.";
              }
            } else if (fc.name === "getBatteryStatus" || fc.name === "getDeviceInfo") {
              if (!spokenReply) {
                spokenReply = `Checked your system status\u2014everything looks solid.`;
              }
            }
          }
          if (clientWs.readyState === import_ws.WebSocket.OPEN && currentTurnId === activeTurnId) {
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
        conversationHistory.push({ role: "user", parts: [{ text: trimmed }] });
        conversationHistory.push({ role: "model", parts: [{ text: spokenReply }] });
        if (conversationHistory.length > 20) {
          conversationHistory.splice(0, conversationHistory.length - 20);
        }
        await sendSpokenReply(spokenReply, currentTurnId);
      } catch (e) {
        console.warn("[Fast Turn Notice]:", e?.message || e);
        if (currentTurnId === activeTurnId) {
          await sendSpokenReply("I'm right here with you. Say that one more time?", currentTurnId);
        }
      }
    };
    const handleFastTurn = async (userText, clientLocalTime, requestedTurnId) => {
      const trimmed = userText.trim();
      if (!trimmed) {
        if (clientWs.readyState === import_ws.WebSocket.OPEN) {
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
        if (cachedStartupAudio && clientWs.readyState === import_ws.WebSocket.OPEN && !sentVoiceTurnIds.has(startupTurnId)) {
          sentVoiceTurnIds.add(startupTurnId);
          clientWs.send(JSON.stringify({ audio: cachedStartupAudio, transcript: STARTUP_TEXT, turnId: startupTurnId }));
          return;
        }
        if (ai) {
          const base64Audio = await synthesizeZoyaSpeech(ai, STARTUP_TEXT);
          if (base64Audio) {
            cachedStartupAudio = base64Audio;
            if (clientWs.readyState === import_ws.WebSocket.OPEN && startupTurnId === activeTurnId && !sentVoiceTurnIds.has(startupTurnId)) {
              sentVoiceTurnIds.add(startupTurnId);
              clientWs.send(JSON.stringify({ audio: base64Audio, transcript: STARTUP_TEXT, turnId: startupTurnId }));
              return;
            }
          }
        }
        if (clientWs.readyState === import_ws.WebSocket.OPEN && startupTurnId === activeTurnId && !sentVoiceTurnIds.has(startupTurnId)) {
          sentVoiceTurnIds.add(startupTurnId);
          clientWs.send(JSON.stringify({ text: STARTUP_TEXT, useBrowserSpeech: true, turnId: startupTurnId }));
        }
        return;
      }
      const normPrompt = trimmed.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
      const now = Date.now();
      if (!normPrompt) {
        if (clientWs.readyState === import_ws.WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ silentTurn: true, turnId: requestedTurnId }));
        }
        return;
      }
      if (normPrompt === lastUserPromptNorm && now - lastUserPromptTime < 1500) {
        if (clientWs.readyState === import_ws.WebSocket.OPEN) {
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
    const handleAudioWavTurn = async (base64Wav, clientLocalTime, requestedTurnId) => {
      if (!ai || !base64Wav || typeof base64Wav !== "string" || base64Wav.length < 200) {
        if (clientWs.readyState === import_ws.WebSocket.OPEN) {
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
              role: "user",
              parts: [
                { inlineData: { mimeType: "audio/wav", data: base64Wav } },
                { text: transcriptionPrompt }
              ]
            }
          ],
          "You are an exact, zero-hallucination speech transcription engine for Zoya AI.",
          false,
          "application/json"
        );
        if (!isTurnActive(currentTurnId)) return;
        const rawText = (sttResponse.text || "").trim();
        const cleanedJson = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        const jsonMatch = cleanedJson.match(/\{[\s\S]*\}/);
        let parsed = {};
        try {
          parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleanedJson);
        } catch {
          parsed = { silent: true };
        }
        if (parsed.silent) {
          if (clientWs.readyState === import_ws.WebSocket.OPEN && currentTurnId === activeTurnId) {
            clientWs.send(JSON.stringify({ silentTurn: true, turnId: currentTurnId }));
          }
          return;
        }
        if (parsed.unclear) {
          await sendSpokenReply("Didn't catch that\u2014say it again?", currentTurnId);
          return;
        }
        const transcriptText = (parsed.userTranscript || "").trim();
        if (!transcriptText) {
          if (clientWs.readyState === import_ws.WebSocket.OPEN && currentTurnId === activeTurnId) {
            clientWs.send(JSON.stringify({ silentTurn: true, turnId: currentTurnId }));
          }
          return;
        }
        const normTranscript = transcriptText.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
        const now = Date.now();
        if (!normTranscript || normTranscript === lastUserPromptNorm && now - lastUserPromptTime < 1800) {
          if (clientWs.readyState === import_ws.WebSocket.OPEN && currentTurnId === activeTurnId) {
            clientWs.send(JSON.stringify({ silentTurn: true, turnId: currentTurnId }));
          }
          return;
        }
        lastUserPromptNorm = normTranscript;
        lastUserPromptTime = now;
        if (clientWs.readyState === import_ws.WebSocket.OPEN && currentTurnId === activeTurnId) {
          clientWs.send(JSON.stringify({ userTranscript: transcriptText, turnId: currentTurnId }));
        }
        await processValidatedUserTurn(transcriptText, currentTurnId, clientLocalTime);
      } catch {
        if (clientWs.readyState === import_ws.WebSocket.OPEN && currentTurnId === activeTurnId) {
          clientWs.send(JSON.stringify({ silentTurn: true, turnId: currentTurnId }));
        }
      }
    };
    clientWs.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "auth") {
          const token = msg.token;
          if (!token || typeof token !== "string") {
            if (clientWs.readyState === import_ws.WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: "AUTH_ERROR", error: "Authentication token is required" }));
            }
            return;
          }
          if (!firebaseAdminApp) {
            if (clientWs.readyState === import_ws.WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: "AUTH_ERROR", error: "Firebase Admin not initialized on server" }));
            }
            return;
          }
          try {
            const decoded = await (0, import_auth.getAuth)(firebaseAdminApp).verifyIdToken(token);
            authenticatedUid = decoded.uid;
            console.log(`[WebSocket] Client authenticated as UID: ${authenticatedUid}`);
            userMemoriesCache = await getUserMemories(authenticatedUid);
            if (clientWs.readyState === import_ws.WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: "AUTH_SUCCESS",
                uid: authenticatedUid,
                memories: userMemoriesCache.map((m) => m.content)
              }));
            }
          } catch (err) {
            console.warn("[WebSocket] Token verification failed:", err.message);
            if (clientWs.readyState === import_ws.WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: "AUTH_ERROR",
                error: "Invalid or expired Firebase token"
              }));
            }
          }
          return;
        }
        if (msg.type === "INTERRUPT") {
          if (typeof msg.clientTurnId === "number" && msg.clientTurnId > activeTurnId) {
            activeTurnId = msg.clientTurnId;
          } else {
            activeTurnId++;
          }
          isProcessingTurn = false;
          if (clientWs.readyState === import_ws.WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ interrupted: true, turnId: activeTurnId }));
          }
          return;
        }
        if (msg.type === "SYNC_MEMORIES" && Array.isArray(msg.memories)) {
          if (authenticatedUid) {
            const existing = await getUserMemories(authenticatedUid);
            for (const mem of msg.memories) {
              if (typeof mem === "string" && mem.trim() && !existing.some((em) => em.content.toLowerCase() === mem.toLowerCase().trim())) {
                await saveUserMemory(authenticatedUid, { content: mem.trim(), category: "general" });
              }
            }
            userMemoriesCache = await getUserMemories(authenticatedUid);
          }
          return;
        }
        if (msg.type === "SET_PERSONALITY" && typeof msg.mode === "string") {
          userPersonalityMode = msg.mode;
          console.log(`[WebSocket] Personality mode updated to: ${userPersonalityMode}`);
          return;
        }
        if (msg.clientContent?.turns?.[0]?.parts?.[0]?.text === "System initialized. Say your startup sequence." || msg.textPrompt === "System initialized. Say your startup sequence.") {
          await handleFastTurn("System initialized. Say your startup sequence.", msg.clientTime, msg.clientTurnId);
          return;
        }
        if (msg.textPrompt) {
          await handleFastTurn(msg.textPrompt, msg.clientTime, msg.clientTurnId);
          return;
        }
        if (msg.clientContent?.turns?.[0]?.parts?.[0]?.text) {
          const userText = msg.clientContent.turns[0].parts[0].text;
          await handleFastTurn(userText, msg.clientTime, msg.clientTurnId);
          return;
        }
        if (msg.audioWav) {
          await handleAudioWavTurn(msg.audioWav, msg.clientTime, msg.clientTurnId);
          return;
        }
        if (msg.toolResponse) {
          if (msg.toolResponse.functionResponses) {
            for (const fr of msg.toolResponse.functionResponses) {
              if (fr.name === "saveMemory" && fr.response?.memory_saved && authenticatedUid) {
                const saved = String(fr.response.memory_saved).trim();
                const existing = await getUserMemories(authenticatedUid);
                if (!existing.some((m) => m.content.toLowerCase() === saved.toLowerCase())) {
                  await saveUserMemory(authenticatedUid, {
                    content: saved,
                    category: "general"
                  });
                  userMemoriesCache = await getUserMemories(authenticatedUid);
                }
              }
            }
          }
          return;
        }
      } catch (e) {
        console.warn("[WebSocket] Notice processing client message:", e);
      }
    });
    clientWs.on("close", () => {
      isConnectionClosed = true;
      isProcessingTurn = false;
      activeTurnId += 1e5;
      conversationHistory.length = 0;
      sentVoiceTurnIds.clear();
      clientWs.removeAllListeners();
      console.log("[WebSocket] Client disconnected");
    });
    clientWs.on("error", (err) => {
      console.warn("[WebSocket] Socket error:", err);
    });
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
