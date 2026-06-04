-- CreateEnum
CREATE TYPE "TelegramConversationRole" AS ENUM ('user', 'bot');

-- CreateEnum
CREATE TYPE "TelegramConversationTurnType" AS ENUM ('diary_user', 'diary_summary', 'correction_user', 'correction_ack', 'system');

-- CreateTable
CREATE TABLE "telegram_conversation_turns" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "chat_id" BIGINT NOT NULL,
    "role" "TelegramConversationRole" NOT NULL,
    "turn_type" "TelegramConversationTurnType" NOT NULL,
    "text" TEXT NOT NULL,
    "telegram_message_id" BIGINT,
    "reply_to_message_id" BIGINT,
    "entry_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_conversation_turns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "telegram_conversation_turns_user_id_chat_id_created_at_idx" ON "telegram_conversation_turns"("user_id", "chat_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_conversation_turns_chat_id_telegram_message_id_key" ON "telegram_conversation_turns"("chat_id", "telegram_message_id");

-- AddForeignKey
ALTER TABLE "telegram_conversation_turns" ADD CONSTRAINT "telegram_conversation_turns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_conversation_turns" ADD CONSTRAINT "telegram_conversation_turns_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "diary_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
