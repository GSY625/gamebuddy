CREATE INDEX IF NOT EXISTS "user_game_profiles_user_id_updated_at_idx"
ON "user_game_profiles" ("user_id", "updated_at");

CREATE INDEX IF NOT EXISTS "user_game_profiles_game_id_published_to_square_updated_at_idx"
ON "user_game_profiles" ("game_id", "published_to_square", "updated_at");

CREATE INDEX IF NOT EXISTS "friend_requests_receiver_id_status_created_at_idx"
ON "friend_requests" ("receiver_id", "status", "created_at");

CREATE INDEX IF NOT EXISTS "friend_requests_sender_id_status_created_at_idx"
ON "friend_requests" ("sender_id", "status", "created_at");

CREATE INDEX IF NOT EXISTS "friendships_user_id_created_at_idx"
ON "friendships" ("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "friendships_friend_id_created_at_idx"
ON "friendships" ("friend_id", "created_at");

CREATE INDEX IF NOT EXISTS "blocks_blocker_id_idx"
ON "blocks" ("blocker_id");

CREATE INDEX IF NOT EXISTS "blocks_blocked_id_idx"
ON "blocks" ("blocked_id");
