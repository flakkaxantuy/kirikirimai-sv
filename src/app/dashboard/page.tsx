"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FileText, Download, Search, Calendar, LogOut, FileDown, PlusCircle, Printer, Edit3, Trash2, Loader2 } from "lucide-react";
import OfficialPermitDocument, { PermitData } from "@/components/OfficialPermitDocument";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Default empty permits list (Zero data initial state)
const DEFAULT_PERMITS: PermitData[] = [];

export default function DashboardPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [permits, setPermits] = useState<PermitData[]>([]);
  const [selectedPermitForPDF, setSelectedPermitForPDF] = useState<PermitData | null>(null);

  // Available years dynamic extractor
  const availableYears = Array.from(
    new Set([
      "2026", "2025", "2024",
      ...permits.map(p => p.tanggal ? p.tanggal.split("-")[0] : "").filter(Boolean)
    ])
  ).sort((a, b) => b.localeCompare(a));

  const MONTHS = [
    { value: "all", label: "Semua Bulan" },
    { value: "01", label: "Januari" },
    { value: "02", label: "Februari" },
    { value: "03", label: "Maret" },
    { value: "04", label: "April" },
    { value: "05", label: "Mei" },
    { value: "06", label: "Juni" },
    { value: "07", label: "Juli" },
    { value: "08", label: "Agustus" },
    { value: "09", label: "September" },
    { value: "10", label: "Oktober" },
    { value: "11", label: "November" },
    { value: "12", label: "Desember" }
  ];

  // Delete modal & countdown state
  const [deleteTarget, setDeleteTarget] = useState<PermitData | null>(null);
  const [deleteCountdown, setDeleteCountdown] = useState<number | null>(null);

  // Deletion timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (deleteCountdown !== null && deleteCountdown > 0) {
      timer = setTimeout(() => {
        setDeleteCountdown(deleteCountdown - 1);
      }, 1000);
    } else if (deleteCountdown === 0 && deleteTarget) {
      // Execute permanent deletion
      const targetId = deleteTarget.id;
      const updated = permits.filter(p => p.id !== targetId);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPermits(updated);
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
      try {
        localStorage.setItem("spil_permits", JSON.stringify(updated));
        // Also delete from SQLite DB
        fetch(`${basePath}/api/permits?id=${encodeURIComponent(targetId)}`, { method: "DELETE" }).catch(e => console.error("SQLite delete error:", e));
      } catch (e) {
        console.error("Gagal memperbarui storage saat hapus", e);
      }
      setDeleteTarget(null);
      setDeleteCountdown(null);
    }
    return () => clearTimeout(timer);
  }, [deleteCountdown, deleteTarget, permits]);

  // Load permits from SQLite DB with localStorage fallback
  useEffect(() => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const loadPermits = async () => {
      try {
        const res = await fetch(`${basePath}/api/permits`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setPermits(json.data);
          localStorage.setItem("spil_permits", JSON.stringify(json.data));
          return;
        }

        // Fallback to localStorage if SQLite is empty
        const stored = localStorage.getItem("spil_permits");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPermits(parsed);
            // Sync local storage data to SQLite
            await fetch(`${basePath}/api/permits`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(parsed)
            });
          }
        }
      } catch (e) {
        console.error("SQLite DB fetch error:", e);
        const stored = localStorage.getItem("spil_permits");
        if (stored) {
          try {
            setPermits(JSON.parse(stored));
          } catch (_) {}
        }
      }
    };

    loadPermits();
  }, []);

  const filteredData = permits.filter(item => {
    const matchSearch = item.pekerjaan.toLowerCase().includes(search.toLowerCase()) || 
                        item.id.toLowerCase().includes(search.toLowerCase()) ||
                        item.namaPemohon.toLowerCase().includes(search.toLowerCase());
    
    const parts = item.tanggal ? item.tanggal.split("-") : [];
    const itemYear = parts[0] || "";
    const itemMonth = parts[1] || "";

    const matchYear = yearFilter === "all" || itemYear === yearFilter;
    const matchMonth = monthFilter === "all" || itemMonth === monthFilter;
    const matchDate = dateFilter ? item.tanggal === dateFilter : true;
    const itemStatus = item.validasi?.status || "Disetujui";
    const matchStatus = statusFilter.length === 0 || statusFilter.some(s => {
      if (s === "Disetujui") return itemStatus.includes("Disetujui") || itemStatus.includes("Diberikan");
      if (s === "Lembur") return itemStatus.includes("Lembur") || item.validasi?.hasLembur === true;
      return itemStatus.toLowerCase().includes(s.toLowerCase());
    });

    return matchSearch && matchYear && matchMonth && matchDate && matchStatus;
  });

  const exportSummaryPDF = (company: "SPIL" | "TPIL" = "TPIL") => {
    const doc = new jsPDF();
    doc.setFontSize(13);
    const companyName = company === "SPIL" ? "PT. SALAM PACIFIC INDONESIA LINES" : "PT. TPIL LOGISTICS";
    doc.text(`${companyName} - REKAPITULASI IJIN KERJA`, 14, 15);
    doc.setFontSize(9);
    doc.text(`Rekapitulasi Dokumen Resmi (${company}) | Tanggal Ekspor: ${new Date().toLocaleDateString('id-ID')}`, 14, 22);
    
    const tableData = filteredData.map(row => [
      row.id, 
      row.tanggal, 
      row.pekerjaan, 
      row.klasifikasi.join(", "), 
      row.namaPemohon, 
      row.validasi?.status === "Diberikan" ? "Disetujui" : (row.validasi?.status || "Disetujui")
    ]);
    
    autoTable(doc, {
      startY: 28,
      head: [['ID Izin', 'Tanggal', 'Pekerjaan', 'Klasifikasi', 'Pemohon', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: company === "SPIL" ? [43, 122, 75] : [0, 59, 115] }
    });
    
    doc.save(`Rekap_Izin_Kerja_${company}.pdf`);
  };

  const exportCSV = () => {
    const headers = ['ID Izin', 'Tanggal', 'Pekerjaan', 'Klasifikasi', 'Pemohon', 'Status'];
    const csvContent = [
      headers.join(","),
      ...filteredData.map(row => `"${row.id}","${row.tanggal}","${row.pekerjaan}","${row.klasifikasi.join("; ")}","${row.namaPemohon}","${row.validasi?.status === 'Diberikan' ? 'Disetujui' : (row.validasi?.status || 'Disetujui')}"`)
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "Rekap_Izin_Kerja_Risiko_Tinggi.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col w-full overflow-x-hidden">
      {/* Top Header Section - Compact Text-Only Header */}
      <div className="bg-gradient-to-r from-[#1E5950] via-[#2B7A4B] to-[#1E5950] text-white pt-5 pb-10 px-4 sm:px-6 rounded-b-2xl shadow-sm w-full border-b border-teal-800">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="min-w-0 flex-1 pr-2">
            <h1 className="text-lg sm:text-xl font-black tracking-tight truncate text-white leading-tight">
              Dashboard E-Permit
            </h1>
            <p className="text-emerald-100/85 text-xs truncate font-medium tracking-wide mt-0.5">
              Selamat Datang, Dedi Prasetyo!
            </p>
          </div>
          <button 
            onClick={() => router.push("/")} 
            className="p-2 sm:px-3 sm:py-2 bg-black/20 hover:bg-black/30 active:scale-95 transition-all rounded-xl shrink-0 flex items-center gap-1.5 text-xs font-bold text-white border border-white/20 shadow-sm cursor-pointer"
            title="Keluar"
          >
            <LogOut className="w-4 h-4 text-white" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 px-4 sm:px-6 -mt-8 max-w-4xl mx-auto w-full space-y-5 pb-24 relative z-10">

        {/* Search Engine & Filter Card - Slim Compact Design */}
        <div className="bg-white p-3 sm:p-3.5 rounded-2xl shadow-xl space-y-2 border border-slate-200">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari Pekerjaan, ID, atau Pemohon..." 
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2B7A4B] text-xs text-slate-900 font-bold placeholder-slate-400"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Filter Dropdowns Grid - Slim 3-column inline */}
          <div className="grid grid-cols-3 gap-1.5 items-center">
            {/* Filter Tahun */}
            <div className="relative">
              <select
                className="w-full text-center px-1.5 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2B7A4B] text-[10px] text-slate-900 font-extrabold appearance-none cursor-pointer truncate"
                value={yearFilter}
                onChange={e => setYearFilter(e.target.value)}
              >
                <option value="all">Thn: Semua</option>
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 text-[8px] font-bold">▼</div>
            </div>

            {/* Filter Bulan */}
            <div className="relative">
              <select
                className="w-full text-center px-1.5 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2B7A4B] text-[10px] text-slate-900 font-extrabold appearance-none cursor-pointer truncate"
                value={monthFilter}
                onChange={e => setMonthFilter(e.target.value)}
              >
                {MONTHS.map(m => (
                  <option key={m.value} value={m.value}>{m.label === "Semua Bulan" ? "Bln: Semua" : m.label}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 text-[8px] font-bold">▼</div>
            </div>

            {/* Filter Tanggal Spesifik */}
            <div className="relative">
              <input 
                type="date" 
                className="w-full text-center px-1 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2B7A4B] text-[10px] text-slate-900 font-extrabold cursor-pointer"
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
              />
            </div>
          </div>

          {/* Status Filters - Direct Single Row Layout */}
          <div className="pt-2 border-t border-slate-100">
            <div className="grid grid-cols-3 gap-1.5 w-full">
              {[
                { id: "Disetujui", label: "Disetujui", count: permits.filter(p => (p.validasi?.status || "Disetujui").includes("Disetujui") || (p.validasi?.status || "").includes("Diberikan")).length, activeClass: "bg-[#2B7A4B] text-white shadow-sm font-black ring-1 ring-[#22633C]", inactiveClass: "bg-slate-100 hover:bg-emerald-50/80 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 font-bold", dot: "bg-white", inactiveDot: "bg-emerald-500" },
                { id: "Lembur", label: "Lembur", count: permits.filter(p => (p.validasi?.status || "").includes("Lembur") || p.validasi?.hasLembur === true).length, activeClass: "bg-amber-500 text-white shadow-sm font-black ring-1 ring-amber-600", inactiveClass: "bg-slate-100 hover:bg-amber-50/80 text-slate-700 hover:text-amber-800 border border-slate-200 hover:border-amber-300 font-bold", dot: "bg-white", inactiveDot: "bg-amber-500" },
                { id: "Dibatalkan", label: "Dibatalkan", count: permits.filter(p => p.validasi?.status === "Dibatalkan").length, activeClass: "bg-red-600 text-white shadow-sm font-black ring-1 ring-red-700", inactiveClass: "bg-slate-100 hover:bg-red-50/80 text-slate-700 hover:text-red-800 border border-slate-200 hover:border-red-300 font-bold", dot: "bg-white", inactiveDot: "bg-red-500" }
              ].map(opt => {
                const isSelected = statusFilter.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      if (isSelected) {
                        setStatusFilter(statusFilter.filter(s => s !== opt.id));
                      } else {
                        setStatusFilter([...statusFilter, opt.id]);
                      }
                    }}
                    className={`w-full px-1 sm:px-2 py-1.5 rounded-lg text-[10px] sm:text-xs flex items-center justify-center gap-1 sm:gap-1.5 transition-all duration-150 cursor-pointer select-none ${isSelected ? opt.activeClass : opt.inactiveClass}`}
                    title={`Klik untuk filter status ${opt.label}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? opt.dot : opt.inactiveDot}`} />
                    <span className="truncate">{opt.label}</span>
                    <span className={`px-1 sm:px-1.5 py-0.5 text-[9px] sm:text-[10px] rounded font-extrabold leading-none shrink-0 ${isSelected ? "bg-white/20 text-white" : "bg-slate-200/80 text-slate-700"}`}>
                      {opt.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reset button if filter active */}
          {(yearFilter !== "all" || monthFilter !== "all" || dateFilter || search || statusFilter.length > 0) && (
            <button 
              onClick={() => {
                setYearFilter("all");
                setMonthFilter("all");
                setDateFilter("");
                setSearch("");
                setStatusFilter([]);
              }} 
              className="w-full py-1 text-center bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-[11px] font-extrabold transition-all border border-red-200 cursor-pointer"
            >
              Reset Semua Filter
            </button>
          )}
        </div>

        {/* Prominent Action Banner - Slim & Modern */}
        <div className="bg-gradient-to-r from-[#174740] via-[#2B7A4B] to-[#143B35] text-white p-3 sm:p-3.5 rounded-2xl shadow-md border border-emerald-500/30">
          {/* Main Action Button */}
          <button 
            onClick={() => {
              router.push('/form');
            }}
            className="w-full py-2.5 sm:py-3 bg-[#2B7A4B] hover:bg-[#22633C] active:scale-[0.98] text-white rounded-xl font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition-all border border-emerald-400/40 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-white" />
            <span>Buat Izin Kerja Baru</span>
          </button>
        </div>

        {/* Audit Filter & Summary Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h3 className="font-extrabold text-slate-800 text-base">Riwayat Surat Izin ({filteredData.length})</h3>
          </div>
          <div className="flex gap-2 shrink-0 items-center">
            <button onClick={exportCSV} className="flex-1 sm:flex-none text-xs flex items-center justify-center gap-1 bg-white border border-slate-200 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 font-bold shadow-sm cursor-pointer">
              <FileDown className="w-4 h-4 text-emerald-600" /> CSV
            </button>
            <div className="flex-1 sm:flex-none relative flex items-center bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-sm hover:border-red-300 transition-all">
              <Download className="w-4 h-4 text-red-500 mr-1 shrink-0" />
              <select
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "SPIL" || val === "TPIL") {
                    exportSummaryPDF(val);
                    e.target.value = "";
                  }
                }}
                defaultValue=""
                className="text-xs font-bold text-slate-700 bg-transparent outline-none cursor-pointer pr-1 py-0.5"
              >
                <option value="" disabled>Rekap PDF ▼</option>
                <option value="SPIL">PDF (SPIL)</option>
                <option value="TPIL">PDF (TPIL)</option>
              </select>
            </div>
          </div>
        </div>

        {/* List of Permits */}
        <div className="space-y-3">
          {filteredData.length > 0 ? (
            filteredData.map((item, index) => (
              <div 
                key={`${item.id}-${index}`} 
                onClick={() => setSelectedPermitForPDF(item)}
                className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all active:scale-[0.99] cursor-pointer border border-slate-200 hover:border-[var(--color-primary)] space-y-3"
              >
                {/* Header row inside card */}
                <div className="flex justify-between items-center border-b border-slate-100 pb-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold ${
                      item.validasi?.status === 'Diberikan' ? 'bg-emerald-100 text-emerald-700' : 
                      item.validasi?.status === 'Lembur' ? 'bg-amber-100 text-amber-700' : 
                      'bg-red-100 text-red-700'
                    }`}>
                      <FileText className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-[var(--color-primary)] font-mono truncate">{item.id}</span>
                    {(Number(item.revisi) || 0) > 0 ? (
                      <span className="text-[10px] font-extrabold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200 whitespace-nowrap shrink-0">
                        Revisi {item.revisi}
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full border border-slate-200 whitespace-nowrap shrink-0">
                        Rev 00
                      </span>
                    )}
                  </div>

                  <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full whitespace-nowrap shrink-0 ${
                    (item.validasi?.status?.includes('Disetujui') || item.validasi?.status?.includes('Diberikan')) && item.validasi?.status?.includes('Lembur') ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                    (item.validasi?.status === 'Disetujui' || item.validasi?.status === 'Diberikan') ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 
                    item.validasi?.status === 'Lembur' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 
                    'bg-red-100 text-red-800 border border-red-200'
                  }`}>
                    {item.validasi?.status === 'Diberikan' ? 'Disetujui' : item.validasi?.status === 'Diberikan & Lembur' ? 'Disetujui & Lembur' : (item.validasi?.status || 'Disetujui')}
                  </span>
                </div>

                {/* Body Content */}
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 text-sm sm:text-base leading-snug">{item.pekerjaan}</h4>
                  
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1 font-medium"><Calendar className="w-3.5 h-3.5 text-slate-400" /> {item.tanggal}</span>
                    <span>•</span>
                    <span>Pemohon: <strong className="text-slate-800">{item.namaPemohon}</strong></span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {item.klasifikasi?.map((k, idx) => (
                      <span key={idx} className="text-[10px] bg-blue-50 text-[var(--color-primary)] border border-blue-100 px-2 py-0.5 rounded-lg font-bold">
                        {k}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Footer Action Buttons - Prominent & High Visibility */}
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(item);
                      setDeleteCountdown(null);
                    }}
                    className="px-3.5 py-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-xl font-extrabold text-xs flex items-center gap-1.5 border border-red-200 shadow-sm active:scale-95 transition-all"
                    title="Hapus Surat Izin"
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" /> Hapus
                  </button>

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/form?editId=${item.id}`);
                    }}
                    className="px-3.5 py-2 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-xl font-extrabold text-xs flex items-center gap-1.5 border border-blue-300 shadow-sm active:scale-95 transition-all"
                    title="Edit Surat Izin"
                  >
                    <Edit3 className="w-3.5 h-3.5 shrink-0" /> Edit
                  </button>

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPermitForPDF(item);
                    }}
                    className="px-4 py-2 bg-[#2B7A4B] hover:bg-[#22633C] text-white rounded-xl font-extrabold text-xs flex items-center gap-1.5 shadow-md hover:shadow-lg active:scale-95 transition-all border border-emerald-700"
                    title="Lihat & Cetak PDF Resmi"
                  >
                    <Printer className="w-3.5 h-3.5 shrink-0 text-white" /> PDF Resmi
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-slate-500 bg-white rounded-2xl border border-dashed border-slate-300">
              <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="font-bold text-slate-700">Tidak ada surat izin ditemukan</p>
              <p className="text-xs text-slate-400 mt-1">Gunakan tombol diatas untuk membuat surat izin baru.</p>
            </div>
          )}
        </div>
      </div>

      {/* Official PDF View Modal */}
      {selectedPermitForPDF && (
        <OfficialPermitDocument 
          data={selectedPermitForPDF} 
          onClose={() => setSelectedPermitForPDF(null)} 
        />
      )}

      {/* Delete Confirmation Modal with 3-second countdown */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            
            {/* Header with Danger Badge */}
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 border border-red-200">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug">
                  Konfirmasi Penghapusan Dokumen
                </h3>
                <p className="text-xs font-semibold text-red-600 mt-0.5">
                  Tindakan ini bersifat permanen
                </p>
              </div>
            </div>

            {/* Target Item Details Card */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1.5 text-xs text-slate-700 font-medium">
              <div className="flex justify-between items-center">
                <span className="font-extrabold text-slate-500">ID Surat Izin:</span>
                <span className="font-mono font-extrabold text-[var(--color-primary)]">{deleteTarget.id}</span>
              </div>
              <div className="flex justify-between items-start gap-2">
                <span className="font-extrabold text-slate-500 shrink-0">Pekerjaan:</span>
                <span className="font-bold text-slate-900 text-right truncate max-w-[200px]">{deleteTarget.pekerjaan}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-extrabold text-slate-500">Pemohon:</span>
                <span className="font-semibold text-slate-800">{deleteTarget.namaPemohon}</span>
              </div>
            </div>

            {/* Warning Message */}
            <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
              Apakah Anda yakin ingin menghapus arsip surat izin kerja ini dari riwayat sistem? Data yang telah dihapus tidak dapat dipulihkan kembali.
            </p>

            {/* Countdown Progress Bar */}
            {deleteCountdown !== null && (
              <div className="space-y-1.5">
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                  <div 
                    className="bg-red-600 h-full transition-all duration-1000 ease-linear rounded-full"
                    style={{ width: `${((deleteCountdown + 1) / 3) * 100}%` }}
                  />
                </div>
                <p className="text-[11px] text-center text-red-600 font-bold animate-pulse">
                  Menghapus otomatis dalam {deleteCountdown} detik...
                </p>
              </div>
            )}

            {/* Modal Buttons */}
            <div className="flex gap-2.5 pt-1">
              <button
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteCountdown(null);
                }}
                className={`flex-1 py-3 rounded-2xl font-extrabold text-xs sm:text-sm transition-all border shadow-sm active:scale-95 ${
                  deleteCountdown !== null
                    ? "bg-slate-900 text-white hover:bg-slate-800 border-slate-900 ring-2 ring-slate-400"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300"
                }`}
              >
                {deleteCountdown !== null ? `Batalkan Hapus (${deleteCountdown}s)` : "Batal"}
              </button>

              <button
                onClick={() => {
                  if (deleteCountdown === null) {
                    setDeleteCountdown(3);
                  }
                }}
                disabled={deleteCountdown !== null}
                className={`flex-1 py-3 text-white rounded-2xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md transition-all border ${
                  deleteCountdown !== null 
                    ? "bg-red-700 border-red-800 cursor-wait opacity-90" 
                    : "bg-red-600 hover:bg-red-700 border-red-700 active:scale-95"
                }`}
              >
                {deleteCountdown !== null ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 shrink-0" />
                    <span>Ya, Hapus Dokumen</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
