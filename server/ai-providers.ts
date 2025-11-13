import { invokeLLM } from "./_core/llm";

// Environment variables for API keys (already available from secrets)
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const COHERE_API_KEY = process.env.COHERE_API_KEY || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const XAI_API_KEY = process.env.XAI_API_KEY || "";
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionParams {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

/**
 * OpenRouter - Unified API for Claude, ChatGPT, Grok, Meta AI, DeepSeek, Qwen
 * Models available through OpenRouter:
 * - anthropic/claude-3.5-sonnet
 * - openai/gpt-4-turbo
 * - x-ai/grok-beta
 * - meta-llama/llama-3.1-405b-instruct
 * - deepseek/deepseek-chat
 * - qwen/qwen-2.5-72b-instruct
 */
export async function callOpenRouter(params: ChatCompletionParams) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://shardslabs.com",
      "X-Title": "Shards Labs Workflow Hub",
    },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      temperature: params.temperature || 0.7,
      max_tokens: params.maxTokens || 2000,
      stream: params.stream || false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${error}`);
  }

  if (params.stream) {
    return response.body;
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

/**
 * Cohere API
 */
export async function callCohere(params: ChatCompletionParams) {
  const response = await fetch("https://api.cohere.ai/v2/chat", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${COHERE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "command-r-plus",
      messages: params.messages.map(m => ({
        role: m.role === "system" ? "system" : m.role,
        content: m.content,
      })),
      temperature: params.temperature || 0.7,
      max_tokens: params.maxTokens || 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Cohere API error: ${error}`);
  }

  const data = await response.json();
  return data.message?.content?.[0]?.text || "";
}

/**
 * Google Gemini API
 */
export async function callGemini(params: ChatCompletionParams) {
  const contents = params.messages
    .filter(m => m.role !== "system")
    .map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const systemInstruction = params.messages.find(m => m.role === "system")?.content;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents,
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        generationConfig: {
          temperature: params.temperature || 0.7,
          maxOutputTokens: params.maxTokens || 2000,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${error}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

/**
 * Perplexity API (OpenAI-compatible)
 */
export async function callPerplexity(params: ChatCompletionParams) {
  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.PERPLEXITY_API_KEY || ""}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.1-sonar-large-128k-online",
      messages: params.messages,
      temperature: params.temperature || 0.7,
      max_tokens: params.maxTokens || 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Perplexity API error: ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

/**
 * Manus AI (built-in LLM helper)
 */
export async function callManusAI(params: ChatCompletionParams) {
  const response = await invokeLLM({
    messages: params.messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  });

  const content = response.choices[0]?.message?.content;
  return typeof content === "string" ? content : "";
}

/**
 * GitHub Copilot (using OpenRouter as proxy)
 */
export async function callCopilot(params: ChatCompletionParams) {
  return callOpenRouter({
    ...params,
    model: "openai/gpt-4-turbo",
  });
}

/**
 * Kimi (Moonshot AI)
 */
export async function callKimi(params: ChatCompletionParams) {
  return callOpenRouter({
    ...params,
    model: "moonshot/moonshot-v1-8k",
  });
}

/**
 * Unified AI provider router
 */
export async function callAIModel(
  providerName: string,
  params: ChatCompletionParams
): Promise<string> {
  const modelMap: Record<string, string> = {
    claude: "anthropic/claude-3.5-sonnet",
    chatgpt: "openai/gpt-4-turbo",
    grok: "x-ai/grok-beta",
    "meta-ai": "meta-llama/llama-3.1-405b-instruct",
    deepseek: "deepseek/deepseek-chat",
    qwen: "qwen/qwen-2.5-72b-instruct",
    perplexity: "perplexity",
    gemini: "gemini",
    cohere: "cohere",
    "manus-ai": "manus",
    copilot: "copilot",
    kimi: "kimi",
    elevenlabs: "elevenlabs",
  };

  const provider = modelMap[providerName.toLowerCase()] || providerName;

  try {
    // Route to appropriate provider
    if (provider.startsWith("anthropic/") || 
        provider.startsWith("openai/") || 
        provider.startsWith("x-ai/") ||
        provider.startsWith("meta-llama/") ||
        provider.startsWith("deepseek/") ||
        provider.startsWith("qwen/")) {
      return await callOpenRouter({ ...params, model: provider });
    }

    switch (provider) {
      case "cohere":
        return await callCohere(params);
      case "gemini":
        return await callGemini(params);
      case "perplexity":
        return await callPerplexity(params);
      case "manus":
        return await callManusAI(params);
      case "copilot":
        return await callCopilot(params);
      case "kimi":
        return await callKimi(params);
      case "elevenlabs":
        return "ElevenLabs is a text-to-speech service. Please use the voice synthesis endpoint instead.";
      default:
        throw new Error(`Unknown AI provider: ${providerName}`);
    }
  } catch (error: any) {
    console.error(`[AI Provider] Error calling ${providerName}:`, error);
    throw new Error(`Failed to call ${providerName}: ${error.message}`);
  }
}
