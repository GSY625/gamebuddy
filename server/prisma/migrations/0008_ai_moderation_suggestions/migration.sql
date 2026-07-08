-- CreateTable
CREATE TABLE "ai_moderation_suggestions" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "risk_level" TEXT NOT NULL,
    "categories" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "suggested_action" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "admin_action" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_moderation_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_moderation_suggestions_report_id_created_at_idx" ON "ai_moderation_suggestions"("report_id", "created_at");