CREATE INDEX IF NOT EXISTS "chat_messages_room_id_created_at_idx"
ON "chat_messages" ("room_id", "created_at");

CREATE INDEX IF NOT EXISTS "email_verifications_email_code_created_at_idx"
ON "email_verifications" ("email", "code", "created_at");

CREATE INDEX IF NOT EXISTS "email_verifications_expires_at_idx"
ON "email_verifications" ("expires_at");
