-- =============================================================================
-- Enthropic Trading Platform - Complete Database Schema
-- Phase 2: Schema Creation
-- =============================================================================
-- Prerequisites: 01_extensions.sql must be run first
-- =============================================================================

-- =============================================================================
-- PHASE 2: AUTHENTICATION & AUTHORIZATION TABLES
-- =============================================================================

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
                                     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                     name VARCHAR(50) UNIQUE NOT NULL,
                                     description TEXT,
                                     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE roles IS 'User roles for RBAC (admin, trader, viewer, risk_manager, system)';
COMMENT ON COLUMN roles.name IS 'Unique role identifier';

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
                                           id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                           name VARCHAR(100) UNIQUE NOT NULL,
                                           description TEXT,
                                           resource VARCHAR(50) NOT NULL,
                                           action VARCHAR(50) NOT NULL,
                                           created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE permissions IS 'Granular permissions for resource-action pairs';
COMMENT ON COLUMN permissions.resource IS 'Resource type (orders, accounts, positions, etc.)';
COMMENT ON COLUMN permissions.action IS 'Action allowed (create, read, update, delete, etc.)';

-- Role-Permission mapping (RBAC)
CREATE TABLE IF NOT EXISTS role_permissions (
                                                role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
                                                permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
                                                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                                PRIMARY KEY (role_id, permission_id)
);

COMMENT ON TABLE role_permissions IS 'Many-to-many relationship between roles and permissions';

-- =============================================================================
-- PHASE 1 + 2: ACCOUNTS TABLE (Extended with Auth Fields)
-- =============================================================================

CREATE TABLE IF NOT EXISTS accounts (
                                        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Authentication fields (Phase 2)
                                        username VARCHAR(100) UNIQUE NOT NULL,
                                        email VARCHAR(255) UNIQUE NOT NULL,
                                        password_hash VARCHAR(255) NOT NULL,
                                        role_id UUID REFERENCES roles(id),

    -- Account status
                                        is_active BOOLEAN NOT NULL DEFAULT true,
                                        is_verified BOOLEAN NOT NULL DEFAULT false,

    -- Login tracking
                                        last_login_at TIMESTAMPTZ,
                                        failed_login_attempts INTEGER NOT NULL DEFAULT 0,
                                        locked_until TIMESTAMPTZ,

    -- Trading fields (Phase 1)
                                        balance NUMERIC(20, 8) NOT NULL DEFAULT 0 CHECK (balance >= 0),
                                        available_balance NUMERIC(20, 8) NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
                                        margin_used NUMERIC(20, 8) NOT NULL DEFAULT 0 CHECK (margin_used >= 0),

    -- Risk limits
                                        max_position_size NUMERIC(20, 8) NOT NULL DEFAULT 1000000,
                                        max_order_size NUMERIC(20, 8) NOT NULL DEFAULT 100000,
                                        max_daily_loss NUMERIC(20, 8) NOT NULL DEFAULT 50000,

    -- Metadata
                                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                                        CONSTRAINT balance_available_check CHECK (available_balance <= balance)
);

COMMENT ON TABLE accounts IS 'User accounts with authentication, authorization, and trading balances';
COMMENT ON COLUMN accounts.balance IS 'Total account balance';
COMMENT ON COLUMN accounts.available_balance IS 'Balance available for new orders';
COMMENT ON COLUMN accounts.margin_used IS 'Margin currently in use';

-- =============================================================================
-- PHASE 2: TOKEN MANAGEMENT TABLES
-- =============================================================================

-- Refresh tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
                                              id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                              account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                                              token_hash VARCHAR(255) NOT NULL UNIQUE,
                                              expires_at TIMESTAMPTZ NOT NULL,
                                              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                              revoked_at TIMESTAMPTZ,
                                              revoked_reason VARCHAR(100),
                                              user_agent TEXT,
                                              ip_address INET
);

COMMENT ON TABLE refresh_tokens IS 'JWT refresh tokens for session management';

-- Token blacklist (for logout/revocation)
CREATE TABLE IF NOT EXISTS token_blacklist (
                                               id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                               token_jti VARCHAR(255) NOT NULL UNIQUE,
                                               account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
                                               expires_at TIMESTAMPTZ NOT NULL,
                                               revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                               reason VARCHAR(100)
);

COMMENT ON TABLE token_blacklist IS 'Blacklisted JWT tokens (logout, security breach, etc.)';

