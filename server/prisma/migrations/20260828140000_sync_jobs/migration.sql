-- CreateEnum
CREATE TYPE "SyncJobTrigger" AS ENUM ('SCHEDULED', 'MANUAL');

-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" SERIAL NOT NULL,
    "trigger" "SyncJobTrigger" NOT NULL,
    "status" "SyncJobStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatesCount" INTEGER,
    "error" TEXT,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);
