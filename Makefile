# ==============================================================================
# ENTHROPIC TRADING PLATFORM - MAKEFILE
# ==============================================================================
# Comprehensive operational commands for development, testing, and deployment
# Run 'make help' to see all available commands
# ==============================================================================

.DEFAULT_GOAL := help
SHELL := /bin/bash

# Colors for output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[0;33m
BLUE := \033[0;34m
NC := \033[0m

# ==============================================================================
# HELP
# ==============================================================================

.PHONY: help
help: ## Display this help message
	@echo ""
	@echo "$(BLUE)Enthropic Trading Platform - Available Commands$(NC)"
	@echo ""
	@echo "$(GREEN)Setup & Installation:$(NC)"
	@awk 'BEGIN {FS = ":.*?## "} /^(setup|install|init).*:.*?## / {printf "  $(YELLOW)%-25s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(GREEN)Infrastructure:$(NC)"
	@awk 'BEGIN {FS = ":.*?## "} /^(infra|db).*:.*?## / {printf "  $(YELLOW)%-25s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(GREEN)Services:$(NC)"
	@awk 'BEGIN {FS = ":.*?## "} /^(up|down|restart|logs|ps|services).*:.*?## / {printf "  $(YELLOW)%-25s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(GREEN)Development:$(NC)"
	@awk 'BEGIN {FS = ":.*?## "} /^(dev|build|watch).*:.*?## / {printf "  $(YELLOW)%-25s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(GREEN)Testing:$(NC)"
	@awk 'BEGIN {FS = ":.*?## "} /^(test|lint|format).*:.*?## / {printf "  $(YELLOW)%-25s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(GREEN)Health & Monitoring:$(NC)"
	@awk 'BEGIN {FS = ":.*?## "} /^(health|status|metrics).*:.*?## / {printf "  $(YELLOW)%-25s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(GREEN)Database:$(NC)"
	@awk 'BEGIN {FS = ":.*?## "} /^(migrate|seed|backup).*:.*?## / {printf "  $(YELLOW)%-25s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(GREEN)Cleanup:$(NC)"
	@awk 'BEGIN {FS = ":.*?## "} /^(clean|prune|reset).*:.*?## / {printf "  $(YELLOW)%-25s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""

# ==============================================================================
# SETUP & INSTALLATION
# ==============================================================================

.PHONY: setup
setup: ## Initial setup - copy environment files and install dependencies
	@echo "$(BLUE)Setting up Enthropic Trading Platform...$(NC)"
	@cp -n .env.example .env 2>/dev/null || echo "Root .env already exists"
	@for dir in apps/auth-service apps/risk-service apps/nats-gateway apps/dashboard apps/execution-core apps/strategy-service; do \
		if [ -f "$$dir/.env.example" ]; then \
			cp -n "$$dir/.env.example" "$$dir/.env" 2>/dev/null || echo "$$dir/.env already exists"; \
		fi; \
	done
	@echo "$(GREEN)Environment files created. Please edit .env files with your configuration.$(NC)"
	@echo "$(YELLOW)IMPORTANT: Generate strong secrets before running services!$(NC)"

.PHONY: setup-secrets
setup-secrets: ## Generate secure random secrets for .env
	@echo "$(BLUE)Generating secure secrets...$(NC)"
	@JWT_SECRET=$$(openssl rand -base64 64 | tr -d '\n') && \
	DB_PASSWORD=$$(openssl rand -base64 32 | tr -d '\n') && \
	REDIS_PASSWORD=$$(openssl rand -base64 32 | tr -d '\n') && \
	GRAFANA_PASSWORD=$$(openssl rand -base64 16 | tr -d '\n') && \
	echo "" && \
	echo "$(GREEN)Generated Secrets (copy to your .env file):$(NC)" && \
	echo "" && \
	echo "JWT_SECRET=$$JWT_SECRET" && \
	echo "POSTGRES_PASSWORD=$$DB_PASSWORD" && \
	echo "REDIS_PASSWORD=$$REDIS_PASSWORD" && \
	echo "GRAFANA_ADMIN_PASSWORD=$$GRAFANA_PASSWORD" && \
	echo ""

.PHONY: install
install: ## Install all dependencies (Node.js, Python, Rust)
	@echo "$(BLUE)Installing dependencies...$(NC)"
	@npm install
	@cd apps/auth-service && npm install
	@cd apps/risk-service && npm install
	@cd apps/nats-gateway && npm install
	@cd apps/dashboard && npm install
	@cd tests/e2e && npm install
	@echo "$(GREEN)Node.js dependencies installed$(NC)"
	@if command -v poetry &> /dev/null; then \
		cd apps/strategy-service && poetry install; \
		echo "$(GREEN)Python dependencies installed$(NC)"; \
	else \
		echo "$(YELLOW)Poetry not found. Install with: pip install poetry$(NC)"; \
	fi
	@if command -v cargo &> /dev/null; then \
		cd apps/execution-core && cargo fetch; \
		echo "$(GREEN)Rust dependencies fetched$(NC)"; \
	else \
		echo "$(YELLOW)Cargo not found. Install Rust from rustup.rs$(NC)"; \
	fi

.PHONY: init
init: setup install infra-up migrate seed ## Complete initialization (setup, install, start infra, migrate, seed)
	@echo "$(GREEN)Initialization complete!$(NC)"

# ==============================================================================
# INFRASTRUCTURE
# ==============================================================================

.PHONY: infra-up
infra-up: ## Start infrastructure services (PostgreSQL, Redis, NATS, observability)
	@echo "$(BLUE)Starting infrastructure...$(NC)"
	@docker compose up -d postgres redis nats jaeger prometheus grafana otel-collector
	@echo "$(GREEN)Waiting for services to be healthy...$(NC)"
	@sleep 10
	@make health-infra

.PHONY: infra-down
infra-down: ## Stop infrastructure services
	@echo "$(BLUE)Stopping infrastructure...$(NC)"
	@docker compose stop postgres redis nats jaeger prometheus grafana otel-collector

.PHONY: infra-restart
infra-restart: infra-down infra-up ## Restart infrastructure services

.PHONY: infra-logs
infra-logs: ## View infrastructure logs
	@docker compose logs -f postgres redis nats jaeger prometheus grafana

# ==============================================================================
# SERVICES
# ==============================================================================

.PHONY: up
up: ## Start all services with Docker Compose
	@echo "$(BLUE)Starting all services...$(NC)"
	@docker compose up -d --build
	@echo "$(GREEN)All services started. Run 'make health' to verify.$(NC)"

.PHONY: down
down: ## Stop all services
	@echo "$(BLUE)Stopping all services...$(NC)"
	@docker compose down

.PHONY: restart
restart: down up ## Restart all services

.PHONY: logs
logs: ## View all service logs (follow mode)
	@docker compose logs -f

.PHONY: logs-auth
logs-auth: ## View auth-service logs
	@docker compose logs -f auth-service

.PHONY: logs-execution
logs-execution: ## View execution-core logs
	@docker compose logs -f execution-core

.PHONY: logs-risk
logs-risk: ## View risk-service logs
	@docker compose logs -f risk-service

.PHONY: logs-strategy
logs-strategy: ## View strategy-service logs
	@docker compose logs -f strategy-service

.PHONY: logs-gateway
logs-gateway: ## View nats-gateway logs
	@docker compose logs -f nats-gateway

.PHONY: logs-dashboard
logs-dashboard: ## View dashboard logs
	@docker compose logs -f dashboard

.PHONY: ps
ps: ## Show running containers
	@docker compose ps

.PHONY: services-up
services-up: ## Start only application services (without infrastructure)
	@docker compose up -d auth-service execution-core risk-service strategy-service nats-gateway dashboard

.PHONY: services-down
services-down: ## Stop application services
	@docker compose stop auth-service execution-core risk-service strategy-service nats-gateway dashboard

# ==============================================================================
# DEVELOPMENT
# ==============================================================================

.PHONY: dev-auth
dev-auth: ## Run auth-service in development mode
	@cd apps/auth-service && npm run start:dev

.PHONY: dev-risk
dev-risk: ## Run risk-service in development mode
	@cd apps/risk-service && npm run start:dev

.PHONY: dev-gateway
dev-gateway: ## Run nats-gateway in development mode
	@cd apps/nats-gateway && npm run start:dev

.PHONY: dev-dashboard
dev-dashboard: ## Run dashboard in development mode
	@cd apps/dashboard && npm run dev

.PHONY: dev-execution
dev-execution: ## Run execution-core in development mode
	@cd apps/execution-core && cargo run

.PHONY: dev-strategy
dev-strategy: ## Run strategy-service in development mode
	@cd apps/strategy-service && poetry run python -m src.main

.PHONY: build
build: ## Build all services
	@echo "$(BLUE)Building all services...$(NC)"
	@npm run build:all

.PHONY: build-docker
build-docker: ## Build all Docker images
	@echo "$(BLUE)Building Docker images...$(NC)"
	@docker compose build

# ==============================================================================
# TESTING
# ==============================================================================

.PHONY: test
test: ## Run all tests
	@echo "$(BLUE)Running all tests...$(NC)"
	@npm run test:all

.PHONY: test-auth
test-auth: ## Run auth-service tests
	@cd apps/auth-service && npm test

.PHONY: test-risk
test-risk: ## Run risk-service tests
	@cd apps/risk-service && npm test

.PHONY: test-execution
test-execution: ## Run execution-core tests
	@cd apps/execution-core && cargo test

.PHONY: test-strategy
test-strategy: ## Run strategy-service tests
	@cd apps/strategy-service && poetry run pytest -v

.PHONY: test-e2e
test-e2e: ## Run end-to-end tests
	@cd tests/e2e && npm test

.PHONY: test-load
test-load: ## Run load tests with Locust
	@cd tests/load && locust -f locustfile.py

.PHONY: lint
lint: ## Run linters on all services
	@echo "$(BLUE)Running linters...$(NC)"
	@npm run lint:all
	@cd apps/execution-core && cargo clippy -- -D warnings
	@cd apps/strategy-service && poetry run ruff check src tests

.PHONY: format
format: ## Format code in all services
	@echo "$(BLUE)Formatting code...$(NC)"
	@npm run format:all

.PHONY: format-check
format-check: ## Check code formatting without changes
	@npm run format:ts -- --check
	@cd apps/execution-core && cargo fmt --check
	@cd apps/strategy-service && poetry run black --check src tests

# ==============================================================================
# HEALTH & MONITORING
# ==============================================================================

.PHONY: health
health: ## Check health of all services
	@echo "$(BLUE)Checking service health...$(NC)"
	@echo ""
	@curl -sf http://localhost:3002/health > /dev/null && echo "$(GREEN)[OK]$(NC) Auth Service (3002)" || echo "$(RED)[FAIL]$(NC) Auth Service (3002)"
	@curl -sf http://localhost:9100/health > /dev/null && echo "$(GREEN)[OK]$(NC) Execution Core (9100)" || echo "$(RED)[FAIL]$(NC) Execution Core (9100)"
	@curl -sf http://localhost:3003/health > /dev/null && echo "$(GREEN)[OK]$(NC) Risk Service (3003)" || echo "$(RED)[FAIL]$(NC) Risk Service (3003)"
	@curl -sf http://localhost:8000/health > /dev/null && echo "$(GREEN)[OK]$(NC) Strategy Service (8000)" || echo "$(RED)[FAIL]$(NC) Strategy Service (8000)"
	@curl -sf http://localhost:8080/health > /dev/null && echo "$(GREEN)[OK]$(NC) NATS Gateway (8080)" || echo "$(RED)[FAIL]$(NC) NATS Gateway (8080)"
	@curl -sf http://localhost:5173 > /dev/null && echo "$(GREEN)[OK]$(NC) Dashboard (5173)" || echo "$(RED)[FAIL]$(NC) Dashboard (5173)"
	@echo ""

.PHONY: health-infra
health-infra: ## Check health of infrastructure services
	@echo "$(BLUE)Checking infrastructure health...$(NC)"
	@echo ""
	@docker compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1 && echo "$(GREEN)[OK]$(NC) PostgreSQL (5432)" || echo "$(RED)[FAIL]$(NC) PostgreSQL (5432)"
	@docker compose exec -T redis redis-cli ping > /dev/null 2>&1 && echo "$(GREEN)[OK]$(NC) Redis (6379)" || echo "$(RED)[FAIL]$(NC) Redis (6379)"
	@curl -sf http://localhost:8222/healthz > /dev/null && echo "$(GREEN)[OK]$(NC) NATS (4222)" || echo "$(RED)[FAIL]$(NC) NATS (4222)"
	@curl -sf http://localhost:16686 > /dev/null && echo "$(GREEN)[OK]$(NC) Jaeger (16686)" || echo "$(RED)[FAIL]$(NC) Jaeger (16686)"
	@curl -sf http://localhost:9090/-/healthy > /dev/null && echo "$(GREEN)[OK]$(NC) Prometheus (9090)" || echo "$(RED)[FAIL]$(NC) Prometheus (9090)"
	@curl -sf http://localhost:3001/api/health > /dev/null && echo "$(GREEN)[OK]$(NC) Grafana (3001)" || echo "$(RED)[FAIL]$(NC) Grafana (3001)"
	@echo ""

.PHONY: status
status: ps health health-infra ## Show complete system status

.PHONY: metrics
metrics: ## Open Prometheus metrics in browser
	@echo "Opening Prometheus at http://localhost:9090"
	@command -v xdg-open &> /dev/null && xdg-open http://localhost:9090 || open http://localhost:9090

# ==============================================================================
# DATABASE
# ==============================================================================

.PHONY: migrate
migrate: ## Run database migrations
	@echo "$(BLUE)Running migrations...$(NC)"
	@cd apps/auth-service && npx prisma migrate deploy
	@cd apps/risk-service && npx prisma migrate deploy
	@echo "$(GREEN)Migrations complete$(NC)"

.PHONY: migrate-dev
migrate-dev: ## Create new migration (development)
	@cd apps/auth-service && npx prisma migrate dev
	@cd apps/risk-service && npx prisma migrate dev

.PHONY: seed
seed: ## Seed database with initial data
	@echo "$(BLUE)Seeding database...$(NC)"
	@cd apps/auth-service && npx prisma db seed
	@echo "$(GREEN)Database seeded$(NC)"

.PHONY: db-reset
db-reset: ## Reset database (drop and recreate)
	@echo "$(YELLOW)WARNING: This will delete all data!$(NC)"
	@read -p "Continue? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	@docker compose down postgres
	@docker volume rm enthropic-postgres-data || true
	@docker compose up -d postgres
	@sleep 5
	@make migrate
	@make seed
	@echo "$(GREEN)Database reset complete$(NC)"

.PHONY: db-shell
db-shell: ## Open PostgreSQL shell
	@docker compose exec postgres psql -U postgres -d enthropic

.PHONY: backup-db
backup-db: ## Backup database to file
	@TIMESTAMP=$$(date +%Y%m%d_%H%M%S) && \
	docker compose exec -T postgres pg_dumpall -U postgres > backups/db_backup_$$TIMESTAMP.sql && \
	echo "$(GREEN)Backup saved to backups/db_backup_$$TIMESTAMP.sql$(NC)"

# ==============================================================================
# CLEANUP
# ==============================================================================

.PHONY: clean
clean: ## Stop services and remove volumes
	@echo "$(YELLOW)Stopping services and removing volumes...$(NC)"
	@docker compose down -v
	@echo "$(GREEN)Cleanup complete$(NC)"

.PHONY: clean-all
clean-all: clean ## Full cleanup including node_modules and build artifacts
	@echo "$(YELLOW)Removing build artifacts and dependencies...$(NC)"
	@rm -rf node_modules apps/*/node_modules apps/*/dist apps/execution-core/target
	@find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	@echo "$(GREEN)Full cleanup complete$(NC)"

.PHONY: prune
prune: ## Remove unused Docker resources
	@echo "$(YELLOW)Pruning Docker resources...$(NC)"
	@docker system prune -f
	@echo "$(GREEN)Docker pruned$(NC)"

.PHONY: reset
reset: clean-all init ## Complete reset and reinitialize
