## Enthropic Trading Platform

Enterprise-grade, high-performance trading platform built with microservices architecture featuring real-time market data processing, risk management, and strategy execution.

## 🏗️ Architecture

The platform consists of 6 microservices:

- **Auth Service** (NestJS) - Port 3002 - Authentication & Authorization
- **Execution Core** (Rust) - Port 9100 - Ultra-low latency order processing
- **Risk Service** (NestJS) - Port 3003 - Real-time risk management
- **Strategy Service** (Python) - Port 8000 - Algorithmic trading strategies
- **NATS Gateway** (Node.js) - Ports 8080/8081 - WebSocket & HTTP gateway
- **Dashboard** (React) - Port 5173 - Trading interface

**Infrastructure:**
- PostgreSQL (Port 5432) - Primary database
- Redis (Port 6379) - Caching & sessions
- NATS (Port 4222) - Message broker
- Jaeger (Port 16686) - Distributed tracing
- Prometheus (Port 9090) - Metrics
- Grafana (Port 3001) - Dashboards

## 📦 Prerequisites

- Docker >= 24.0
- Docker Compose >= 2.20
- Node.js >= 18.0
- Rust >= 1.75
- Python >= 3.11

## 🚀 Quick Start

### 1. Setup Environment

```bash
# Copy environment files
make setup

# Edit .env files (IMPORTANT: Change JWT_SECRET and passwords!)
vim .env
```

### 2. Start Infrastructure

```bash
make infra-up
```

### 3. Start All Services

```bash
make up
```

### 4. Verify Health

```bash
make health
```

### 5. Access Applications

- **Dashboard**: http://localhost:5173
- **Jaeger**: http://localhost:16686
- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090

## 💻 Development

### Using Makefile

```bash
make setup       # Setup environment
make infra-up    # Start infrastructure
make up          # Start all services
make logs        # View logs
make health      # Check health
make down        # Stop everything
make clean       # Remove volumes
make test        # Run tests
```

### Using npm scripts

```bash
npm run install:all      # Install all dependencies
npm run build:all        # Build all services
npm run dev:auth         # Run auth in dev mode
npm run dev:execution    # Run execution in dev mode
npm run docker:up        # Start with Docker
npm run health:check     # Check health
```

### Individual Services

**Auth Service:**
```bash
cd apps/auth-service
npm install
npm run prisma:generate
npm run start:dev
```

**Execution Core:**
```bash
cd apps/execution-core
cargo build
cargo run
```

**Risk Service:**
```bash
cd apps/risk-service
npm install
npm run start:dev
```

**Strategy Service:**
```bash
cd apps/strategy-service
poetry install
poetry run python -m src.main
```

**NATS Gateway:**
```bash
cd apps/nats-gateway
npm install
npm run start:dev
```

**Dashboard:**
```bash
cd apps/dashboard
npm install
npm run dev
```

## 🧪 Testing

```bash
# Run all tests
make test

# Individual tests
npm run test:auth
npm run test:risk
npm run test:execution
npm run test:strategy
```

## 📊 Observability

### Metrics (Prometheus)
Access at http://localhost:9090

Key metrics:
- `execution_orders_total` - Total orders processed
- `execution_order_latency` - Order processing latency
- `risk_limit_breaches_total` - Risk violations
- `db_pool_connections` - Database pool status

### Traces (Jaeger)
Access at http://localhost:16686

View distributed traces across all services for order flow, risk checks, and database queries.

### Dashboards (Grafana)
Access at http://localhost:3001 (admin/admin)

Pre-configured dashboards:
- Trading Platform Overview
- Service Performance
- Database Metrics

### Logs

```bash
# All logs
make logs

# Specific service
docker compose logs -f execution-core
docker compose logs -f auth-service
```

## 🌐 Production Deployment

### Docker Compose

```bash
# Build production images
docker compose build

# Start in production mode
docker compose up -d

# Scale services
docker compose up -d --scale execution-core=3
```

### Kubernetes

```bash
# Install using Helm
cd infra/kubernetes/charts/enthropic
helm install enthropic . -f values.yaml

# Or use kubectl
kubectl apply -f infra/kubernetes/manifests/
```

## 🔧 Troubleshooting

### Services not starting

```bash
# Check logs
make logs

# Restart
make restart

# Check database
docker compose ps postgres
docker compose logs postgres
```

### Port conflicts

```bash
# Check ports
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :4222  # NATS
```

### Database issues

```bash
# Reset database
make clean
make infra-up
make migrate
```

## 📚 Documentation

- [AUTH.md](docs/AUTH.md) - Authentication guide
- [DEPLOYMENT.md](docs/DEPLOYMENT.md) - Deployment instructions
- [OBSERVABILITY.md](docs/OBSERVABILITY.md) - Monitoring setup

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push and open a Pull Request

## 📝 License

Proprietary - All rights reserved

---

**Need Help?** Check the troubleshooting section or open an issue.
