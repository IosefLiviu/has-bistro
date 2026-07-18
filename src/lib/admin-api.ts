import "server-only";
import { NextResponse } from "next/server";
import { getCurrentStaff } from "./staff";
import type { Staff } from "./types";

/** Gard pentru rutele API de admin. */
export async function requireStaff(): Promise<
  { staff: Staff; fail: null } | { staff: null; fail: NextResponse }
> {
  const staff = await getCurrentStaff();
  if (!staff) {
    return {
      staff: null,
      fail: NextResponse.json({ error: "Neautorizat" }, { status: 401 }),
    };
  }
  return { staff, fail: null };
}
