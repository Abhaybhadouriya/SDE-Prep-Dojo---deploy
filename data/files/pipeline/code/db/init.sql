-- ShopStream schema. Runs once, the first time the postgres volume is created.
CREATE TABLE IF NOT EXISTS products (
    product_id  TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    price_cents BIGINT NOT NULL CHECK (price_cents >= 0)
);

INSERT INTO products (product_id, name, price_cents) VALUES
  ('P-100', 'Coffee mug', 29900), ('P-101', 'Notebook', 9900),
  ('P-102', 'Headphones', 249900), ('P-103', 'Keyboard', 179900),
  ('P-104', 'Water bottle', 49900), ('P-105', 'Backpack', 129900),
  ('P-106', 'Desk lamp', 89900), ('P-107', 'USB-C cable', 39900)
ON CONFLICT (product_id) DO NOTHING;

-- order_id is the PRIMARY KEY: this is what makes the sink idempotent
-- (INSERT ... ON CONFLICT (order_id) DO UPDATE).
CREATE TABLE IF NOT EXISTS orders (
    order_id        TEXT PRIMARY KEY,
    customer_id     TEXT NOT NULL,
    total_cents     BIGINT NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'INR',
    items           JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL,
    kafka_partition INT NOT NULL,
    kafka_offset    BIGINT NOT NULL,
    inserted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders (customer_id, created_at DESC);
