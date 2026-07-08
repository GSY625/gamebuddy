-- CreateTable
CREATE TABLE "ai_match_recommendations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "candidate_user_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "reasons" TEXT NOT NULL,
    "icebreaker" TEXT NOT NULL,
    "feedback" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_match_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_match_recommendations_user_id_game_id_created_at_idx" ON "ai_match_recommendations"("user_id", "game_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_match_recommendations_candidate_user_id_created_at_idx" ON "ai_match_recommendations"("candidate_user_id", "created_at");