# Contributing to Shards Labs Workflow Hub

Thank you for your interest in contributing to Shards Labs Workflow Hub! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please read [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) before contributing.

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

- **Clear title and description**
- **Steps to reproduce** the behavior
- **Expected behavior** vs actual behavior
- **Screenshots** if applicable
- **Environment details** (OS, Node version, browser, etc.)
- **Error messages** or console logs

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- **Clear title and description**
- **Use case** explaining why this enhancement would be useful
- **Proposed solution** or implementation approach
- **Alternatives considered**

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Follow the coding standards** outlined below
3. **Write tests** for new features or bug fixes
4. **Update documentation** as needed
5. **Ensure all tests pass** before submitting
6. **Write clear commit messages** following conventional commits format

#### Branch Naming Convention

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `test/description` - Test additions or fixes

#### Commit Message Format

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
type(scope): subject

body (optional)

footer (optional)
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test additions or modifications
- `chore`: Build process or auxiliary tool changes

**Examples:**
```
feat(ai-chat): add streaming response support
fix(workflows): resolve execution timeout issue
docs(readme): update installation instructions
```

## Development Setup

### Prerequisites

- Node.js 22+
- pnpm 10+
- MySQL or TiDB database

### Local Development

1. Clone your fork:
```bash
git clone https://github.com/YOUR_USERNAME/workflow-hub.git
cd workflow-hub
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables (contact maintainers for development credentials)

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

### Project Structure

```
shards-workflow-hub/
├── client/          # Frontend React application
├── server/          # Backend Express + tRPC
├── drizzle/         # Database schema
├── scripts/         # Utility scripts
├── shared/          # Shared types
└── storage/         # S3 helpers
```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Avoid `any` types - use proper typing
- Export types from appropriate modules

### React Components

- Use functional components with hooks
- Follow React best practices
- Use TypeScript for prop types
- Keep components focused and reusable

### tRPC Procedures

- Define input validation with Zod schemas
- Use `protectedProcedure` for authenticated endpoints
- Return consistent response formats
- Handle errors appropriately

### Database

- Define schema in `drizzle/schema.ts`
- Use Drizzle ORM for queries
- Create helper functions in `server/db.ts`
- Never expose raw SQL to frontend

### Styling

- Use Tailwind CSS utility classes
- Follow existing design patterns
- Use shadcn/ui components when available
- Maintain responsive design

### Testing

- Write unit tests for utility functions
- Write integration tests for API endpoints
- Test React components with React Testing Library
- Aim for meaningful test coverage

## Documentation

- Update README.md for user-facing changes
- Add JSDoc comments for complex functions
- Update API documentation for new endpoints
- Include inline comments for complex logic

## Review Process

1. All submissions require review before merging
2. Maintainers will review code for:
   - Functionality and correctness
   - Code quality and style
   - Test coverage
   - Documentation completeness
3. Address review feedback promptly
4. Once approved, maintainers will merge your PR

## Questions?

Feel free to open an issue for questions or reach out to maintainers directly.

Thank you for contributing to Shards Labs Workflow Hub!
