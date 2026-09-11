CREATE TABLE "DevJob" (
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"projectId" uuid NOT NULL,
	"userId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "UserCredential" (
	"anthropicApiKey" text,
	"githubPat" text,
	"glmApiKey" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"userId" uuid PRIMARY KEY NOT NULL
);
--> statement-breakpoint
ALTER TABLE "DevJob" ADD CONSTRAINT "DevJob_projectId_Project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DevJob" ADD CONSTRAINT "DevJob_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "UserCredential" ADD CONSTRAINT "UserCredential_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;