import { NextRequest, NextResponse } from "next/server";
import { getDonnaTrends } from "@/features/oura/server/donna";
import { validateInternalApiKey } from "@/lib/auth";

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!validateInternalApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const window = searchParams.get("window") ?? "7d";

  if (window !== "7d" && window !== "30d") {
    return NextResponse.json(
      { error: "Invalid window. Expected 7d or 30d" },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await getDonnaTrends(window));
  } catch (error) {
    console.error("[GET /api/internal/donna/context/trends]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
