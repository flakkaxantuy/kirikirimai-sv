import { NextResponse } from "next/server";
import { getAllPermitsDB, savePermitDB, deletePermitDB, bulkSavePermitsDB } from "@/lib/db";

export async function GET() {
  try {
    const permits = await getAllPermitsDB();
    return NextResponse.json({ success: true, data: permits });
  } catch (error: any) {
    console.error("GET /api/permits error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Check if bulk sync payload
    if (Array.isArray(body)) {
      await bulkSavePermitsDB(body);
      const updated = await getAllPermitsDB();
      return NextResponse.json({ success: true, data: updated });
    }

    if (!body || !body.id) {
      return NextResponse.json({ success: false, error: "ID permit wajib diisi" }, { status: 400 });
    }

    await savePermitDB(body);
    return NextResponse.json({ success: true, data: body });
  } catch (error: any) {
    console.error("POST /api/permits error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "ID parameter missing" }, { status: 400 });
    }
    await deletePermitDB(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/permits error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
