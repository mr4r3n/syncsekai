-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "AnimeProvider" AS ENUM ('ANILIST', 'MAL', 'KITSU');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'SKIPPED', 'REVERTED');

-- CreateEnum
CREATE TYPE "MappingSource" AS ENUM ('AUTO', 'MANUAL', 'IMPORT', 'COMMUNITY');

-- CreateEnum
CREATE TYPE "SiteLinkKind" AS ENUM ('SOCIAL', 'FRIEND');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('TECHNICAL', 'SCROBBLE_SYNC', 'MAPPINGS', 'ACCOUNT', 'FEATURE_REQUEST', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'WAITING_USER', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "userToken" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "pendingEmail" TEXT,
    "emailChangeToken" TEXT,
    "emailChangeExpiresAt" TIMESTAMP(3),
    "username" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "activationToken" TEXT,
    "activationExpiresAt" TIMESTAMP(3),
    "inactivityWarnedAt" TIMESTAMP(3),
    "inactivityLockedAt" TIMESTAMP(3),
    "avatarUrl" TEXT,
    "lastUsernameChange" TIMESTAMP(3),
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorType" TEXT NOT NULL DEFAULT 'NONE',
    "twoFactorSecret" TEXT,
    "emailOtpCode" TEXT,
    "emailOtpExpiresAt" TIMESTAMP(3),
    "passwordResetToken" TEXT,
    "passwordResetExpiresAt" TIMESTAMP(3),
    "backupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "backupCodesGeneratedAt" TIMESTAMP(3),
    "deletionToken" TEXT,
    "deletionTokenExpiresAt" TIMESTAMP(3),
    "deletionScheduledAt" TIMESTAMP(3),
    "googleId" TEXT,
    "discordId" TEXT,
    "githubId" TEXT,
    "webhookToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "coverUrl" TEXT,
    "genres" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "completionPercentage" INTEGER NOT NULL DEFAULT 85,
    "syncRatings" BOOLEAN NOT NULL DEFAULT true,
    "emailErrorAlerts" BOOLEAN NOT NULL DEFAULT true,
    "discordNotifications" BOOLEAN NOT NULL DEFAULT true,
    "webNotifications" BOOLEAN NOT NULL DEFAULT true,
    "autoApproveMappings" BOOLEAN NOT NULL DEFAULT true,
    "preferredTracker" TEXT NOT NULL DEFAULT 'BOTH',
    "blockedGenres" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "canScrobble" BOOLEAN NOT NULL DEFAULT true,
    "canAccessCatalog" BOOLEAN NOT NULL DEFAULT true,
    "canEditMappings" BOOLEAN NOT NULL DEFAULT true,
    "canSyncAnilist" BOOLEAN NOT NULL DEFAULT true,
    "canSyncMal" BOOLEAN NOT NULL DEFAULT true,
    "canSyncKitsu" BOOLEAN NOT NULL DEFAULT true,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "themePalette" TEXT NOT NULL DEFAULT 'sync',
    "themeMode" TEXT NOT NULL DEFAULT 'dark',
    "showInLeaderboard" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'UNMAPPED_ANIME',
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlexConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serverName" TEXT,
    "serverUrl" TEXT,
    "plexUsername" TEXT,
    "encryptedAuthToken" TEXT,
    "monitoredLibraries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlexConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JellyfinConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serverName" TEXT,
    "serverUrl" TEXT,
    "jellyfinUsername" TEXT,
    "encryptedApiKey" TEXT,
    "monitoredLibraries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JellyfinConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmbyConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serverName" TEXT,
    "serverUrl" TEXT,
    "embyUsername" TEXT,
    "encryptedApiKey" TEXT,
    "monitoredLibraries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmbyConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimeConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AnimeProvider" NOT NULL,
    "remoteUsername" TEXT,
    "remoteUserId" TEXT,
    "avatarUrl" TEXT,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "isConnected" BOOLEAN NOT NULL DEFAULT true,
    "lastLatencyMs" INTEGER,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimeConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TitleMapping" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plexTitle" TEXT NOT NULL,
    "plexSeason" INTEGER DEFAULT 1,
    "anilistMediaId" INTEGER,
    "anilistTitle" TEXT,
    "malMediaId" INTEGER,
    "malTitle" TEXT,
    "kitsuMediaId" INTEGER,
    "kitsuTitle" TEXT,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "isApproved" BOOLEAN NOT NULL DEFAULT true,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "source" "MappingSource" NOT NULL DEFAULT 'AUTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TitleMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlacklistEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "titlePattern" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlacklistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrobbleHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "showTitle" TEXT NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "seasonNumber" INTEGER DEFAULT 1,
    "viewPercentage" DOUBLE PRECISION NOT NULL,
    "rating" DOUBLE PRECISION,
    "anilistStatus" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "malStatus" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "kitsuStatus" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "source" TEXT,
    "serverName" TEXT,
    "libraryName" TEXT,
    "errorMessage" TEXT,
    "payloadSnapshot" JSONB,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrobbleHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainPolicy" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "isAllowed" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemMetric" (
    "id" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "ipAddress" TEXT,
    "dateKey" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'INFO',
    "service" TEXT NOT NULL DEFAULT 'SYSTEM',
    "message" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "deviceId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceName" TEXT,
    "deviceType" TEXT DEFAULT 'DESKTOP',
    "browser" TEXT,
    "os" TEXT,
    "iconType" TEXT DEFAULT 'DEFAULT',
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteLink" (
    "id" TEXT NOT NULL,
    "kind" "SiteLinkKind" NOT NULL,
    "provider" TEXT,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "descriptionEs" TEXT,
    "iconUrl" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemAnnouncement" (
    "id" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT NOT NULL DEFAULT 'FESTIVE',
    "themePreset" TEXT NOT NULL DEFAULT 'CUSTOM',
    "badgeText" TEXT,
    "badgeBgColor" TEXT,
    "badgeTextColor" TEXT,
    "message" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL DEFAULT 'NONE',
    "mediaUrl" TEXT,
    "mediaPosition" TEXT NOT NULL DEFAULT 'LEFT',
    "backgroundType" TEXT NOT NULL DEFAULT 'GRADIENT',
    "backgroundValue" TEXT,
    "textColor" TEXT,
    "effectType" TEXT NOT NULL DEFAULT 'NONE',
    "enableGlobalAtmosphere" BOOLEAN NOT NULL DEFAULT true,
    "ctaText" TEXT,
    "ctaUrl" TEXT,
    "ctaTarget" TEXT NOT NULL DEFAULT '_self',
    "ctaBgColor" TEXT,
    "ctaTextColor" TEXT,
    "isClosable" BOOLEAN NOT NULL DEFAULT true,
    "targetAudience" TEXT NOT NULL DEFAULT 'ALL',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "dismissExpiryDays" INTEGER NOT NULL DEFAULT 7,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementPreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'CUSTOM',
    "themePreset" TEXT NOT NULL DEFAULT 'CUSTOM',
    "badgeText" TEXT,
    "badgeBgColor" TEXT,
    "badgeTextColor" TEXT,
    "message" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL DEFAULT 'NONE',
    "mediaUrl" TEXT,
    "mediaPosition" TEXT NOT NULL DEFAULT 'LEFT',
    "backgroundType" TEXT NOT NULL DEFAULT 'GRADIENT',
    "backgroundValue" TEXT,
    "textColor" TEXT DEFAULT '#ffffff',
    "effectType" TEXT NOT NULL DEFAULT 'NONE',
    "enableGlobalAtmosphere" BOOLEAN NOT NULL DEFAULT true,
    "ctaText" TEXT,
    "ctaUrl" TEXT,
    "ctaTarget" TEXT NOT NULL DEFAULT '_self',
    "ctaBgColor" TEXT,
    "ctaTextColor" TEXT,
    "isClosable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnouncementPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "ticketNumber" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "category" "TicketCategory" NOT NULL DEFAULT 'TECHNICAL',
    "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "assignedAdminId" TEXT,
    "lastReplyAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "isStaff" BOOLEAN NOT NULL DEFAULT false,
    "isInternalNote" BOOLEAN NOT NULL DEFAULT false,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketAttachment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "messageId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_userToken_key" ON "User"("userToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailChangeToken_key" ON "User"("emailChangeToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_passwordResetToken_key" ON "User"("passwordResetToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");

-- CreateIndex
CREATE UNIQUE INDEX "User_githubId_key" ON "User"("githubId");

-- CreateIndex
CREATE UNIQUE INDEX "User_webhookToken_key" ON "User"("webhookToken");

-- CreateIndex
CREATE INDEX "UserFavorite_userId_idx" ON "UserFavorite"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserFavorite_userId_animeId_key" ON "UserFavorite"("userId", "animeId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "PlexConnection_userId_key" ON "PlexConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "JellyfinConnection_userId_key" ON "JellyfinConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmbyConnection_userId_key" ON "EmbyConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AnimeConnection_userId_provider_key" ON "AnimeConnection"("userId", "provider");

-- CreateIndex
CREATE INDEX "TitleMapping_isGlobal_isApproved_idx" ON "TitleMapping"("isGlobal", "isApproved");

-- CreateIndex
CREATE INDEX "TitleMapping_plexTitle_idx" ON "TitleMapping"("plexTitle");

-- CreateIndex
CREATE UNIQUE INDEX "TitleMapping_userId_plexTitle_plexSeason_key" ON "TitleMapping"("userId", "plexTitle", "plexSeason");

-- CreateIndex
CREATE INDEX "BlacklistEntry_userId_idx" ON "BlacklistEntry"("userId");

-- CreateIndex
CREATE INDEX "ScrobbleHistory_userId_viewedAt_idx" ON "ScrobbleHistory"("userId", "viewedAt" DESC);

-- CreateIndex
CREATE INDEX "ScrobbleHistory_userId_showTitle_idx" ON "ScrobbleHistory"("userId", "showTitle");

-- CreateIndex
CREATE INDEX "ScrobbleHistory_viewedAt_idx" ON "ScrobbleHistory"("viewedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "DomainPolicy_domain_key" ON "DomainPolicy"("domain");

-- CreateIndex
CREATE INDEX "SystemMetric_metricKey_dateKey_idx" ON "SystemMetric"("metricKey", "dateKey");

-- CreateIndex
CREATE UNIQUE INDEX "SystemMetric_metricKey_ipAddress_dateKey_key" ON "SystemMetric"("metricKey", "ipAddress", "dateKey");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_service_level_idx" ON "AuditLog"("service", "level");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_lastActiveAt_idx" ON "Session"("userId", "lastActiveAt" DESC);

-- CreateIndex
CREATE INDEX "Session_userId_deviceId_idx" ON "Session"("userId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- CreateIndex
CREATE INDEX "SiteLink_kind_isEnabled_sortOrder_idx" ON "SiteLink"("kind", "isEnabled", "sortOrder");

-- CreateIndex
CREATE INDEX "Ticket_userId_status_idx" ON "Ticket"("userId", "status");

-- CreateIndex
CREATE INDEX "Ticket_status_priority_idx" ON "Ticket"("status", "priority");

-- CreateIndex
CREATE INDEX "Ticket_createdAt_idx" ON "Ticket"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Ticket_lastReplyAt_idx" ON "Ticket"("lastReplyAt" DESC);

-- CreateIndex
CREATE INDEX "TicketMessage_ticketId_createdAt_idx" ON "TicketMessage"("ticketId", "createdAt" ASC);

-- CreateIndex
CREATE INDEX "TicketMessage_senderId_idx" ON "TicketMessage"("senderId");

-- CreateIndex
CREATE INDEX "TicketAttachment_ticketId_idx" ON "TicketAttachment"("ticketId");

-- CreateIndex
CREATE INDEX "TicketAttachment_messageId_idx" ON "TicketAttachment"("messageId");

-- AddForeignKey
ALTER TABLE "UserFavorite" ADD CONSTRAINT "UserFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlexConnection" ADD CONSTRAINT "PlexConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JellyfinConnection" ADD CONSTRAINT "JellyfinConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmbyConnection" ADD CONSTRAINT "EmbyConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimeConnection" ADD CONSTRAINT "AnimeConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TitleMapping" ADD CONSTRAINT "TitleMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlacklistEntry" ADD CONSTRAINT "BlacklistEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrobbleHistory" ADD CONSTRAINT "ScrobbleHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assignedAdminId_fkey" FOREIGN KEY ("assignedAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "TicketMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

