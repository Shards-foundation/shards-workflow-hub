import { eq, desc, and, sql, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users,
  mcpConnectors,
  InsertMcpConnector,
  McpConnector,
  workflowTemplates,
  InsertWorkflowTemplate,
  WorkflowTemplate,
  workflows,
  InsertWorkflow,
  Workflow,
  workflowExecutions,
  InsertWorkflowExecution,
  WorkflowExecution,
  workflowExecutionSteps,
  InsertWorkflowExecutionStep,
  clients,
  InsertClient,
  Client,
  projects,
  InsertProject,
  Project,
  analyticsEvents,
  InsertAnalyticsEvent,
  contentAssets,
  InsertContentAsset,
  systemLogs,
  InsertSystemLog
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============= User Management =============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============= MCP Connector Management =============

export async function createMcpConnector(connector: InsertMcpConnector) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(mcpConnectors).values(connector);
  return result;
}

export async function getAllMcpConnectors(): Promise<McpConnector[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(mcpConnectors).orderBy(mcpConnectors.category, mcpConnectors.displayName);
}

export async function getMcpConnectorsByCategory(category: string): Promise<McpConnector[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(mcpConnectors).where(eq(mcpConnectors.category, category as any));
}

export async function updateMcpConnectorHealth(name: string, healthStatus: "healthy" | "degraded" | "down" | "unknown") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(mcpConnectors)
    .set({ healthStatus, lastHealthCheck: new Date() })
    .where(eq(mcpConnectors.name, name));
}

export async function toggleMcpConnector(id: number, isActive: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(mcpConnectors)
    .set({ isActive })
    .where(eq(mcpConnectors.id, id));
}

// ============= Workflow Template Management =============

export async function createWorkflowTemplate(template: InsertWorkflowTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(workflowTemplates).values(template);
  return result;
}

export async function getAllWorkflowTemplates(): Promise<WorkflowTemplate[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(workflowTemplates).orderBy(desc(workflowTemplates.createdAt));
}

export async function getWorkflowTemplateById(id: number): Promise<WorkflowTemplate | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(workflowTemplates).where(eq(workflowTemplates.id, id)).limit(1);
  return result[0];
}

export async function incrementTemplateUsage(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(workflowTemplates)
    .set({ usageCount: sql`${workflowTemplates.usageCount} + 1` })
    .where(eq(workflowTemplates.id, id));
}

// ============= Workflow Instance Management =============

export async function createWorkflow(workflow: InsertWorkflow) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(workflows).values(workflow);
  return result;
}

export async function getAllWorkflows(): Promise<Workflow[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(workflows).orderBy(desc(workflows.createdAt));
}

export async function getWorkflowById(id: number): Promise<Workflow | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(workflows).where(eq(workflows.id, id)).limit(1);
  return result[0];
}

export async function updateWorkflowStatus(id: number, status: "active" | "paused" | "archived") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(workflows)
    .set({ status })
    .where(eq(workflows.id, id));
}

export async function updateWorkflowExecution(id: number, data: { lastExecutedAt?: Date; nextExecutionAt?: Date; executionCount?: number; successCount?: number; failureCount?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(workflows)
    .set(data)
    .where(eq(workflows.id, id));
}

// ============= Workflow Execution Management =============

export async function createWorkflowExecution(execution: InsertWorkflowExecution) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(workflowExecutions).values(execution);
  return result;
}

export async function getWorkflowExecutions(workflowId: number, limit: number = 50): Promise<WorkflowExecution[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(workflowExecutions)
    .where(eq(workflowExecutions.workflowId, workflowId))
    .orderBy(desc(workflowExecutions.createdAt))
    .limit(limit);
}

export async function getWorkflowExecutionById(id: number): Promise<WorkflowExecution | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(workflowExecutions).where(eq(workflowExecutions.id, id)).limit(1);
  return result[0];
}

export async function updateWorkflowExecutionStatus(id: number, status: "pending" | "running" | "completed" | "failed" | "cancelled", data?: { completedAt?: Date; duration?: number; result?: any; error?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(workflowExecutions)
    .set({ status, ...data })
    .where(eq(workflowExecutions.id, id));
}

// ============= Workflow Execution Step Management =============

export async function createWorkflowExecutionStep(step: InsertWorkflowExecutionStep) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(workflowExecutionSteps).values(step);
  return result;
}

export async function getWorkflowExecutionSteps(executionId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(workflowExecutionSteps)
    .where(eq(workflowExecutionSteps.executionId, executionId))
    .orderBy(workflowExecutionSteps.createdAt);
}

