-- Add life-domain tags to metric definitions (separate from value_type).

ALTER TABLE "metric_definitions"
ADD COLUMN "tags_json" JSONB NOT NULL DEFAULT '[]';
