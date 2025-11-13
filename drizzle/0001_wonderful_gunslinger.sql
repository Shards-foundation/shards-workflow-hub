CREATE TABLE `analytics_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventType` varchar(100) NOT NULL,
	`eventCategory` varchar(100) NOT NULL,
	`entityType` varchar(50),
	`entityId` int,
	`userId` int,
	`data` json,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analytics_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`email` varchar(320),
	`company` varchar(200),
	`phone` varchar(50),
	`website` varchar(500),
	`industry` varchar(100),
	`status` enum('lead','prospect','active','inactive','churned') NOT NULL DEFAULT 'lead',
	`source` varchar(100),
	`assignedTo` int,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`type` enum('image','video','audio','document','design') NOT NULL,
	`source` varchar(100) NOT NULL,
	`url` varchar(1000) NOT NULL,
	`fileKey` varchar(500),
	`mimeType` varchar(100),
	`fileSize` int,
	`projectId` int,
	`workflowExecutionId` int,
	`metadata` json,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `content_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mcp_connectors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`displayName` varchar(200) NOT NULL,
	`category` enum('project_management','communication','content_creation','development','payment','analytics','automation','intelligence') NOT NULL,
	`description` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`config` json,
	`healthStatus` enum('healthy','degraded','down','unknown') NOT NULL DEFAULT 'unknown',
	`lastHealthCheck` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mcp_connectors_id` PRIMARY KEY(`id`),
	CONSTRAINT `mcp_connectors_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` text,
	`status` enum('planning','active','on_hold','completed','cancelled') NOT NULL DEFAULT 'planning',
	`startDate` timestamp,
	`endDate` timestamp,
	`budget` int,
	`assignedTo` int,
	`linearProjectId` varchar(100),
	`asanaProjectId` varchar(100),
	`clickupProjectId` varchar(100),
	`notionPageId` varchar(100),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`level` enum('debug','info','warn','error','critical') NOT NULL,
	`source` varchar(100) NOT NULL,
	`message` text NOT NULL,
	`data` json,
	`userId` int,
	`workflowExecutionId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `system_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflow_execution_steps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`executionId` int NOT NULL,
	`stepId` varchar(100) NOT NULL,
	`stepName` varchar(200) NOT NULL,
	`mcpConnector` varchar(100) NOT NULL,
	`status` enum('pending','running','completed','failed','skipped') NOT NULL DEFAULT 'pending',
	`startedAt` timestamp,
	`completedAt` timestamp,
	`duration` int,
	`input` json,
	`output` json,
	`error` text,
	`retryCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workflow_execution_steps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflow_executions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workflowId` int NOT NULL,
	`status` enum('pending','running','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
	`triggeredBy` enum('manual','schedule','webhook','event') NOT NULL,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`duration` int,
	`result` json,
	`error` text,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workflow_executions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflow_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` text,
	`category` varchar(100) NOT NULL,
	`icon` varchar(50),
	`definition` json NOT NULL,
	`isPublic` boolean NOT NULL DEFAULT false,
	`createdBy` int NOT NULL,
	`usageCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflow_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`templateId` int,
	`name` varchar(200) NOT NULL,
	`description` text,
	`status` enum('active','paused','archived') NOT NULL DEFAULT 'active',
	`schedule` varchar(100),
	`config` json,
	`createdBy` int NOT NULL,
	`lastExecutedAt` timestamp,
	`nextExecutionAt` timestamp,
	`executionCount` int NOT NULL DEFAULT 0,
	`successCount` int NOT NULL DEFAULT 0,
	`failureCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflows_id` PRIMARY KEY(`id`)
);
