-- =============================================================================
-- Enthropic Trading Platform - Orders & Positions Schema
-- File: infra/db/init/03_trading_tables.sql
-- =============================================================================
-- Run after 02_schema.sql
-- =============================================================================

-- =============================================================================
-- ORDERS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS orders (
                                      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                                      client_order_id VARCHAR(100) NOT NULL,
                                      symbol VARCHAR(20) NOT NULL,
                                      side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
                                      order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('market', 'limit', 'stop', 'stop_limit')),
                                      quantity NUMERIC(20, 8) NOT NULL CHECK (quantity > 0),
                                      price NUMERIC(20, 8),
                                      stop_price NUMERIC(20, 8),
                                      filled_quantity NUMERIC(20, 8) NOT NULL DEFAULT 0,
                                      avg_fill_price NUMERIC(20, 8),
                                      status VARCHAR(20) NOT NULL DEFAULT 'pending'
                                          CHECK (status IN ('pending', 'accepted', 'partially_filled', 'filled', 'cancelled', 'rejected', 'expired')),
                                      time_in_force VARCHAR(10) NOT NULL DEFAULT 'GTC' CHECK (time_in_force IN ('GTC', 'IOC', 'FOK', 'DAY')),
                                      reject_reason TEXT,
                                      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                      filled_at TIMESTAMPTZ,

                                      CONSTRAINT orders_unique_client_id UNIQUE (account_id, client_order_id)
);

-- Indexes for orders
CREATE INDEX IF NOT EXISTS idx_orders_account_id ON orders(account_id);
CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders(symbol);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_account_status ON orders(account_id, status);

COMMENT ON TABLE orders IS 'Trading orders with status tracking';

-- =============================================================================
-- POSITIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS positions (
                                         id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                         account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                                         symbol VARCHAR(20) NOT NULL,
                                         net_quantity NUMERIC(20, 8) NOT NULL DEFAULT 0,
                                         avg_price NUMERIC(20, 8) NOT NULL DEFAULT 0,
                                         current_price NUMERIC(20, 8),
                                         cost_basis NUMERIC(20, 8) NOT NULL DEFAULT 0,
                                         market_value NUMERIC(20, 8),
                                         unrealized_pnl NUMERIC(20, 8) NOT NULL DEFAULT 0,
                                         realized_pnl NUMERIC(20, 8) NOT NULL DEFAULT 0,
                                         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                         updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                                         CONSTRAINT positions_unique_account_symbol UNIQUE (account_id, symbol)
);

-- Indexes for positions
CREATE INDEX IF NOT EXISTS idx_positions_account_id ON positions(account_id);
CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions(symbol);

COMMENT ON TABLE positions IS 'Account positions per symbol';

-- =============================================================================
-- TRADES TABLE (Fill History)
-- =============================================================================

CREATE TABLE IF NOT EXISTS trades (
                                      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                      order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
                                      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                                      symbol VARCHAR(20) NOT NULL,
                                      side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
                                      quantity NUMERIC(20, 8) NOT NULL CHECK (quantity > 0),
                                      price NUMERIC(20, 8) NOT NULL,
                                      commission NUMERIC(20, 8) NOT NULL DEFAULT 0,
                                      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('trades', 'executed_at', if_not_exists => TRUE);

-- Indexes for trades
CREATE INDEX IF NOT EXISTS idx_trades_account_id ON trades(account_id);
CREATE INDEX IF NOT EXISTS idx_trades_order_id ON trades(order_id);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);

COMMENT ON TABLE trades IS 'Trade execution history (fills)';

-- =============================================================================
-- RISK LIMITS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS risk_limits (
                                           id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                           account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
                                           symbol VARCHAR(20),
                                           limit_type VARCHAR(50) NOT NULL,
                                           limit_value NUMERIC(20, 8) NOT NULL,
                                           current_value NUMERIC(20, 8) NOT NULL DEFAULT 0,
                                           is_active BOOLEAN NOT NULL DEFAULT true,
                                           created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                           updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                                           CONSTRAINT risk_limits_unique UNIQUE (account_id, symbol, limit_type)
);

COMMENT ON TABLE risk_limits IS 'Risk limits per account/symbol';

-- =============================================================================
-- ACCOUNT PERMISSIONS TABLE (if not exists)
-- =============================================================================

CREATE TABLE IF NOT EXISTS account_permissions (
                                                   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                                   account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                                                   permission VARCHAR(100) NOT NULL,
                                                   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                                                   CONSTRAINT account_permissions_unique UNIQUE (account_id, permission)
);

COMMENT ON TABLE account_permissions IS 'Direct permission assignments to accounts';

-- =============================================================================
-- HELPER FUNCTION: Get role name from account
-- =============================================================================

CREATE OR REPLACE FUNCTION get_account_role(p_account_id UUID)
    RETURNS VARCHAR AS $$
DECLARE
    v_role VARCHAR;
BEGIN
    SELECT r.name INTO v_role
    FROM accounts a
             JOIN roles r ON a.role_id = r.id
    WHERE a.id = p_account_id;

    RETURN v_role;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TRIGGER: Update updated_at on orders
-- =============================================================================

CREATE OR REPLACE FUNCTION update_orders_updated_at()
    RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_orders_updated_at ON orders;
CREATE TRIGGER trigger_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
EXECUTE FUNCTION update_orders_updated_at();

-- =============================================================================
-- TRIGGER: Update updated_at on positions
-- =============================================================================

CREATE OR REPLACE FUNCTION update_positions_updated_at()
    RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_positions_updated_at ON positions;
CREATE TRIGGER trigger_positions_updated_at
    BEFORE UPDATE ON positions
    FOR EACH ROW
EXECUTE FUNCTION update_positions_updated_at();

-- =============================================================================
-- INSERT SAMPLE DATA (for testing)
-- =============================================================================

-- Note: Run this only after accounts are created
-- Sample positions will be created when orders are filled

DO $$
    BEGIN
        RAISE NOTICE '===========================================';
        RAISE NOTICE 'Trading tables created successfully!';
        RAISE NOTICE '===========================================';
        RAISE NOTICE 'Tables created:';
        RAISE NOTICE '  - orders (trading orders)';
        RAISE NOTICE '  - positions (account positions)';
        RAISE NOTICE '  - trades (fill history - hypertable)';
        RAISE NOTICE '  - risk_limits (risk management)';
        RAISE NOTICE '  - account_permissions (direct permissions)';
        RAISE NOTICE '===========================================';
    END $$;