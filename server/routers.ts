import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // ============= Dashboard Statistics =============
  dashboard: router({
    stats: protectedProcedure.query(async () => {
      return await db.getDashboardStats();
    }),
  }),

  // ============= MCP Connector Management =============
  mcpConnectors: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllMcpConnectors();
    }),
    
    listByCategory: protectedProcedure
      .input(z.object({ category: z.string() }))
      .query(async ({ input }) => {
        return await db.getMcpConnectorsByCategory(input.category);
      }),
    
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        displayName: z.string(),
        category: z.enum(["project_management", "communication", "content_creation", "development", "payment", "analytics", "automation", "intelligence"]),
        description: z.string().optional(),
        config: z.record(z.string(), z.any()).optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await db.createMcpConnector(input);
        return { success: true };
      }),
    
    toggle: protectedProcedure
      .input(z.object({ id: z.number(), isActive: z.boolean() }))
      .mutation(async ({ input }) => {
        await db.toggleMcpConnector(input.id, input.isActive);
        return { success: true };
      }),
    
    updateHealth: protectedProcedure
      .input(z.object({
        name: z.string(),
        healthStatus: z.enum(["healthy", "degraded", "down", "unknown"]),
      }))
      .mutation(async ({ input }) => {
        await db.updateMcpConnectorHealth(input.name, input.healthStatus);
        return { success: true };
      }),
  }),

  // ============= Workflow Template Management =============
  workflowTemplates: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllWorkflowTemplates();
    }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getWorkflowTemplateById(input.id);
      }),
    
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
        category: z.string(),
        icon: z.string().optional(),
        definition: z.object({
          steps: z.array(z.object({
            id: z.string(),
            name: z.string(),
            mcpConnector: z.string(),
            action: z.string(),
            config: z.record(z.string(), z.any()),
            dependencies: z.array(z.string()).optional(),
          })),
          triggers: z.array(z.object({
            type: z.string(),
            config: z.record(z.string(), z.any()),
          })).optional(),
        }),
        isPublic: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.createWorkflowTemplate({
          ...input,
          createdBy: ctx.user.id,
        });
        return { success: true, id: Number(result[0].insertId) };
      }),
  }),

  // ============= Workflow Instance Management =============
  workflows: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllWorkflows();
    }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getWorkflowById(input.id);
      }),
    
    create: protectedProcedure
      .input(z.object({
        templateId: z.number().optional(),
        name: z.string(),
        description: z.string().optional(),
        schedule: z.string().optional(),
        config: z.record(z.string(), z.any()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.createWorkflow({
          ...input,
          createdBy: ctx.user.id,
        });
        
        if (input.templateId) {
          await db.incrementTemplateUsage(input.templateId);
        }
        
        await db.logAnalyticsEvent({
          eventType: "workflow_created",
          eventCategory: "workflow",
          entityType: "workflow",
          userId: ctx.user.id,
          data: { workflowName: input.name },
        });
        
        return { success: true, id: Number(result[0].insertId) };
      }),
    
    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["active", "paused", "archived"]),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateWorkflowStatus(input.id, input.status);
        
        await db.logAnalyticsEvent({
          eventType: "workflow_status_changed",
          eventCategory: "workflow",
          entityType: "workflow",
          entityId: input.id,
          userId: ctx.user.id,
          data: { status: input.status },
        });
        
        return { success: true };
      }),
  }),

  // ============= Workflow Execution Management =============
  workflowExecutions: router({
    list: protectedProcedure
      .input(z.object({ workflowId: z.number(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        return await db.getWorkflowExecutions(input.workflowId, input.limit);
      }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getWorkflowExecutionById(input.id);
      }),
    
    getSteps: protectedProcedure
      .input(z.object({ executionId: z.number() }))
      .query(async ({ input }) => {
        return await db.getWorkflowExecutionSteps(input.executionId);
      }),
    
    create: protectedProcedure
      .input(z.object({
        workflowId: z.number(),
        triggeredBy: z.enum(["manual", "schedule", "webhook", "event"]),
        metadata: z.record(z.string(), z.any()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.createWorkflowExecution({
          ...input,
          status: "pending",
        });
        
        const executionId = Number(result[0].insertId);
        
        await db.logAnalyticsEvent({
          eventType: "workflow_execution_started",
          eventCategory: "execution",
          entityType: "workflow_execution",
          entityId: executionId,
          userId: ctx.user.id,
          data: { workflowId: input.workflowId, triggeredBy: input.triggeredBy },
        });
        
        return { success: true, executionId };
      }),
    
    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["pending", "running", "completed", "failed", "cancelled"]),
        completedAt: z.date().optional(),
        duration: z.number().optional(),
        result: z.record(z.string(), z.any()).optional(),
        error: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, status, ...data } = input;
        await db.updateWorkflowExecutionStatus(id, status, data);
        return { success: true };
      }),
  }),

  // ============= Client Management =============
  clients: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllClients();
    }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getClientById(input.id);
      }),
    
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        email: z.string().optional(),
        company: z.string().optional(),
        phone: z.string().optional(),
        website: z.string().optional(),
        industry: z.string().optional(),
        source: z.string().optional(),
        assignedTo: z.number().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.createClient(input);
        const clientId = Number(result[0].insertId);
        
        await db.logAnalyticsEvent({
          eventType: "client_created",
          eventCategory: "client",
          entityType: "client",
          entityId: clientId,
          userId: ctx.user.id,
          data: { clientName: input.name },
        });
        
        return { success: true, id: clientId };
      }),
    
    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["lead", "prospect", "active", "inactive", "churned"]),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateClientStatus(input.id, input.status);
        
        await db.logAnalyticsEvent({
          eventType: "client_status_changed",
          eventCategory: "client",
          entityType: "client",
          entityId: input.id,
          userId: ctx.user.id,
          data: { status: input.status },
        });
        
        return { success: true };
      }),
  }),

  // ============= Project Management =============
  projects: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllProjects();
    }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getProjectById(input.id);
      }),
    
    getByClient: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        return await db.getProjectsByClient(input.clientId);
      }),
    
    create: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        name: z.string(),
        description: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        budget: z.number().optional(),
        assignedTo: z.number().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.createProject(input);
        const projectId = Number(result[0].insertId);
        
        await db.logAnalyticsEvent({
          eventType: "project_created",
          eventCategory: "project",
          entityType: "project",
          entityId: projectId,
          userId: ctx.user.id,
          data: { projectName: input.name, clientId: input.clientId },
        });
        
        return { success: true, id: projectId };
      }),
    
    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["planning", "active", "on_hold", "completed", "cancelled"]),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateProjectStatus(input.id, input.status);
        
        await db.logAnalyticsEvent({
          eventType: "project_status_changed",
          eventCategory: "project",
          entityType: "project",
          entityId: input.id,
          userId: ctx.user.id,
          data: { status: input.status },
        });
        
        return { success: true };
      }),
  }),

  // ============= Analytics =============
  analytics: router({
    events: protectedProcedure
      .input(z.object({
        eventType: z.string().optional(),
        eventCategory: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getAnalyticsEvents(input);
      }),
    
    logEvent: protectedProcedure
      .input(z.object({
        eventType: z.string(),
        eventCategory: z.string(),
        entityType: z.string().optional(),
        entityId: z.number().optional(),
        data: z.record(z.string(), z.any()).optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.logAnalyticsEvent({
          ...input,
          userId: ctx.user.id,
        });
        return { success: true };
      }),
  }),

  // ============= Content Assets =============
  contentAssets: router({
    list: protectedProcedure
      .input(z.object({
        projectId: z.number().optional(),
        workflowExecutionId: z.number().optional(),
        type: z.string().optional(),
        limit: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getContentAssets(input);
      }),
    
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        type: z.enum(["image", "video", "audio", "document", "design"]),
        source: z.string(),
        url: z.string(),
        fileKey: z.string().optional(),
        mimeType: z.string().optional(),
        fileSize: z.number().optional(),
        projectId: z.number().optional(),
        workflowExecutionId: z.number().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.createContentAsset({
          ...input,
          createdBy: ctx.user.id,
        });
        const assetId = Number(result[0].insertId);
        
        await db.logAnalyticsEvent({
          eventType: "content_asset_created",
          eventCategory: "content",
          entityType: "content_asset",
          entityId: assetId,
          userId: ctx.user.id,
          data: { assetName: input.name, type: input.type, source: input.source },
        });
        
        return { success: true, id: assetId };
      }),
  }),

  // ============= System Logs =============
  systemLogs: router({
    list: protectedProcedure
      .input(z.object({
        level: z.string().optional(),
        source: z.string().optional(),
        workflowExecutionId: z.number().optional(),
        limit: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getSystemLogs(input);
      }),
    
    create: protectedProcedure
      .input(z.object({
        level: z.enum(["debug", "info", "warn", "error", "critical"]),
        source: z.string(),
        message: z.string(),
        data: z.record(z.string(), z.any()).optional(),
        workflowExecutionId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.createSystemLog({
          ...input,
          userId: ctx.user.id,
        });
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
