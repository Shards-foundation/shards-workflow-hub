# Shards Labs Workflow Hub

> **Autonomous Business Operations Platform** - Orchestrate workflows across 49 MCP connectors, 13 AI models, and Stripe payments

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://reactjs.org/)
[![tRPC](https://img.shields.io/badge/tRPC-11-2596BE.svg)](https://trpc.io/)

## Overview

Shards Labs Workflow Hub is a comprehensive autonomous business operations platform that integrates 49 MCP (Model Context Protocol) connectors, 13 AI models, and Stripe payment processing into a unified workflow orchestration system. Built for Shards Labs, this platform enables seamless automation of client acquisition, project management, content generation, and business intelligence workflows.

## Features

### 🔌 49 MCP Connectors Across 9 Categories

**Project Management** (5 connectors)
- Asana, Linear, ClickUp, Notion, Zapier

**Communication** (7 connectors)
- Gmail, Google Calendar, Fireflies, Webflow, Jotform, Todoist, Explorium

**Content Creation** (6 connectors)
- Canva, InVideo, Hume, MiniMax, Serena, PopHIVE

**Development** (8 connectors)
- GitHub, Vercel, Neon, Supabase, Prisma Postgres, Playwright, Jam, Dify

**Payment** (3 connectors)
- Stripe, PayPal for Business, RevenueCat

**Analytics** (3 connectors)
- PostHog, Sentry, Airtable

**Automation** (5 connectors)
- Zapier, Dify, Cloudflare, Firecrawl, Hugging Face

**Intelligence** (10 connectors)
- Claude, ChatGPT, Grok, Gemini, Cohere, OpenRouter, Kling, Tripo AI, Polygon.io, JSONBin.io

**Media Generation** (2 connectors)
- ElevenLabs, Typeform

### 🤖 13 AI Models Integration

Real API integrations with conversation history and context management:

- **Claude** (Anthropic) - via OpenRouter
- **ChatGPT** (OpenAI) - via OpenRouter
- **Grok** (xAI) - via OpenRouter
- **Gemini** (Google) - Direct API
- **Perplexity** - Direct API
- **Cohere** - Direct API
- **Meta AI** (Llama 3.1) - via OpenRouter
- **DeepSeek** - via OpenRouter
- **Qwen** - via OpenRouter
- **Manus AI** - Built-in LLM
- **Copilot** (GitHub) - via OpenRouter
- **Kimi** (Moonshot) - via OpenRouter
- **ElevenLabs** - Text-to-Speech API

### 💳 Stripe Payment Integration

Three-tier subscription model with full payment processing:

| Plan | Price | Features |
|------|-------|----------|
| **Free** | $0/month | 3 AI models, 10 workflows/month, basic support |
| **Pro** | $29/month | All 13 AI models, unlimited workflows, priority support |
| **Enterprise** | $99/month | Everything + custom integrations, team collaboration, API access |

### 📊 Core Capabilities

- **Workflow Orchestration** - Design, execute, and monitor multi-step workflows
- **AI Chat Interface** - Unified chat with all 13 AI models
- **Client & Project Management** - Track clients, projects, and deliverables
- **Analytics Dashboard** - Real-time metrics and performance tracking
- **Content Asset Management** - Store and organize generated content
- **Payment Processing** - Subscription management and billing

## Tech Stack

### Frontend
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Styling
- **shadcn/ui** - Component library
- **Wouter** - Routing
- **tRPC React Query** - Type-safe API client

### Backend
- **Express 4** - Web server
- **tRPC 11** - End-to-end typesafe APIs
- **Drizzle ORM** - Database ORM
- **MySQL/TiDB** - Database
- **Stripe SDK** - Payment processing

### Infrastructure
- **Manus OAuth** - Authentication
- **S3** - File storage
- **Vite** - Build tool
- **pnpm** - Package manager

## Project Structure

```
shards-workflow-hub/
├── client/                 # Frontend React application
│   ├── public/            # Static assets
│   └── src/
│       ├── components/    # Reusable UI components
│       ├── pages/         # Page components
│       ├── hooks/         # Custom React hooks
│       ├── lib/           # tRPC client setup
│       └── App.tsx        # Routes and layout
├── server/                # Backend Express + tRPC
│   ├── _core/            # Framework core (OAuth, context, etc.)
│   ├── webhooks/         # Webhook handlers (Stripe)
│   ├── db.ts             # Database query helpers
│   ├── routers.ts        # tRPC API procedures
│   ├── ai-providers.ts   # AI model integrations
│   └── stripe.ts         # Stripe helper functions
├── drizzle/              # Database schema and migrations
│   └── schema.ts         # Database tables definition
├── scripts/              # Utility scripts
│   └── seed-*.mjs        # Database seeding scripts
├── shared/               # Shared types and constants
└── storage/              # S3 storage helpers
```

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 10+
- MySQL or TiDB database
- Stripe account (for payments)
- API keys for AI providers (OpenRouter, Cohere, Gemini, etc.)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/shardslabs/workflow-hub.git
cd workflow-hub
```

2. Install dependencies:
```bash
pnpm install
```

3. Configure environment variables through Manus platform settings

4. Push database schema:
```bash
pnpm db:push
```

5. Seed the database:
```bash
pnpm tsx scripts/seed-connectors.mjs
pnpm tsx scripts/seed-ai-models.mjs
pnpm tsx scripts/seed-subscription-plans.mjs
```

6. Start development server:
```bash
pnpm dev
```

The application will be available at `http://localhost:3000`

## Database Schema

The application uses 11 core tables:

- **users** - User accounts and authentication
- **mcp_connectors** - MCP connector configurations
- **workflows** - Workflow definitions
- **workflow_executions** - Execution history and logs
- **clients** - Client management
- **projects** - Project tracking
- **ai_models** - AI model configurations
- **ai_conversations** - Chat conversations
- **ai_messages** - Chat message history
- **subscription_plans** - Stripe subscription tiers
- **user_subscriptions** - User subscription status
- **payment_history** - Payment transactions

## API Documentation

The application uses tRPC for type-safe APIs. All procedures are defined in `server/routers.ts`:

### Authentication
- `auth.me` - Get current user
- `auth.logout` - Logout user

### Workflows
- `workflows.list` - List all workflows
- `workflows.getById` - Get workflow by ID
- `workflows.create` - Create new workflow
- `workflows.update` - Update workflow
- `workflows.execute` - Execute workflow

### AI Chat
- `aiModels.list` - List available AI models
- `aiConversations.create` - Create new conversation
- `aiMessages.send` - Send message to AI model

### Subscriptions
- `subscriptionPlans.list` - List subscription plans
- `subscription.createCheckout` - Create Stripe checkout
- `subscription.current` - Get current subscription

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## Acknowledgments

- Built with [Manus](https://manus.im) - AI-powered development platform
- Powered by [OpenRouter](https://openrouter.ai) for multi-model AI access
- UI components from [shadcn/ui](https://ui.shadcn.com)
- Payment processing by [Stripe](https://stripe.com)

## Support

For support, email support@shardslabs.com or open an issue on GitHub.

---

**Made with ❤️ by Shards Labs**
