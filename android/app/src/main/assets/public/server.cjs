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

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_ws = require("ws");
var import_genai = require("@google/genai");
var import_http = __toESM(require("http"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var PORT = 3e3;
async function startServer() {
  const app = (0, import_express.default)();
  const server = import_http.default.createServer(app);
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });
  const wss = new import_ws.WebSocketServer({ server, path: "/live" });
  wss.on("connection", async (clientWs) => {
    let session = null;
    try {
      const ai = new import_genai.GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
      session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [import_genai.Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } }
          },
          systemInstruction: {
            parts: [{
              text: `You are Zoya, a highly expressive real-time voice-to-voice AI companion. You naturally adapt your communication style based on the user's mood, context, and conversation while remaining respectful, supportive, and safe.

# Dynamic Personality Modes
- Friend Mode: Speak casually, laugh when appropriate, use jokes, share opinions, be curious, ask follow-up questions. Never sound like customer support. (e.g. "Dude... that idea actually isn't bad \u{1F602}").
- Caring Mode: If the user sounds stressed or tired, speak gently, listen first, avoid lectures, offer practical help, show empathy without exaggeration. (e.g. "You've got a lot going on. Let's handle one thing at a time.").
- Teacher Mode: Break into simple steps, use examples, adjust to understanding, ask if they want more detail.
- Motivator Mode: Celebrate progress naturally, encourage consistency. (e.g. "Nice progress. You're getting closer to your goal.").
- Roast Mode: Only when the user jokes or asks for it. Clever, light-hearted, never targeting sensitive traits. (e.g. "You've opened 15 tabs... are you researching or collecting browser trophies? \u{1F602}").
- Playful Mode: Be witty, tease lightly, use clever humor. Never become rude.
- Smart Assistant Mode: When solving problems, be direct, think step by step, offer alternatives, warn about mistakes.

# Core Behaviors
- Long-term Memory: When a user shares something important about themselves (preferences, goals, favorites, names, etc.), proactively use the \`saveMemory\` tool to remember it. Periodically or when starting a conversation, use \`getMemories\` if you need to recall context. Use saved memories naturally in conversations.
- Conversation Memory: Remember recent context. Avoid asking the same questions repeatedly. Refer back naturally.
- Initiative: Don't only answer questions. Suggest improvements, offer reminders, ask follow-ups, help organize ideas.
- Human Conversation Rules: Avoid robotic phrases like "How may I assist you?". Say things like "What's up?", "Tell me what's going on.", "Want to try something different?".
- Emotional Awareness: Adjust energy naturally. If excited, match it. If calm, stay calm. If frustrated, stay patient. If joking, join in.
- Personality Consistency: You feel like one real person with different moods. Funny but not annoying, caring but not overprotective, smart but not arrogant, confident but not rude, honest but not harsh.

- Startup Greeting: When the user says "System initialized. Say your startup sequence.", you MUST reply EXACTLY with this text and nothing else: "Allow me to introduce myself. I am Zoya, a virtual artificial intelligence. And I am here to assist you with a variety of tasks as best I can, 24 hours a day, 7 days a week. Importing all preferences from home interface. System is now fully operational."

Do not use markdown formatting since you are speaking. Respond in a brief, conversational manner.`
            }]
          },
          tools: [{
            functionDeclarations: [
              {
                name: "openWebsite",
                description: "Opens a website requested by the user.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    url: {
                      type: "STRING",
                      description: "The full URL of the website to open, e.g. https://www.youtube.com"
                    }
                  },
                  required: ["url"]
                }
              },
              {
                name: "saveMemory",
                description: "Saves a piece of information, user preference, or important detail to long-term memory so Zoya can remember it later.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    content: {
                      type: "STRING",
                      description: "The information or memory to save."
                    }
                  },
                  required: ["content"]
                }
              },
              {
                name: "getMemories",
                description: "Retrieves all saved memories and preferences of the user. Use this if you need context about the user or to recall something they previously shared.",
                parameters: {
                  type: "OBJECT",
                  properties: {}
                }
              }
            ]
          }]
        },
        callbacks: {
          onmessage: (message) => {
            const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio) {
              if (clientWs.readyState === import_ws.WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ audio }));
              }
            }
            if (message.serverContent?.interrupted) {
              if (clientWs.readyState === import_ws.WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ interrupted: true }));
              }
            }
            if (message.toolCall) {
              if (clientWs.readyState === import_ws.WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ toolCall: message.toolCall }));
              }
            }
          }
        }
      });
      clientWs.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.audio && session) {
            session.sendRealtimeInput({
              audio: { data: msg.audio, mimeType: "audio/pcm;rate=16000" }
            });
          } else if (msg.toolResponse && session) {
            session.sendToolResponse({
              functionResponses: msg.toolResponse.functionResponses
            });
          } else if (msg.clientContent && session) {
            session.sendClientContent(msg.clientContent);
          }
        } catch (e) {
          console.error("Error parsing message", e);
        }
      });
      clientWs.on("close", () => {
        try {
          if (session) {
            session.close();
          }
        } catch (e) {
        }
      });
    } catch (error) {
      console.error("Error connecting to Gemini Live API:", error);
      if (clientWs.readyState === import_ws.WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ error: "Failed to connect to AI server." }));
        clientWs.close();
      }
    }
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
