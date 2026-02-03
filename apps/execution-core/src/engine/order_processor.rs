//! Order Processing Engine with Authentication
//! Phase 1: Persistence + Phase 2: Auth checks
//! Phase 3: Market execution via MarketTick

use crate::auth::{AuthContext, AuthError, permissions};
use crate::engine::position_keeper::{PositionKeeper, Fill};

use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

// =====================================================
// MARKET TICK (FROM NATS - market.tick.*)
// =====================================================
// Cocok dengan market-simulator.service.ts

#[derive(Debug, Deserialize)]
pub struct MarketTick {
    pub symbol: String,

    #[serde(rename = "lastPrice")]
    pub last_price: String,
}

// =====================================================
// ORDER MODEL
// =====================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Order {
    pub id: Uuid,
    pub account_id: Uuid,
    pub client_order_id: String,
    pub symbol: String,
    pub side: String,
    pub order_type: String,
    pub quantity: Decimal,
    pub price: Option<Decimal>,
    pub filled_quantity: Decimal,
    pub avg_fill_price: Option<Decimal>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// =====================================================
// NEW ORDER REQUEST
// =====================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewOrderRequest {
    #[serde(alias = "client_order_id", default = "generate_order_id")]
    pub client_order_id: String,

    #[serde(alias = "accountId")]
    pub account_id: Option<String>,

    pub symbol: String,
    pub side: String,

    #[serde(alias = "order_type")]
    pub order_type: String,

    pub quantity: Decimal,
    pub price: Option<Decimal>,

    #[serde(alias = "time_in_force", default)]
    pub time_in_force: Option<String>,
}

fn generate_order_id() -> String {
    Uuid::new_v4().to_string()
}

// =====================================================
// ORDER RESULT
// =====================================================

#[derive(Debug)]
pub enum OrderResult {
    Accepted(Order),
    Rejected { reason: String, code: String },
    Duplicate(Order),
}

// =====================================================
// ORDER PROCESSOR
// =====================================================

pub struct OrderProcessor {
    pool: PgPool,
    orders: Arc<RwLock<HashMap<Uuid, Order>>>,
}

impl OrderProcessor {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool,
            orders: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    // =====================================================
    // LOAD OPEN ORDERS
    // =====================================================

    pub async fn load_open_orders(&self) -> anyhow::Result<usize> {
        let rows: Vec<Order> = sqlx::query_as(
            r#"SELECT id, account_id, client_order_id, symbol, side, order_type,
                      quantity, price, filled_quantity, avg_fill_price, status,
                      created_at, updated_at
               FROM orders
               WHERE status IN ('pending', 'partially_filled')"#
        )
            .fetch_all(&self.pool)
            .await?;

        let count = rows.len();
        let mut orders = self.orders.write().await;
        for order in rows {
            orders.insert(order.id, order);
        }

        tracing::info!("Loaded {} open orders", count);
        Ok(count)
    }

    // =====================================================
    // MARKET EXECUTION (INILAH YANG HILANG)
    // =====================================================

    pub async fn process_market_tick(
        &self,
        tick: &MarketTick,
        position_keeper: &PositionKeeper,
    ) {
        let price: Decimal = match tick.last_price.parse() {
            Ok(p) => p,
            Err(_) => {
                tracing::warn!("Invalid price in market tick");
                return;
            }
        };

        let orders = self.orders.read().await;

        let matched: Vec<Order> = orders
            .values()
            .filter(|o| {
                o.symbol == tick.symbol
                    && o.status == "pending"
                    && match (o.side.as_str(), o.price) {
                    ("buy", Some(limit)) => price <= limit,
                    ("sell", Some(limit)) => price >= limit,
                    _ => false,
                }
            })
            .cloned()
            .collect();

        drop(orders);

        for order in matched {
            if let Err(e) = self.fill_order(order, price, position_keeper).await {
                tracing::error!("Failed to fill order: {}", e);
            }
        }
    }

