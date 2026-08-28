-- CreateEnum
CREATE TYPE "ConversationPriority" AS ENUM ('normal', 'high', 'urgent');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ConversationStatus" ADD VALUE 'new';
ALTER TYPE "ConversationStatus" ADD VALUE 'contacted';
ALTER TYPE "ConversationStatus" ADD VALUE 'interested';
ALTER TYPE "ConversationStatus" ADD VALUE 'qualified';
ALTER TYPE "ConversationStatus" ADD VALUE 'won';

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "followUpAt" TIMESTAMP(3),
ADD COLUMN     "followUpCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priority" "ConversationPriority" NOT NULL DEFAULT 'normal';
