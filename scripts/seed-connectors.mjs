import { drizzle } from "drizzle-orm/mysql2";
import { mcpConnectors } from "../drizzle/schema.js";

const db = drizzle(process.env.DATABASE_URL);

const connectors = [
  { name: "linear", displayName: "Linear", category: "project_management", description: "Issue tracking and project management", isActive: true },
  { name: "asana", displayName: "Asana", category: "project_management", description: "Work management platform", isActive: true },
  { name: "clickup", displayName: "ClickUp", category: "project_management", description: "All-in-one productivity platform", isActive: true },
  { name: "notion", displayName: "Notion", category: "project_management", description: "Connected workspace for docs and knowledge", isActive: true },
  { name: "todoist", displayName: "Todoist", category: "project_management", description: "Task management and to-do lists", isActive: true },
  { name: "gmail", displayName: "Gmail", category: "communication", description: "Email communication", isActive: true },
  { name: "google-calendar", displayName: "Google Calendar", category: "communication", description: "Calendar and scheduling", isActive: true },
  { name: "fireflies", displayName: "Fireflies", category: "communication", description: "Meeting transcription and notes", isActive: true },
  { name: "jotform", displayName: "Jotform", category: "communication", description: "Form builder and data collection", isActive: true },
  { name: "canva", displayName: "Canva", category: "content_creation", description: "Design and graphics creation", isActive: true },
  { name: "invideo", displayName: "InVideo", category: "content_creation", description: "AI-powered video generation", isActive: true },
  { name: "minimax", displayName: "MiniMax", category: "content_creation", description: "AI voice, image, video, and music", isActive: true },
  { name: "hume", displayName: "Hume AI", category: "content_creation", description: "Emotional voice synthesis", isActive: true },
  { name: "webflow", displayName: "Webflow", category: "content_creation", description: "Website design and CMS", isActive: true },
  { name: "vercel", displayName: "Vercel", category: "development", description: "Deployment and hosting platform", isActive: true },
  { name: "supabase", displayName: "Supabase", category: "development", description: "Backend-as-a-service", isActive: true },
  { name: "neon", displayName: "Neon", category: "development", description: "Serverless Postgres", isActive: true },
  { name: "cloudflare", displayName: "Cloudflare", category: "development", description: "CDN and infrastructure", isActive: true },
  { name: "sentry", displayName: "Sentry", category: "development", description: "Error tracking and monitoring", isActive: true },
  { name: "stripe", displayName: "Stripe", category: "payment", description: "Payment processing", isActive: true },
  { name: "paypal-for-business", displayName: "PayPal", category: "payment", description: "Alternative payment processing", isActive: true },
  { name: "revenuecat", displayName: "RevenueCat", category: "payment", description: "Subscription management", isActive: true },
  { name: "posthog", displayName: "PostHog", category: "analytics", description: "Product analytics", isActive: true },
  { name: "jam", displayName: "Jam", category: "analytics", description: "Bug reporting and session replay", isActive: true },
  { name: "zapier", displayName: "Zapier", category: "automation", description: "Workflow automation", isActive: true },
  { name: "dify", displayName: "Dify", category: "automation", description: "Custom AI workflows", isActive: true },
  { name: "playwright", displayName: "Playwright", category: "automation", description: "Browser automation", isActive: true },
  { name: "airtable", displayName: "Airtable", category: "automation", description: "Database and data hub", isActive: true },
  { name: "explorium", displayName: "Explorium", category: "intelligence", description: "Business intelligence and enrichment", isActive: true },
  { name: "hugging-face", displayName: "Hugging Face", category: "intelligence", description: "AI model repository", isActive: true },
  { name: "firecrawl", displayName: "Firecrawl", category: "intelligence", description: "Web scraping and crawling", isActive: true },
];

async function seed() {
  console.log("Seeding MCP connectors...");
  
  for (const connector of connectors) {
    await db.insert(mcpConnectors).values(connector).onDuplicateKeyUpdate({
      set: { displayName: connector.displayName, description: connector.description }
    });
  }
  
  console.log(`✓ Seeded ${connectors.length} MCP connectors`);
  process.exit(0);
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
