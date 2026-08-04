import { NextResponse } from 'next/server';
import { loginUserDB } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    
    if (!username || !password) {
      return NextResponse.json({ success: false, message: 'Username dan Password wajib diisi' }, { status: 400 });
    }

    const isValid = await loginUserDB(username, password);
    
    if (isValid) {
      const response = NextResponse.json({ success: true, username });
      response.cookies.set({
        name: 'spil_admin_session',
        value: 'authenticated',
        httpOnly: true,
        secure: false, // works on HTTP and HTTPS
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24, // 24 hours
      });
      return response;
    } else {
      return NextResponse.json({ success: false, message: 'Username atau Password salah' }, { status: 401 });
    }
  } catch (error) {
    console.error("Login API Error:", error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
