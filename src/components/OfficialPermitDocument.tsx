"use client";

import React, { useRef, useState } from "react";
import { toJpeg } from "html-to-image";
import jsPDF from "jspdf";
import { Download, X, Smartphone, FileText, CheckCircle, ShieldAlert, Calendar, MapPin, User, Phone, Loader2, Printer } from "lucide-react";

export interface PermitData {
  id: string;
  nomorSurat?: string;
  noDok?: string;
  revisi?: number | string;
  tanggal: string;
  hal?: string;
  pekerjaan: string;
  lokasi: string;
  area: string;
  namaManager: string;
  telpManager: string;
  namaPemohon: string;
  telpPemohon: string;
  pengawas: string;
  telpPengawas: string;
  petugasK3: string;
  telpK3: string;
  klasifikasi: string[];
  pekerjaList: { jenis: string; jumlah: string }[];
  perlengkapan: { jenis: string; nama: string; jumlah: string }[];
  keselamatan: { aktivitas: string; potensi: string; langkah: string }[];
  apd: string[];
  darurat: string[];
  validasi: {
    status: string; // "Diberikan" | "Lembur" | "Diberikan & Lembur" | "Dibatalkan"
    mulai: string;
    sampai: string;
    catatan?: string;
    tanggal?: string;
    hasLembur?: boolean;
    lemburMulai?: string;
    lemburSampai?: string;
    lemburTanggal?: string;
  };
  signatures?: {
    pemohon?: string;
    k3?: string;
    manager?: string;
  };
}

interface Props {
  data: PermitData;
  onClose: () => void;
}

const formatTanggalHariIni = (dateInput?: string) => {
  if (dateInput && dateInput.trim() !== "") {
    const parts = dateInput.split("-");
    if (parts.length === 3 && parts[0].length === 4) {
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const day = parseInt(parts[2]);
      const d = new Date(year, month, day);
      return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    }
    const d = new Date(dateInput);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    }
    return dateInput;
  }
  return new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
};

