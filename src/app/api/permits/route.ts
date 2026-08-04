import { NextResponse, type NextRequest } from "next/server";
import { getAllPermitsDB, savePermitDB, deletePermitDB, bulkSavePermitsDB } from "@/lib/db";

function isAuthorized(request: NextRequest) {
  const session = request.cookies.get("spil_admin_session");
  return session && session.value === "authenticated";
}

export async function GET() {
  try {
    const permits = await getAllPermitsDB();
    return NextResponse.json({ success: true, data: permits });
  } catch (error: any) {
    console.error("GET /api/permits error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Check if bulk sync payload (requires admin auth)
    if (Array.isArray(body)) {
      if (!isAuthorized(request)) {
        return NextResponse.json({ success: false, error: "Akses ditolak" }, { status: 401 });
      }
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

export async function DELETE(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ success: false, error: "Akses ditolak: Wajib login admin" }, { status: 401 });
    }

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
