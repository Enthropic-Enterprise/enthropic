-- =============================================================================
-- Enthropic Trading Platform - Database Extensions
-- Phase 1: Extensions
-- =============================================================================
-- Run this AFTER creating the database (00_create_database.sql)
-- Must be run as superuser
-- =============================================================================

-- TimescaleDB for time-series data (trades, market ticks)
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Cryptographic functions (for hashing)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- COMPLETION NOTICE
-- =============================================================================

DO $$
    BEGIN
        RAISE NOTICE '===========================================';
        RAISE NOTICE 'Extensions initialized successfully!';
        RAISE NOTICE '===========================================';
        RAISE NOTICE 'Installed extensions:';
        RAISE NOTICE '  - timescaledb (time-series database)';
        RAISE NOTICE '  - uuid-ossp (UUID generation)';
        RAISE NOTICE '  - pgcrypto (encryption/hashing)';
        RAISE NOTICE '===========================================';
        RAISE NOTICE 'Next step: Run 02_schema.sql';
        RAISE NOTICE '===========================================';
    END $$;