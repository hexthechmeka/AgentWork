CREATE TABLE "FavoritePrompt" (
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text,
	"negativePrompt" text DEFAULT '' NOT NULL,
	"prompt" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Folder" (
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"isSystem" boolean DEFAULT false NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ImagieImage" (
	"blobUrl" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp,
	"folderId" uuid NOT NULL,
	"guidanceScale" numeric NOT NULL,
	"height" integer NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metadata" json DEFAULT '{}'::json NOT NULL,
	"modelName" text NOT NULL,
	"negativePrompt" text DEFAULT '' NOT NULL,
	"prompt" text NOT NULL,
	"sampler" text NOT NULL,
	"seed" bigint,
	"steps" integer NOT NULL,
	"thumbUrl" text NOT NULL,
	"width" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "RunpodSetting" (
	"apiKey" text,
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"podId" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ImagieImage" ADD CONSTRAINT "ImagieImage_folderId_Folder_id_fk" FOREIGN KEY ("folderId") REFERENCES "public"."Folder"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "Folder" ("id", "name", "isSystem")
SELECT '00000000-0000-0000-0000-0000000000f1', '미분류', true
WHERE NOT EXISTS (SELECT 1 FROM "Folder" WHERE "name" = '미분류' AND "isSystem" = true);--> statement-breakpoint
INSERT INTO "Folder" ("id", "name", "isSystem")
SELECT '00000000-0000-0000-0000-0000000000f2', '임시', true
WHERE NOT EXISTS (SELECT 1 FROM "Folder" WHERE "name" = '임시' AND "isSystem" = true);