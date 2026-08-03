import { NextResponse } from 'next/server';
import { changePasswordDB } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { username, oldPassword, newPassword } = await request.json();
    
    if (!username || !oldPassword || !newPassword) {
      return NextResponse.json({ success: false, message: 'Semua kolom wajib diisi' }, { status: 400 });
    }

    const success = await changePasswordDB(username, oldPassword, newPassword);
    
    if (success) {
      return NextResponse.json({ success: true, message: 'Password berhasil diubah' });
    } else {
      return NextResponse.json({ success: false, message: 'Username atau password lama salah' }, { status: 401 });
    }
  } catch (error) {
    console.error("Change Password API Error:", error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
