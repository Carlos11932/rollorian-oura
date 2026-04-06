import { NextRequest, NextResponse } from "next/server";
import { getDonnaHealth } from "@/features/oura/server/donna";
import { validateInternalApiKey } from "@/lib/auth";

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!validateInternalApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const day = searchParams.get("day") ?? new Date().toISOString().slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return NextResponse.json(
      { error: "Invalid day format. Expected YYYY-MM-DD" },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await getDonnaHealth(day));
  } catch (error) {
    console.error("[GET /api/internal/donna/context/health]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
