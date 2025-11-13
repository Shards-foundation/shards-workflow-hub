import { drizzle } from "drizzle-orm/mysql2";
import { aiModels } from "../drizzle/schema.ts";

const db = drizzle(process.env.DATABASE_URL);

const models = [
  {
    name: "claude",
    displayName: "Claude (Anthropic)",
    provider: "anthropic",
    modelId: "claude-3-5-sonnet-20241022",
    category: "chat",
    capabilities: {
      streaming: true,
      functionCalling: true,
      vision: true,
      maxTokens: 8192,
      contextWindow: 200000
    },
    defaultConfig: {
      temperature: 1.0,
      maxTokens: 4096
    },
    isActive: true
  },
  {
    name: "chatgpt",
    displayName: "ChatGPT (OpenAI)",
    provider: "openai",
    modelId: "gpt-4o",
    category: "chat",
    capabilities: {
      streaming: true,
      functionCalling: true,
      vision: true,
      maxTokens: 16384,
      contextWindow: 128000
    },
    defaultConfig: {
      temperature: 0.7,
      maxTokens: 4096
    },
    isActive: true
  },
  {
    name: "grok",
    displayName: "Grok (xAI)",
    provider: "xai",
    modelId: "grok-2-latest",
    category: "chat",
    capabilities: {
      streaming: true,
      functionCalling: true,
      vision: false,
      maxTokens: 32768,
      contextWindow: 131072
    },
    defaultConfig: {
      temperature: 0.7,
      maxTokens: 4096
    },
    isActive: true
  },
  {
    name: "manus",
    displayName: "Manus AI",
    provider: "manus",
    modelId: "manus-default",
    category: "chat",
    capabilities: {
      streaming: true,
      functionCalling: true,
      vision: true,
      maxTokens: 8192,
      contextWindow: 200000
    },
    defaultConfig: {
      temperature: 1.0,
      maxTokens: 4096
    },
    isActive: true
  },
  {
    name: "copilot",
    displayName: "GitHub Copilot",
    provider: "github",
    modelId: "gpt-4",
    category: "chat",
    capabilities: {
      streaming: true,
      functionCalling: true,
      vision: false,
      maxTokens: 8192,
      contextWindow: 32000
    },
    defaultConfig: {
      temperature: 0.7,
      maxTokens: 2048
    },
    isActive: true
  },
  {
    name: "kimi",
    displayName: "Kimi (Moonshot AI)",
    provider: "moonshot",
    modelId: "moonshot-v1-8k",
    category: "chat",
    capabilities: {
      streaming: true,
      functionCalling: false,
      vision: false,
      maxTokens: 8192,
      contextWindow: 8192
    },
    defaultConfig: {
      temperature: 0.7,
      maxTokens: 4096
    },
    isActive: true
  },
  {
    name: "k2",
    displayName: "K2",
    provider: "k2",
    modelId: "k2-default",
    category: "chat",
    capabilities: {
      streaming: true,
      functionCalling: false,
      vision: false,
      maxTokens: 4096,
      contextWindow: 8192
    },
    defaultConfig: {
      temperature: 0.7,
      maxTokens: 2048
    },
    isActive: true
  },
  {
    name: "qwen",
    displayName: "Qwen (Alibaba Cloud)",
    provider: "alibaba",
    modelId: "qwen-max",
    category: "chat",
    capabilities: {
      streaming: true,
      functionCalling: true,
      vision: true,
      maxTokens: 8192,
      contextWindow: 32000
    },
    defaultConfig: {
      temperature: 0.7,
      maxTokens: 4096
    },
    isActive: true
  },
  {
    name: "deepseek",
    displayName: "DeepSeek",
    provider: "deepseek",
    modelId: "deepseek-chat",
    category: "chat",
    capabilities: {
      streaming: true,
      functionCalling: true,
      vision: false,
      maxTokens: 4096,
      contextWindow: 32000
    },
    defaultConfig: {
      temperature: 0.7,
      maxTokens: 4096
    },
    isActive: true
  },
  {
    name: "perplexity",
    displayName: "Perplexity",
    provider: "perplexity",
    modelId: "llama-3.1-sonar-large-128k-online",
    category: "chat",
    capabilities: {
      streaming: true,
      functionCalling: false,
      vision: false,
      maxTokens: 4096,
      contextWindow: 128000
    },
    defaultConfig: {
      temperature: 0.7,
      maxTokens: 4096
    },
    isActive: true
  },
  {
    name: "meta",
    displayName: "Meta AI (Llama)",
    provider: "meta",
    modelId: "llama-3.3-70b",
    category: "chat",
    capabilities: {
      streaming: true,
      functionCalling: true,
      vision: false,
      maxTokens: 8192,
      contextWindow: 128000
    },
    defaultConfig: {
      temperature: 0.7,
      maxTokens: 4096
    },
    isActive: true
  },
  {
    name: "elevenlabs",
    displayName: "ElevenLabs",
    provider: "elevenlabs",
    modelId: "eleven_multilingual_v2",
    category: "audio",
    capabilities: {
      streaming: true,
      functionCalling: false,
      vision: false,
      maxTokens: 0,
      contextWindow: 0
    },
    defaultConfig: {},
    isActive: true
  },
  {
    name: "gemini",
    displayName: "Gemini (Google)",
    provider: "google",
    modelId: "gemini-2.0-flash-exp",
    category: "chat",
    capabilities: {
      streaming: true,
      functionCalling: true,
      vision: true,
      maxTokens: 8192,
      contextWindow: 1000000
    },
    defaultConfig: {
      temperature: 1.0,
      maxTokens: 4096
    },
    isActive: true
  }
];

async function seed() {
  console.log("Seeding AI models...");
  
  try {
    for (const model of models) {
      await db.insert(aiModels).values(model).onDuplicateKeyUpdate({
        set: {
          displayName: model.displayName,
          provider: model.provider,
          modelId: model.modelId,
          capabilities: model.capabilities,
          defaultConfig: model.defaultConfig
        }
      });
    }
    
    console.log(`✓ Seeded ${models.length} AI models`);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

seed();
