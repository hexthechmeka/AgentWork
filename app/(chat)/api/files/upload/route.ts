import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";

const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= 5 * 1024 * 1024, {
      message: "File size should be less than 5MB",
    })
    .refine((file) => ["image/jpeg", "image/png"].includes(file.type), {
      message: "File type should be JPEG or PNG",
    }),
});

async function getSessionSafe() {
  try {
    return await auth();
  } catch (error) {
    console.error("Upload route: auth() threw:", error);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionSafe();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (request.body === null) {
      return new Response("Request body is empty", { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as Blob;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const validatedFile = FileSchema.safeParse({ file });

    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.issues
        .map((error) => error.message)
        .join(", ");

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const filename = (formData.get("file") as File).name;
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileBuffer = await file.arrayBuffer();

    console.log(
      "Upload route: BLOB_READ_WRITE_TOKEN present?",
      Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      "length:",
      process.env.BLOB_READ_WRITE_TOKEN?.length ?? 0,
      "VERCEL_ENV:",
      process.env.VERCEL_ENV,
      "region:",
      process.env.VERCEL_REGION
    );

    try {
      const data = await put(`${safeName}`, fileBuffer, {
        access: "public",
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });

      return NextResponse.json(data);
    } catch (error) {
      console.error("Upload route: put() failed:", error);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  } catch (error) {
    console.error("Upload route: unhandled error before blob upload:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