    async fn fill_order(
        &self,
        order: Order,
        price: Decimal,
        position_keeper: &PositionKeeper,
    ) -> anyhow::Result<()> {

        // 1. Insert trade
        sqlx::query(
            r#"INSERT INTO trades (order_id, account_id, symbol, side, quantity, price)
               VALUES ($1, $2, $3, $4, $5, $6)"#
        )
            .bind(order.id)
            .bind(order.account_id)
            .bind(&order.symbol)
            .bind(&order.side)
            .bind(order.quantity)
            .bind(price)
            .execute(&self.pool)
            .await?;

        // 2. Update order
        sqlx::query(
            r#"UPDATE orders
               SET status = 'filled',
                   filled_quantity = quantity,
                   avg_fill_price = $2,
                   updated_at = NOW()
               WHERE id = $1"#
        )
            .bind(order.id)
            .bind(price)
            .execute(&self.pool)
            .await?;

        {
            let mut cache = self.orders.write().await;
            cache.remove(&order.id);
        }

        // 3. Update position
        position_keeper
            .apply_fill(&Fill {
                account_id: order.account_id,
                symbol: order.symbol,
                side: order.side,
                quantity: order.quantity,
                price,
            })
            .await?;

        tracing::info!("Order {} filled at {}", order.id, price);
        Ok(())
    }

    // =====================================================
    // SUBMIT / CANCEL
    // =====================================================

    pub async fn submit_order(
        &self,
        auth: &AuthContext,
        req: NewOrderRequest,
    ) -> Result<OrderResult, AuthError> {
        if !auth.has_permission(permissions::ORDERS_CREATE) {
            return Err(AuthError::InsufficientPermissions(
                "orders:create required".into()
            ));
        }

        let existing: Option<Order> = sqlx::query_as(
            "SELECT * FROM orders WHERE account_id = $1 AND client_order_id = $2"
        )
            .bind(auth.account_id)
            .bind(&req.client_order_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| AuthError::DatabaseError(e.to_string()))?;

        if let Some(order) = existing {
            return Ok(OrderResult::Duplicate(order));
        }

        let id = Uuid::new_v4();
        let now = Utc::now();

        let order: Order = sqlx::query_as(
            r#"INSERT INTO orders (id, account_id, client_order_id, symbol, side,
                                   order_type, quantity, price,
                                   filled_quantity, status, created_at, updated_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,'pending',$9,$9)
               RETURNING *"#
        )
            .bind(id)
            .bind(auth.account_id)
            .bind(&req.client_order_id)
            .bind(&req.symbol)
            .bind(&req.side)
            .bind(&req.order_type)
            .bind(req.quantity)
            .bind(req.price)
            .bind(now)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| AuthError::DatabaseError(e.to_string()))?;

        self.orders.write().await.insert(order.id, order.clone());
        Ok(OrderResult::Accepted(order))
    }

    pub async fn cancel_order(
        &self,
        auth: &AuthContext,
        order_id: Uuid,
    ) -> Result<Option<Order>, AuthError> {
        if !auth.has_permission(permissions::ORDERS_CANCEL) {
            return Err(AuthError::InsufficientPermissions(
                "orders:cancel required".into()
            ));
        }

        let order: Option<Order> = sqlx::query_as(
            "SELECT * FROM orders WHERE id = $1"
        )
            .bind(order_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| AuthError::DatabaseError(e.to_string()))?;

        let order = match order {
            Some(o) => o,
            None => return Ok(None),
        };

        if !auth.can_access_account(&order.account_id) {
            return Err(AuthError::InsufficientPermissions(
                "Cannot cancel others' orders".into()
            ));
        }

        let cancelled: Order = sqlx::query_as(
            r#"UPDATE orders SET status='cancelled', updated_at=NOW()
               WHERE id=$1 RETURNING *"#
        )
            .bind(order_id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| AuthError::DatabaseError(e.to_string()))?;

        self.orders.write().await.remove(&order_id);
        Ok(Some(cancelled))
    }
}