export default function OfficialPermitDocument({ data, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<"mobile" | "a4">("mobile");
  const [logoVariant, setLogoVariant] = useState<"tpil" | "spil">("tpil");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const handleDownloadPDF = async (targetLogo?: "tpil" | "spil") => {
    setIsGeneratingPDF(true);

    try {
      const selectedLogo = targetLogo || logoVariant;
      
      // Update states to switch logo & ensure A4 view mode is active
      setLogoVariant(selectedLogo);
      setViewMode("a4");

      // Wait 400ms for React re-render & browser paint
      await new Promise(r => setTimeout(r, 400));

      const element = printRef.current;
      if (!element) {
        alert("Elemen dokumen A4 tidak ditemukan.");
        setIsGeneratingPDF(false);
        return;
      }

      // Generate JPEG using html-to-image (uses native browser SVG rendering engine, 0 oklch bugs)
      const imgData = await toJpeg(element, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
        style: {
          padding: "24px",
          backgroundColor: "#ffffff"
        },
        filter: (node) => {
          // Exclude buttons or non-printable controls
          return !node.classList?.contains("no-print");
        }
      });

      // Load image to get true pixel dimensions
      const img = new Image();
      img.src = imgData;
      await new Promise((res) => {
        img.onload = res;
      });

      const pdf = new jsPDF({
        orientation: "p",
        unit: "mm",
        format: "a4",
        compress: true
      });

      const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm

      // Balanced 4mm margin so outer borders are never cut off on right/left edges
      const margin = 4;
      const availableWidth = pdfWidth - (margin * 2); // 202mm
      const availableHeight = pdfHeight - (margin * 2); // 289mm

      const imgRatio = img.width / img.height;

      let renderWidth = availableWidth;
      let renderHeight = availableWidth / imgRatio;

      if (renderHeight > availableHeight) {
        renderHeight = availableHeight;
        renderWidth = availableHeight * imgRatio;
      }

      const xOffset = margin + ((availableWidth - renderWidth) / 2);
      const yOffset = margin + ((availableHeight - renderHeight) / 2);

      pdf.addImage(imgData, "JPEG", xOffset, yOffset, renderWidth, renderHeight, undefined, "FAST");
      
      pdf.save(`Surat_Ijin_Kerja_${selectedLogo.toUpperCase()}_${data.id}.pdf`);
    } catch (err) {
      console.error("Gagal export PDF html-to-image", err);
      // Fallback to native browser print if needed
      if (confirm("Gagal memproses file PDF otomatis. Buka jendela Cetak Browser?")) {
        window.print();
      }
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const allKlasifikasi = ["Kerja Panas", "Kerja Dingin", "Kerja Listrik", "Ketinggian", "Alat Berat", "Radiografi", "Ruang Terbatas", "Galian"];

  const defaultPekerjaTypes = [
    "Engineer", "Surveyor", "Operator Alat Berat", "Teknisi Elektrik",
    "Mekanik", "Welder", "Fitter", "Helper", "Painter", "Lainnya"
  ];

  const getPekerjaCount = (jenis: string) => {
    const found = data.pekerjaList?.find(p => p.jenis.toLowerCase() === jenis.toLowerCase());
    return found ? found.jumlah : "";
  };

  const apdCol1 = ["Safety Helmet", "Penutup Rambut", "Kacamata", "Kap Las", "Earplug", "Earmuff", "Masker Kain"];
  const apdCol2 = ["Respirator", "Sarung Tangan Kain", "Sarung Tangan Karet", "Sarung Tangan Kulit", "Sarung Tangan Kombinasi", "Body harness", "Sepatu Safety"];
  const apdCol3 = ["Sepatu Safety Boot", "Sepatu Safety Karet", "Apron", "Rompi", "Jas Hujan", "Katelpak", "Lainnya"];

  const allDaruratList = [
    "Pemadam Api (APAR, Karung Goni)",
    "Barikade (Garis tanda Bahaya)",
    "Rambu (Tanda Keselamatan)",
    "LOTO (Lock Out Tag Out)",
    "Radio Telekomunikasi (HT)",
    "Jaring / Tali Keselamatan",
    "Lainnya"
  ];

  const statusVal = data.validasi?.status || "Diberikan";

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="min-h-screen w-full p-2 sm:p-6 pb-36 flex flex-col items-center">
        
        {/* Top Action Bar - Mobile First Structured Design */}
        <div className="w-full max-w-4xl bg-white rounded-t-3xl p-3.5 sm:p-4 border-b shadow-lg sticky top-0 z-10 print:hidden space-y-3">
          {/* Header Row: Title & Close Button */}
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <div>
              <h2 className="font-extrabold text-slate-900 text-sm sm:text-base leading-tight">Pratinjau Surat Izin Kerja (SIK)</h2>
              <p className="text-[11px] text-slate-500 font-mono font-bold">{data.nomorSurat || data.id}</p>
            </div>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors" title="Tutup">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Download & Action Buttons Grid (Symmetrical 3-Column) */}
          <div className="grid grid-cols-3 gap-2">
            <button 
              onClick={() => handleDownloadPDF("tpil")} 
              disabled={isGeneratingPDF}
              className="py-2.5 px-2 bg-[#00a4e4] hover:bg-blue-600 active:scale-95 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1 shadow transition-all disabled:opacity-50"
              title="Unduh PDF (Logo TPIL)"
            >
              {isGeneratingPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <Download className="w-3.5 h-3.5 shrink-0" />}
              <span className="truncate">Unduh TPIL</span>
            </button>

            <button 
              onClick={() => handleDownloadPDF("spil")} 
              disabled={isGeneratingPDF}
              className="py-2.5 px-2 bg-[#e30613] hover:bg-red-700 active:scale-95 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1 shadow transition-all disabled:opacity-50"
              title="Unduh PDF (Logo SPIL)"
            >
              {isGeneratingPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <Download className="w-3.5 h-3.5 shrink-0" />}
              <span className="truncate">Unduh SPIL</span>
            </button>

            <button 
              onClick={() => window.print()} 
              className="py-2.5 px-2 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1 shadow transition-all"
              title="Cetak via Jendela Browser"
            >
              <Printer className="w-3.5 h-3.5 shrink-0 text-white" />
              <span className="truncate">Cetak</span>
            </button>
          </div>

          {/* View Mode & Logo Switcher Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            {/* View Mode Switcher */}
            <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-extrabold flex-1">
              <button 
                onClick={() => setViewMode("mobile")} 
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${viewMode === "mobile" ? "bg-white text-[var(--color-primary)] shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
              >
                <Smartphone className="w-3.5 h-3.5" /> Ringkasan HP
              </button>
              <button 
                onClick={() => setViewMode("a4")} 
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${viewMode === "a4" ? "bg-white text-[var(--color-primary)] shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
              >
                <FileText className="w-3.5 h-3.5" /> Dokumen A4
              </button>
            </div>

            {/* Logo Switcher */}
            <div className="flex items-center justify-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-extrabold shrink-0">
              <span className="text-[10px] text-slate-500 font-bold px-1">Logo Pratinjau:</span>
              <button
                onClick={() => setLogoVariant("tpil")}
                className={`px-3 py-1 rounded-lg transition-all ${logoVariant === "tpil" ? "bg-white text-[#00a4e4] shadow-sm font-black" : "text-slate-600 hover:text-slate-900"}`}
              >
                TPIL
              </button>
              <button
                onClick={() => setLogoVariant("spil")}
                className={`px-3 py-1 rounded-lg transition-all ${logoVariant === "spil" ? "bg-white text-[#e30613] shadow-sm font-black" : "text-slate-600 hover:text-slate-900"}`}
              >
                SPIL
              </button>
            </div>
          </div>
        </div>

        {/* View Mode 1: Mobile Friendly Card Summary View */}
        {viewMode === "mobile" && (
          <div className="w-full max-w-4xl bg-slate-50 p-4 rounded-b-3xl space-y-4 print:hidden">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold text-slate-500">ID Izin Kerja</span>
                  <h3 className="text-lg font-extrabold text-[var(--color-primary)]">{data.id}</h3>
                </div>
                <span className="bg-emerald-100 text-emerald-800 text-xs font-extrabold px-3 py-1 rounded-full">
                  {statusVal}
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm pt-2 border-t border-slate-100">
                <div className="flex flex-col gap-1 text-slate-500 font-semibold">
                  <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" /> Pekerjaan:</span>
                  <span className="font-extrabold text-[#002b66] bg-blue-50/80 px-2.5 py-1 rounded-xl border border-blue-200/60 text-xs sm:text-sm">{data.pekerjaan}</span>
                </div>
                <div className="flex flex-col gap-1 text-slate-500 font-semibold">
                  <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" /> Lokasi & Area:</span>
                  <span className="font-extrabold text-[#002b66] bg-blue-50/80 px-2.5 py-1 rounded-xl border border-blue-200/60 text-xs sm:text-sm">{data.lokasi} ({data.area})</span>
                </div>
                <div className="flex flex-col gap-1 text-slate-500 font-semibold">
                  <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Tanggal:</span>
                  <span className="font-extrabold text-[#002b66] bg-blue-50/80 px-2.5 py-1 rounded-xl border border-blue-200/60 text-xs sm:text-sm">{data.tanggal}</span>
                </div>
                <div className="flex flex-col gap-1 text-slate-500 font-semibold">
                  <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-amber-600 shrink-0" /> Pemohon:</span>
                  <span className="font-extrabold text-[#002b66] bg-blue-50/80 px-2.5 py-1 rounded-xl border border-blue-200/60 text-xs sm:text-sm">{data.namaPemohon}</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-2">
              <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-blue-600" /> Klasifikasi Risiko Tinggi
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {data.klasifikasi?.map((k, i) => (
                  <span key={i} className="bg-blue-50 text-[var(--color-primary)] text-xs font-extrabold px-3 py-1 rounded-xl border border-blue-200">
                    {k}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-2">
              <h4 className="font-extrabold text-sm text-slate-800">Status Penanggung Jawab & Tanda Tangan</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { role: "Pemohon", name: data.namaPemohon, telp: data.telpPemohon, sig: data.signatures?.pemohon },
                  { role: "Petugas K3", name: data.petugasK3, telp: data.telpK3, sig: data.signatures?.k3 },
                  { role: "Manager", name: data.namaManager, telp: data.telpManager, sig: data.signatures?.manager }
                ].map((person, idx) => (
                  <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-500 block">{person.role}</span>
                      <strong className="text-sm text-slate-800 block truncate">{person.name}</strong>
                      <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" /> {person.telp}</span>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600">TTD:</span>
                      {person.sig ? (
                        <span className="text-xs text-emerald-600 font-extrabold flex items-center gap-1">
                          <CheckCircle className="w-4 h-4" /> Ada
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 font-semibold">-</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* View Mode 2 / Printable A4 Document Container */}
        <div className={`w-full max-w-4xl bg-slate-200/70 p-2 sm:p-4 pb-12 mb-16 overflow-x-auto rounded-b-3xl border border-slate-300 ${viewMode === "mobile" ? "hidden print:block" : "block"}`}>
          <div className="text-center text-xs font-bold text-slate-600 mb-2 print:hidden">
            💡 Geser ke samping ↔ untuk melihat seluruh lembar dokumen A4
          </div>

          {/* Official Printable A4 Content - Exactly matching official company template FK3-TPIL-08-01 */}
          <div className="w-[820px] min-w-[820px] mx-auto bg-white shadow-2xl p-6 text-black text-[10px] font-sans print:w-full print:min-w-full print:shadow-none print:p-0 box-border" ref={printRef}>
            
            {/* Outer Outline Frame - Centered 760px box with guaranteed 30px white margin on left and right edges */}
            <div className="w-[760px] mx-auto border-2 border-black p-2.5 bg-white box-border">
              
              {/* Header Table */}
              <table className="w-full border-2 border-black border-collapse text-center mb-1.5">
              <tbody>
                <tr>
                  <td className="w-[24%] border border-black p-1 align-middle">
                    {logoVariant === "tpil" ? (
                      <div className="flex items-center justify-center p-0">
                        <img 
                          src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/tpil-logo.png`} 
                          alt="TPIL Logistics" 
                          className="h-16 object-contain max-w-[185px]" 
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center p-0.5">
                        <img 
                          src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/spil-logo.png`} 
                          alt="SPIL" 
                          className="h-14 object-contain max-w-[170px]" 
                        />
                      </div>
                    )}
                  </td>
                  <td className="w-[48%] border border-black p-2 align-middle font-serif font-bold text-sm sm:text-base tracking-wide leading-tight text-black">
                    SURAT IJIN KERJA<br />(PERMIT TO WORK)
                  </td>
                  <td className="w-[28%] border border-black p-0 align-middle">
                    <table className="w-full h-full border-collapse text-[9.5px] text-left">
                      <tbody>
                        <tr className="border-b border-black">
                          <td className="py-2 px-2.5 font-bold w-16 align-middle leading-snug">No. Dok</td>
                          <td className="py-2 px-2.5 align-middle leading-snug">: {data.noDok || (logoVariant === "spil" ? "FK3-SPIL-08-01" : "FK3-TPIL-08-01")}</td>
                        </tr>
                        <tr className="border-b border-black">
                          <td className="py-2 px-2.5 font-bold align-middle leading-snug">Revisi</td>
                          <td className="py-2 px-2.5 align-middle leading-snug">: {data.revisi !== undefined && data.revisi !== null ? String(data.revisi).padStart(2, "0") : "00"}</td>
                        </tr>
                        <tr className="border-b border-black">
                          <td className="py-2 px-2.5 font-bold align-middle leading-snug">Tanggal</td>
                          <td className="py-2 px-2.5 align-middle leading-snug">: {formatTanggalHariIni(data.tanggal)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-2.5 font-bold align-middle leading-snug">Hal</td>
                          <td className="py-2 px-2.5 align-middle leading-snug">: {data.hal || "1 dari 1"}</td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Document Number */}
            <div className="font-bold text-[10px] my-1.5 leading-snug text-black">
              Nomor : <span className="font-normal text-black">{data.nomorSurat || data.id}</span>
            </div>

            {/* Section A: Klasifikasi Pekerjaan */}
            <div className="bg-[#b4c6e7] font-bold px-2.5 py-1.5 border border-black text-[10.5px] leading-snug text-black">
              A. KLASIFIKASI PEKERJAAN
            </div>
            <table className="w-full border border-black border-collapse text-center text-[9.5px] mb-1.5">
              <thead>
                <tr className="bg-white">
                  {allKlasifikasi.map(item => (
                    <th key={item} className="border border-black py-1.5 px-1 font-bold w-1/8 leading-snug align-middle text-black">{item}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {allKlasifikasi.map(item => {
                    const isChecked = data.klasifikasi?.some(k => k.toLowerCase().includes(item.toLowerCase()));
                    return (
                      <td key={item} className="border border-black py-1.5 px-1 align-middle">
                        {/* SVG checkmark centered perfectly in 14x14 square */}
                        <div className="w-3.5 h-3.5 border border-black mx-auto flex items-center justify-center p-0.5 bg-white">
                          {isChecked && (
                            <svg className="w-3 h-3 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>

            {/* Section B: Informasi Pekerjaan */}
            <div className="bg-[#b4c6e7] font-bold px-2.5 py-1.5 border border-black text-[10.5px] leading-snug text-black">
              B. INFORMASI PEKERJAAN
            </div>
            <table className="w-full border border-black border-collapse text-[9.5px] mb-1.5">
              <tbody>
                <tr>
                  {/* Left Column: Info General */}
                  <td className="w-3/5 border-r border-black p-0 align-top">
                    <table className="w-full border-collapse text-[9.5px]">
                      <tbody>
                        {[
                          { label: "Pekerjaan", val: data.pekerjaan },
                          { label: "Lokasi", val: data.lokasi },
                          { label: "Area", val: data.area },
                          { label: "Nama Manager", val: data.namaManager },
                          { label: "No. Telp Manager", val: data.telpManager },
                          { label: "Nama Pemohon", val: data.namaPemohon },
                          { label: "No. Telp Pemohon", val: data.telpPemohon },
                          { label: "Pengawas", val: data.pengawas },
                          { label: "No. Telp Pengawas", val: data.telpPengawas },
                          { label: "Petugas K3", val: data.petugasK3 },
                          { label: "No. Telp Petugas K3", val: data.telpK3 }
                        ].map((row, idx, arr) => (
                          <tr key={row.label} className={idx < arr.length - 1 ? "border-b border-black" : ""}>
                            <td className="w-2/5 py-1.5 px-2 font-bold border-r border-black text-black leading-snug align-middle">{row.label}</td>
                            <td className="w-3/5 py-1.5 px-2 font-normal text-black leading-snug align-middle">{row.val || ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>

                  {/* Right Column: Daftar Pekerja */}
                  <td className="w-2/5 p-0 align-top border-r border-black">
                    <table className="w-full border-collapse text-center text-[9.5px]">
                      <thead>
                        <tr className="bg-[#b4c6e7] border-b border-black font-bold text-black">
                          <th className="py-1.5 px-2 border-r border-black w-2/3 text-left pl-2 leading-snug align-middle">Daftar Pekerja</th>
                          <th className="py-1.5 px-2 border-r border-black w-1/3 leading-snug align-middle">Jumlah</th>
                        </tr>
                      </thead>
                      <tbody>
                        {defaultPekerjaTypes.map((jenis, i) => (
                          <tr key={jenis} className={i < defaultPekerjaTypes.length - 1 ? "border-b border-black" : ""}>
                            <td className="py-1.5 px-2 text-left border-r border-black pl-2 leading-snug align-middle text-black font-bold">
                              {jenis === "Lainnya" ? "Lainnya:......................" : jenis}
                            </td>
                            <td className="py-1.5 px-2 border-r border-black font-normal text-black leading-snug align-middle">{getPekerjaCount(jenis)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Section C: Perlengkapan Kerja */}
            <div className="bg-[#b4c6e7] font-bold px-2.5 py-1.5 border border-black text-[10.5px] leading-snug text-black">
              C. PERLENGKAPAN KERJA
            </div>
            <table className="w-full border border-black border-collapse text-[9.5px] text-center mb-1">
              <thead>
                <tr className="bg-white border-b border-black font-bold text-black">
                  <th className="py-1 px-1 border-r border-black w-[18.75%] align-middle leading-snug">Alat</th>
                  <th className="py-1 px-1 border-r border-black w-[6.25%] align-middle leading-snug">Jml</th>
                  <th className="py-1 px-1 border-r border-black w-[18.75%] align-middle leading-snug">Mesin</th>
                  <th className="py-1 px-1 border-r border-black w-[6.25%] align-middle leading-snug">Jml</th>
                  <th className="py-1 px-1 border-r border-black w-[18.75%] align-middle leading-snug">Material</th>
                  <th className="py-1 px-1 border-r border-black w-[6.25%] align-middle leading-snug">Jml</th>
                  <th className="py-1 px-1 border-r border-black w-[18.75%] align-middle leading-snug">Alat Berat</th>
                  <th className="py-1 px-1 border-r border-black w-[6.25%] align-middle leading-snug">Jml</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const alatItems = data.perlengkapan?.filter(p => p.jenis === "Alat") || [];
                  const mesinItems = data.perlengkapan?.filter(p => p.jenis === "Mesin") || [];
                  const materialItems = data.perlengkapan?.filter(p => p.jenis === "Material") || [];
                  const alatBeratItems = data.perlengkapan?.filter(p => p.jenis === "Alat Berat") || [];
                  const maxRows = Math.max(alatItems.length, mesinItems.length, materialItems.length, alatBeratItems.length, 1);

                  return Array.from({ length: maxRows }).map((_, rIdx) => {
                    const a = alatItems[rIdx];
                    const m = mesinItems[rIdx];
                    const mat = materialItems[rIdx];
                    const ab = alatBeratItems[rIdx];

                    return (
                      <tr key={rIdx} className={rIdx < maxRows - 1 ? "border-b border-black" : ""}>
                        {/* Alat */}
                        <td className="py-1 px-1.5 border-r border-black text-left font-normal text-black leading-snug align-middle min-h-[22px]">
                          {a ? a.nama : ""}
                        </td>
                        <td className="py-1 px-1 border-r border-black text-center font-normal text-black leading-snug align-middle">
                          {a ? a.jumlah : ""}
                        </td>

                        {/* Mesin */}
                        <td className="py-1 px-1.5 border-r border-black text-left font-normal text-black leading-snug align-middle">
                          {m ? m.nama : ""}
                        </td>
                        <td className="py-1 px-1 border-r border-black text-center font-normal text-black leading-snug align-middle">
                          {m ? m.jumlah : ""}
                        </td>

                        {/* Material */}
                        <td className="py-1 px-1.5 border-r border-black text-left font-normal text-black leading-snug align-middle">
                          {mat ? mat.nama : ""}
                        </td>
                        <td className="py-1 px-1 border-r border-black text-center font-normal text-black leading-snug align-middle">
                          {mat ? mat.jumlah : ""}
                        </td>

                        {/* Alat Berat */}
                        <td className="py-1 px-1.5 border-r border-black text-left font-normal text-black leading-snug align-middle">
                          {ab ? ab.nama : ""}
                        </td>
                        <td className="py-1 px-1 border-r border-black text-center font-normal text-black leading-snug align-middle">
                          {ab ? ab.jumlah : ""}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
            <div className="text-[8.5px] italic font-semibold mb-1.5 leading-snug text-black">* Semua perlengkapan kerja diperiksa oleh petugas K3</div>

            {/* Section D: Keselamatan Kerja */}
            <div className="bg-[#b4c6e7] font-bold px-2.5 py-1.5 border border-black text-[10.5px] leading-snug text-black">
              D. KESELAMATAN KERJA
            </div>
            <table className="w-full border border-black border-collapse text-[9.5px] mb-1">
              <thead>
                <tr className="bg-white border-b border-black font-bold text-black text-center">
                  <th className="py-1.5 px-1 border-r border-black w-8 align-middle leading-snug">No</th>
                  <th className="py-1.5 px-1 border-r border-black w-1/3 align-middle leading-snug">Aktivitas</th>
                  <th className="py-1.5 px-1 border-r border-black w-1/3 align-middle leading-snug">Potensi Bahaya</th>
                  <th className="py-1.5 px-1 border-r border-black w-1/3 align-middle leading-snug">Langkah Aman Pekerjaan</th>
                </tr>
              </thead>
              <tbody>
                {data.keselamatan && data.keselamatan.length > 0 ? (
                  data.keselamatan.map((k, idx) => (
                    <tr key={idx} className="border-b border-black">
                      <td className="py-1.5 px-1 text-center border-r border-black align-middle leading-snug font-bold text-black">{idx + 1}</td>
                      <td className="py-1.5 px-2 border-r border-black font-normal text-black align-middle leading-snug">{k.aktivitas}</td>
                      <td className="py-1.5 px-2 border-r border-black font-normal text-black align-middle leading-snug">{k.potensi}</td>
                      <td className="py-1.5 px-2 border-r border-black font-normal text-black align-middle leading-snug">{k.langkah}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-2 px-1 text-center border-r border-black align-middle">1</td>
                    <td className="py-2 px-1 border-r border-black align-middle"></td>
                    <td className="py-2 px-1 border-r border-black align-middle"></td>
                    <td className="py-2 px-1 border-r border-black align-middle"></td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="text-[8.5px] italic font-semibold mb-1.5 leading-snug text-black">* Identifikasi bahaya dijadikan sebagai panduan bekerja secara aman dan selamat</div>

            {/* Section E: Peralatan Keselamatan */}
            <div className="bg-[#b4c6e7] font-bold px-2.5 py-1.5 border border-black text-[10.5px] leading-snug text-black">
              E. PERALATAN KESELAMATAN
            </div>
            <table className="w-full border border-black border-collapse text-[9.5px] mb-1">
              <thead>
                <tr className="bg-[#b4c6e7] border-b border-black font-bold text-black text-center">
                  <th colSpan={3} className="py-1.5 px-1 border-r border-black w-2/3 align-middle leading-snug">Alat Pelindung Diri</th>
                  <th className="py-1.5 px-1 border-r border-black w-1/3 align-middle leading-snug">Perlengkapan Keselamatan & Darurat</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  {/* APD Column 1 with vertical border */}
                  <td className="w-2/9 py-1.5 px-2 border-r border-black align-top text-black leading-snug">
                    {apdCol1.map(item => {
                      const checked = data.apd?.some(a => a.toLowerCase() === item.toLowerCase());
                      return (
                        <div key={item} className="flex items-center gap-1.5 my-1">
                          <span className="font-bold shrink-0 text-black font-mono text-[10px]">[{checked ? "X" : " "}]</span>
                          <span className="whitespace-nowrap font-normal text-black">{item}</span>
                        </div>
                      );
                    })}
                  </td>

                  {/* APD Column 2 with vertical border */}
                  <td className="w-2/9 py-1.5 px-2 border-r border-black align-top text-black leading-snug">
                    {apdCol2.map(item => {
                      const checked = data.apd?.some(a => a.toLowerCase() === item.toLowerCase());
                      return (
                        <div key={item} className="flex items-center gap-1.5 my-1">
                          <span className="font-bold shrink-0 text-black font-mono text-[10px]">[{checked ? "X" : " "}]</span>
                          <span className="whitespace-nowrap font-normal text-black">{item}</span>
                        </div>
                      );
                    })}
                  </td>

                  {/* APD Column 3 with vertical border */}
                  <td className="w-2/9 py-1.5 px-2 border-r border-black align-top text-black leading-snug">
                    {apdCol3.map(item => {
                      const apdLainnyaMatch = data.apd?.find(a => a.toLowerCase() === "lainnya" || a.toLowerCase().startsWith("lainnya:"));
                      const checked = item === "Lainnya" ? Boolean(apdLainnyaMatch) : data.apd?.some(a => a.toLowerCase() === item.toLowerCase());
                      const customText = apdLainnyaMatch && apdLainnyaMatch.includes(":") ? apdLainnyaMatch.split(":")[1].trim() : "";

                      return (
                        <div key={item} className="flex items-center gap-1.5 my-1">
                          <span className="font-bold shrink-0 text-black font-mono text-[10px]">[{checked ? "X" : " "}]</span>
                          <span className="whitespace-nowrap font-normal text-black">
                            {item === "Lainnya" ? (customText ? `Lainnya : ${customText}` : "Lainnya :............") : item}
                          </span>
                        </div>
                      );
                    })}
                  </td>

                  {/* Darurat Column 4 with vertical border */}
                  <td className="w-1/3 py-1.5 px-2 border-r border-black align-top text-black leading-snug">
                    {allDaruratList.map(item => {
                      const daruratLainnyaMatch = data.darurat?.find(d => d.toLowerCase() === "lainnya" || d.toLowerCase().startsWith("lainnya:"));
                      const checked = item === "Lainnya" ? Boolean(daruratLainnyaMatch) : data.darurat?.some(d => d.toLowerCase() === item.toLowerCase());
                      const customText = daruratLainnyaMatch && daruratLainnyaMatch.includes(":") ? daruratLainnyaMatch.split(":")[1].trim() : "";

                      return (
                        <div key={item} className="flex items-center gap-1.5 my-1">
                          <span className="font-bold shrink-0 text-black font-mono text-[10px]">[{checked ? "X" : " "}]</span>
                          <span className="whitespace-nowrap font-normal text-black">
                            {item === "Lainnya" ? (customText ? `Lainnya : ${customText}` : "Lainnya :...................................") : item}
                          </span>
                        </div>
                      );
                    })}
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="text-[8.5px] italic font-semibold mb-1.5 leading-snug text-black">
              * Seluruh peralatan keselamatan yang disyaratkan harus disiapkan sebelum memulai pekerjaan dan diperiksa oleh petugas k3
            </div>

            {/* Section F: Validasi Izin Kerja */}
            {(() => {
              const isDiberikanActive = statusVal.includes("Disetujui") || statusVal.includes("Diberikan");
              const isLemburActive = statusVal.includes("Lembur") || data.validasi?.hasLembur === true;
              const isDibatalkanActive = statusVal.includes("Dibatalkan");

              return (
                <>
                  <div className="bg-[#b4c6e7] font-bold px-2.5 py-1.5 border border-black text-[10.5px] leading-snug text-black">
                    F. VALIDASI IZIN KERJA
                  </div>
                  <table className="w-full border border-black border-collapse text-[9.5px] mb-2">
              <thead>
                <tr className="bg-white border-b border-black font-bold text-center text-black">
                  <th className="py-1.5 px-1 border-r border-black w-1/3 align-middle leading-snug">Izin Disetujui</th>
                  <th className="py-1.5 px-1 border-r border-black w-1/3 align-middle leading-snug">Izin Lembur</th>
                  <th className="py-1.5 px-1 border-r border-black w-1/3 align-middle leading-snug">Izin Dibatalkan</th>
                </tr>
              </thead>
              <tbody>
                {/* Row 1: Mulai Jam with explicit bottom border */}
                <tr className="border-b border-black">
                  <td className="py-1.5 px-2 border-r border-black align-middle leading-snug text-black font-bold">
                    Mulai Jam : <span className="font-normal text-black">{isDiberikanActive ? data.validasi?.mulai : ""}</span>
                  </td>
                  <td className="py-1.5 px-2 border-r border-black align-middle leading-snug text-black font-bold">
                    Mulai Jam : <span className="font-normal text-black">{isLemburActive ? (data.validasi?.lemburMulai || data.validasi?.mulai || "") : ""}</span>
                  </td>
                  <td className="py-1.5 px-2 border-r border-black align-middle leading-snug text-black font-bold">
                    Jam : <span className="font-normal text-black">{isDibatalkanActive ? data.validasi?.mulai : ""}</span>
                  </td>
                </tr>

                {/* Row 2: Sampai Jam / Keterangan with explicit bottom border */}
                <tr className="border-b border-black">
                  <td className="py-1.5 px-2 border-r border-black align-middle leading-snug text-black font-bold">
                    Sampai Jam : <span className="font-normal text-black">{isDiberikanActive ? data.validasi?.sampai : ""}</span>
                  </td>
                  <td className="py-1.5 px-2 border-r border-black align-middle leading-snug text-black font-bold">
                    Sampai Jam : <span className="font-normal text-black">{isLemburActive ? (data.validasi?.lemburSampai || data.validasi?.sampai || "") : ""}</span>
                  </td>
                  <td className="py-1.5 px-2 border-r border-black align-middle leading-snug text-black font-bold">
                    Keterangan : <span className="font-normal text-black">{isDibatalkanActive ? data.validasi?.catatan || "" : ""}</span>
                  </td>
                </tr>

                {/* 3 Signature Blocks with explicit sub-row borders for Disiapkan Pemohon, Nama, Tanggal */}
                {[
                  { role: "Disiapkan Pemohon", name: data.namaPemohon, sigKey: "pemohon" },
                  { role: "Diperiksa Petugas K3", name: data.petugasK3, sigKey: "k3" },
                  { role: "Mengetahui Manager Area", name: data.namaManager, sigKey: "manager" }
                ].map((block, blockIdx) => (
                  <tr key={blockIdx} className="border-b border-black">
                    {["Disetujui", "Lembur", "Dibatalkan"].map((colStatus, colIdx) => {
                      const isActiveCol = 
                        (colStatus === "Disetujui" || colStatus === "Diberikan") ? isDiberikanActive :
                        colStatus === "Lembur" ? isLemburActive :
                        isDibatalkanActive;

                      const colDate = colStatus === "Lembur" 
                        ? (data.validasi?.lemburTanggal || data.validasi?.tanggal || data.tanggal)
                        : (data.validasi?.tanggal || data.tanggal);

                      return (
                        <td key={colIdx} className="p-0 border-r border-black align-top">
                          <table className="w-full border-collapse">
                            <tbody>
                              <tr>
                                {/* Left Text Sub-Rows with explicit border-b for role, nama, tanggal */}
                                <td className="w-2/3 p-0 align-top border-r border-black">
                                  <div className="py-1.5 px-2 font-bold border-b border-black text-[9px] truncate bg-white leading-snug text-black">
                                    {block.role}
                                  </div>
                                  <div className="py-1.5 px-2 border-b border-black text-[9px] truncate bg-white leading-snug text-black font-bold">
                                    Nama : <span className="font-normal text-black">{isActiveCol ? block.name : ""}</span>
                                  </div>
                                  <div className="py-1.5 px-2 text-[9px] truncate bg-white leading-snug text-black font-bold">
                                    Tanggal : <span className="font-normal text-black">{isActiveCol ? formatTanggalHariIni(colDate) : ""}</span>
                                  </div>
                                </td>

                                {/* Right Dedicated Signature Box */}
                                <td className="w-1/3 p-1 align-middle text-center bg-[#f8fafc]">
                                  {isActiveCol && data.signatures && data.signatures[block.sigKey as keyof typeof data.signatures] ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                      src={data.signatures[block.sigKey as keyof typeof data.signatures]}
                                      alt="TTD"
                                      className="max-h-9 max-w-full mx-auto object-contain"
                                    />
                                  ) : (
                                    <span className="text-[8px] text-[#cbd5e1] font-mono">( TTD )</span>
                                  )}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
                </>
              );
            })()}

            {/* Footer Notes */}
            <div className="border border-black p-2 text-[9.5px] min-h-[26px] mb-2 leading-snug text-black">
              <strong className="text-black font-bold">* Catatan Lain :</strong> <span className="font-normal text-black">{data.validasi?.catatan || "-"}</span>
            </div>

            {/* Paper Copy Indicator Footer */}
            <div className="flex justify-between text-[9px] italic font-semibold border-t border-[#94a3b8] pt-1 leading-tight">
              <div><strong className="text-black font-bold">Putih :</strong> Petugas K3</div>
              <div><strong className="text-black font-bold">Kuning :</strong> Pemohon</div>
              <div><strong className="text-black font-bold">Merah :</strong> Manager Area</div>
            </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