-- API Keys for service-to-service auth
CREATE TABLE IF NOT EXISTS api_keys (
                                        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                                        name VARCHAR(100) NOT NULL,
                                        key_hash VARCHAR(255) NOT NULL UNIQUE,
                                        permissions TEXT[] NOT NULL DEFAULT '{}',
                                        rate_limit_per_minute INTEGER NOT NULL DEFAULT 1000,
                                        is_active BOOLEAN NOT NULL DEFAULT true,
                                        last_used_at TIMESTAMPTZ,
                                        expires_at TIMESTAMPTZ,
                                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE api_keys IS 'API keys for programmatic access';

-- Audit log for security events
CREATE TABLE IF NOT EXISTS audit_log (
                                         id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                         account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
                                         event_type VARCHAR(50) NOT NULL,
                                         event_data JSONB,
                                         ip_address INET,
                                         user_agent TEXT,
                                         success BOOLEAN NOT NULL,
                                         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE audit_log IS 'Security and system event audit trail';

-- =============================================================================
-- INSTRUMENTS TABLE (Trading Symbols)
-- =============================================================================

CREATE TABLE IF NOT EXISTS instruments (
                                           id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                           symbol VARCHAR(20) UNIQUE NOT NULL,
                                           name VARCHAR(255) NOT NULL,
                                           instrument_type VARCHAR(20) NOT NULL CHECK (instrument_type IN ('equity', 'crypto', 'forex', 'futures', 'options')),
                                           exchange VARCHAR(50) NOT NULL,
                                           currency VARCHAR(10) NOT NULL,

    -- Trading parameters
                                           tick_size NUMERIC(20, 8) NOT NULL CHECK (tick_size > 0),
                                           lot_size NUMERIC(20, 8) NOT NULL CHECK (lot_size > 0),
                                           min_quantity NUMERIC(20, 8) DEFAULT 0.00000001,
                                           max_quantity NUMERIC(20, 8),

    -- Status
                                           is_active BOOLEAN NOT NULL DEFAULT true,
                                           trading_hours_start TIME,
                                           trading_hours_end TIME,

    -- Metadata
                                           description TEXT,
                                           created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                           updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE instruments IS 'Tradable financial instruments and their specifications';
COMMENT ON COLUMN instruments.tick_size IS 'Minimum price increment';
COMMENT ON COLUMN instruments.lot_size IS 'Minimum tradable quantity';

-- =============================================================================
-- PHASE 1: TRADING TABLES
-- =============================================================================

-- Orders
CREATE TABLE IF NOT EXISTS orders (
                                      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                      account_id UUID NOT NULL REFERENCES accounts(id),
                                      client_order_id VARCHAR(100) NOT NULL,
                                      symbol VARCHAR(20) NOT NULL,
                                      side VARCHAR(4) NOT NULL CHECK (side IN ('buy', 'sell')),
                                      order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('market', 'limit', 'stop', 'stop_limit')),
                                      time_in_force VARCHAR(10) NOT NULL DEFAULT 'gtc' CHECK (time_in_force IN ('gtc', 'ioc', 'fok', 'day')),
                                      quantity NUMERIC(20, 8) NOT NULL CHECK (quantity > 0),
                                      price NUMERIC(20, 8) CHECK (price IS NULL OR price > 0),
                                      stop_price NUMERIC(20, 8) CHECK (stop_price IS NULL OR stop_price > 0),
                                      filled_quantity NUMERIC(20, 8) NOT NULL DEFAULT 0 CHECK (filled_quantity >= 0),
                                      avg_fill_price NUMERIC(20, 8),
                                      status VARCHAR(20) NOT NULL DEFAULT 'pending'
                                          CHECK (status IN ('pending', 'partially_filled', 'filled', 'cancelled', 'rejected', 'expired')),
                                      reject_reason TEXT,
                                      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                                      CONSTRAINT client_order_unique UNIQUE (account_id, client_order_id),
                                      CONSTRAINT filled_quantity_check CHECK (filled_quantity <= quantity)
);

COMMENT ON TABLE orders IS 'Trading orders (market, limit, stop, stop-limit)';
COMMENT ON COLUMN orders.time_in_force IS 'gtc=Good Till Cancelled, ioc=Immediate Or Cancel, fok=Fill Or Kill, day=Day Order';

-- Positions
CREATE TABLE IF NOT EXISTS positions (
                                         account_id UUID NOT NULL REFERENCES accounts(id),
                                         symbol VARCHAR(20) NOT NULL,
                                         net_quantity NUMERIC(20, 8) NOT NULL DEFAULT 0,
                                         avg_price NUMERIC(20, 8) NOT NULL DEFAULT 0 CHECK (avg_price >= 0),
                                         realized_pnl NUMERIC(20, 8) NOT NULL DEFAULT 0,
                                         unrealized_pnl NUMERIC(20, 8) NOT NULL DEFAULT 0,
                                         cost_basis NUMERIC(20, 8) NOT NULL DEFAULT 0,
                                         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                         updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                                         PRIMARY KEY (account_id, symbol)
);

COMMENT ON TABLE positions IS 'Current positions per account and symbol';
COMMENT ON COLUMN positions.net_quantity IS 'Net position (positive=long, negative=short, zero=flat)';
COMMENT ON COLUMN positions.realized_pnl IS 'Profit/Loss from closed trades';
COMMENT ON COLUMN positions.unrealized_pnl IS 'Mark-to-market P&L on open position';

-- Trades (TimescaleDB hypertable)
CREATE TABLE IF NOT EXISTS trades (
                                      id UUID NOT NULL DEFAULT uuid_generate_v4(),
                                      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                      buy_order_id UUID NOT NULL REFERENCES orders(id),
                                      sell_order_id UUID NOT NULL REFERENCES orders(id),
                                      buyer_account_id UUID NOT NULL REFERENCES accounts(id),
                                      seller_account_id UUID NOT NULL REFERENCES accounts(id),
                                      symbol VARCHAR(20) NOT NULL,
                                      quantity NUMERIC(20, 8) NOT NULL CHECK (quantity > 0),
                                      price NUMERIC(20, 8) NOT NULL CHECK (price > 0),
                                      buyer_fee NUMERIC(20, 8) NOT NULL DEFAULT 0,
                                      seller_fee NUMERIC(20, 8) NOT NULL DEFAULT 0,

                                      PRIMARY KEY (id, executed_at)
);

COMMENT ON TABLE trades IS 'Executed trades (TimescaleDB hypertable for time-series data)';

-- Convert trades to TimescaleDB hypertable
SELECT create_hypertable('trades', 'executed_at',
                         chunk_time_interval => INTERVAL '1 day',
                         if_not_exists => TRUE
       );

-- Market Ticks (TimescaleDB hypertable)
CREATE TABLE IF NOT EXISTS market_ticks (
                                            symbol VARCHAR(20) NOT NULL,
                                            timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                            bid_price NUMERIC(20, 8) NOT NULL,
                                            ask_price NUMERIC(20, 8) NOT NULL,
                                            bid_size NUMERIC(20, 8) NOT NULL,
                                            ask_size NUMERIC(20, 8) NOT NULL,
                                            last_price NUMERIC(20, 8) NOT NULL,
                                            last_size NUMERIC(20, 8) NOT NULL,
                                            volume NUMERIC(20, 8) NOT NULL DEFAULT 0,
                                            source VARCHAR(50),

                                            PRIMARY KEY (symbol, timestamp)
);

COMMENT ON TABLE market_ticks IS 'Real-time market data ticks (TimescaleDB hypertable)';

-- Convert market_ticks to TimescaleDB hypertable
SELECT create_hypertable('market_ticks', 'timestamp',
                         chunk_time_interval => INTERVAL '1 hour',
                         if_not_exists => TRUE
       );

-- Order Events (audit trail)
CREATE TABLE IF NOT EXISTS order_events (
                                            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                            order_id UUID NOT NULL REFERENCES orders(id),
                                            event_type VARCHAR(50) NOT NULL,
                                            event_data JSONB,
                                            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE order_events IS 'Order lifecycle events (created, filled, cancelled, etc.)';

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Accounts
CREATE INDEX IF NOT EXISTS idx_accounts_username ON accounts(username);
CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);
CREATE INDEX IF NOT EXISTS idx_accounts_role ON accounts(role_id);
CREATE INDEX IF NOT EXISTS idx_accounts_active ON accounts(is_active) WHERE is_active = true;

-- Instruments
CREATE INDEX IF NOT EXISTS idx_instruments_symbol ON instruments(symbol);
CREATE INDEX IF NOT EXISTS idx_instruments_type ON instruments(instrument_type);
CREATE INDEX IF NOT EXISTS idx_instruments_exchange ON instruments(exchange);
CREATE INDEX IF NOT EXISTS idx_instruments_active ON instruments(is_active) WHERE is_active = true;

-- Orders
CREATE INDEX IF NOT EXISTS idx_orders_account ON orders(account_id);
CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders(symbol);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_account_status ON orders(account_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- Positions
CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions(symbol);

-- Refresh tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_account ON refresh_tokens(account_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- Token blacklist
CREATE INDEX IF NOT EXISTS idx_token_blacklist_jti ON token_blacklist(token_jti);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at);

-- Audit log
CREATE INDEX IF NOT EXISTS idx_audit_log_account ON audit_log(account_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_type ON audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);

-- Order events
CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events(order_id);
CREATE INDEX IF NOT EXISTS idx_order_events_type ON order_events(event_type);

-- =============================================================================
-- COMPRESSION POLICIES (TimescaleDB)
-- =============================================================================

-- Enable compression on trades table
ALTER TABLE trades SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'symbol',
    timescaledb.compress_orderby = 'executed_at DESC'
    );

-- Auto-compress data older than 7 days
SELECT add_compression_policy('trades', INTERVAL '7 days', if_not_exists => TRUE);

-- Enable compression on market_ticks table
ALTER TABLE market_ticks SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'symbol',
    timescaledb.compress_orderby = 'timestamp DESC'
    );

-- Auto-compress data older than 1 day
SELECT add_compression_policy('market_ticks', INTERVAL '1 day', if_not_exists => TRUE);

-- =============================================================================
-- RETENTION POLICIES (TimescaleDB)
-- =============================================================================

-- Keep trades for 2 years, then auto-delete
SELECT add_retention_policy('trades', INTERVAL '2 years', if_not_exists => TRUE);

-- Keep market ticks for 90 days, then auto-delete
SELECT add_retention_policy('market_ticks', INTERVAL '90 days', if_not_exists => TRUE);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_positions_updated_at
    BEFORE UPDATE ON positions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_instruments_updated_at
    BEFORE UPDATE ON instruments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- VIEWS
-- =============================================================================

-- Accounts with roles view
CREATE OR REPLACE VIEW accounts_with_roles AS
SELECT
    a.id,
    a.username,
    a.email,
    a.password_hash,
    a.role_id,
    r.name AS role,
    r.description AS role_description,
    a.is_active,
    a.is_verified,
    a.balance,
    a.available_balance,
    a.margin_used,
    a.max_position_size,
    a.max_order_size,
    a.max_daily_loss,
    a.created_at,
    a.updated_at,
    a.last_login_at,
    a.failed_login_attempts,
    a.locked_until
FROM accounts a
         LEFT JOIN roles r ON a.role_id = r.id;

COMMENT ON VIEW accounts_with_roles IS 'Accounts with denormalized role information';

-- Open orders view
CREATE OR REPLACE VIEW open_orders AS
SELECT
    o.id,
    o.account_id,
    a.username,
    o.symbol,
    i.name AS instrument_name,
    o.side,
    o.order_type,
    o.quantity,
    o.price,
    o.filled_quantity,
    o.avg_fill_price,
    o.status,
    o.time_in_force,
    o.created_at
FROM orders o
         JOIN accounts a ON o.account_id = a.id
         LEFT JOIN instruments i ON o.symbol = i.symbol
WHERE o.status IN ('pending', 'partially_filled');

COMMENT ON VIEW open_orders IS 'Currently active orders';

-- Active positions view
CREATE OR REPLACE VIEW active_positions AS
SELECT
    p.account_id,
    a.username,
    p.symbol,
    i.name AS instrument_name,
    p.net_quantity,
    p.avg_price,
    p.realized_pnl,
    p.unrealized_pnl,
    (p.realized_pnl + p.unrealized_pnl) AS total_pnl,
    CASE
        WHEN p.net_quantity > 0 THEN 'LONG'
        WHEN p.net_quantity < 0 THEN 'SHORT'
        ELSE 'FLAT'
        END AS position_type,
    p.updated_at
FROM positions p
         JOIN accounts a ON p.account_id = a.id
         LEFT JOIN instruments i ON p.symbol = i.symbol
WHERE p.net_quantity != 0;

COMMENT ON VIEW active_positions IS 'Non-zero positions with P&L';

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO PUBLIC;

-- Grant select on views
GRANT SELECT ON accounts_with_roles TO PUBLIC;
GRANT SELECT ON open_orders TO PUBLIC;
GRANT SELECT ON active_positions TO PUBLIC;

-- =============================================================================
-- COMPLETION NOTICE
-- =============================================================================

DO $$
    BEGIN
        RAISE NOTICE '===========================================';
        RAISE NOTICE 'Schema initialization complete!';
        RAISE NOTICE '===========================================';
        RAISE NOTICE 'Tables created: 13';
        RAISE NOTICE '  - Authentication: roles, permissions, role_permissions, accounts';
        RAISE NOTICE '  - Security: refresh_tokens, token_blacklist, api_keys, audit_log';
        RAISE NOTICE '  - Trading: instruments, orders, positions, order_events';
        RAISE NOTICE '  - TimescaleDB: trades (hypertable), market_ticks (hypertable)';
        RAISE NOTICE '===========================================';
        RAISE NOTICE 'Views created: 3';
        RAISE NOTICE '  - accounts_with_roles, open_orders, active_positions';
        RAISE NOTICE '===========================================';
        RAISE NOTICE 'TimescaleDB features enabled:';
        RAISE NOTICE '  - Hypertables: trades (1 day chunks), market_ticks (1 hour chunks)';
        RAISE NOTICE '  - Compression: trades (7 days), market_ticks (1 day)';
        RAISE NOTICE '  - Retention: trades (2 years), market_ticks (90 days)';
        RAISE NOTICE '===========================================';
        RAISE NOTICE 'Next step: Run 03_trading_tables.sql';
        RAISE NOTICE '===========================================';
    END $$;