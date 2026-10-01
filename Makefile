# ============================================================================
# SPU Backend — Development Makefile
# ============================================================================
# One-command shortcuts for common development workflows.
# Usage: make <target>
# ============================================================================

.PHONY: help setup db-up db-down db-test-up dev prod test lint clean

# Default target
help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
setup: ## Install dependencies and create .env from template
	@echo "📦 Installing Node.js dependencies..."
	npm install
	@if [ ! -f .env ]; then \
		echo "⚠️  .env not found — copying from .env.example"; \
		cp .env.example .env; \
		echo "✏️  Edit .env with your database credentials before proceeding."; \
	else \
		echo "✅ .env already exists, skipping copy."; \
	fi

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
db-up: ## Start PostgreSQL (development) via Docker Compose
	docker compose up -d postgres
	@echo "⏳ Waiting for PostgreSQL to accept connections..."
	@until docker compose exec postgres pg_isready -U postgres > /dev/null 2>&1; do sleep 1; done
	@echo "✅ PostgreSQL is ready on port $${PGPORT_DEV:-5432}"

db-down: ## Stop and remove database containers (preserves data volume)
	docker compose down

db-test-up: ## Start PostgreSQL (test) via Docker Compose test profile
	docker compose --profile test up -d postgres-test
	@echo "✅ Test PostgreSQL is ready on port 5433"

# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------
dev: ## Start the development server (Nodemon + auto-reload)
	npm run start:dev

prod: ## Start the production server
	npm run start:prod

# ---------------------------------------------------------------------------
# Testing & Quality
# ---------------------------------------------------------------------------
test: ## Run the full Mocha test suite
	npm run start:test

lint: ## Run ESLint (if configured)
	npx eslint . --fix 2>/dev/null || echo "ℹ️  ESLint not configured — skipping."

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------
clean: db-down ## Stop containers, remove node_modules and Docker volumes
	rm -rf node_modules
	docker compose down -v
	@echo "🗑️  Cleanup complete."

