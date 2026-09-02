-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('COOLING_SYSTEM', 'BATTERY_SYSTEM', 'VIBRATION_INSPECTION', 'TELEMETRY_SYSTEM', 'GENERAL_INSPECTION');

-- CreateEnum
CREATE TYPE "MaintenancePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'DISMISSED');

-- CreateTable
CREATE TABLE "MaintenanceRecommendation" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "type" "MaintenanceType" NOT NULL,
    "priority" "MaintenancePriority" NOT NULL,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MaintenanceRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaintenanceRecommendation_vehicleId_status_idx" ON "MaintenanceRecommendation"("vehicleId", "status");

-- CreateIndex
CREATE INDEX "MaintenanceRecommendation_priority_status_idx" ON "MaintenanceRecommendation"("priority", "status");

-- CreateIndex
CREATE INDEX "MaintenanceRecommendation_createdAt_idx" ON "MaintenanceRecommendation"("createdAt");

-- AddForeignKey
ALTER TABLE "MaintenanceRecommendation" ADD CONSTRAINT "MaintenanceRecommendation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
