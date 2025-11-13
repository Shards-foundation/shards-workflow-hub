import { drizzle } from "drizzle-orm/mysql2";
import { mcpConnectors } from "../drizzle/schema.js";

const db = drizzle(process.env.DATABASE_URL);

const connectors = [
  // Project Management (5)
  { name: "linear", displayName: "Linear", category: "project_management", description: "Issue tracking and project management", isActive: true },
  { name: "asana", displayName: "Asana", category: "project_management", description: "Work management platform", isActive: true },
  { name: "clickup", displayName: "ClickUp", category: "project_management", description: "All-in-one productivity platform", isActive: true },
  { name: "notion", displayName: "Notion", category: "project_management", description: "Connected workspace for docs and knowledge", isActive: true },
  { name: "todoist", displayName: "Todoist", category: "project_management", description: "Task management and to-do lists", isActive: true },
  
  // Communication (6)
  { name: "gmail", displayName: "Gmail", category: "communication", description: "Email communication", isActive: true },
  { name: "google-calendar", displayName: "Google Calendar", category: "communication", description: "Calendar and scheduling", isActive: true },
  { name: "outlook-mail", displayName: "Outlook Mail", category: "communication", description: "Microsoft email service", isActive: true },
  { name: "outlook-calendar", displayName: "Outlook Calendar", category: "communication", description: "Microsoft calendar service", isActive: true },
  { name: "fireflies", displayName: "Fireflies", category: "communication", description: "Meeting transcription and notes", isActive: true },
  { name: "jotform", displayName: "Jotform", category: "communication", description: "Form builder and data collection", isActive: true },
  
  // Content Creation (6)
  { name: "canva", displayName: "Canva", category: "content_creation", description: "Design and graphics creation", isActive: true },
  { name: "invideo", displayName: "InVideo", category: "content_creation", description: "AI-powered video generation", isActive: true },
  { name: "minimax", displayName: "MiniMax", category: "content_creation", description: "AI voice, image, video, and music", isActive: true },
  { name: "hume", displayName: "Hume", category: "content_creation", description: "Emotional voice synthesis", isActive: true },
  { name: "webflow", displayName: "Webflow", category: "content_creation", description: "Website design and CMS", isActive: true },
  { name: "elevenlabs", displayName: "ElevenLabs", category: "content_creation", description: "AI voice generation and cloning", isActive: true },
  
  // Development (8)
  { name: "vercel", displayName: "Vercel", category: "development", description: "Deployment and hosting platform", isActive: true },
  { name: "supabase", displayName: "Supabase", category: "development", description: "Backend-as-a-service", isActive: true },
  { name: "neon", displayName: "Neon", category: "development", description: "Serverless Postgres", isActive: true },
  { name: "prisma-postgres", displayName: "Prisma Postgres", category: "development", description: "Database ORM and management", isActive: true },
  { name: "cloudflare", displayName: "Cloudflare", category: "development", description: "CDN and infrastructure", isActive: true },
  { name: "cloudflare-api", displayName: "Cloudflare API", category: "development", description: "Cloudflare API integration", isActive: true },
  { name: "sentry", displayName: "Sentry", category: "development", description: "Error tracking and monitoring", isActive: true },
  { name: "serena", displayName: "Serena", category: "development", description: "Semantic code search", isActive: true },
  
  // Payment (3)
  { name: "stripe", displayName: "Stripe", category: "payment", description: "Payment processing", isActive: true },
  { name: "paypal-for-business", displayName: "PayPal for Business", category: "payment", description: "Alternative payment processing", isActive: true },
  { name: "revenuecat", displayName: "RevenueCat", category: "payment", description: "Subscription management", isActive: true },
  
  // Analytics (3)
  { name: "posthog", displayName: "PostHog", category: "analytics", description: "Product analytics", isActive: true },
  { name: "jam", displayName: "Jam", category: "analytics", description: "Bug reporting and session replay", isActive: true },
  { name: "polygon", displayName: "Polygon.io", category: "analytics", description: "Financial market data", isActive: true },
  
  // Automation (5)
  { name: "zapier", displayName: "Zapier", category: "automation", description: "Workflow automation", isActive: true },
  { name: "dify", displayName: "Dify", category: "automation", description: "Custom AI workflows", isActive: true },
  { name: "playwright", displayName: "Playwright", category: "automation", description: "Browser automation", isActive: true },
  { name: "airtable", displayName: "Airtable", category: "automation", description: "Database and data hub", isActive: true },
  { name: "jsonbin", displayName: "JSONBin.io", category: "automation", description: "JSON storage API", isActive: true },
  
  // Intelligence (10)
  { name: "explorium", displayName: "Explorium", category: "intelligence", description: "Business intelligence and enrichment", isActive: true },
  { name: "hugging-face", displayName: "Hugging Face", category: "intelligence", description: "AI model repository", isActive: true },
  { name: "pophive", displayName: "PopHIVE", category: "intelligence", description: "Public health data", isActive: true },
  { name: "firecrawl", displayName: "Firecrawl", category: "intelligence", description: "Web scraping and crawling", isActive: true },
  { name: "openai", displayName: "OpenAI", category: "intelligence", description: "GPT models and AI services", isActive: true },
  { name: "google-gemini", displayName: "Google Gemini", category: "intelligence", description: "Google's AI model", isActive: true },
  { name: "grok", displayName: "Grok", category: "intelligence", description: "xAI's conversational AI", isActive: true },
  { name: "openrouter", displayName: "OpenRouter", category: "intelligence", description: "Unified AI model access", isActive: true },
  { name: "cohere", displayName: "Cohere", category: "intelligence", description: "NLP and language models", isActive: true },
  { name: "github", displayName: "GitHub", category: "intelligence", description: "Code repository and collaboration", isActive: true },
  
  // Media Generation (3)
  { name: "kling", displayName: "Kling", category: "media_generation", description: "AI video generation", isActive: true },
  { name: "tripo-ai", displayName: "Tripo AI", category: "media_generation", description: "3D model generation", isActive: true },
  { name: "typeform", displayName: "Typeform", category: "communication", description: "Interactive forms and surveys", isActive: true },
];

async function seed() {
  console.log("Seeding MCP connectors...");
  
  for (const connector of connectors) {
    await db.insert(mcpConnectors).values(connector).onDuplicateKeyUpdate({
      set: { displayName: connector.displayName, description: connector.description, category: connector.category }
    });
  }
  
  console.log(`✓ Seeded ${connectors.length} MCP connectors`);
  process.exit(0);
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
