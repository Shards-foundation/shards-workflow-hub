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