export async function updateWorkflowExecutionStepStatus(id: number, status: "pending" | "running" | "completed" | "failed" | "skipped", data?: { completedAt?: Date; duration?: number; output?: any; error?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(workflowExecutionSteps)
    .set({ status, ...data })
    .where(eq(workflowExecutionSteps.id, id));
}

// ============= Client Management =============

export async function createClient(client: InsertClient) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(clients).values(client);
  return result;
}

export async function getAllClients(): Promise<Client[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(clients).orderBy(desc(clients.createdAt));
}

export async function getClientById(id: number): Promise<Client | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return result[0];
}

export async function updateClientStatus(id: number, status: "lead" | "prospect" | "active" | "inactive" | "churned") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(clients)
    .set({ status })
    .where(eq(clients.id, id));
}

// ============= Project Management =============

export async function createProject(project: InsertProject) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(projects).values(project);
  return result;
}

export async function getAllProjects(): Promise<Project[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(projects).orderBy(desc(projects.createdAt));
}

export async function getProjectsByClient(clientId: number): Promise<Project[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(projects).where(eq(projects.clientId, clientId));
}

export async function getProjectById(id: number): Promise<Project | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return result[0];
}

export async function updateProjectStatus(id: number, status: "planning" | "active" | "on_hold" | "completed" | "cancelled") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(projects)
    .set({ status })
    .where(eq(projects.id, id));
}

// ============= Analytics =============

export async function logAnalyticsEvent(event: InsertAnalyticsEvent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(analyticsEvents).values(event);
}

export async function getAnalyticsEvents(filters: { eventType?: string; eventCategory?: string; startDate?: Date; endDate?: Date; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters.eventType) conditions.push(eq(analyticsEvents.eventType, filters.eventType));
  if (filters.eventCategory) conditions.push(eq(analyticsEvents.eventCategory, filters.eventCategory));
  if (filters.startDate) conditions.push(gte(analyticsEvents.createdAt, filters.startDate));
  if (filters.endDate) conditions.push(lte(analyticsEvents.createdAt, filters.endDate));
  
  let query = db.select().from(analyticsEvents);
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  return query.orderBy(desc(analyticsEvents.createdAt)).limit(filters.limit || 100);
}

// ============= Content Assets =============

export async function createContentAsset(asset: InsertContentAsset) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(contentAssets).values(asset);
  return result;
}

export async function getContentAssets(filters: { projectId?: number; workflowExecutionId?: number; type?: string; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters.projectId) conditions.push(eq(contentAssets.projectId, filters.projectId));
  if (filters.workflowExecutionId) conditions.push(eq(contentAssets.workflowExecutionId, filters.workflowExecutionId));
  if (filters.type) conditions.push(eq(contentAssets.type, filters.type as any));
  
  let query = db.select().from(contentAssets);
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  return query.orderBy(desc(contentAssets.createdAt)).limit(filters.limit || 50);
}

// ============= System Logs =============

export async function createSystemLog(log: InsertSystemLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(systemLogs).values(log);
}

export async function getSystemLogs(filters: { level?: string; source?: string; workflowExecutionId?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters.level) conditions.push(eq(systemLogs.level, filters.level as any));
  if (filters.source) conditions.push(eq(systemLogs.source, filters.source));
  if (filters.workflowExecutionId) conditions.push(eq(systemLogs.workflowExecutionId, filters.workflowExecutionId));
  
  let query = db.select().from(systemLogs);
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  return query.orderBy(desc(systemLogs.createdAt)).limit(filters.limit || 100);
}

// ============= Dashboard Statistics =============

export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return null;
  
  const [workflowCount] = await db.select({ count: sql<number>`count(*)` }).from(workflows);
  const [activeWorkflowCount] = await db.select({ count: sql<number>`count(*)` }).from(workflows).where(eq(workflows.status, 'active'));
  const [executionCount] = await db.select({ count: sql<number>`count(*)` }).from(workflowExecutions);
  const [clientCount] = await db.select({ count: sql<number>`count(*)` }).from(clients);
  const [projectCount] = await db.select({ count: sql<number>`count(*)` }).from(projects);
  const [connectorCount] = await db.select({ count: sql<number>`count(*)` }).from(mcpConnectors);
  const [activeConnectorCount] = await db.select({ count: sql<number>`count(*)` }).from(mcpConnectors).where(eq(mcpConnectors.isActive, true));
  
  return {
    totalWorkflows: workflowCount.count,
    activeWorkflows: activeWorkflowCount.count,
    totalExecutions: executionCount.count,
    totalClients: clientCount.count,
    totalProjects: projectCount.count,
    totalConnectors: connectorCount.count,
    activeConnectors: activeConnectorCount.count,
  };
}
