import { drizzle } from "drizzle-orm/mysql2";
import { subscriptionPlans } from "../drizzle/schema.ts";

const db = drizzle(process.env.DATABASE_URL);

const plans = [
  {
    name: "free",
    displayName: "Free",
    description: "Perfect for trying out the platform",
    stripePriceId: null, // Free plan has no Stripe price
    price: 0,
    interval: "month",
    features: {
      aiModelsAccess: ["chatgpt", "gemini", "claude"], // 3 basic models
      maxWorkflows: 10,
      maxExecutionsPerMonth: 100,
      prioritySupport: false,
      customIntegrations: false,
      teamCollaboration: false,
      apiAccess: false,
    },
    isActive: true,
    sortOrder: 1,
  },
  {
    name: "pro",
    displayName: "Pro",
    description: "For professionals and power users",
    stripePriceId: null, // Will be set after creating Stripe product
    price: 2900, // $29.00
    interval: "month",
    features: {
      aiModelsAccess: ["all"], // All 13 AI models
      maxWorkflows: "unlimited",
      maxExecutionsPerMonth: "unlimited",
      prioritySupport: true,
      customIntegrations: false,
      teamCollaboration: false,
      apiAccess: true,
    },
    isActive: true,
    sortOrder: 2,
  },
  {
    name: "enterprise",
    displayName: "Enterprise",
    description: "For teams and organizations",
    stripePriceId: null, // Will be set after creating Stripe product
    price: 9900, // $99.00
    interval: "month",
    features: {
      aiModelsAccess: ["all"],
      maxWorkflows: "unlimited",
      maxExecutionsPerMonth: "unlimited",
      prioritySupport: true,
      customIntegrations: true,
      teamCollaboration: true,
      apiAccess: true,
    },
    isActive: true,
    sortOrder: 3,
  },
];

async function seed() {
  console.log("Seeding subscription plans...");
  
  try {
    for (const plan of plans) {
      await db.insert(subscriptionPlans).values(plan).onDuplicateKeyUpdate({
        set: {
          displayName: plan.displayName,
          description: plan.description,
          price: plan.price,
          features: plan.features,
          sortOrder: plan.sortOrder,
        }
      });
    }
    
    console.log(`✓ Seeded ${plans.length} subscription plans`);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

seed();
