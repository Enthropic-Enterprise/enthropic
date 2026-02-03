//! NATS Message Handler with Authentication
//! Handles order submit, cancel, market tick execution, and position query

use crate::auth::{AuthContext, AuthService};
use crate::engine::{OrderProcessor, PositionKeeper};
use crate::engine::order_processor::{NewOrderRequest, OrderResult, MarketTick};

use async_nats::Client;
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

use std::collections::HashSet;
use std::sync::Arc;
use uuid::Uuid;

// =====================================================
// AUTH TYPES
// =====================================================

#[derive(Debug, Deserialize)]
struct AuthenticatedMessage<T> {
    auth: AuthPayload,
    #[serde(flatten)]
    data: T,
}

#[derive(Debug, Deserialize)]
struct AuthPayload {
    account_id: String,
    username: String,
    role: String,
    permissions: Vec<String>,
}

impl From<AuthPayload> for AuthContext {
    fn from(p: AuthPayload) -> Self {
        AuthContext {
            account_id: Uuid::parse_str(&p.account_id).unwrap_or_default(),
            username: p.username,
            role: p.role,
            permissions: p.permissions.into_iter().collect::<HashSet<String>>(),
            token_jti: String::new(),
        }
    }
}

// =====================================================
// ORDER RESPONSE
// =====================================================

#[derive(Serialize)]
struct OrderResponse {
    success: bool,
    order_id: Option<String>,
    error: Option<String>,
}

// =====================================================
// NATS SUBSCRIBER
// =====================================================

pub struct NatsSubscriber {
    client: Client,
    pool: PgPool,
    order_processor: Arc<OrderProcessor>,
    position_keeper: Arc<PositionKeeper>,
    #[allow(dead_code)]
    auth_service: Arc<AuthService>,
}

impl NatsSubscriber {
    pub fn new(
        client: Client,
        pool: PgPool,
        auth_service: Arc<AuthService>,
    ) -> Self {
        Self {
            order_processor: Arc::new(OrderProcessor::new(pool.clone())),
            position_keeper: Arc::new(PositionKeeper::new(pool.clone())),
            client,
            pool,
            auth_service,
        }
    }

    pub async fn initialize(&self) -> anyhow::Result<()> {
        self.order_processor.load_open_orders().await?;
        self.position_keeper.load_positions().await?;
        tracing::info!("Execution core initialized");
        Ok(())
    }

    pub async fn run(&self) -> anyhow::Result<()> {
        let mut order_sub = self.client.subscribe("orders.submit").await?;
        let mut cancel_sub = self.client.subscribe("orders.cancel").await?;
        let mut position_sub = self.client.subscribe("positions.query").await?;
        let mut market_sub = self.client.subscribe("market.tick.*").await?;

        tracing::info!("NATS subscriber running");

        loop {
            tokio::select! {
                Some(msg) = order_sub.next() => {
                    self.handle_order_submit(msg).await;
                }
                Some(msg) = cancel_sub.next() => {
                    self.handle_order_cancel(msg).await;
                }
                Some(msg) = position_sub.next() => {
                    self.handle_position_query(msg).await;
                }
                Some(msg) = market_sub.next() => {
                    self.handle_market_tick(msg).await;
                }
            }
        }
    }

    // =====================================================
    // ORDER SUBMIT
    // =====================================================

    async fn handle_order_submit(&self, msg: async_nats::Message) {
        let parsed: Result<AuthenticatedMessage<NewOrderRequest>, _> =
            serde_json::from_slice(&msg.payload);

        let response = match parsed {
            Ok(auth_msg) => {
                let auth: AuthContext = auth_msg.auth.into();
                match self.order_processor.submit_order(&auth, auth_msg.data).await {
                    Ok(OrderResult::Accepted(order)) => OrderResponse {
                        success: true,
                        order_id: Some(order.id.to_string()),
                        error: None,
                    },
                    Ok(OrderResult::Duplicate(order)) => OrderResponse {
                        success: true,
                        order_id: Some(order.id.to_string()),
                        error: Some("Duplicate order".into()),
                    },
                    Ok(OrderResult::Rejected { reason, .. }) => OrderResponse {
                        success: false,
                        order_id: None,
                        error: Some(reason),
                    },
                    Err(e) => OrderResponse {
                        success: false,
                        order_id: None,
                        error: Some(e.to_string()),
                    },
                }
            }
            Err(e) => OrderResponse {
                success: false,
                order_id: None,
                error: Some(format!("Invalid payload: {}", e)),
            },
        };

        if let Some(reply) = msg.reply {
            let _ = self.client
                .publish(reply, serde_json::to_vec(&response).unwrap().into())
                .await;
        }
    }

    // =====================================================
    // MARKET TICK
    // =====================================================

    async fn handle_market_tick(&self, msg: async_nats::Message) {
        let tick: MarketTick = match serde_json::from_slice(&msg.payload) {
            Ok(t) => t,
            Err(e) => {
                tracing::error!("Invalid market tick: {}", e);
                return;
            }
        };

        tracing::info!(
            "Market tick {} @ {}",
            tick.symbol,
            tick.last_price
        );

        self.order_processor
            .process_market_tick(&tick, &self.position_keeper)
            .await;
    }

    // =====================================================
    // ORDER CANCEL
    // =====================================================

    async fn handle_order_cancel(&self, msg: async_nats::Message) {
        #[derive(Deserialize)]
        struct CancelReq {
            order_id: String,
        }

        let parsed: Result<AuthenticatedMessage<CancelReq>, _> =
            serde_json::from_slice(&msg.payload);

        let response = match parsed {
            Ok(auth_msg) => {
                let auth: AuthContext = auth_msg.auth.into();
                match Uuid::parse_str(&auth_msg.data.order_id) {
                    Ok(id) => match self.order_processor.cancel_order(&auth, id).await {
                        Ok(Some(order)) => OrderResponse {
                            success: true,
                            order_id: Some(order.id.to_string()),
                            error: None,
                        },
                        Ok(None) => OrderResponse {
                            success: false,
                            order_id: None,
                            error: Some("Order not found".into()),
                        },
                        Err(e) => OrderResponse {
                            success: false,
                            order_id: None,
                            error: Some(e.to_string()),
                        },
                    },
                    Err(_) => OrderResponse {
                        success: false,
                        order_id: None,
                        error: Some("Invalid order_id".into()),
                    },
                }
            }
            Err(e) => OrderResponse {
                success: false,
                order_id: None,
                error: Some(e.to_string()),
            },
        };

        if let Some(reply) = msg.reply {
            let _ = self.client
                .publish(reply, serde_json::to_vec(&response).unwrap().into())
                .await;
        }
    }

    // =====================================================
    // POSITION QUERY
    // =====================================================

    async fn handle_position_query(&self, msg: async_nats::Message) {
        let parsed: Result<AuthenticatedMessage<serde_json::Value>, _> =
            serde_json::from_slice(&msg.payload);

        let response = match parsed {
            Ok(auth_msg) => {
                let auth: AuthContext = auth_msg.auth.into();
                match self.position_keeper.get_account_positions(&auth, None).await {
                    Ok(p) => serde_json::json!({ "success": true, "positions": p }),
                    Err(e) => serde_json::json!({ "success": false, "error": e.to_string() }),
                }
            }
            Err(e) => serde_json::json!({ "success": false, "error": e.to_string() }),
        };

        if let Some(reply) = msg.reply {
            let _ = self.client
                .publish(reply, serde_json::to_vec(&response).unwrap().into())
                .await;
        }
    }
}
