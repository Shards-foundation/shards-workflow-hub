import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * MCP Connector configurations
 * Stores configuration for each MCP server integration
 */
export const mcpConnectors = mysqlTable("mcp_connectors", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  displayName: varchar("displayName", { length: 200 }).notNull(),
  category: mysqlEnum("category", [
    "project_management",
    "communication",
    "content_creation",
    "development",
    "payment",
    "analytics",
    "automation",
    "intelligence",
    "media_generation"
  ]).notNull(),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  config: json("config").$type<Record<string, any>>(),
  healthStatus: mysqlEnum("healthStatus", ["healthy", "degraded", "down", "unknown"]).default("unknown").notNull(),
  lastHealthCheck: timestamp("lastHealthCheck"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type McpConnector = typeof mcpConnectors.$inferSelect;
export type InsertMcpConnector = typeof mcpConnectors.$inferInsert;

/**
 * Workflow Templates
 * Defines reusable workflow templates
 */
export const workflowTemplates = mysqlTable("workflow_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }).notNull(),
  icon: varchar("icon", { length: 50 }),
  definition: json("definition").$type<{
    steps: Array<{
      id: string;
      name: string;
      mcpConnector: string;
      action: string;
      config: Record<string, any>;
      dependencies?: string[];
    }>;
    triggers?: Array<{
      type: string;
      config: Record<string, any>;
    }>;
  }>().notNull(),
  isPublic: boolean("isPublic").default(false).notNull(),
  createdBy: int("createdBy").notNull(),
  usageCount: int("usageCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WorkflowTemplate = typeof workflowTemplates.$inferSelect;
export type InsertWorkflowTemplate = typeof workflowTemplates.$inferInsert;

/**
 * Workflow Instances
 * Active workflow instances created from templates
 */
export const workflows = mysqlTable("workflows", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId"),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["active", "paused", "archived"]).default("active").notNull(),
  schedule: varchar("schedule", { length: 100 }),
  config: json("config").$type<Record<string, any>>(),
  createdBy: int("createdBy").notNull(),
  lastExecutedAt: timestamp("lastExecutedAt"),
  nextExecutionAt: timestamp("nextExecutionAt"),
  executionCount: int("executionCount").default(0).notNull(),
  successCount: int("successCount").default(0).notNull(),
  failureCount: int("failureCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Workflow = typeof workflows.$inferSelect;
export type InsertWorkflow = typeof workflows.$inferInsert;

/**
 * Workflow Executions
 * Records of individual workflow runs
 */
export const workflowExecutions = mysqlTable("workflow_executions", {
  id: int("id").autoincrement().primaryKey(),
  workflowId: int("workflowId").notNull(),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed", "cancelled"]).default("pending").notNull(),
  triggeredBy: mysqlEnum("triggeredBy", ["manual", "schedule", "webhook", "event"]).notNull(),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  duration: int("duration"),
  result: json("result").$type<Record<string, any>>(),
  error: text("error"),
  metadata: json("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WorkflowExecution = typeof workflowExecutions.$inferSelect;
export type InsertWorkflowExecution = typeof workflowExecutions.$inferInsert;

/**
 * Workflow Execution Steps
 * Individual steps within a workflow execution
 */
export const workflowExecutionSteps = mysqlTable("workflow_execution_steps", {
  id: int("id").autoincrement().primaryKey(),
  executionId: int("executionId").notNull(),
  stepId: varchar("stepId", { length: 100 }).notNull(),
  stepName: varchar("stepName", { length: 200 }).notNull(),
  mcpConnector: varchar("mcpConnector", { length: 100 }).notNull(),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed", "skipped"]).default("pending").notNull(),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  duration: int("duration"),
  input: json("input").$type<Record<string, any>>(),
  output: json("output").$type<Record<string, any>>(),
  error: text("error"),
  retryCount: int("retryCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WorkflowExecutionStep = typeof workflowExecutionSteps.$inferSelect;
export type InsertWorkflowExecutionStep = typeof workflowExecutionSteps.$inferInsert;

/**
 * Clients
 * Client/customer records for business operations
 */
export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 320 }),
  company: varchar("company", { length: 200 }),
  phone: varchar("phone", { length: 50 }),
  website: varchar("website", { length: 500 }),
  industry: varchar("industry", { length: 100 }),
  status: mysqlEnum("status", ["lead", "prospect", "active", "inactive", "churned"]).default("lead").notNull(),
  source: varchar("source", { length: 100 }),
  assignedTo: int("assignedTo"),
  metadata: json("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

/**
 * Projects
 * Client projects and engagements
 */
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["planning", "active", "on_hold", "completed", "cancelled"]).default("planning").notNull(),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  budget: int("budget"),
  assignedTo: int("assignedTo"),
  linearProjectId: varchar("linearProjectId", { length: 100 }),
  asanaProjectId: varchar("asanaProjectId", { length: 100 }),
  clickupProjectId: varchar("clickupProjectId", { length: 100 }),
  notionPageId: varchar("notionPageId", { length: 100 }),
  metadata: json("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

/**
 * Analytics Events
 * Track business and workflow analytics
 */
export const analyticsEvents = mysqlTable("analytics_events", {
  id: int("id").autoincrement().primaryKey(),
  eventType: varchar("eventType", { length: 100 }).notNull(),
  eventCategory: varchar("eventCategory", { length: 100 }).notNull(),
  entityType: varchar("entityType", { length: 50 }),
  entityId: int("entityId"),
  userId: int("userId"),
  data: json("data").$type<Record<string, any>>(),
  metadata: json("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type InsertAnalyticsEvent = typeof analyticsEvents.$inferInsert;

/**
 * Content Assets
 * Generated content from MCP connectors (Canva, InVideo, etc.)
 */
export const contentAssets = mysqlTable("content_assets", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  type: mysqlEnum("type", ["image", "video", "audio", "document", "design"]).notNull(),
  source: varchar("source", { length: 100 }).notNull(),
  url: varchar("url", { length: 1000 }).notNull(),
  fileKey: varchar("fileKey", { length: 500 }),
  mimeType: varchar("mimeType", { length: 100 }),
  fileSize: int("fileSize"),
  projectId: int("projectId"),
  workflowExecutionId: int("workflowExecutionId"),
  metadata: json("metadata").$type<Record<string, any>>(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ContentAsset = typeof contentAssets.$inferSelect;
export type InsertContentAsset = typeof contentAssets.$inferInsert;

/**
 * System Logs
 * Centralized logging for debugging and monitoring
 */
export const systemLogs = mysqlTable("system_logs", {
  id: int("id").autoincrement().primaryKey(),
  level: mysqlEnum("level", ["debug", "info", "warn", "error", "critical"]).notNull(),
  source: varchar("source", { length: 100 }).notNull(),
  message: text("message").notNull(),
  data: json("data").$type<Record<string, any>>(),
  userId: int("userId"),
  workflowExecutionId: int("workflowExecutionId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SystemLog = typeof systemLogs.$inferSelect;
export type InsertSystemLog = typeof systemLogs.$inferInsert;

/**
 * AI Model Configurations
 * Stores available AI models and their settings
 */
export const aiModels = mysqlTable("ai_models", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  displayName: varchar("displayName", { length: 200 }).notNull(),
  provider: varchar("provider", { length: 100 }).notNull(),
  modelId: varchar("modelId", { length: 200 }).notNull(),
  category: mysqlEnum("category", ["chat", "completion", "embedding", "image", "audio", "video"]).default("chat").notNull(),
  capabilities: json("capabilities").$type<{
    streaming?: boolean;
    functionCalling?: boolean;
    vision?: boolean;
    maxTokens?: number;
    contextWindow?: number;
  }>(),
  defaultConfig: json("defaultConfig").$type<{
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  }>(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AiModel = typeof aiModels.$inferSelect;
export type InsertAiModel = typeof aiModels.$inferInsert;

/**
 * AI Conversations
 * Stores chat conversations with AI models
 */
export const aiConversations = mysqlTable("ai_conversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 500 }),
  modelId: int("modelId").notNull(),
  systemPrompt: text("systemPrompt"),
  config: json("config").$type<{
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  }>(),
  messageCount: int("messageCount").default(0).notNull(),
  lastMessageAt: timestamp("lastMessageAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AiConversation = typeof aiConversations.$inferSelect;
export type InsertAiConversation = typeof aiConversations.$inferInsert;

/**
 * AI Messages
 * Stores individual messages in conversations
 */
export const aiMessages = mysqlTable("ai_messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  metadata: json("metadata").$type<{
    model?: string;
    tokens?: number;
    finishReason?: string;
    error?: string;
  }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiMessage = typeof aiMessages.$inferSelect;
export type InsertAiMessage = typeof aiMessages.$inferInsert;

/**
 * Subscription Plans
 * Defines available subscription tiers
 */
export const subscriptionPlans = mysqlTable("subscription_plans", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  displayName: varchar("displayName", { length: 200 }).notNull(),
  description: text("description"),
  stripePriceId: varchar("stripePriceId", { length: 200 }),
  price: int("price").notNull(), // in cents
  interval: mysqlEnum("interval", ["month", "year"]).notNull(),
  features: json("features").$type<{
    aiModelsAccess: string[]; // model IDs or "all"
    maxWorkflows: number | "unlimited";
    maxExecutionsPerMonth: number | "unlimited";
    prioritySupport: boolean;
    customIntegrations: boolean;
    teamCollaboration: boolean;
    apiAccess: boolean;
  }>(),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = typeof subscriptionPlans.$inferInsert;

/**
 * User Subscriptions
 * Tracks user subscription status
 */
export const userSubscriptions = mysqlTable("user_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  planId: int("planId").notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 200 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 200 }),
  status: mysqlEnum("status", ["active", "canceled", "past_due", "trialing", "incomplete"]).default("active").notNull(),
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  cancelAtPeriodEnd: boolean("cancelAtPeriodEnd").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertUserSubscription = typeof userSubscriptions.$inferInsert;

/**
 * Payment History
 * Tracks completed payments (minimal data, query Stripe for details)
 */
export const paymentHistory = mysqlTable("payment_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 200 }),
  stripeInvoiceId: varchar("stripeInvoiceId", { length: 200 }),
  amount: int("amount").notNull(), // in cents
  currency: varchar("currency", { length: 10 }).default("usd").notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PaymentHistory = typeof paymentHistory.$inferSelect;
export type InsertPaymentHistory = typeof paymentHistory.$inferInsert;
