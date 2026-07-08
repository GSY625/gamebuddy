-- CreateTable
CREATE TABLE "ai_interaction_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "scene" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input_summary" TEXT NOT NULL,
    "output_summary" TEXT,
    "latency_ms" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_interaction_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_interaction_logs_user_id_created_at_idx" ON "ai_interaction_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_interaction_logs_scene_created_at_idx" ON "ai_interaction_logs"("scene", "created_at");
