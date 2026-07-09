import { NextResponse } from "next/server";
import { listPois } from "../store";

export function GET() {
  return NextResponse.json(listPois());
}
