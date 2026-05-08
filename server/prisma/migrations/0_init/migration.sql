-- CreateEnum
CREATE TYPE "UserSegment" AS ENUM ('STUDENT', 'PROFESSIONAL', 'HOBBYIST', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "CodingExperience" AS ENUM ('NEVER', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "PrimaryGoal" AS ENUM ('INTERVIEWS', 'FUN', 'CLASSROOM', 'COMPETE', 'SKILL_UP', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "HowHeard" AS ENUM ('FRIEND', 'SOCIAL', 'SEARCH', 'SCHOOL', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "AvatarSource" AS ENUM ('OAUTH', 'URL', 'DEFAULT');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'PRO');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELED', 'PAST_DUE', 'UNPAID');

-- CreateEnum
CREATE TYPE "ClanJoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ClanChallengeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'COUNTERED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_CHANGES');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "BattleRoyaleFormat" AS ENUM ('SAME_PROBLEM', 'SCORE_ATTACK');

-- CreateEnum
CREATE TYPE "ClanWarsFormat" AS ENUM ('SAME_PROBLEM', 'SCORE_ATTACK');

-- CreateEnum
CREATE TYPE "BattleRoundStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "BattleRoundEndReason" AS ENUM ('EARLY_ALL_PASSED', 'TIMER', 'NO_PLAYERS', 'HOST_ENDED');

-- CreateEnum
CREATE TYPE "BattleMode" AS ENUM ('ONE_V_ONE', 'BATTLE_ROYALE', 'CLAN_VS_CLAN', 'GROUP', 'CLAN_WARS');

-- CreateEnum
CREATE TYPE "BattleStatus" AS ENUM ('WAITING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SkillType" AS ENUM ('FREEZE', 'SCRAMBLE', 'BLIND', 'TIME_STEAL', 'FOG_OF_WAR');

-- CreateEnum
CREATE TYPE "MatchmakingStatus" AS ENUM ('QUEUED', 'MATCHED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "ChatRoomType" AS ENUM ('BATTLE', 'LOBBY', 'DM', 'CLAN');

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('DM', 'GROUP');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "githubUsername" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "onboardingCompletedAt" TIMESTAMP(3),
    "userSegment" "UserSegment",
    "codingExperience" "CodingExperience",
    "primaryGoal" "PrimaryGoal",
    "howHeard" "HowHeard",
    "avatarSource" "AvatarSource",
    "mmr" INTEGER NOT NULL DEFAULT 1000,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
    "stripeCustomerId" TEXT,
    "gamesPlayedToday" INTEGER NOT NULL DEFAULT 0,
    "lastGameResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trialEndsAt" TIMESTAMP(3),
    "hasUsedTrial" BOOLEAN NOT NULL DEFAULT false,
    "clanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "stripePriceId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "bannerUrl" TEXT,
    "logoUrl" TEXT,
    "inviteOnly" BOOLEAN NOT NULL DEFAULT false,
    "mmr" INTEGER NOT NULL DEFAULT 1000,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Clan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClanJoinRequest" (
    "id" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ClanJoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClanJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClanChallenge" (
    "id" TEXT NOT NULL,
    "challengerClanId" TEXT NOT NULL,
    "challengedClanId" TEXT NOT NULL,
    "status" "ClanChallengeStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "mode" "BattleMode" NOT NULL DEFAULT 'CLAN_VS_CLAN',
    "teamSize" INTEGER NOT NULL DEFAULT 2,
    "timeLimitMinutes" INTEGER NOT NULL DEFAULT 30,
    "enabledSkills" "SkillType"[] DEFAULT ARRAY[]::"SkillType"[],
    "preferredTopic" TEXT,
    "clanWarsFormat" "ClanWarsFormat",
    "rounds" JSONB,
    "counterMode" "BattleMode",
    "counterTeamSize" INTEGER,
    "counterTimeLimitMinutes" INTEGER,
    "counterEnabledSkills" "SkillType"[] DEFAULT ARRAY[]::"SkillType"[],
    "counterPreferredTopic" TEXT,
    "counterMessage" TEXT,
    "counterClanWarsFormat" "ClanWarsFormat",
    "counterRounds" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClanChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Problem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'EASY',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "starterCode" TEXT NOT NULL DEFAULT '{}',
    "hints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "solution" TEXT NOT NULL DEFAULT '',
    "contributedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Problem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProblemSubmission" (
    "id" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'EASY',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "starterCode" JSONB NOT NULL,
    "signature" JSONB NOT NULL,
    "tests" JSONB NOT NULL,
    "hints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "solution" TEXT NOT NULL,
    "referenceCode" JSONB NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "reviewNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "linkedProblemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProblemSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCase" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "expectedOutput" TEXT NOT NULL,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Battle" (
    "id" TEXT NOT NULL,
    "mode" "BattleMode" NOT NULL DEFAULT 'ONE_V_ONE',
    "rematchOfBattleId" TEXT,
    "problemId" TEXT,
    "teamSize" INTEGER,
    "timeLimitMinutes" INTEGER NOT NULL DEFAULT 5,
    "autoBalance" BOOLEAN NOT NULL DEFAULT true,
    "enabledSkills" "SkillType"[] DEFAULT ARRAY[]::"SkillType"[],
    "inviteCode" TEXT,
    "inviteExpiresAt" TIMESTAMP(3),
    "seasonId" TEXT,
    "battleRoyaleFormat" "BattleRoyaleFormat",
    "maxPlayers" INTEGER,
    "currentRound" INTEGER NOT NULL DEFAULT 0,
    "clanWarsFormat" "ClanWarsFormat",
    "teamOneName" TEXT,
    "teamTwoName" TEXT,
    "teamOneTag" TEXT,
    "teamTwoTag" TEXT,
    "teamOneClanId" TEXT,
    "teamTwoClanId" TEXT,
    "teamOneCaptainId" TEXT,
    "teamTwoCaptainId" TEXT,
    "isInIntermission" BOOLEAN NOT NULL DEFAULT false,
    "winnerId" TEXT,
    "winningTeam" TEXT,
    "status" "BattleStatus" NOT NULL DEFAULT 'WAITING',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Battle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattleRound" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "timeLimitSeconds" INTEGER NOT NULL,
    "eliminateCount" INTEGER NOT NULL,
    "status" "BattleRoundStatus" NOT NULL DEFAULT 'PENDING',
    "problemId" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "endedReason" "BattleRoundEndReason",

    CONSTRAINT "BattleRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattleRoundSubmission" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "testsPassed" INTEGER NOT NULL DEFAULT 0,
    "totalTests" INTEGER NOT NULL DEFAULT 0,
    "allPassed" BOOLEAN NOT NULL DEFAULT false,
    "pointsEarned" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BattleRoundSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattleSkillUse" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "skillType" "SkillType" NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BattleSkillUse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattleParticipant" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT,
    "code" TEXT,
    "language" TEXT,
    "testsPassed" INTEGER NOT NULL DEFAULT 0,
    "totalTests" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "pointsEarned" INTEGER NOT NULL DEFAULT 0,
    "isReady" BOOLEAN NOT NULL DEFAULT false,
    "isEliminated" BOOLEAN NOT NULL DEFAULT false,
    "placement" INTEGER,
    "eliminatedInRound" INTEGER,
    "mmrChange" INTEGER,

    CONSTRAINT "BattleParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchmakingEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" "BattleMode" NOT NULL DEFAULT 'ONE_V_ONE',
    "preferredDifficulty" "Difficulty",
    "preferredTopic" TEXT,
    "mmrAtQueue" INTEGER NOT NULL,
    "status" "MatchmakingStatus" NOT NULL DEFAULT 'QUEUED',
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchedAt" TIMESTAMP(3),

    CONSTRAINT "MatchmakingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProblemPool" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,

    CONSTRAINT "ProblemPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProblemPoolItem" (
    "id" TEXT NOT NULL,
    "problemPoolId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "pointValue" INTEGER NOT NULL,

    CONSTRAINT "ProblemPoolItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "peakMmr" INTEGER NOT NULL,
    "peakRankTier" TEXT NOT NULL,
    "finalMmr" INTEGER NOT NULL,
    "finalRankTier" TEXT NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDisplayed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "addresseeId" TEXT NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "roomType" "ChatRoomType" NOT NULL,
    "roomId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageRead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roomType" "ChatRoomType" NOT NULL,
    "roomId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "type" "ConversationType" NOT NULL DEFAULT 'DM',
    "participantIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "testsPassed" INTEGER NOT NULL,
    "totalTests" INTEGER NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'bronze',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Clan_name_key" ON "Clan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Clan_tag_key" ON "Clan"("tag");

-- CreateIndex
CREATE INDEX "ClanJoinRequest_clanId_status_idx" ON "ClanJoinRequest"("clanId", "status");

-- CreateIndex
CREATE INDEX "ClanJoinRequest_userId_status_idx" ON "ClanJoinRequest"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ClanJoinRequest_clanId_userId_key" ON "ClanJoinRequest"("clanId", "userId");

-- CreateIndex
CREATE INDEX "Problem_contributedById_idx" ON "Problem"("contributedById");

-- CreateIndex
CREATE UNIQUE INDEX "ProblemSubmission_linkedProblemId_key" ON "ProblemSubmission"("linkedProblemId");

-- CreateIndex
CREATE INDEX "ProblemSubmission_status_createdAt_idx" ON "ProblemSubmission"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ProblemSubmission_submittedById_status_idx" ON "ProblemSubmission"("submittedById", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Battle_inviteCode_key" ON "Battle"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "BattleRound_battleId_roundNumber_key" ON "BattleRound"("battleId", "roundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BattleRoundSubmission_roundId_userId_problemId_key" ON "BattleRoundSubmission"("roundId", "userId", "problemId");

-- CreateIndex
CREATE UNIQUE INDEX "BattleSkillUse_battleId_userId_skillType_key" ON "BattleSkillUse"("battleId", "userId", "skillType");

-- CreateIndex
CREATE UNIQUE INDEX "BattleParticipant_battleId_userId_key" ON "BattleParticipant"("battleId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchmakingEntry_userId_key" ON "MatchmakingEntry"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProblemPool_battleId_key" ON "ProblemPool"("battleId");

-- CreateIndex
CREATE UNIQUE INDEX "Season_number_key" ON "Season"("number");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonRecord_userId_seasonId_key" ON "SeasonRecord"("userId", "seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_requesterId_addresseeId_key" ON "Friendship"("requesterId", "addresseeId");

-- CreateIndex
CREATE INDEX "Message_roomType_roomId_createdAt_idx" ON "Message"("roomType", "roomId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageRead_roomType_roomId_idx" ON "MessageRead"("roomType", "roomId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageRead_userId_roomType_roomId_key" ON "MessageRead"("userId", "roomType", "roomId");

-- CreateIndex
CREATE INDEX "PracticeAttempt_userId_attemptedAt_idx" ON "PracticeAttempt"("userId", "attemptedAt");

-- CreateIndex
CREATE INDEX "PracticeAttempt_userId_problemId_idx" ON "PracticeAttempt"("userId", "problemId");

-- CreateIndex
CREATE INDEX "UserAchievement_userId_idx" ON "UserAchievement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key" ON "UserAchievement"("userId", "achievementId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClanJoinRequest" ADD CONSTRAINT "ClanJoinRequest_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClanJoinRequest" ADD CONSTRAINT "ClanJoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClanChallenge" ADD CONSTRAINT "ClanChallenge_challengerClanId_fkey" FOREIGN KEY ("challengerClanId") REFERENCES "Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClanChallenge" ADD CONSTRAINT "ClanChallenge_challengedClanId_fkey" FOREIGN KEY ("challengedClanId") REFERENCES "Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Problem" ADD CONSTRAINT "Problem_contributedById_fkey" FOREIGN KEY ("contributedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemSubmission" ADD CONSTRAINT "ProblemSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemSubmission" ADD CONSTRAINT "ProblemSubmission_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemSubmission" ADD CONSTRAINT "ProblemSubmission_linkedProblemId_fkey" FOREIGN KEY ("linkedProblemId") REFERENCES "Problem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_rematchOfBattleId_fkey" FOREIGN KEY ("rematchOfBattleId") REFERENCES "Battle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleRound" ADD CONSTRAINT "BattleRound_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleRoundSubmission" ADD CONSTRAINT "BattleRoundSubmission_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "BattleRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleSkillUse" ADD CONSTRAINT "BattleSkillUse_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleParticipant" ADD CONSTRAINT "BattleParticipant_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleParticipant" ADD CONSTRAINT "BattleParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchmakingEntry" ADD CONSTRAINT "MatchmakingEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemPool" ADD CONSTRAINT "ProblemPool_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemPoolItem" ADD CONSTRAINT "ProblemPoolItem_problemPoolId_fkey" FOREIGN KEY ("problemPoolId") REFERENCES "ProblemPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemPoolItem" ADD CONSTRAINT "ProblemPoolItem_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonRecord" ADD CONSTRAINT "SeasonRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonRecord" ADD CONSTRAINT "SeasonRecord_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageRead" ADD CONSTRAINT "MessageRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeAttempt" ADD CONSTRAINT "PracticeAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeAttempt" ADD CONSTRAINT "PracticeAttempt_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

