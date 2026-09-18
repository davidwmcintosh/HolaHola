ALTER TABLE "actfl_progress"
ADD COLUMN "operation_receipts" jsonb DEFAULT '{}'::jsonb NOT NULL;