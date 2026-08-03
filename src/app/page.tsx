"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Lock, ArrowRight, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMsg("");

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

    if (isChangingPassword) {
      try {
        const res = await fetch(`${basePath}/api/auth/change-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, oldPassword: password, newPassword }),
        });
        const data = await res.json();
        
        if (data.success) {
          setSuccessMsg(data.message || "Password berhasil diubah");
          setIsChangingPassword(false);
          setPassword("");
          setNewPassword("");
        } else {
          setError(data.message || "Gagal mengubah password");
        }
      } catch (err) {
        setError("Terjadi kesalahan server");
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const res = await fetch(`${basePath}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        router.push("/dashboard");
      } else {
        setError(data.message || "Login gagal");
        setLoading(false);
      }
    } catch (err) {
      setError("Terjadi kesalahan server");
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 flex items-center justify-center p-4 bg-gradient-to-br from-[#1E5950] via-[#2B7A4B] to-[#1E5950] min-h-screen">
      <div className="w-full max-w-md glass rounded-3xl p-8 relative overflow-hidden shadow-2xl">
        {/* Decorative background glow */}
        <div className="absolute -top-16 -right-16 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-[#e30613]/25 rounded-full blur-2xl pointer-events-none"></div>

        <div className="flex flex-col items-center mb-8 relative z-10">
          <h1 className="text-2xl font-bold text-slate-800 text-center">E-Permit Mobile</h1>
          <p className="text-slate-500 text-sm mt-1">Sistem Izin Kerja Risiko Tinggi SPIL</p>
          
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-[#2B7A4B] rounded-full text-xs font-bold">
            <ShieldCheck className="w-4 h-4 text-[#2B7A4B]" />
            <span>{isChangingPassword ? "Ubah Password Admin" : "Portal Login Admin"}</span>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 relative z-10">
          {successMsg && (
            <div className="bg-emerald-50 text-emerald-600 p-3 rounded-lg text-sm text-center font-medium border border-emerald-200">
              {successMsg}
            </div>
          )}
          {error && (
            <div className="bg-red-50 text-red-500 p-3 rounded-lg text-sm text-center font-medium">
              {error}
            </div>
          )}
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700 ml-1">Username / ID Admin</label>
            <div className="relative flex items-center">
              <User className="absolute left-4 w-5 h-5 text-slate-400 z-10 pointer-events-none" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan ID Admin"
                style={{ paddingLeft: "3rem" }}
                className="input-field bg-white/90 font-medium text-slate-800"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700 ml-1">
              {isChangingPassword ? "Password Lama" : "Kata Sandi"}
            </label>
            <div className="relative flex items-center">
              <Lock className="absolute left-4 w-5 h-5 text-slate-400 z-10 pointer-events-none" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ paddingLeft: "3rem" }}
                className="input-field bg-white/90 font-medium text-slate-800"
                required
              />
            </div>
          </div>

          {isChangingPassword && (
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 ml-1">Password Baru</label>
              <div className="relative flex items-center">
                <Lock className="absolute left-4 w-5 h-5 text-slate-400 z-10 pointer-events-none" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ paddingLeft: "3rem" }}
                  className="input-field bg-white/90 font-medium text-slate-800"
                  required
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full btn-primary mt-6 flex items-center justify-center gap-2 group text-base py-3.5 ${isChangingPassword ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20' : ''}`}
          >
            {loading ? (
              <span className="animate-pulse">{isChangingPassword ? "Memproses..." : "Memproses Login..."}</span>
            ) : (
              <>
                <span>{isChangingPassword ? "Simpan Password Baru" : "Masuk Sebagai Admin"}</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setIsChangingPassword(!isChangingPassword);
                setError("");
                setSuccessMsg("");
                setPassword("");
                setNewPassword("");
              }}
              className="text-sm font-bold text-slate-500 hover:text-[#2B7A4B] transition-colors"
            >
              {isChangingPassword ? "Kembali ke Login" : "Ubah Password Admin?"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
