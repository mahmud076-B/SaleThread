/*
  Warnings:

  - A unique constraint covering the columns `[businessId,channelType,externalId]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[externalId]` on the table `Message` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Channel" ADD COLUMN     "accessToken" TEXT,
ADD COLUMN     "instagramId" TEXT,
ADD COLUMN     "pageId" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "externalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_businessId_channelType_externalId_key" ON "Customer"("businessId", "channelType", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Message_externalId_key" ON "Message"("externalId");
