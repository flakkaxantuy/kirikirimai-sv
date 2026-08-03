"use client";

import React, { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SignatureCanvas from "react-signature-canvas";
import { ChevronLeft, ChevronRight, Save, Plus, Trash2, CheckCircle2, ShieldAlert, ArrowLeft, AlertTriangle, PenTool, Check, X, FileText } from "lucide-react";
import OfficialPermitDocument, { PermitData } from "@/components/OfficialPermitDocument";

const STEPS = ["Dokumen", "Klasifikasi", "Informasi", "Perlengkapan", "Keselamatan", "Peralatan", "Validasi"];

const DEFAULT_PEKERJA_TYPES = [
  "Engineer", "Surveyor", "Operator Alat Berat", "Teknisi Elektrik",
  "Mekanik", "Welder", "Fitter", "Helper", "Painter", "Lainnya"
];

function FormWizardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("editId");

  const [currentStep, setCurrentStep] = useState(0);
  const [showOfficialPDF, setShowOfficialPDF] = useState(false);
  const [submittedData, setSubmittedData] = useState<PermitData | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [invalidFields, setInvalidFields] = useState<string[]>([]);
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  const DEFAULT_INITIAL_DATE = "2026-04-10";

  const getInitialHeaderDate = () => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("spil_last_header_date");
        if (saved && saved.trim()) return saved;
        const permitsStr = localStorage.getItem("spil_permits");
        if (permitsStr) {
          const permits: PermitData[] = JSON.parse(permitsStr);
          if (permits.length > 0 && permits[0].tanggal) {
            return permits[0].tanggal;
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
    return DEFAULT_INITIAL_DATE;
  };

  const getTodayYYYYMMDD = () => {
    return getInitialHeaderDate();
  };

  // State for Step 0 (Header Dokumen)
  const [headerDoc, setHeaderDoc] = useState(() => ({
    noDok: "FK3-SPIL-08-01",
    nomorSurat: "",
    revisi: "00",
    tanggalDoc: getInitialHeaderDate(),
    hal: "1 dari 1"
  }));

  // State for Step A (Klasifikasi)
  const [klasifikasi, setKlasifikasi] = useState<string[]>([]);
  const klasifikasiOptions = ["Kerja Panas", "Kerja Dingin", "Kerja Listrik", "Ketinggian", "Alat Berat", "Radiografi", "Ruang Terbatas", "Galian"];

  // State for Step B
  const [info, setInfo] = useState({
    pekerjaan: "",
    lokasi: "",
    area: "",
    namaManager: "",
    telpManager: "",
    namaPemohon: "",
    telpPemohon: "",
    namaPengawas: "",
    telpPengawas: "",
    namaPetugasK3: "",
    telpPetugasK3: ""
  });
  
  // Pre-loaded Pekerja List with 0 defaults
  const [pekerjaList, setPekerjaList] = useState<{ jenis: string; jumlah: string }[]>(
    DEFAULT_PEKERJA_TYPES.map(jenis => ({ jenis, jumlah: "0" }))
  );

  // State for Step C
  const [perlengkapan, setPerlengkapan] = useState([{ jenis: "Alat", nama: "", jumlah: "1" }]);
  const newPerlengkapanInputRef = useRef<HTMLInputElement | null>(null);
  const [shouldFocusNewPerlengkapan, setShouldFocusNewPerlengkapan] = useState(false);

  // State for Step D
  const [keselamatan, setKeselamatan] = useState([{ aktivitas: "", potensi: "", langkah: "" }]);
  const newKeselamatanInputRef = useRef<HTMLInputElement | null>(null);
  const [shouldFocusNewKeselamatan, setShouldFocusNewKeselamatan] = useState(false);

  // State for Step E
  const [apd, setApd] = useState<string[]>([]);
  const [apdLainnyaText, setApdLainnyaText] = useState("");
  const apdOptions = ["Safety Helmet", "Penutup Rambut", "Kacamata", "Kap Las", "Earplug", "Earmuff", "Masker Kain", "Respirator", "Sarung Tangan Kain", "Sarung Tangan Karet", "Sarung Tangan Kulit", "Sarung Tangan Kombinasi", "Body harness", "Sepatu Safety", "Sepatu Safety Boot", "Sepatu Safety Karet", "Apron", "Rompi", "Jas Hujan", "Katelpak", "Lainnya"];
  const [darurat, setDarurat] = useState<string[]>([]);
  const [daruratLainnyaText, setDaruratLainnyaText] = useState("");
  const daruratOptions = [
    "Pemadam Api (APAR, Karung Goni)",
    "Barikade (Garis tanda Bahaya)",
    "Rambu (Tanda Keselamatan)",
    "LOTO (Lock Out Tag Out)",
    "Radio Telekomunikasi (HT)",
    "Jaring / Tali Keselamatan",
    "Lainnya"
  ];

  // State for Step F
  const [validasi, setValidasi] = useState({ 
    tanggal: getTodayYYYYMMDD(), 
    mulai: "08:00", 
    sampai: "17:00", 
    keterangan: "Disetujui", 
    catatan: "",
    hasLembur: false,
    lemburMulai: "17:00",
    lemburSampai: "21:00",
    lemburTanggal: getTodayYYYYMMDD()
  });
  
  // Signature States (Stored Base64 Strings)
  const [sigPemohon, setSigPemohon] = useState<string>("");
  const [sigK3, setSigK3] = useState<string>("");
  const [sigManager, setSigManager] = useState<string>("");

  // Signature Modal Control
  const [activeSigModal, setActiveSigModal] = useState<"pemohon" | "k3" | "manager" | null>(null);
  const modalCanvasRef = useRef<SignatureCanvas>(null);

  // Draft Prompt Modal State
  const [showDraftModal, setShowDraftModal] = useState<boolean>(false);
  const [pendingDraft, setPendingDraft] = useState<any>(null);

  // Auto scroll and focus for newly added Perlengkapan item
  useEffect(() => {
    if (shouldFocusNewPerlengkapan && newPerlengkapanInputRef.current) {
      newPerlengkapanInputRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      newPerlengkapanInputRef.current.focus();
      setShouldFocusNewPerlengkapan(false);
    }
  }, [perlengkapan.length, shouldFocusNewPerlengkapan]);

  const handleAddPerlengkapan = (jenisCategory: string = "Alat") => {
    setPerlengkapan(prev => [...prev, { jenis: jenisCategory, nama: "", jumlah: "1" }]);
    setShouldFocusNewPerlengkapan(true);
  };

  // Auto scroll and focus for newly added Keselamatan JSA activity
  useEffect(() => {
    if (shouldFocusNewKeselamatan && newKeselamatanInputRef.current) {
      newKeselamatanInputRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      newKeselamatanInputRef.current.focus();
      setShouldFocusNewKeselamatan(false);
    }
  }, [keselamatan.length, shouldFocusNewKeselamatan]);

  const handleAddKeselamatan = () => {
    setKeselamatan(prev => [...prev, { aktivitas: "", potensi: "", langkah: "" }]);
    setShouldFocusNewKeselamatan(true);
  };

  // Load Edit Data if editId is provided
  useEffect(() => {
    if (editId) {
      try {
        const stored = localStorage.getItem("spil_permits");
        if (stored) {
          const permits: PermitData[] = JSON.parse(stored);
          const target = permits.find(p => p.id === editId);
          if (target) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setIsEditingMode(true);
            setHeaderDoc({
              noDok: target.noDok || "FK3-SPIL-08-01",
              nomorSurat: target.nomorSurat || target.id || "",
              revisi: target.revisi !== undefined ? String(target.revisi).padStart(2, "0") : "00",
              tanggalDoc: target.tanggal || getTodayYYYYMMDD(),
              hal: target.hal || "1 dari 1"
            });
            if (target.klasifikasi) setKlasifikasi(target.klasifikasi);
            setInfo({
              pekerjaan: target.pekerjaan || "",
              lokasi: target.lokasi || "",
              area: target.area || "",
              namaManager: target.namaManager || "",
              telpManager: target.telpManager || "",
              namaPemohon: target.namaPemohon || "",
              telpPemohon: target.telpPemohon || "",
              namaPengawas: target.pengawas || "",
              telpPengawas: target.telpPengawas || "",
              namaPetugasK3: target.petugasK3 || "",
              telpPetugasK3: target.telpK3 || ""
            });

            if (target.pekerjaList) {
              const mappedPekerja = DEFAULT_PEKERJA_TYPES.map(jenis => {
                const found = target.pekerjaList.find(p => p.jenis.toLowerCase() === jenis.toLowerCase());
                return { jenis, jumlah: found ? found.jumlah : "0" };
              });
              setPekerjaList(mappedPekerja);
            }

            if (target.perlengkapan && target.perlengkapan.length > 0) setPerlengkapan(target.perlengkapan);
            if (target.keselamatan && target.keselamatan.length > 0) setKeselamatan(target.keselamatan);
            if (target.apd) setApd(target.apd);
            if (target.darurat) setDarurat(target.darurat);
            if (target.validasi) {
              const statusVal = target.validasi.status || "Disetujui";
              setValidasi({
                tanggal: target.validasi.tanggal || target.tanggal || getTodayYYYYMMDD(),
                mulai: target.validasi.mulai || "08:00",
                sampai: target.validasi.sampai || "17:00",
                keterangan: statusVal === "Diberikan" ? "Disetujui" : statusVal === "Diberikan & Lembur" ? "Disetujui & Lembur" : statusVal,
                catatan: target.validasi.catatan || "",
                hasLembur: target.validasi.hasLembur || statusVal.includes("Lembur") && (statusVal.includes("Disetujui") || statusVal.includes("Diberikan")),
                lemburMulai: target.validasi.lemburMulai || "17:00",
                lemburSampai: target.validasi.lemburSampai || "21:00",
                lemburTanggal: target.validasi.lemburTanggal || target.validasi.tanggal || target.tanggal || getTodayYYYYMMDD()
              });
            }
            if (target.signatures) {
              if (target.signatures.pemohon) setSigPemohon(target.signatures.pemohon);
              if (target.signatures.k3) setSigK3(target.signatures.k3);
              if (target.signatures.manager) setSigManager(target.signatures.manager);
            }
            return;
          }
        }
      } catch (e) {
        console.error("Gagal memuat data edit", e);
      }
    }

    // Check draft from localStorage if not editing
    try {
      const savedDate = localStorage.getItem("spil_last_header_date");
      let latestPermitDate = "";
      try {
        const permitsStr = localStorage.getItem("spil_permits");
        if (permitsStr) {
          const permits: PermitData[] = JSON.parse(permitsStr);
          if (permits.length > 0 && permits[0].tanggal) {
            latestPermitDate = permits[0].tanggal;
          }
        }
      } catch (e) {
        console.error(e);
      }

      const activeLastDate = savedDate || latestPermitDate || DEFAULT_INITIAL_DATE;

      const draft = localStorage.getItem("spil_form_draft");
      if (draft && !editId) {
        const parsed = JSON.parse(draft);
        const hasContent = 
          (parsed.klasifikasi && parsed.klasifikasi.length > 0) ||
          (parsed.info && (parsed.info.pekerjaan || parsed.info.namaPemohon || parsed.info.lokasi)) ||
          (parsed.keselamatan && parsed.keselamatan.length > 0 && parsed.keselamatan[0].aktivitas);

        if (hasContent) {
          setPendingDraft(parsed);
          setShowDraftModal(true);
        } else {
          setHeaderDoc(prev => ({ ...prev, tanggalDoc: activeLastDate }));
        }
      } else if (!editId) {
        setHeaderDoc(prev => ({ ...prev, tanggalDoc: activeLastDate }));
      }
    } catch (e) {
      console.error("Gagal membaca draft form", e);
    }
  }, [editId]);

  const applyDraft = (parsed: any) => {
    if (!parsed) return;
    const savedDate = localStorage.getItem("spil_last_header_date");
    const activeLastDate = savedDate || DEFAULT_INITIAL_DATE;

    if (parsed.headerDoc) {
      setHeaderDoc({
        ...parsed.headerDoc,
        nomorSurat: parsed.headerDoc.nomorSurat || "",
        tanggalDoc: activeLastDate || parsed.headerDoc.tanggalDoc || DEFAULT_INITIAL_DATE
      });
    }
    if (parsed.klasifikasi) setKlasifikasi(parsed.klasifikasi);
    if (parsed.info) setInfo(parsed.info);
    if (parsed.pekerjaList && parsed.pekerjaList.length > 0) {
      const mappedPekerja = DEFAULT_PEKERJA_TYPES.map(jenis => {
        const found = parsed.pekerjaList.find((p: { jenis: string; jumlah: string }) => p.jenis.toLowerCase() === jenis.toLowerCase());
        return { jenis, jumlah: found ? found.jumlah : "0" };
      });
      setPekerjaList(mappedPekerja);
    }
    if (parsed.perlengkapan && parsed.perlengkapan.length > 0) setPerlengkapan(parsed.perlengkapan);
    if (parsed.keselamatan && parsed.keselamatan.length > 0) setKeselamatan(parsed.keselamatan);
    if (parsed.apd) setApd(parsed.apd);
    if (parsed.darurat) setDarurat(parsed.darurat);
    if (parsed.validasi) setValidasi(parsed.validasi);
    if (parsed.sigPemohon) setSigPemohon(parsed.sigPemohon);
    if (parsed.sigK3) setSigK3(parsed.sigK3);
    if (parsed.sigManager) setSigManager(parsed.sigManager);
    setHasRestoredDraft(true);
    setShowDraftModal(false);
  };

  const handleStartFresh = () => {
    try {
      localStorage.removeItem("spil_form_draft");
    } catch (e) {}
    setShowDraftModal(false);
  };

  // Save draft to localStorage on changes (when not editing an existing record)
  useEffect(() => {
    if (isEditingMode) return;
    const draftData = {
      headerDoc,
      klasifikasi,
      info,
      pekerjaList,
      perlengkapan,
      keselamatan,
      apd,
      darurat,
      validasi,
      sigPemohon,
      sigK3,
      sigManager
    };
    try {
      localStorage.setItem("spil_form_draft", JSON.stringify(draftData));
    } catch (e) {
      console.error(e);
    }
  }, [headerDoc, klasifikasi, info, pekerjaList, perlengkapan, keselamatan, apd, darurat, validasi, sigPemohon, sigK3, sigManager, isEditingMode]);

  const toggleArray = (arr: string[], setArr: React.Dispatch<React.SetStateAction<string[]>>, val: string) => {
    if (arr.includes(val)) setArr(arr.filter(i => i !== val));
    else setArr([...arr, val]);
  };

  // Validate a specific step index and return missing field keys
  const validateStep = useCallback((stepIdx: number): { valid: boolean; errorMsg?: string; missingFields: string[] } => {
    const missing: string[] = [];

    if (stepIdx === 0) {
      if (!headerDoc.noDok.trim()) missing.push("noDok");
      if (!headerDoc.revisi.trim()) missing.push("revisi");
      if (!headerDoc.tanggalDoc.trim()) missing.push("tanggalDoc");
      if (!headerDoc.hal.trim()) missing.push("hal");
      
      let duplicateError = "";
      if (headerDoc.nomorSurat.trim()) {
        try {
          const existingStr = localStorage.getItem("spil_permits");
          if (existingStr) {
            const existing: PermitData[] = JSON.parse(existingStr);
            const isDuplicate = existing.some(p => p.nomorSurat === headerDoc.nomorSurat.trim() && p.id !== editId);
            if (isDuplicate) {
              missing.push("nomorSurat");
              duplicateError = `Nomor Surat Izin "${headerDoc.nomorSurat.trim()}" sudah ada. Silakan gunakan nomor lain.`;
            }
          }
        } catch (e) {
          console.error(e);
        }
      }

      if (missing.length > 0) {
        return { valid: false, errorMsg: duplicateError || "Harap isi semua informasi Header Dokumen (No. Dok, Revisi, Tanggal, dan Hal).", missingFields: missing };
      }
    } else if (stepIdx === 1) {
      if (klasifikasi.length === 0) {
        missing.push("klasifikasi");
        return { valid: false, errorMsg: "Klasifikasi Pekerjaan wajib dipilih (pilih minimal 1 kategori risiko).", missingFields: missing };
      }
    } else if (stepIdx === 2) {
      if (!info.pekerjaan.trim()) missing.push("pekerjaan");
      if (!info.lokasi.trim()) missing.push("lokasi");
      if (!info.area.trim()) missing.push("area");
      if (!info.namaPemohon.trim()) missing.push("namaPemohon");
      if (!info.namaManager.trim()) missing.push("namaManager");
      if (!info.namaPetugasK3.trim()) missing.push("namaPetugasK3");
      
      const totalPekerja = pekerjaList.reduce((sum, p) => sum + (parseInt(p.jumlah) || 0), 0);
      if (totalPekerja === 0) missing.push("pekerjaList");

      if (missing.length > 0) {
        return { valid: false, errorMsg: "Harap lengkapi semua kolom bertanda bintang (*) di Informasi Pekerjaan & isi minimal 1 pekerja (>0).", missingFields: missing };
      }
    } else if (stepIdx === 3) {
      const hasEmptyItem = perlengkapan.some(p => !p.nama.trim() || !p.jumlah.trim() || parseInt(p.jumlah) <= 0);
      if (perlengkapan.length === 0 || hasEmptyItem) {
        missing.push("perlengkapan");
        return { 
          valid: false, 
          errorMsg: "Harap isi Nama Item & Jumlah pada seluruh perlengkapan kerja yang ditambahkan sebelum melanjutkan!", 
          missingFields: missing 
        };
      }
    } else if (stepIdx === 4) {
      if (!keselamatan.some(k => k.aktivitas.trim() !== "" && k.potensi.trim() !== "" && k.langkah.trim() !== "")) {
        missing.push("keselamatan");
        return { valid: false, errorMsg: "Keselamatan Kerja (JSA) wajib diisi (lengkapi Aktivitas, Potensi Bahaya, & Langkah Aman).", missingFields: missing };
      }
    } else if (stepIdx === 5) {
      if (apd.length === 0) {
        missing.push("apd");
        return { valid: false, errorMsg: "Peralatan Keselamatan (APD) wajib dipilih minimal 1 item.", missingFields: missing };
      }
    } else if (stepIdx === 6) {
      if (!sigPemohon) missing.push("sigPemohon");
      if (!sigK3) missing.push("sigK3");
      if (missing.length > 0) {
        return { valid: false, errorMsg: "Tanda Tangan Digital Pemohon & Petugas K3 wajib diisi melalui modal pop-up.", missingFields: missing };
      }
    }
    return { valid: true, missingFields: [] };
  }, [headerDoc, klasifikasi, info, pekerjaList, perlengkapan, keselamatan, apd, sigPemohon, sigK3]);

  // Navigate to target step with strict validation check & auto-scroll to top
  const navigateToStep = (targetStep: number) => {
    setValidationError(null);

    // Check all steps up to targetStep
    if (targetStep > currentStep) {
      for (let i = 0; i < targetStep; i++) {
        const check = validateStep(i);
        if (!check.valid) {
          setValidationError(check.errorMsg || "Harap lengkapi bidang formulir terlebih dahulu.");
          setInvalidFields(check.missingFields);
          setCurrentStep(i); // Redirect to the earliest incomplete step
          window.scrollTo({ top: 0, behavior: "smooth" }); // Scroll to top for visibility
          return;
        }
      }
    }

    setInvalidFields([]);
    setCurrentStep(targetStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleNext = () => {
    const check = validateStep(currentStep);
    if (!check.valid) {
      setValidationError(check.errorMsg || "Lengkapi bidang wajib sebelum melanjutkan.");
      setInvalidFields(check.missingFields);
      window.scrollTo({ top: 0, behavior: "smooth" }); // Auto-scroll to top error banner
      return;
    }
    setValidationError(null);
    setInvalidFields([]);
    setCurrentStep(prev => Math.min(STEPS.length - 1, prev + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBack = () => {
    setValidationError(null);
    setInvalidFields([]);
    setCurrentStep(prev => Math.max(0, prev - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Save Signature from Modal Canvas
  const saveSignatureFromModal = () => {
    if (!modalCanvasRef.current || modalCanvasRef.current.isEmpty()) {
      alert("Tolong goreskan tanda tangan pada area canvas terlebih dahulu.");
      return;
    }
    const dataUrl = modalCanvasRef.current.toDataURL();
    if (activeSigModal === "pemohon") setSigPemohon(dataUrl);
    else if (activeSigModal === "k3") setSigK3(dataUrl);
    else if (activeSigModal === "manager") setSigManager(dataUrl);

    setActiveSigModal(null);
    setValidationError(null);
    setInvalidFields(prev => prev.filter(f => f !== `sig${activeSigModal}`));
  };

  const submitForm = () => {
    // Validate step 0 first for duplicate Nomor Surat check
    const check0 = validateStep(0);
    if (!check0.valid) {
      setValidationError(check0.errorMsg || "Terdapat kesalahan pada Langkah 0: Dokumen.");
      setInvalidFields(check0.missingFields);
      setCurrentStep(0);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // Validate current step (Step 6 - Validasi)
    const check = validateStep(6);
    if (!check.valid) {
      setValidationError(check.errorMsg || "Harap lengkapi tanda tangan digital.");
      setInvalidFields(check.missingFields);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    let existing: PermitData[] = [];
    try {
      existing = JSON.parse(localStorage.getItem("spil_permits") || "[]");
    } catch (e) {
      console.error(e);
    }

    // Header document date comes strictly from Form Step 0 (headerDoc.tanggalDoc)
    const docHeaderDate = headerDoc.tanggalDoc || getTodayYYYYMMDD();
    // Validation execution date comes from Form Step 6 / F (validasi.tanggal)
    const valExecDate = validasi.tanggal || docHeaderDate;
    const currentYear = valExecDate.split("-")[0] || new Date().getFullYear().toString();

    // When in Edit Mode (editId exists), strictly lock and preserve original permitNumber
    let permitNumber = headerDoc.nomorSurat || editId || "";

    if (!permitNumber) {
      let maxSeq = 0;
      existing.forEach(p => {
        const pDate = p.validasi?.tanggal || p.tanggal || "";
        const pYear = pDate ? pDate.split("-")[0] : (p.nomorSurat?.split("/").pop() || p.id?.split("/").pop() || currentYear);
        if (pYear === currentYear) {
          const match = (p.nomorSurat || p.id || "").match(/^(\d+)\/IK\/HSE/i);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxSeq) maxSeq = num;
          }
        }
      });
      const nextSeq = String(maxSeq + 1).padStart(3, "0");
      permitNumber = `${nextSeq}/IK/HSE/${currentYear}`;
    }

    const fullPermit: PermitData = {
      id: permitNumber,
      nomorSurat: permitNumber,
      noDok: headerDoc.noDok,
      revisi: headerDoc.revisi,
      tanggal: docHeaderDate, // Fixed header date from Step 0
      hal: headerDoc.hal,
      pekerjaan: info.pekerjaan,
      lokasi: info.lokasi,
      area: info.area,
      namaManager: info.namaManager,
      telpManager: info.telpManager || "-",
      namaPemohon: info.namaPemohon,
      telpPemohon: info.telpPemohon || "-",
      pengawas: info.namaPengawas || info.namaPemohon,
      telpPengawas: info.telpPengawas || "-",
      petugasK3: info.namaPetugasK3,
      telpK3: info.telpPetugasK3 || "-",
      klasifikasi,
      pekerjaList: pekerjaList.filter(p => parseInt(p.jumlah) > 0),
      perlengkapan: perlengkapan.filter(p => p.nama),
      keselamatan: keselamatan.filter(k => k.aktivitas),
      apd,
      darurat,
      validasi: {
        status: validasi.keterangan || "Disetujui",
        mulai: validasi.mulai,
        sampai: validasi.sampai,
        catatan: validasi.catatan,
        tanggal: validasi.tanggal,
        hasLembur: validasi.hasLembur || validasi.keterangan === "Disetujui & Lembur" || validasi.keterangan === "Diberikan & Lembur",
        lemburMulai: validasi.lemburMulai,
        lemburSampai: validasi.lemburSampai,
        lemburTanggal: validasi.lemburTanggal || validasi.tanggal
      },
      signatures: {
        pemohon: sigPemohon,
        k3: sigK3,
        manager: sigManager
      }
    };

    // Save or update in localStorage and SQLite DB
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
      if (isEditingMode && editId) {
        const updatedList = existing.map(p => p.id === editId ? fullPermit : p);
        localStorage.setItem("spil_permits", JSON.stringify(updatedList));

        if (editId !== permitNumber) {
          fetch(`${basePath}/api/permits?id=${encodeURIComponent(editId)}`, { method: "DELETE" })
            .catch(err => console.error("Gagal hapus id lama dari DB:", err));
        }
      } else {
        localStorage.setItem("spil_permits", JSON.stringify([fullPermit, ...existing]));
      }
      localStorage.removeItem("spil_form_draft");

      // Save directly to SQLite Database
      fetch(`${basePath}/api/permits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fullPermit)
      }).catch(err => console.error("Gagal simpan ke SQLite DB:", err));
    } catch (e) {
      console.error(e);
    }

    setSubmittedData(fullPermit);
    setShowOfficialPDF(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-28">
      {/* Header & Stepper */}
      <div className="bg-white shadow-sm sticky top-0 z-40 pt-3.5 pb-2.5 px-4 border-b border-slate-200">
        <div className="relative flex items-center justify-center mb-2.5">
          <button 
            onClick={() => setShowExitConfirm(true)} 
            className="absolute left-0 p-1 text-slate-700 hover:text-slate-950 flex items-center gap-1 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 text-[#2B7A4B]" /> 
            <span className="hidden xs:inline">Dashboard</span>
          </button>
          <div className="text-center px-8 flex flex-col items-center">
            <div className="flex items-center gap-1.5 justify-center">
              <h1 className="font-extrabold text-sm sm:text-base text-[#2B7A4B] leading-tight">
                {isEditingMode ? "Edit Surat Izin" : "Form Surat Izin Kerja (SIK)"}
              </h1>
              {!isEditingMode && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-[#2B7A4B] rounded-full text-[10px] font-bold border border-emerald-200">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                  Draft Otomatis
                </span>
              )}
            </div>
            <span className="text-[11px] sm:text-xs text-[#2B7A4B] font-mono font-extrabold leading-tight mt-0.5">
              {isEditingMode ? `(${headerDoc.nomorSurat || editId})` : (headerDoc.noDok || "FK3-TPIL-08-01")}
            </span>
          </div>
        </div>
        
        {/* Progress Bar Stepper */}
        <div className="flex justify-between items-center relative mb-2 max-w-xl mx-auto px-2">
          <div className="absolute top-1/2 left-0 right-0 h-1.5 bg-slate-200 -translate-y-1/2 z-0 rounded-full"></div>
          <div className="absolute top-1/2 left-0 h-1.5 bg-[#2B7A4B] -translate-y-1/2 z-0 rounded-full transition-all duration-300" style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}></div>
          
          {STEPS.map((step, idx) => (
            <div key={idx} className="relative z-10 flex flex-col items-center">
              <button 
                onClick={() => navigateToStep(idx)}
                className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs sm:text-sm font-extrabold transition-all shadow-sm ${idx <= currentStep ? 'bg-[#2B7A4B] text-white scale-105 ring-2 ring-emerald-200' : 'bg-white text-slate-400 border-2 border-slate-300'}`}
                title={step}
              >
                {idx < currentStep ? <CheckCircle2 className="w-5 h-5 text-white" /> : idx}
              </button>
            </div>
          ))}
        </div>
        <div className="text-center text-xs sm:text-sm font-extrabold text-[#2B7A4B] tracking-wide">
          Langkah {currentStep} dari {STEPS.length - 1}: <span className="text-[#2B7A4B]">{STEPS[currentStep].toUpperCase()}</span>
        </div>
      </div>

      {/* Validation Error Toast Alert */}
      {validationError && (
        <div className="bg-red-600 text-white p-4 mx-4 mt-4 rounded-2xl shadow-xl flex items-start gap-3 max-w-2xl sm:mx-auto animate-in slide-in-from-top-2 border-2 border-red-700">
          <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm sm:text-base font-bold leading-snug">
            {validationError}
          </div>
          <button onClick={() => setValidationError(null)} className="text-white/90 hover:text-white text-base font-extrabold px-1">
            ✕
          </button>
        </div>
      )}

      {/* Restored Draft Notice Banner */}
      {hasRestoredDraft && !isEditingMode && (
        <div className="bg-emerald-50 border border-emerald-300 text-[#174740] p-3 mx-4 mt-3 rounded-2xl shadow-sm flex items-center justify-between gap-2 max-w-2xl sm:mx-auto text-xs animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2 font-bold min-w-0">
            <CheckCircle2 className="w-4.5 h-4.5 text-[#2B7A4B] shrink-0" />
            <span className="truncate">Draft isian Anda sebelumnya dimuat otomatis</span>
          </div>
          <button 
            onClick={() => {
              try {
                localStorage.removeItem("spil_form_draft");
              } catch (e) {
                console.error(e);
              }
              window.location.reload();
            }}
            className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-[#2B7A4B] border border-emerald-300 rounded-xl text-[11px] font-extrabold transition-all shrink-0 cursor-pointer shadow-xs"
          >
            Reset Form
          </button>
        </div>
      )}
      <div className="flex-1 p-4 max-w-2xl mx-auto w-full space-y-6">
        {/* STEP 0: Header Dokumen */}
        {currentStep === 0 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
              <FileText className="w-7 h-7 text-[#2B7A4B] shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-base text-[#2B7A4B]">Informasi Header Dokumen Resmi</h3>
                <p className="text-sm text-slate-600 mt-0.5">Lengkapi atribut header dokumen Surat Izin Kerja (SIK) sebelum memilih Klasifikasi Pekerjaan.</p>
              </div>
            </div>

            <div className="card space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-800 flex items-center justify-between">
                  <span>No. Dok <span className="text-red-500">*</span></span>
                </label>
                <input 
                  type="text" 
                  className={`input-field py-3 text-base ${invalidFields.includes("noDok") ? "border-2 border-red-500 ring-2 ring-red-200 bg-red-50/30" : ""}`} 
                  value={headerDoc.noDok} 
                  onChange={e => {
                    setHeaderDoc({ ...headerDoc, noDok: e.target.value });
                    if (invalidFields.includes("noDok")) setInvalidFields(invalidFields.filter(f => f !== "noDok"));
                  }}
                  placeholder="FK3-SPIL-08-01" 
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-800 flex items-center justify-between">
                  <span>Nomor Surat Izin</span>
                </label>
                <input 
                  type="text" 
                  className={`input-field py-3 text-base`} 
                  value={headerDoc.nomorSurat} 
                  onChange={e => {
                    setHeaderDoc({ ...headerDoc, nomorSurat: e.target.value });
                  }}
                  placeholder="001/IK/HSE/2026" 
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-800">Revisi <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    className={`input-field py-3 text-base ${invalidFields.includes("revisi") ? "border-2 border-red-500 ring-2 ring-red-200 bg-red-50/30" : ""}`} 
                    value={headerDoc.revisi} 
                    onChange={e => {
                      setHeaderDoc({ ...headerDoc, revisi: e.target.value });
                      if (invalidFields.includes("revisi")) setInvalidFields(invalidFields.filter(f => f !== "revisi"));
                    }} 
                    placeholder="00" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-800">Tanggal <span className="text-red-500">*</span></label>
                  <input 
                    type="date" 
                    className={`input-field py-3 text-base ${invalidFields.includes("tanggalDoc") ? "border-2 border-red-500 ring-2 ring-red-200 bg-red-50/30" : ""}`} 
                    value={headerDoc.tanggalDoc} 
                    onChange={e => {
                      const newDate = e.target.value;
                      setHeaderDoc({ ...headerDoc, tanggalDoc: newDate });
                      setValidasi(prev => ({ ...prev, tanggal: newDate }));
                      if (newDate) {
                        try {
                          localStorage.setItem("spil_last_header_date", newDate);
                        } catch (err) {
                          console.error(err);
                        }
                      }
                      if (invalidFields.includes("tanggalDoc")) setInvalidFields(invalidFields.filter(f => f !== "tanggalDoc"));
                    }} 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-800">Hal <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    className={`input-field py-3 text-base ${invalidFields.includes("hal") ? "border-2 border-red-500 ring-2 ring-red-200 bg-red-50/30" : ""}`} 
                    value={headerDoc.hal} 
                    onChange={e => {
                      setHeaderDoc({ ...headerDoc, hal: e.target.value });
                      if (invalidFields.includes("hal")) setInvalidFields(invalidFields.filter(f => f !== "hal"));
                    }} 
                    placeholder="1 dari 1" 
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 1: Klasifikasi */}
        {currentStep === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <div className={`p-4 rounded-2xl flex items-start gap-3 transition-all ${invalidFields.includes("klasifikasi") ? "bg-red-50 border-2 border-red-500 shadow-md" : "bg-blue-50 border border-blue-200"}`}>
              <ShieldAlert className={`w-7 h-7 shrink-0 mt-0.5 ${invalidFields.includes("klasifikasi") ? "text-red-600" : "text-[var(--color-primary)]"}`} />
              <div>
                <h3 className={`font-bold text-base ${invalidFields.includes("klasifikasi") ? "text-red-700" : "text-[var(--color-primary)]"}`}>A. Klasifikasi Pekerjaan Risiko Tinggi <span className="text-red-500">*</span></h3>
                <p className="text-sm text-slate-600 mt-0.5">Pilih semua opsi kategori risiko pekerjaan yang berlaku (minimal 1).</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {klasifikasiOptions.map(opt => (
                <label key={opt} className={`flex items-center p-4 border-2 rounded-2xl cursor-pointer transition-all ${klasifikasi.includes(opt) ? 'border-[var(--color-primary)] bg-blue-50/50 shadow-md' : invalidFields.includes("klasifikasi") ? 'border-red-400 bg-red-50/20' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                  <input type="checkbox" className="w-6 h-6 text-[var(--color-primary)] rounded mr-3" checked={klasifikasi.includes(opt)} onChange={() => toggleArray(klasifikasi, setKlasifikasi, opt)} />
                  <span className="font-bold text-slate-900 text-base">{opt}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xl font-extrabold text-slate-900">B. Informasi Pekerjaan & Personil</h2>
            
            <div className="card space-y-4">
              <h3 className="font-extrabold text-base text-[var(--color-primary)] border-b pb-2">Detail Lokasi & Pekerjaan</h3>
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-800">Pekerjaan <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  className={`input-field py-3 text-base ${invalidFields.includes("pekerjaan") ? "border-2 border-red-500 ring-2 ring-red-200 bg-red-50/30" : ""}`} 
                  value={info.pekerjaan} 
                  onChange={e => {
                    setInfo({...info, pekerjaan: e.target.value});
                    if (invalidFields.includes("pekerjaan")) setInvalidFields(invalidFields.filter(f => f !== "pekerjaan"));
                  }} 
                  placeholder="Contoh: Pengelasan Pipa Utama..." 
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-800">Lokasi <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    className={`input-field py-3 text-base ${invalidFields.includes("lokasi") ? "border-2 border-red-500 ring-2 ring-red-200 bg-red-50/30" : ""}`} 
                    value={info.lokasi} 
                    onChange={e => {
                      setInfo({...info, lokasi: e.target.value});
                      if (invalidFields.includes("lokasi")) setInvalidFields(invalidFields.filter(f => f !== "lokasi"));
                    }} 
                    placeholder="Dermaga A" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-800">Area <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    className={`input-field py-3 text-base ${invalidFields.includes("area") ? "border-2 border-red-500 ring-2 ring-red-200 bg-red-50/30" : ""}`} 
                    value={info.area} 
                    onChange={e => {
                      setInfo({...info, area: e.target.value});
                      if (invalidFields.includes("area")) setInvalidFields(invalidFields.filter(f => f !== "area"));
                    }} 
                    placeholder="Area 1" 
                  />
                </div>
              </div>
            </div>

            <div className="card space-y-4">
              <h3 className="font-extrabold text-base text-[var(--color-primary)] border-b pb-2">Penanggung Jawab & Pengawas</h3>
              {[
                {label: "Manager", key: "Manager", fieldKey: "namaManager", required: true},
                {label: "Pemohon", key: "Pemohon", fieldKey: "namaPemohon", required: true},
                {label: "Pengawas", key: "Pengawas", fieldKey: "namaPengawas", required: false},
                {label: "Petugas K3", key: "PetugasK3", fieldKey: "namaPetugasK3", required: true}
              ].map(person => (
                <div key={person.key} className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-800">Nama {person.label} {person.required && <span className="text-red-500">*</span>}</label>
                    <input 
                      type="text" 
                      className={`input-field py-3 text-base bg-white ${invalidFields.includes(person.fieldKey) ? "border-2 border-red-500 ring-2 ring-red-200 bg-red-50/50" : ""}`} 
                      value={info[`nama${person.key}` as keyof typeof info] || ''} 
                      onChange={e => {
                        setInfo({...info, [`nama${person.key}`]: e.target.value});
                        if (invalidFields.includes(person.fieldKey)) setInvalidFields(invalidFields.filter(f => f !== person.fieldKey));
                      }} 
                      placeholder={`Nama ${person.label}`} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-800">No. Telp {person.label}</label>
                    <input 
                      type="tel" 
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="input-field py-3 text-base bg-white font-mono" 
                      value={info[`telp${person.key}` as keyof typeof info] || ''} 
                      onChange={e => {
                        const numericVal = e.target.value.replace(/[^0-9]/g, '');
                        setInfo({...info, [`telp${person.key}`]: numericVal});
                      }} 
                      placeholder="0812xxxxxxxx" 
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Pre-loaded Worker List with Stepper Buttons (+ / -) & Direct Number Input */}
            <div className={`card space-y-3 transition-all ${invalidFields.includes("pekerjaList") ? "border-2 border-red-500 bg-red-50/30" : ""}`}>
              <div className="border-b pb-2">
                <h3 className="font-extrabold text-base text-[var(--color-primary)]">
                  Daftar Pekerja & Jumlah <span className="text-red-500">*</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  Isi jumlah pekerja (Gunakan tombol <strong>+</strong> / <strong>-</strong> atau ketik angka). Pekerja bernilai 0 otomatis disembunyikan di dokumen resmi.
                </p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {pekerjaList.map((p, idx) => {
                  const count = parseInt(p.jumlah) || 0;
                  return (
                    <div 
                      key={p.jenis} 
                      className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                        count > 0 ? "bg-blue-50/70 border-[var(--color-primary)] shadow-sm" : "bg-slate-50 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <span className={`text-sm font-bold truncate pr-2 ${count > 0 ? "text-[var(--color-primary)] font-extrabold" : "text-slate-700"}`}>
                        {p.jenis}
                      </span>

                      <div className="flex items-center shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const newArr = [...pekerjaList];
                            const currentVal = parseInt(newArr[idx].jumlah) || 0;
                            newArr[idx].jumlah = Math.max(0, currentVal - 1).toString();
                            setPekerjaList(newArr);
                            if (invalidFields.includes("pekerjaList")) setInvalidFields(invalidFields.filter(f => f !== "pekerjaList"));
                          }}
                          className="w-9 h-9 rounded-l-xl bg-slate-200 hover:bg-slate-300 active:scale-95 text-slate-800 font-black flex items-center justify-center text-lg transition-colors select-none"
                          title="Kurangi Pekerja"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          className="w-12 h-9 text-center font-extrabold border-y border-slate-300 text-slate-900 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                          value={p.jumlah}
                          onChange={e => {
                            const val = e.target.value;
                            const newArr = [...pekerjaList];
                            newArr[idx].jumlah = val;
                            setPekerjaList(newArr);
                            if (invalidFields.includes("pekerjaList")) setInvalidFields(invalidFields.filter(f => f !== "pekerjaList"));
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newArr = [...pekerjaList];
                            const currentVal = parseInt(newArr[idx].jumlah) || 0;
                            newArr[idx].jumlah = (currentVal + 1).toString();
                            setPekerjaList(newArr);
                            if (invalidFields.includes("pekerjaList")) setInvalidFields(invalidFields.filter(f => f !== "pekerjaList"));
                          }}
                          className="w-9 h-9 rounded-r-xl bg-[var(--color-primary)] hover:bg-blue-800 active:scale-95 text-white font-black flex items-center justify-center text-lg transition-colors select-none"
                          title="Tambah Pekerja"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">C. Perlengkapan Kerja</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Kelola perlengkapan berdasarkan kategori (Alat, Mesin, Material, Alat Berat). Klik tombol <strong>+ Tambah</strong> pada kategori yang sesuai.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 text-amber-950 text-sm p-4 rounded-2xl flex items-start gap-3">
              <ShieldAlert className="w-6 h-6 shrink-0 mt-0.5 text-amber-600" />
              <p className="font-semibold"><strong>Catatan:</strong> Semua perlengkapan kerja diperiksa oleh petugas K3 sebelum memulai pekerjaan.</p>
            </div>
            
            <div className="space-y-4">
              {["Alat", "Mesin", "Material", "Alat Berat"].map((cat) => {
                const itemsInCat = perlengkapan
                  .map((item, originalIndex) => ({ item, originalIndex }))
                  .filter(x => x.item.jenis === cat);

                return (
                  <div key={cat} className="card space-y-3.5 border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-5">
                    {/* Category Header */}
                    <div className="flex justify-between items-center border-b pb-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-black px-3 py-1 rounded-xl uppercase tracking-wider ${
                          cat === "Alat" ? "bg-blue-100 text-blue-800 border border-blue-200" :
                          cat === "Mesin" ? "bg-purple-100 text-purple-800 border border-purple-200" :
                          cat === "Material" ? "bg-amber-100 text-amber-800 border border-amber-200" :
                          "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        }`}>
                          {cat}
                        </span>
                        <span className="text-xs font-bold text-slate-500">
                          ({itemsInCat.length} item)
                        </span>
                      </div>

                      <button 
                        type="button"
                        onClick={() => handleAddPerlengkapan(cat)} 
                        className="text-xs text-[var(--color-primary)] font-extrabold flex items-center gap-1.5 bg-blue-50 px-3.5 py-2 rounded-xl hover:bg-blue-100 active:scale-95 transition-all border border-blue-200/80 shadow-sm"
                      >
                        <Plus className="w-4 h-4"/> Tambah {cat}
                      </button>
                    </div>

                    {/* Items List for this category */}
                    {itemsInCat.length > 0 ? (
                      <div className="space-y-3">
                        {itemsInCat.map(({ item: p, originalIndex: idx }, subIdx) => (
                          <div 
                            key={idx} 
                            className={`flex flex-col sm:flex-row gap-3 items-start sm:items-end p-3.5 rounded-xl border transition-all ${
                              invalidFields.includes("perlengkapan") && (!p.nama.trim() || !p.jumlah.trim())
                                ? "bg-red-50/50 border-2 border-red-500" 
                                : "bg-slate-50 border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            <div className="w-full sm:flex-1">
                              <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                                Nama {cat} #{subIdx + 1} <span className="text-red-500">*</span>
                              </label>
                              <input 
                                ref={idx === perlengkapan.length - 1 ? newPerlengkapanInputRef : null}
                                type="text" 
                                placeholder={
                                  cat === "Alat" ? "Contoh: Blender Potong, Kunci Inggris" :
                                  cat === "Mesin" ? "Contoh: Mesin Las Inverter 250A, Generator" :
                                  cat === "Material" ? "Contoh: Kawat Las LB-52, Tirai Anti Api" :
                                  "Contoh: Mobile Crane 80 Ton, Excavator Mini"
                                } 
                                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm font-medium focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none" 
                                value={p.nama} 
                                onChange={e => {
                                  const newArr = [...perlengkapan]; 
                                  newArr[idx].nama = e.target.value; 
                                  setPerlengkapan(newArr);
                                  if (invalidFields.includes("perlengkapan")) {
                                    setInvalidFields(invalidFields.filter(f => f !== "perlengkapan"));
                                  }
                                }} 
                              />
                            </div>

                            <div className="flex w-full sm:w-auto items-end gap-2 justify-between sm:justify-start">
                              <div className="shrink-0">
                                <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                                  Jumlah <span className="text-red-500">*</span>
                                </label>
                                <div className="flex items-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newArr = [...perlengkapan];
                                      const currentVal = parseInt(newArr[idx].jumlah) || 1;
                                      newArr[idx].jumlah = Math.max(1, currentVal - 1).toString();
                                      setPerlengkapan(newArr);
                                    }}
                                    className="w-9 h-10 rounded-l-xl bg-slate-200 hover:bg-slate-300 active:scale-95 text-slate-800 font-black flex items-center justify-center text-base transition-colors select-none border border-r-0 border-slate-300"
                                    title="Kurangi Jumlah"
                                  >
                                    -
                                  </button>
                                  <input 
                                    type="number" 
                                    min="1"
                                    placeholder="Jml" 
                                    className="w-14 h-10 text-center font-extrabold border-y border-slate-300 text-slate-900 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]" 
                                    value={p.jumlah} 
                                    onChange={e => {
                                      const newArr = [...perlengkapan]; 
                                      newArr[idx].jumlah = e.target.value; 
                                      setPerlengkapan(newArr);
                                    }} 
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newArr = [...perlengkapan];
                                      const currentVal = parseInt(newArr[idx].jumlah) || 0;
                                      newArr[idx].jumlah = (currentVal + 1).toString();
                                      setPerlengkapan(newArr);
                                    }}
                                    className="w-9 h-10 rounded-r-xl bg-[var(--color-primary)] hover:bg-blue-800 active:scale-95 text-white font-black flex items-center justify-center text-base transition-colors select-none border border-l-0 border-[var(--color-primary)]"
                                    title="Tambah Jumlah"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>

                              <button 
                                type="button"
                                onClick={() => setPerlengkapan(perlengkapan.filter((_, i) => i !== idx))} 
                                className="p-2.5 h-10 text-red-500 hover:bg-red-50 rounded-xl border border-transparent hover:border-red-200 shrink-0 flex items-center justify-center transition-colors"
                                title="Hapus Item"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div 
                        onClick={() => handleAddPerlengkapan(cat)}
                        className="border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/40 rounded-xl p-3.5 text-center cursor-pointer transition-all group"
                      >
                        <p className="text-xs text-slate-500 group-hover:text-[var(--color-primary)] font-bold flex items-center justify-center gap-1.5 py-0.5">
                          <Plus className="w-4 h-4 text-slate-400 group-hover:text-[var(--color-primary)]" /> Klik untuk tambah item {cat}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xl font-extrabold text-slate-900">D. Keselamatan Kerja (JSA) <span className="text-red-500">*</span></h2>
            <p className="text-sm text-slate-600 font-medium">Identifikasi bahaya dijadikan panduan bekerja aman.</p>
            
            <div className="space-y-4">
              {keselamatan.map((k, idx) => (
                <div key={idx} className={`card relative border-l-4 border-l-[var(--color-primary)] space-y-4 transition-all ${invalidFields.includes("keselamatan") ? "border-2 border-red-500 bg-red-50/30" : ""}`}>
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-extrabold text-sm bg-blue-100 text-[var(--color-primary)] px-3 py-1 rounded-full">Langkah #{idx + 1}</span>
                    <button onClick={() => setKeselamatan(keselamatan.filter((_, i) => i !== idx))} className="text-red-500 p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-5 h-5" /></button>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-800">Aktivitas Pekerjaan <span className="text-red-500">*</span></label>
                    <input 
                      ref={idx === keselamatan.length - 1 ? newKeselamatanInputRef : null}
                      type="text" 
                      className="input-field py-3 text-base" 
                      placeholder="Contoh: Pemotongan pipa besi" 
                      value={k.aktivitas} 
                      onChange={e => {
                        const newArr = [...keselamatan]; newArr[idx].aktivitas = e.target.value; setKeselamatan(newArr);
                      }} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-red-600">Potensi Bahaya <span className="text-red-500">*</span></label>
                    <input type="text" className="input-field py-3 text-base border-red-200 focus:ring-red-400" placeholder="Contoh: Percikan api, luka bakar" value={k.potensi} onChange={e => {
                      const newArr = [...keselamatan]; newArr[idx].potensi = e.target.value; setKeselamatan(newArr);
                    }} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-emerald-700">Langkah Aman Pekerjaan <span className="text-red-500">*</span></label>
                    <textarea className="input-field py-3 text-base border-emerald-200 focus:ring-emerald-400 min-h-[70px]" placeholder="Contoh: Pakai sarung tangan kulit & sediakan APAR" value={k.langkah} onChange={e => {
                      const newArr = [...keselamatan]; newArr[idx].langkah = e.target.value; setKeselamatan(newArr);
                    }} />
                  </div>
                </div>
              ))}
              
              <button 
                onClick={handleAddKeselamatan} 
                className="w-full py-3.5 border-2 border-dashed border-slate-300 text-slate-700 rounded-2xl font-extrabold hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 text-base active:scale-95 shadow-sm"
              >
                <Plus className="w-5 h-5" /> Tambah Aktivitas JSA
              </button>
            </div>
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xl font-extrabold text-slate-900">E. Peralatan Keselamatan</h2>
            
            <div className={`card transition-all ${invalidFields.includes("apd") ? "border-2 border-red-500 bg-red-50/30" : ""}`}>
              <h3 className="font-extrabold text-base text-[var(--color-primary)] mb-3 pb-2 border-b">Alat Pelindung Diri (APD) <span className="text-red-500">*</span></h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {apdOptions.map(opt => {
                  if (opt === "Lainnya") {
                    const isChecked = apd.some(a => a.toLowerCase() === "lainnya" || a.toLowerCase().startsWith("lainnya:"));
                    return (
                      <div key={opt} className="col-span-1 sm:col-span-2 space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50/60">
                        <label className="flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="w-5 h-5 text-[var(--color-primary)] rounded mr-3 shrink-0" 
                            checked={isChecked} 
                            onChange={() => {
                              if (isChecked) {
                                setApd(apd.filter(a => !a.toLowerCase().startsWith("lainnya")));
                                setApdLainnyaText("");
                              } else {
                                setApd([...apd, apdLainnyaText.trim() ? `Lainnya: ${apdLainnyaText.trim()}` : "Lainnya"]);
                              }
                            }} 
                          />
                          <span className="text-sm font-bold text-slate-900">Lainnya (APD Khusus)</span>
                        </label>

                        {isChecked && (
                          <div className="pl-8 pt-1 animate-in fade-in slide-in-from-top-1">
                            <input
                              type="text"
                              placeholder="Sebutkan rincian APD lainnya (opsional, boleh dikosongkan)..."
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm font-medium focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none shadow-sm"
                              value={apdLainnyaText}
                              onChange={e => {
                                const val = e.target.value;
                                setApdLainnyaText(val);
                                const filtered = apd.filter(a => !a.toLowerCase().startsWith("lainnya"));
                                setApd([...filtered, val.trim() ? `Lainnya: ${val.trim()}` : "Lainnya"]);
                              }}
                            />
                            <p className="text-[11px] text-slate-500 mt-1 italic font-medium">💡 Isian teks ini bersifat opsional (boleh dikosongkan jika tidak ada rincian).</p>
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <label key={opt} className="flex items-center p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-200">
                      <input type="checkbox" className="w-5 h-5 text-[var(--color-primary)] rounded mr-3 shrink-0" checked={apd.includes(opt)} onChange={() => toggleArray(apd, setApd, opt)} />
                      <span className="text-sm font-semibold text-slate-800">{opt}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="card">
              <h3 className="font-extrabold text-base text-[var(--color-primary)] mb-3 pb-2 border-b">Perlengkapan Keselamatan & Darurat</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {daruratOptions.map(opt => {
                  if (opt === "Lainnya") {
                    const isChecked = darurat.some(d => d.toLowerCase() === "lainnya" || d.toLowerCase().startsWith("lainnya:"));
                    return (
                      <div key={opt} className="col-span-1 sm:col-span-2 space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50/60">
                        <label className="flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="w-5 h-5 text-[var(--color-secondary)] rounded mr-3 shrink-0" 
                            checked={isChecked} 
                            onChange={() => {
                              if (isChecked) {
                                setDarurat(darurat.filter(d => !d.toLowerCase().startsWith("lainnya")));
                                setDaruratLainnyaText("");
                              } else {
                                setDarurat([...darurat, daruratLainnyaText.trim() ? `Lainnya: ${daruratLainnyaText.trim()}` : "Lainnya"]);
                              }
                            }} 
                          />
                          <span className="text-sm font-bold text-slate-900">Lainnya (Perlengkapan Darurat Khusus)</span>
                        </label>

                        {isChecked && (
                          <div className="pl-8 pt-1 animate-in fade-in slide-in-from-top-1">
                            <input
                              type="text"
                              placeholder="Sebutkan rincian perlengkapan darurat lainnya (opsional, boleh dikosongkan)..."
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm font-medium focus:ring-2 focus:ring-[var(--color-secondary)] focus:outline-none shadow-sm"
                              value={daruratLainnyaText}
                              onChange={e => {
                                const val = e.target.value;
                                setDaruratLainnyaText(val);
                                const filtered = darurat.filter(d => !d.toLowerCase().startsWith("lainnya"));
                                setDarurat([...filtered, val.trim() ? `Lainnya: ${val.trim()}` : "Lainnya"]);
                              }}
                            />
                            <p className="text-[11px] text-slate-500 mt-1 italic font-medium">💡 Isian teks ini bersifat opsional (boleh dikosongkan jika tidak ada rincian).</p>
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <label key={opt} className="flex items-center p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-200">
                      <input type="checkbox" className="w-5 h-5 text-[var(--color-secondary)] rounded mr-3 shrink-0" checked={darurat.includes(opt)} onChange={() => toggleArray(darurat, setDarurat, opt)} />
                      <span className="text-sm font-semibold text-slate-800">{opt}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {currentStep === 6 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xl font-extrabold text-slate-900">F. Validasi Izin & Tanda Tangan Digital</h2>
            
            <div className="card space-y-4">
              <h3 className="font-extrabold text-base text-[var(--color-primary)] border-b pb-2">Status & Jam Pelaksanaan</h3>
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-800 flex items-center justify-between">
                  <span>Tanggal Dokumen / Pelaksanaan</span>
                  <span className="text-xs font-normal text-slate-500 italic">(Otomatis Hari Ini)</span>
                </label>
                <input 
                  type="date" 
                  className="input-field text-base font-bold" 
                  value={validasi.tanggal || getTodayYYYYMMDD()} 
                  onChange={e => setValidasi({...validasi, tanggal: e.target.value})} 
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-800">Mulai Jam</label>
                  <input type="time" className="input-field text-base font-bold" value={validasi.mulai} onChange={e => setValidasi({...validasi, mulai: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-800">Sampai Jam</label>
                  <input type="time" className="input-field text-base font-bold" value={validasi.sampai} onChange={e => setValidasi({...validasi, sampai: e.target.value})} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-800">Status Validasi</label>
                <select 
                  className="w-full px-3.5 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-base font-extrabold focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none cursor-pointer" 
                  value={validasi.keterangan} 
                  onChange={e => {
                    const val = e.target.value;
                    setValidasi({
                      ...validasi, 
                      keterangan: val,
                      hasLembur: val.includes("Lembur") && val.includes("Disetujui")
                    });
                  }}
                >
                  <option value="Disetujui" className="text-base py-2">Izin Disetujui</option>
                  <option value="Lembur" className="text-base py-2">Izin Lembur Saja</option>
                  <option value="Dibatalkan" className="text-base py-2">Izin Dibatalkan</option>
                  <option value="Disetujui & Lembur" className="text-base py-2 font-bold text-[#2B7A4B]">Izin Disetujui & Lembur (Dalam 1 Form)</option>
                </select>
              </div>

              {/* Perpanjangan Jam Lembur Box (Dalam 1 Form) */}
              {(validasi.keterangan === "Disetujui & Lembur" || validasi.keterangan === "Diberikan & Lembur" || validasi.hasLembur) && (
                <div className="p-4 bg-amber-50/80 border-2 border-amber-300 rounded-2xl space-y-3 animate-in fade-in duration-200 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping"></span>
                    <h4 className="font-extrabold text-sm text-amber-950">Perpanjangan Waktu (Kolom Izin Lembur dalam 1 Form)</h4>
                  </div>
                  <p className="text-xs text-amber-900 font-medium leading-relaxed">
                    💡 Menambahkan perpanjangan waktu kerja: <span className="font-bold">Kolom Izin Disetujui</span> dan <span className="font-bold">Kolom Izin Lembur</span> akan aktif & terisi lengkap dalam 1 lembar dokumen PDF resmi.
                  </p>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-amber-950">Mulai Jam Lembur</label>
                      <input 
                        type="time" 
                        className="input-field text-sm font-bold bg-white border-amber-300 focus:ring-amber-500" 
                        value={validasi.lemburMulai || "17:00"} 
                        onChange={e => setValidasi({...validasi, lemburMulai: e.target.value})} 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-amber-950">Sampai Jam Lembur</label>
                      <input 
                        type="time" 
                        className="input-field text-sm font-bold bg-white border-amber-300 focus:ring-amber-500" 
                        value={validasi.lemburSampai || "21:00"} 
                        onChange={e => setValidasi({...validasi, lemburSampai: e.target.value})} 
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-amber-950">Tanggal Lembur</label>
                    <input 
                      type="date" 
                      className="input-field text-sm font-bold bg-white border-amber-300 focus:ring-amber-500" 
                      value={validasi.lemburTanggal || validasi.tanggal || getTodayYYYYMMDD()} 
                      onChange={e => setValidasi({...validasi, lemburTanggal: e.target.value})} 
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-800">Catatan Lain (Opsional)</label>
                <textarea className="input-field text-base font-medium min-h-[70px]" value={validasi.catatan} onChange={e => setValidasi({...validasi, catatan: e.target.value})} placeholder="Catatan tambahan K3..." />
              </div>
            </div>

            {/* Interactive Signature Trigger Cards */}
            <div className="card space-y-4">
              <div>
                <h3 className="font-extrabold text-base text-[var(--color-primary)] border-b pb-1">Tanda Tangan Digital (Ketuk untuk Isi) <span className="text-red-500">*</span></h3>
                <p className="text-sm text-slate-600 mt-1 font-medium">Ketuk kotak di bawah untuk membuka Pop-Up Canvas Tanda Tangan.</p>
              </div>
              
              {[
                { label: "Disiapkan Oleh: Pemohon", key: "pemohon", val: sigPemohon, required: true },
                { label: "Diperiksa Oleh: Petugas K3", key: "k3", val: sigK3, required: true },
                { label: "Mengetahui: Manager Area", key: "manager", val: sigManager, required: false }
              ].map(sig => (
                <div key={sig.key} className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-bold text-slate-900">{sig.label} {sig.required && <span className="text-red-500">*</span>}</label>
                    {sig.val && (
                      <button 
                        onClick={() => {
                          if (sig.key === "pemohon") setSigPemohon("");
                          else if (sig.key === "k3") setSigK3("");
                          else setSigManager("");
                        }}
                        className="text-xs text-red-600 font-extrabold hover:underline"
                      >
                        Hapus TTD
                      </button>
                    )}
                  </div>
                  
                  <div 
                    onClick={() => setActiveSigModal(sig.key as "pemohon" | "k3" | "manager")}
                    className={`border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all min-h-[110px] ${
                      sig.val 
                        ? 'border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50' 
                        : invalidFields.includes(`sig${sig.key}`)
                        ? 'border-red-500 bg-red-50/50 hover:bg-red-100'
                        : 'border-slate-300 bg-slate-50 hover:border-[var(--color-primary)] hover:bg-blue-50/50'
                    }`}
                  >
                    {sig.val ? (
                      <div className="flex flex-col items-center gap-1.5 w-full">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={sig.val} alt="Signature" className="max-h-16 object-contain" />
                        <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                          <Check className="w-4 h-4" /> Tanda Tangan Tersimpan (Ketuk untuk Ubah)
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-slate-500">
                        <PenTool className="w-7 h-7 text-[var(--color-primary)]" />
                        <span className="text-sm font-bold text-slate-700">Ketuk di sini untuk memberi Tanda Tangan</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pop-Up Modal Canvas Signature */}
      {activeSigModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-lg shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-lg">
                  Tanda Tangan {activeSigModal === "pemohon" ? "Pemohon" : activeSigModal === "k3" ? "Petugas K3" : "Manager Area"}
                </h3>
                <p className="text-xs text-slate-500 font-medium">Goreskan tanda tangan Anda pada area di bawah ini.</p>
              </div>
              <button onClick={() => setActiveSigModal(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="border-2 border-slate-300 rounded-2xl bg-slate-50 overflow-hidden shadow-inner relative">
              <SignatureCanvas 
                ref={modalCanvasRef}
                canvasProps={{ className: "w-full h-52 bg-white cursor-crosshair" }}
              />
              <span className="absolute bottom-2 right-3 text-[10px] font-mono text-slate-400 pointer-events-none select-none">
                Digital Canvas Touch Pad
              </span>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => modalCanvasRef.current?.clear()} 
                className="flex-1 py-3 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-bold text-sm transition-colors"
              >
                Hapus / Bersihkan
              </button>
              <button 
                onClick={saveSignatureFromModal} 
                className="flex-1 py-3 bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-light)] rounded-xl font-bold text-sm shadow transition-colors flex items-center justify-center gap-1.5"
              >
                <Check className="w-5 h-5" /> Simpan TTD
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Sticky Action Controls */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 sm:p-4 z-30 shadow-2xl">
        <div className="max-w-2xl mx-auto flex justify-between gap-3">
          <button 
            onClick={() => {
              if (currentStep === 0) {
                setShowExitConfirm(true);
              } else {
                handleBack();
              }
            }} 
            className="px-5 py-3 bg-slate-100 text-slate-700 rounded-2xl font-bold text-sm hover:bg-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" /> Kembali
          </button>
          
          {currentStep < STEPS.length - 1 ? (
            <button 
              onClick={handleNext} 
              className="px-6 py-3 bg-[#2B7A4B] hover:bg-[#22633C] text-white rounded-full font-extrabold text-sm shadow-md flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              Lanjut <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button 
              onClick={submitForm} 
              className="px-6 py-3 bg-[#1E5950] hover:bg-[#174740] text-white rounded-full font-extrabold text-sm shadow-lg flex items-center gap-2 active:scale-95 transition-all cursor-pointer"
            >
              <Save className="w-5 h-5 text-white" /> Simpan
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Modal: Exit / Back to Dashboard */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 border border-slate-100 text-center animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-emerald-100 text-[#2B7A4B] rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <Save className="w-7 h-7 text-[#2B7A4B]" />
            </div>
            
            <div className="space-y-1.5">
              <h3 className="text-lg font-black text-slate-800">Kembali ke Dashboard?</h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Isian formulir Anda <span className="font-bold text-[#2B7A4B]">tersimpan otomatis sebagai Draft</span>. Anda dapat melanjutkan pengisian kapan saja.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button 
                onClick={() => {
                  setShowExitConfirm(false);
                  router.push("/dashboard");
                }}
                className="w-full py-3 bg-[#2B7A4B] hover:bg-[#22633C] text-white rounded-xl font-extrabold text-xs shadow-md transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" /> Ya, Kembali ke Dashboard
              </button>

              <button 
                onClick={() => setShowExitConfirm(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all cursor-pointer"
              >
                Lanjut Mengisi Form
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official PDF Document Viewer Modal */}
      {showOfficialPDF && submittedData && (
        <OfficialPermitDocument 
          data={submittedData} 
          onClose={() => {
            setShowOfficialPDF(false);
            router.push('/dashboard');
          }} 
        />
      )}
      {/* Draft Restore Prompt Modal */}
      {showDraftModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 border border-slate-100 text-center animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-emerald-100 text-[#2B7A4B] rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <FileText className="w-7 h-7 text-[#2B7A4B]" />
            </div>
            
            <div className="space-y-1.5">
              <h3 className="text-lg font-black text-slate-900">Lanjutkan Draft Isian?</h3>
              <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                Apakah Anda ingin melanjutkan draf sebelumnya atau membuat baru?
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button 
                onClick={() => applyDraft(pendingDraft)}
                className="w-full py-3 bg-[#2B7A4B] hover:bg-[#22633C] text-white rounded-xl font-black text-xs shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                Lanjutkan Draft
              </button>
              
              <button 
                onClick={handleStartFresh}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all cursor-pointer border border-slate-200"
              >
                Buat Form Baru
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FormPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 font-bold">
        Memuat Formulir...
      </div>
    }>
      <FormWizardContent />
    </Suspense>
  );
}
