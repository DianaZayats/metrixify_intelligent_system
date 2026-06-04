-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('text', 'voice', 'manual');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('received', 'transcribing', 'transcribed', 'summarizing', 'extracting_metrics', 'resolving_schema', 'extracting_facts', 'saving_results', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "MetricValueType" AS ENUM ('number', 'ordinal', 'boolean', 'category');

-- CreateEnum
CREATE TYPE "MetricDefinitionStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "PositiveDirection" AS ENUM ('higher_is_better', 'lower_is_better', 'neutral');

-- CreateEnum
CREATE TYPE "ProfileFactType" AS ENUM ('work', 'health_context', 'routine', 'preference', 'habit', 'goal', 'constraint', 'personal_context');

-- CreateEnum
CREATE TYPE "ProfileFactStability" AS ENUM ('stable', 'evolving', 'temporary');

-- CreateEnum
CREATE TYPE "ProfileFactStatus" AS ENUM ('active', 'archived', 'outdated');

-- CreateEnum
CREATE TYPE "AiRunType" AS ENUM ('transcription', 'summary', 'metric_extraction', 'schema_resolver', 'fact_extraction', 'fact_patch', 'embedding');

-- CreateEnum
CREATE TYPE "AiValidationStatus" AS ENUM ('valid', 'invalid', 'partial');

-- CreateEnum
CREATE TYPE "InputFormat" AS ENUM ('json', 'toon');

-- CreateEnum
CREATE TYPE "CorrelationMethod" AS ENUM ('pearson', 'spearman');

-- CreateEnum
CREATE TYPE "StrengthLabel" AS ENUM ('negligible', 'weak', 'moderate', 'strong');

-- CreateEnum
CREATE TYPE "ProcessingJobStatus" AS ENUM ('pending', 'active', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "CreatedBy" AS ENUM ('ai', 'user', 'system');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "telegram_user_id" BIGINT NOT NULL,
    "username" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "language_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diary_entries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source_type" "SourceType" NOT NULL,
    "raw_text" TEXT,
    "transcript_text" TEXT,
    "summary_text" TEXT,
    "entry_date" DATE NOT NULL,
    "processing_status" "ProcessingStatus" NOT NULL DEFAULT 'received',
    "processing_error" TEXT,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diary_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entry_sources" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "source_type" "SourceType" NOT NULL,
    "telegram_message_id" BIGINT,
    "telegram_update_id" BIGINT,
    "idempotency_key" TEXT NOT NULL,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entry_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_versions" (
    "id" TEXT NOT NULL,
    "prompt_key" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompt_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_runs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "entry_id" TEXT,
    "prompt_version_id" TEXT,
    "run_type" "AiRunType" NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_version_label" TEXT,
    "input_format" "InputFormat" NOT NULL,
    "input_snapshot" JSONB,
    "output_snapshot" JSONB,
    "validation_status" "AiValidationStatus" NOT NULL DEFAULT 'valid',
    "applied_ops_json" JSONB,
    "token_usage_json" JSONB,
    "cost_estimate_json" JSONB,
    "error_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metric_definitions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "value_type" "MetricValueType" NOT NULL,
    "unit" TEXT,
    "scale_min" DOUBLE PRECISION,
    "scale_max" DOUBLE PRECISION,
    "positive_direction" "PositiveDirection" NOT NULL DEFAULT 'neutral',
    "aliases_json" JSONB NOT NULL DEFAULT '[]',
    "extraction_rules_json" JSONB,
    "created_by" "CreatedBy" NOT NULL DEFAULT 'ai',
    "created_from_entry_id" TEXT,
    "confidence" DOUBLE PRECISION,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "MetricDefinitionStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metric_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metric_observations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "metric_definition_id" TEXT NOT NULL,
    "observed_at" TIMESTAMP(3) NOT NULL,
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),
    "value_number" DOUBLE PRECISION,
    "value_text" TEXT,
    "value_boolean" BOOLEAN,
    "confidence" DOUBLE PRECISION,
    "evidence_text" TEXT,
    "source" TEXT NOT NULL DEFAULT 'ai',
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metric_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_facts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value_json" JSONB NOT NULL,
    "fact_type" "ProfileFactType" NOT NULL,
    "stability" "ProfileFactStability" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "status" "ProfileFactStatus" NOT NULL DEFAULT 'active',
    "first_seen_entry_id" TEXT,
    "last_seen_entry_id" TEXT,
    "evidence_count" INTEGER NOT NULL DEFAULT 0,
    "valid_from" TIMESTAMP(3),
    "valid_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_fact_evidence" (
    "id" TEXT NOT NULL,
    "profile_fact_id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "evidence_text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_fact_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_chunks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "entry_id" TEXT,
    "chunk_type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memory_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correlation_results" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "metric_a_id" TEXT NOT NULL,
    "metric_b_id" TEXT NOT NULL,
    "method" "CorrelationMethod" NOT NULL,
    "lag_days" INTEGER NOT NULL DEFAULT 0,
    "sample_size" INTEGER NOT NULL,
    "correlation_value" DOUBLE PRECISION NOT NULL,
    "p_value" DOUBLE PRECISION,
    "strength_label" "StrengthLabel" NOT NULL,
    "metadata_json" JSONB,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "correlation_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_jobs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "job_type" TEXT NOT NULL,
    "status" "ProcessingJobStatus" NOT NULL DEFAULT 'pending',
    "idempotency_key" TEXT NOT NULL,
    "bullmq_job_id" TEXT,
    "processing_step" TEXT,
    "error_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processing_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_accounts_telegram_user_id_key" ON "telegram_accounts"("telegram_user_id");

-- CreateIndex
CREATE INDEX "telegram_accounts_user_id_idx" ON "telegram_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "login_tokens_token_hash_key" ON "login_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "login_tokens_user_id_idx" ON "login_tokens"("user_id");

-- CreateIndex
CREATE INDEX "login_tokens_expires_at_idx" ON "login_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "diary_entries_user_id_entry_date_idx" ON "diary_entries"("user_id", "entry_date");

-- CreateIndex
CREATE INDEX "diary_entries_user_id_processing_status_idx" ON "diary_entries"("user_id", "processing_status");

-- CreateIndex
CREATE UNIQUE INDEX "entry_sources_idempotency_key_key" ON "entry_sources"("idempotency_key");

-- CreateIndex
CREATE INDEX "entry_sources_entry_id_idx" ON "entry_sources"("entry_id");

-- CreateIndex
CREATE INDEX "entry_sources_user_id_idx" ON "entry_sources"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_versions_prompt_key_version_key" ON "prompt_versions"("prompt_key", "version");

-- CreateIndex
CREATE INDEX "ai_runs_user_id_entry_id_idx" ON "ai_runs"("user_id", "entry_id");

-- CreateIndex
CREATE INDEX "ai_runs_run_type_idx" ON "ai_runs"("run_type");

-- CreateIndex
CREATE INDEX "metric_definitions_user_id_status_idx" ON "metric_definitions"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "metric_definitions_user_id_key_key" ON "metric_definitions"("user_id", "key");

-- CreateIndex
CREATE INDEX "metric_observations_user_id_metric_definition_id_observed_a_idx" ON "metric_observations"("user_id", "metric_definition_id", "observed_at");

-- CreateIndex
CREATE INDEX "metric_observations_entry_id_idx" ON "metric_observations"("entry_id");

-- CreateIndex
CREATE INDEX "profile_facts_user_id_status_idx" ON "profile_facts"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "profile_facts_user_id_key_key" ON "profile_facts"("user_id", "key");

-- CreateIndex
CREATE INDEX "profile_fact_evidence_profile_fact_id_idx" ON "profile_fact_evidence"("profile_fact_id");

-- CreateIndex
CREATE INDEX "profile_fact_evidence_entry_id_idx" ON "profile_fact_evidence"("entry_id");

-- CreateIndex
CREATE INDEX "memory_chunks_user_id_idx" ON "memory_chunks"("user_id");

-- CreateIndex
CREATE INDEX "correlation_results_user_id_idx" ON "correlation_results"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "correlation_results_user_id_metric_a_id_metric_b_id_method__key" ON "correlation_results"("user_id", "metric_a_id", "metric_b_id", "method", "lag_days");

-- CreateIndex
CREATE UNIQUE INDEX "processing_jobs_idempotency_key_key" ON "processing_jobs"("idempotency_key");

-- CreateIndex
CREATE INDEX "processing_jobs_entry_id_idx" ON "processing_jobs"("entry_id");

-- CreateIndex
CREATE INDEX "processing_jobs_status_idx" ON "processing_jobs"("status");

-- AddForeignKey
ALTER TABLE "telegram_accounts" ADD CONSTRAINT "telegram_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_tokens" ADD CONSTRAINT "login_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entry_sources" ADD CONSTRAINT "entry_sources_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entry_sources" ADD CONSTRAINT "entry_sources_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "diary_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "diary_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_prompt_version_id_fkey" FOREIGN KEY ("prompt_version_id") REFERENCES "prompt_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_definitions" ADD CONSTRAINT "metric_definitions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_definitions" ADD CONSTRAINT "metric_definitions_created_from_entry_id_fkey" FOREIGN KEY ("created_from_entry_id") REFERENCES "diary_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_observations" ADD CONSTRAINT "metric_observations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_observations" ADD CONSTRAINT "metric_observations_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "diary_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_observations" ADD CONSTRAINT "metric_observations_metric_definition_id_fkey" FOREIGN KEY ("metric_definition_id") REFERENCES "metric_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_facts" ADD CONSTRAINT "profile_facts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_facts" ADD CONSTRAINT "profile_facts_first_seen_entry_id_fkey" FOREIGN KEY ("first_seen_entry_id") REFERENCES "diary_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_facts" ADD CONSTRAINT "profile_facts_last_seen_entry_id_fkey" FOREIGN KEY ("last_seen_entry_id") REFERENCES "diary_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_fact_evidence" ADD CONSTRAINT "profile_fact_evidence_profile_fact_id_fkey" FOREIGN KEY ("profile_fact_id") REFERENCES "profile_facts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_fact_evidence" ADD CONSTRAINT "profile_fact_evidence_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "diary_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_chunks" ADD CONSTRAINT "memory_chunks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_chunks" ADD CONSTRAINT "memory_chunks_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "diary_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correlation_results" ADD CONSTRAINT "correlation_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correlation_results" ADD CONSTRAINT "correlation_results_metric_a_id_fkey" FOREIGN KEY ("metric_a_id") REFERENCES "metric_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correlation_results" ADD CONSTRAINT "correlation_results_metric_b_id_fkey" FOREIGN KEY ("metric_b_id") REFERENCES "metric_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "diary_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

