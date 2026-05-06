USE fm_funkmedia;
CREATE TABLE IF NOT EXISTS stripe_events_processed (
  event_id VARCHAR(255) PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  tenant_id VARCHAR(64),
  payment_intent_id VARCHAR(255),
  processed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;