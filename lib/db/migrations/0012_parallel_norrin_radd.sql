ALTER TABLE "User" ADD COLUMN "firebaseUid" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "isAdmin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD CONSTRAINT "User_firebaseUid_unique" UNIQUE("firebaseUid");