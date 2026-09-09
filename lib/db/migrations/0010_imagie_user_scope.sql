ALTER TABLE "Folder" ADD COLUMN "userId" uuid;
--> statement-breakpoint
UPDATE "Folder" SET "userId" = COALESCE((SELECT "id" FROM "User" WHERE "email" = 'owner@agentwork.local' LIMIT 1), (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1)) WHERE "userId" IS NULL;
--> statement-breakpoint
DELETE FROM "Folder" WHERE "userId" IS NULL;
--> statement-breakpoint
ALTER TABLE "Folder" ALTER COLUMN "userId" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ImagieImage" ADD COLUMN "userId" uuid;
--> statement-breakpoint
UPDATE "ImagieImage" SET "userId" = COALESCE((SELECT "id" FROM "User" WHERE "email" = 'owner@agentwork.local' LIMIT 1), (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1)) WHERE "userId" IS NULL;
--> statement-breakpoint
DELETE FROM "ImagieImage" WHERE "userId" IS NULL;
--> statement-breakpoint
ALTER TABLE "ImagieImage" ALTER COLUMN "userId" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "ImagieImage" ADD CONSTRAINT "ImagieImage_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "FavoritePrompt" ADD COLUMN "userId" uuid;
--> statement-breakpoint
UPDATE "FavoritePrompt" SET "userId" = COALESCE((SELECT "id" FROM "User" WHERE "email" = 'owner@agentwork.local' LIMIT 1), (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1)) WHERE "userId" IS NULL;
--> statement-breakpoint
DELETE FROM "FavoritePrompt" WHERE "userId" IS NULL;
--> statement-breakpoint
ALTER TABLE "FavoritePrompt" ALTER COLUMN "userId" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "FavoritePrompt" ADD CONSTRAINT "FavoritePrompt_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "RunpodSetting" ADD COLUMN "userId" uuid;
--> statement-breakpoint
UPDATE "RunpodSetting" SET "userId" = COALESCE((SELECT "id" FROM "User" WHERE "email" = 'owner@agentwork.local' LIMIT 1), (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1));
--> statement-breakpoint
DELETE FROM "RunpodSetting" WHERE "userId" IS NULL;
--> statement-breakpoint
ALTER TABLE "RunpodSetting" DROP CONSTRAINT IF EXISTS "RunpodSetting_pkey";
--> statement-breakpoint
ALTER TABLE "RunpodSetting" DROP COLUMN "id";
--> statement-breakpoint
ALTER TABLE "RunpodSetting" ALTER COLUMN "userId" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "RunpodSetting" ADD CONSTRAINT "RunpodSetting_pkey" PRIMARY KEY ("userId");
--> statement-breakpoint
ALTER TABLE "RunpodSetting" ADD CONSTRAINT "RunpodSetting_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
