-- Migration: Add context column to artifacts table
-- This adds flexible context-based association for the shared artifacts package

-- 1. Add context column with default empty JSON object
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS context JSONB DEFAULT '{}' NOT NULL;

-- 2. Populate context from existing product_id
UPDATE artifacts
SET context = jsonb_build_object('product_id', product_id)
WHERE context = '{}' AND product_id IS NOT NULL;

-- 3. Create index for efficient context-based queries
CREATE INDEX IF NOT EXISTS ix_artifacts_context_product_id
ON artifacts ((context->>'product_id'));

-- 4. Create index on the full context for flexibility
CREATE INDEX IF NOT EXISTS ix_artifacts_context
ON artifacts USING GIN (context);
