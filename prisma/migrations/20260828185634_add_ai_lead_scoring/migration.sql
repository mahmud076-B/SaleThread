-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "aiLeadConfidence" TEXT,
ADD COLUMN     "aiLeadIntent" TEXT,
ADD COLUMN     "aiLeadReasons" JSONB,
ADD COLUMN     "aiLeadScore" INTEGER,
ADD COLUMN     "aiLeadScoredAt" TIMESTAMP(3),
ADD COLUMN     "aiLeadTemperature" TEXT;
