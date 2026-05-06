USE fm_funkmedia;

CREATE TABLE IF NOT EXISTS contact_submissions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  source_site VARCHAR(255) NOT NULL,
  form_name VARCHAR(64) NOT NULL DEFAULT 'contact',
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  ip VARCHAR(45),
  user_agent VARCHAR(500),
  referrer VARCHAR(500),
  recaptcha_score DECIMAL(3,2),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_tenant_created (tenant_id, created_at DESC),
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;