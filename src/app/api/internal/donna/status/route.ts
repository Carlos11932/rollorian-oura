import { NextRequest, NextResponse } from "next/server";
import { getDonnaStatus } from "@/features/oura/server/donna";
import { validateInternalApiKey } from "@/lib/auth";

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!validateInternalApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await getDonnaStatus());
  } catch (error) {
    console.error("[GET /api/internal/donna/status]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
