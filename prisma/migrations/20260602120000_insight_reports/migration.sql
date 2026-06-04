-- AlterEnum
ALTER TYPE "AiRunType" ADD VALUE 'insights_generation';

-- CreateTable
CREATE TABLE "insight_reports" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "insights_json" JSONB NOT NULL,
    "recommendations_json" JSONB NOT NULL,
    "disclaimer" TEXT,
    "input_summary_json" JSONB,
    "correlation_calculated_at" TIMESTAMP(3),
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "ai_run_id" TEXT,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insight_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "insight_reports_user_id_generated_at_idx" ON "insight_reports"("user_id", "generated_at");

-- AddForeignKey
ALTER TABLE "insight_reports" ADD CONSTRAINT "insight_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
