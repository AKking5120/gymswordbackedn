-- Add razorpay_payment_id column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;
