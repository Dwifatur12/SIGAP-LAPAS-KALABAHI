import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Shield, Clock, Search, 
  FileText, CheckCircle2, AlertCircle, X,
  ChevronRight, Lock, Users, Settings,
  Plus, Edit, Trash2, Eye, EyeOff,
  LogOut, ArrowUpDown, ListOrdered, Pin,
  UserCheck, CalendarDays, Ticket, Building,
  Printer, Table, Send, Inbox, CheckSquare, Image as ImageIcon, Upload,
  Copy, Check, LayoutGrid, List, Filter, RotateCcw, CopyPlus, Wifi, WifiOff
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, runTransaction, writeBatch, getDoc, getDocs } from 'firebase/firestore';

// Polyfill sederhana agar Tailwind tidak menyebabkan error undefined saat loading di preview
if (typeof window !== 'undefined') { window.tailwind = window.tailwind || {}; }

// ==========================================
// FIREBASE SETUP
// ==========================================
const CUSTOM_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBBH-DEzioBJNXczvi_q8mIjYnUnSnHx9w",
  authDomain: "sigap-lapas-kalabahi.firebaseapp.com",
  projectId: "sigap-lapas-kalabahi",
  storageBucket: "sigap-lapas-kalabahi.firebasestorage.app",
  messagingSenderId: "270232328446",
  appId: "1:270232328446:web:e0399bfe337ff07df9adaf"
};

let app, auth, db, appId = 'default-app-id';
try {
  const firebaseConfig = CUSTOM_FIREBASE_CONFIG.apiKey 
    ? CUSTOM_FIREBASE_CONFIG 
    : JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
    
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
} catch (err) {
  console.warn("Firebase not configured in environment.", err);
}

const MOCK_DOC_DATA = [];

// ==========================================
// FUNGSI HELPER GLOBAL
// ==========================================
const formatLiveTime = (date) => {
  const optionsDate = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const optionsTime = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
  return `${new Intl.DateTimeFormat('id-ID', optionsDate).format(date)} - ${new Intl.DateTimeFormat('id-ID', optionsTime).format(date)} WITA`;
};

const formatDateIndo = (dateStr) => {
  if (!dateStr) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric'
  }).format(new Date(dateStr));
};

const formatDateTimeIndo = (dateStr) => {
  if (!dateStr) return '-';
  let dateObj = null;

  if (typeof dateStr === 'object' && typeof dateStr.toDate === 'function') {
    dateObj = dateStr.toDate();
  } else if (typeof dateStr === 'object' && typeof dateStr.seconds === 'number') {
    dateObj = new Date(dateStr.seconds * 1000);
  } else if (typeof dateStr === 'number') {
    dateObj = new Date(dateStr);
  } else if (typeof dateStr === 'string') {
    const hasTime = dateStr.includes('T') || dateStr.includes(':');
    if (!hasTime) {
      return `${formatDateIndo(dateStr)} • (Jam belum tercatat)`;
    }
    dateObj = new Date(dateStr);
  }

  if (!dateObj || isNaN(dateObj.getTime())) {
    return formatDateIndo(dateStr);
  }

  const datePart = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Makassar'
  }).format(dateObj);
  const timePart = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Makassar'
  }).format(dateObj);
  return `${datePart} • ${timePart} WITA`;
};

const getStatusBadgeClass = (jenisSurat) => {
  return jenisSurat === 'Surat Masuk' 
    ? 'bg-emerald-500 text-white shadow-emerald-500/30' 
    : 'bg-orange-500 text-white shadow-orange-500/30';
};

// Helper untuk menyorot (highlight) kata kunci pencarian di dalam teks
const highlightText = (text, query) => {
  if (text === null || text === undefined || text === '') return '-';
  const str = String(text);
  const trimmed = (query || '').trim();
  if (!trimmed) return str;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = str.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, idx) =>
    part.toLowerCase() === trimmed.toLowerCase() ? (
      <mark
        key={idx}
        className="bg-amber-300/90 dark:bg-amber-500/40 text-slate-950 dark:text-amber-100 rounded px-0.5 font-extrabold"
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
};

const DEFAULT_BG_SETTINGS = {
  image: '',
  blur: 0,
  brightness: 100,
  overlay: 40,
  size: 'cover',
  position: 'center'
};

const DEFAULT_LOGO_SETTINGS = {
  image: '',
  headerSize: 32,
  heroSize: 84,
  scale: 100,
  offsetX: 0,
  offsetY: 0,
  radius: 12,
  showInHero: true
};

const compressLogoPng = (file) => new Promise((resolve, reject) => {
  const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
  if (!isPng) {
    reject(new Error('INVALID_FORMAT'));
    return;
  }
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 512;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = event.target.result;
  };
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const compressBackgroundImage = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 1600;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = reject;
    img.src = event.target.result;
  };
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

// ==========================================
// KOMPONEN UTAMA
// ==========================================
export default function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [toast, setToast] = useState(null);
  
  const [documents, setDocuments] = useState(MOCK_DOC_DATA);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [fbUser, setFbUser] = useState(null);

  const [adminUser, setAdminUser] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loginCreds, setLoginCreds] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const isAdmin = adminUser !== null;

  const [adminCreds, setAdminCreds] = useState(() => {
    const saved = localStorage.getItem('laskarAdminCreds');
    return saved ? JSON.parse(saved) : { username: 'admin', password: 'password' };
  });
  const [superAdminCreds, setSuperAdminCreds] = useState(() => {
    const saved = localStorage.getItem('laskarSuperAdminCreds');
    return saved ? JSON.parse(saved) : { username: 'superadmin', password: 'superpassword' };
  });
  const [autoLogoutMinutes, setAutoLogoutMinutes] = useState(() => {
    const saved = localStorage.getItem('laskarAutoLogout');
    return saved ? parseInt(saved) : 30;
  });

  const [startAgendaMasuk, setStartAgendaMasuk] = useState(1);
  const [startAgendaKeluar, setStartAgendaKeluar] = useState(1);
  const [agendaModeMasuk, setAgendaModeMasuk] = useState('auto');
  const [agendaModeKeluar, setAgendaModeKeluar] = useState('auto');
  const [bgSettings, setBgSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('laskarBgSettings');
      return saved ? { ...DEFAULT_BG_SETTINGS, ...JSON.parse(saved) } : DEFAULT_BG_SETTINGS;
    } catch {
      return DEFAULT_BG_SETTINGS;
    }
  });
  const [logoSettings, setLogoSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('laskarLogoSettings');
      return saved ? { ...DEFAULT_LOGO_SETTINGS, ...JSON.parse(saved) } : DEFAULT_LOGO_SETTINGS;
    } catch {
      return DEFAULT_LOGO_SETTINGS;
    }
  });
  
  const [showSettings, setShowSettings] = useState(false);
  const [showSettingsPassword, setShowSettingsPassword] = useState(false);
  const [settingsForm, setSettingsForm] = useState({});
  const [loginError, setLoginError] = useState('');

  const [showDocForm, setShowDocForm] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [selectedItemsForAction, setSelectedItemsForAction] = useState([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const lenisRef = useRef(null);
  const searchInputRef = useRef(null);

  const [isLoadingDocs, setIsLoadingDocs] = useState(Boolean(db));
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('sigapViewMode') || 'grid');
  const [filterType, setFilterType] = useState('Semua');
  const [filterYear, setFilterYear] = useState('Semua');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [isTrashView, setIsTrashView] = useState(false);

  // State Indikator Koneksi Online/Offline
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  // State Autocomplete Alamat Pengirim/Penerima
  const [showAlamatSuggestions, setShowAlamatSuggestions] = useState(false);
  // State Proteksi Unsaved Changes pada Modal Form
  const [initialFormSnapshot, setInitialFormSnapshot] = useState(null);

  // Pisahkan arsip aktif dan arsip di Sampah (Recycle Bin) dari database
  const activeDocuments = useMemo(
    () => documents.filter(d => !d.isDeleted),
    [documents]
  );

  const trashedDocuments = useMemo(
    () => documents
      .filter(d => d.isDeleted === true)
      .sort((a, b) => new Date(b.deletedAt || 0) - new Date(a.deletedAt || 0)),
    [documents]
  );

  // Daftar tahun unik dari arsip aktif untuk Filter Cepat Berdasarkan Tahun
  const availableYears = useMemo(() => {
    const years = new Set();
    const targetList = isTrashView ? trashedDocuments : activeDocuments;
    targetList.forEach(d => {
      if (d.tanggal && /^\d{4}/.test(d.tanggal)) {
        years.add(d.tanggal.substring(0, 4));
      }
    });
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [activeDocuments, trashedDocuments, isTrashView]);

  // Mencari nomor urut berikutnya berdasarkan database terbaru (mode Otomatis atau Kustom)
  const getNextNomorUrut = (jenisSuratType, currentDocs, modeOverride, customStartOverride) => {
    const filtered = currentDocs.filter(d => !d.isDeleted && d.jenisSurat === jenisSuratType);
    const mode = modeOverride ?? (jenisSuratType === 'Surat Masuk' ? agendaModeMasuk : agendaModeKeluar);
    const customStart = customStartOverride ?? (jenisSuratType === 'Surat Masuk' ? startAgendaMasuk : startAgendaKeluar);

    const existingNums = filtered
      .map(d => Number(d.nomorUrut))
      .filter(n => !isNaN(n) && n > 0);

    if (mode === 'auto') {
      return existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;
    }

    const baseNumber = Number(customStart) || 1;
    const usedNumbers = new Set(existingNums);
    let nextNum = baseNumber;
    while (usedNumbers.has(nextNum)) {
      nextNum++;
    }
    return nextNum;
  };

  // Menarik data pengaturan dan arsip terbaru langsung dari database saat membuka menu Super Admin
  const handleOpenSettings = async () => {
    let latestConfig = {
      username: adminCreds.username,
      password: adminCreds.password,
      superUsername: superAdminCreds.username,
      superPassword: superAdminCreds.password,
      autoLogoutMinutes,
      startAgendaMasuk,
      startAgendaKeluar,
      agendaModeMasuk,
      agendaModeKeluar,
      bgSettings: { ...DEFAULT_BG_SETTINGS, ...bgSettings },
      logoSettings: { ...DEFAULT_LOGO_SETTINGS, ...logoSettings }
    };

    if (db && fbUser) {
      try {
        const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'laskar_config', 'global_settings');
        const docsRef = collection(db, 'artifacts', appId, 'public', 'data', 'laskar_docs');
        const [configSnap, docsSnap] = await Promise.all([getDoc(configRef), getDocs(docsRef)]);

        const freshDocs = docsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setDocuments(freshDocs);

        if (configSnap.exists()) {
          const data = configSnap.data();
          latestConfig = {
            username: data.adminUsername || latestConfig.username,
            password: data.adminPassword || latestConfig.password,
            superUsername: data.superUsername || latestConfig.superUsername,
            superPassword: data.superPassword || latestConfig.superPassword,
            autoLogoutMinutes: data.autoLogoutMinutes || latestConfig.autoLogoutMinutes,
            startAgendaMasuk: Number(data.startAgendaMasuk) || 1,
            startAgendaKeluar: Number(data.startAgendaKeluar) || 1,
            agendaModeMasuk: data.agendaModeMasuk || 'auto',
            agendaModeKeluar: data.agendaModeKeluar || 'auto',
            bgSettings: data.bgSettings ? { ...DEFAULT_BG_SETTINGS, ...data.bgSettings } : latestConfig.bgSettings,
            logoSettings: data.logoSettings ? { ...DEFAULT_LOGO_SETTINGS, ...data.logoSettings } : latestConfig.logoSettings
          };

          setAdminCreds({ username: latestConfig.username, password: latestConfig.password });
          setSuperAdminCreds({ username: latestConfig.superUsername, password: latestConfig.superPassword });
          setAutoLogoutMinutes(latestConfig.autoLogoutMinutes);
          setStartAgendaMasuk(latestConfig.startAgendaMasuk);
          setStartAgendaKeluar(latestConfig.startAgendaKeluar);
          setAgendaModeMasuk(latestConfig.agendaModeMasuk);
          setAgendaModeKeluar(latestConfig.agendaModeKeluar);
          setBgSettings(latestConfig.bgSettings);
          setLogoSettings(latestConfig.logoSettings);
        }
      } catch (err) {
        console.error("Gagal menyinkronkan data pengaturan dari database:", err);
      }
    }

    setSettingsForm(latestConfig);
    setShowSettings(true);
  };

  const [formData, setFormData] = useState({
    jenisSurat: 'Surat Keluar',
    formatSurat: 'Naskah Dinas Pengaturan/ Penugasan',
    nomorUrut: 1,
    nomorBerkas: '',
    nomorBerkasBelakang: '',
    alamatPenerima: '', 
    tanggal: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0], 
    perihal: ''
  });

  const resetForm = () => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISODate = (new Date(now - tzOffset)).toISOString().split('T')[0];
    
    const initialData = {
      jenisSurat: 'Surat Keluar',
      formatSurat: 'Naskah Dinas Pengaturan/ Penugasan',
      nomorUrut: getNextNomorUrut('Surat Keluar', documents),
      nomorBerkas: '', 
      nomorBerkasBelakang: '',
      alamatPenerima: '', 
      tanggal: localISODate, 
      perihal: ''
    };
    setFormData(initialData);
    setInitialFormSnapshot(initialData);
  };

  // Helper untuk memparse field nomor berkas saat edit / duplikat
  const extractDocFormParts = (docItem) => {
    let editFormatSurat = docItem.formatSurat || (docItem.modelSurat === 'Surat Keterangan / SK' ? 'Naskah Dinas Penetapan' : 'Naskah Dinas Korespondensi/ Khusus');
    let depan = docItem.nomorBerkasDepan !== undefined ? docItem.nomorBerkasDepan : (docItem.nomorBerkas || '');
    let belakang = docItem.nomorBerkasBelakang !== undefined ? docItem.nomorBerkasBelakang : '';

    if (docItem.nomorBerkasDepan === undefined && (docItem.nomorBerkas || '').includes('/')) {
      const parts = docItem.nomorBerkas.split('/');
      if (parts.length >= 3) {
        editFormatSurat = 'Naskah Dinas Penetapan';
        depan = parts[0];
        belakang = parts.slice(2).join('/');
      } else if (parts.length === 2) {
        depan = parts[0];
      }
    }
    return { editFormatSurat, depan, belakang };
  };

  // Membuka modal edit dengan snapshot awal untuk proteksi unsaved changes
  const handleOpenEditDoc = (docItem, e) => {
    if (e) e.stopPropagation();
    const { editFormatSurat, depan, belakang } = extractDocFormParts(docItem);
    const nextData = {
      ...docItem,
      formatSurat: editFormatSurat,
      nomorBerkas: depan,
      nomorBerkasBelakang: belakang
    };
    setEditingDoc(docItem);
    setFormData(nextData);
    setInitialFormSnapshot(nextData);
    setShowDocForm(true);
  };

  // Fitur Duplikat / Buat Serupa dengan Nomor Agenda terbaru otomatis
  const handleDuplicateDoc = (docItem, e) => {
    if (e) e.stopPropagation();
    const { editFormatSurat, depan, belakang } = extractDocFormParts(docItem);
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISODate = (new Date(now - tzOffset)).toISOString().split('T')[0];
    const nextNum = getNextNomorUrut(docItem.jenisSurat, documents);

    const duplicatedData = {
      jenisSurat: docItem.jenisSurat || 'Surat Keluar',
      formatSurat: editFormatSurat,
      nomorUrut: nextNum,
      nomorBerkas: depan,
      nomorBerkasBelakang: belakang,
      alamatPenerima: docItem.alamatPenerima || '',
      tanggal: localISODate,
      perihal: docItem.perihal || ''
    };
    setSelectedDoc(null);
    setEditingDoc(null);
    setFormData(duplicatedData);
    setInitialFormSnapshot(duplicatedData);
    setShowDocForm(true);
    showToast(`Salinan dari #${docItem.nomorUrut} siap diedit (No. Agenda baru: #${nextNum}).`);
  };

  // Deteksi perubahan yang belum disimpan pada modal form
  const hasUnsavedChanges = useMemo(() => {
    if (!showDocForm || !initialFormSnapshot) return false;
    const keys = ['jenisSurat', 'formatSurat', 'nomorBerkas', 'nomorBerkasBelakang', 'alamatPenerima', 'tanggal', 'perihal'];
    if (editingDoc && Number(formData.nomorUrut) !== Number(initialFormSnapshot.nomorUrut)) {
      return true;
    }
    return keys.some((k) => (formData[k] || '') !== (initialFormSnapshot[k] || ''));
  }, [showDocForm, formData, initialFormSnapshot, editingDoc]);

  // Proteksi saat menutup modal form jika masih ada ketikan yang belum disimpan
  const handleRequestCloseDocForm = () => {
    if (isSubmitting) return;
    if (hasUnsavedChanges) {
      setConfirmDialog({
        isOpen: true,
        message: "Anda memiliki perubahan yang belum disimpan pada formulir surat. Yakin ingin menutup dan membuang perubahan?",
        onConfirm: () => {
          setShowDocForm(false);
          setShowAlamatSuggestions(false);
        }
      });
    } else {
      setShowDocForm(false);
      setShowAlamatSuggestions(false);
    }
  };

  // Daftar saran Autocomplete Pengirim/Penerima dari riwayat database (diurutkan berdasarkan frekuensi)
  const uniqueAlamatSuggestions = useMemo(() => {
    const freqMap = new Map();
    activeDocuments.forEach((d) => {
      const val = (d.alamatPenerima || '').trim();
      if (!val) return;
      freqMap.set(val, (freqMap.get(val) || 0) + 1);
    });
    return Array.from(freqMap.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name]) => name);
  }, [activeDocuments]);

  const filteredAlamatSuggestions = useMemo(() => {
    const query = (formData.alamatPenerima || '').trim().toLowerCase();
    if (!query) return uniqueAlamatSuggestions.slice(0, 6);
    return uniqueAlamatSuggestions
      .filter((item) => item.toLowerCase().includes(query) && item.toLowerCase() !== query)
      .slice(0, 6);
  }, [uniqueAlamatSuggestions, formData.alamatPenerima]);

  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: '', onConfirm: null });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('Nomor Urut Terbaru');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const showToast = (message, type = 'success', copyText = '') => {
    setToast({ message, type, copyText });
    setTimeout(() => setToast(null), copyText ? 7000 : 5000);
  };

  const handleCopyText = async (text, id = 'global', e) => {
    if (e) e.stopPropagation();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(prev => (prev === id ? null : prev)), 2000);
    showToast(`Nomor berkas "${text}" disalin!`);
  };

  const previewNomorBerkas = useMemo(() => {
    const isTwoPart = formData.formatSurat === 'Naskah Dinas Penetapan' || formData.formatSurat === 'Naskah Dinas Korespondensi/ Khusus';
    const depan = (formData.nomorBerkas || '').trim();
    const urut = formData.nomorUrut ?? '';
    const belakang = (formData.nomorBerkasBelakang || '').trim();
    if (!depan && !belakang) return '';
    return isTwoPart ? `${depan}${urut}${belakang}` : `${depan}${urut}`;
  }, [formData.formatSurat, formData.nomorBerkas, formData.nomorUrut, formData.nomorBerkasBelakang]);

  useEffect(() => {
    localStorage.setItem('sigapViewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (!auth) {
      setIsLoadingDocs(false);
      return;
    }
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          try { await signInWithCustomToken(auth, __initial_auth_token); } 
          catch (tokenErr) { await signInAnonymously(auth); }
        } else { await signInAnonymously(auth); }
      } catch (e) {
        console.error("Firebase Auth Error:", e);
        setIsLoadingDocs(false);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setFbUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!db) {
      setIsLoadingDocs(false);
      return;
    }
    if (!fbUser) return;
    
    const docsRef = collection(db, 'artifacts', appId, 'public', 'data', 'laskar_docs');
    const unsubscribeDocs = onSnapshot(docsRef, (snapshot) => {
      const fetchedDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDocuments(fetchedDocs);
      setIsLoadingDocs(false);
    }, (error) => {
      console.error("Firestore Docs Error:", error);
      setIsLoadingDocs(false);
    });

    const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'laskar_config', 'global_settings');
    const unsubscribeConfig = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.superUsername) {
          const sCreds = { username: data.superUsername, password: data.superPassword };
          setSuperAdminCreds(sCreds);
          localStorage.setItem('laskarSuperAdminCreds', JSON.stringify(sCreds));
        }
        if (data.adminUsername) {
          const aCreds = { username: data.adminUsername, password: data.adminPassword };
          setAdminCreds(aCreds);
          localStorage.setItem('laskarAdminCreds', JSON.stringify(aCreds));
        }
        if (data.autoLogoutMinutes) {
          setAutoLogoutMinutes(data.autoLogoutMinutes);
          localStorage.setItem('laskarAutoLogout', data.autoLogoutMinutes.toString());
        }
        if (data.startAgendaMasuk) setStartAgendaMasuk(Number(data.startAgendaMasuk));
        if (data.startAgendaKeluar) setStartAgendaKeluar(Number(data.startAgendaKeluar));
        if (data.agendaModeMasuk) setAgendaModeMasuk(data.agendaModeMasuk);
        if (data.agendaModeKeluar) setAgendaModeKeluar(data.agendaModeKeluar);
        if (data.bgSettings) {
          const mergedBg = { ...DEFAULT_BG_SETTINGS, ...data.bgSettings };
          setBgSettings(mergedBg);
          try {
            localStorage.setItem('laskarBgSettings', JSON.stringify(mergedBg));
          } catch (e) { /* abaikan jika kuota localStorage penuh */ }
        }
        if (data.logoSettings) {
          const mergedLogo = { ...DEFAULT_LOGO_SETTINGS, ...data.logoSettings };
          setLogoSettings(mergedLogo);
          try {
            localStorage.setItem('laskarLogoSettings', JSON.stringify(mergedLogo));
          } catch (e) { /* abaikan jika kuota localStorage penuh */ }
        }
      }
    }, (error) => console.error("Firestore Config Error:", error));

    return () => {
      unsubscribeDocs();
      unsubscribeConfig();
    };
  }, [fbUser]);

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // Perbarui favicon tab browser otomatis saat logo PNG aktif
  useEffect(() => {
    if (!logoSettings?.image || typeof document === 'undefined') return;
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/png';
    link.href = logoSettings.image;
  }, [logoSettings?.image]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let timeoutId;
    const resetTimer = () => {
      if (adminUser) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          setAdminUser(null);
          showToast("Sesi habis. Anda telah otomatis logout.", "error");
        }, autoLogoutMinutes * 60000);
      }
    };
    if (adminUser) {
      resetTimer();
      window.addEventListener('mousemove', resetTimer);
      window.addEventListener('keypress', resetTimer);
      window.addEventListener('click', resetTimer);
      window.addEventListener('scroll', resetTimer);
    }
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keypress', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('scroll', resetTimer);
    };
  }, [adminUser, autoLogoutMinutes]);

  // Deteksi status koneksi internet (Online/Offline)
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast("Koneksi kembali tersambung (Online).", "success");
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast("Koneksi terputus! Anda sedang dalam mode Offline.", "error");
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortBy, filterType, filterYear, dateFrom, dateTo, itemsPerPage, isTrashView]);

  // Pintasan Keyboard: '/' atau Ctrl+K untuk cari, Esc untuk tutup modal / batal pilih
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select';

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === '/' && !isTyping && !showDocForm && !showSettings && !selectedDoc && !showLoginModal) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === 'Escape') {
        if (confirmDialog.isOpen) setConfirmDialog({ isOpen: false, message: '', onConfirm: null });
        else if (showLogoutConfirm) setShowLogoutConfirm(false);
        else if (showLoginModal) { setShowLoginModal(false); setLoginError(''); }
        else if (showSettings) setShowSettings(false);
        else if (showDocForm && !isSubmitting) handleRequestCloseDocForm();
        else if (selectedDoc) setSelectedDoc(null);
        else if (isSelectionMode) { setIsSelectionMode(false); setSelectedItemsForAction([]); }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmDialog.isOpen, showLogoutConfirm, showLoginModal, showSettings, showDocForm, isSubmitting, selectedDoc, isSelectionMode, hasUnsavedChanges]);

  // Sinkronkan detail dokumen yang sedang dibuka dengan data terbaru dari database
  useEffect(() => {
    if (!selectedDoc) return;
    const latestDoc = documents.find(d => d.id === selectedDoc.id);
    if (latestDoc) {
      setSelectedDoc(latestDoc);
    }
  }, [documents]);

  // Inisialisasi GSAP + ScrollTrigger (judul per kata) dan Lenis Smooth Scroll
  useEffect(() => {
    let isMounted = true;
    let lenisInstance = null;
    let gsapContext = null;
    let tickerCallback = null;

    const loadScript = (src) => new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.getAttribute('data-loaded') === 'true') return resolve();
        existing.addEventListener('load', resolve);
        existing.addEventListener('error', reject);
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => {
        s.setAttribute('data-loaded', 'true');
        resolve();
      };
      s.onerror = reject;
      document.head.appendChild(s);
    });

    const initMotion = async () => {
      try {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js');
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js');
        await loadScript('https://unpkg.com/@studio-freight/lenis@1.0.42/dist/lenis.min.js');

        if (!isMounted) return;

        if (window.Lenis && window.gsap && window.ScrollTrigger) {
          window.gsap.registerPlugin(window.ScrollTrigger);

          // 1. Inisialisasi Lenis Smooth Scroll
          lenisInstance = new window.Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: true,
          });
          lenisRef.current = lenisInstance;

          lenisInstance.on('scroll', window.ScrollTrigger.update);

          tickerCallback = (time) => {
            lenisInstance.raf(time * 1000);
          };
          window.gsap.ticker.add(tickerCallback);
          window.gsap.ticker.lagSmoothing(0);

          // 2. Animasi GSAP Judul Muncul Per Kata saat di-Scroll
          gsapContext = window.gsap.context(() => {
            const wordElements = document.querySelectorAll('.gsap-word');
            if (wordElements.length > 0) {
              window.gsap.fromTo(
                wordElements,
                { y: 40, opacity: 0, rotateX: -20 },
                {
                  y: 0,
                  opacity: 1,
                  rotateX: 0,
                  duration: 0.85,
                  stagger: 0.08,
                  ease: 'power3.out',
                  scrollTrigger: {
                    trigger: '.gsap-hero-trigger',
                    start: 'top 85%',
                    toggleActions: 'play none none reverse',
                  },
                }
              );
            }
          });
        }
      } catch (err) {
        console.warn('Gagal memuat library animasi:', err);
      }
    };

    initMotion();

    return () => {
      isMounted = false;
      if (gsapContext) gsapContext.revert();
      if (window.gsap && tickerCallback) window.gsap.ticker.remove(tickerCallback);
      if (lenisInstance) lenisInstance.destroy();
      lenisRef.current = null;
    };
  }, []);

  // Jeda Lenis saat modal terbuka agar scroll di dalam modal berfungsi normal
  useEffect(() => {
    const anyModalOpen = showDocForm || showSettings || Boolean(selectedDoc) || showLoginModal || showLogoutConfirm || confirmDialog.isOpen;
    if (lenisRef.current) {
      if (anyModalOpen) lenisRef.current.stop();
      else lenisRef.current.start();
    }
  }, [showDocForm, showSettings, selectedDoc, showLoginModal, showLogoutConfirm, confirmDialog.isOpen]);

  useEffect(() => {
    if (!editingDoc && showDocForm) {
      setFormData(prev => ({
        ...prev,
        nomorUrut: getNextNomorUrut(prev.jenisSurat, documents)
      }));
    }
  }, [formData.jenisSurat, documents, editingDoc, showDocForm, startAgendaMasuk, startAgendaKeluar, agendaModeMasuk, agendaModeKeluar]);

  const filteredAndSortedDocs = useMemo(() => {
    const sourceDocs = isTrashView ? trashedDocuments : activeDocuments;
    let result = sourceDocs.filter(d => {
      const searchLower = searchTerm.toLowerCase();
      const isTypeMatch = filterType === 'Semua' ? true : d.jenisSurat === filterType;
      const isYearMatch = filterYear === 'Semua' ? true : Boolean(d.tanggal && d.tanggal.startsWith(filterYear));
      const isDateFromMatch = dateFrom ? (d.tanggal && d.tanggal >= dateFrom) : true;
      const isDateToMatch = dateTo ? (d.tanggal && d.tanggal <= dateTo) : true;
      
      const isSearchMatch = (d.nomorBerkas || '').toLowerCase().includes(searchLower) || 
                            (d.alamatPenerima || '').toLowerCase().includes(searchLower) ||
                            (d.perihal && d.perihal.toLowerCase().includes(searchLower)) ||
                            (d.nomorUrut && d.nomorUrut.toString().includes(searchLower));
                            
      return isTypeMatch && isYearMatch && isDateFromMatch && isDateToMatch && isSearchMatch;
    });

    if (isTrashView) {
      result.sort((a, b) => new Date(b.deletedAt || 0) - new Date(a.deletedAt || 0));
      return result;
    }

    switch(sortBy) {
      case 'Nomor Urut Terlama':
         result.sort((a, b) => {
            const numA = Number(a.nomorUrut) || 0;
            const numB = Number(b.nomorUrut) || 0;
            if (numA !== numB) return numA - numB; 
            return new Date(a.tanggal) - new Date(b.tanggal);
         });
        break;
      case 'Nomor Urut Terbaru':
      default:
         result.sort((a, b) => {
            const numA = Number(a.nomorUrut) || 0;
            const numB = Number(b.nomorUrut) || 0;
            if (numA !== numB) return numB - numA; 
            return new Date(b.tanggal) - new Date(a.tanggal);
         });
        break;
    }

    result.sort((a, b) => (b.isPinned === true ? 1 : 0) - (a.isPinned === true ? 1 : 0));
    return result;
  }, [searchTerm, sortBy, filterType, filterYear, dateFrom, dateTo, activeDocuments, trashedDocuments, isTrashView]);

  const safeItemsPerPage = isNaN(itemsPerPage) ? 10 : itemsPerPage;
  const totalPages = Math.ceil(filteredAndSortedDocs.length / safeItemsPerPage);
  const safePage = Number(currentPage) || 1;
  const paginatedDocs = filteredAndSortedDocs.slice((safePage - 1) * safeItemsPerPage, safePage * safeItemsPerPage);

  useEffect(() => {
    if (window.gsap) {
      const cards = document.querySelectorAll('.sigap-doc-card');
      if (cards.length > 0) {
        window.gsap.fromTo(
          cards,
          { y: 35, opacity: 0, scale: 0.96 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.6,
            stagger: 0.07,
            ease: 'power3.out',
            clearProps: 'transform',
          }
        );
      }
    }
  }, [paginatedDocs.length, currentPage, sortBy, searchTerm]);

  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError('');
    if (loginCreds.username === superAdminCreds.username && loginCreds.password === superAdminCreds.password) {
      setAdminUser({ username: 'Super Admin', role: 'superadmin' });
      setShowLoginModal(false);
      setLoginCreds({ username: '', password: '' });
      showToast('Berhasil Login sebagai Super Admin!');
    } else if (loginCreds.username === adminCreds.username && loginCreds.password === adminCreds.password) {
      setAdminUser({ username: 'Petugas TU', role: 'admin' });
      setShowLoginModal(false);
      setLoginCreds({ username: '', password: '' });
      showToast('Berhasil Login sebagai Petugas!');
    } else {
      setLoginError('Username atau Password tidak valid!');
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
    setIsSelectionMode(false);
    setSelectedItemsForAction([]);
    setIsTrashView(false);
  };

  const handleTogglePin = async (id, e) => {
    e.stopPropagation();
    if (adminUser?.role !== 'superadmin') return;
    const docItem = documents.find(d => d.id === id);
    if (!docItem) return;
    
    if (db && fbUser) {
      try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'laskar_docs', id), {
          ...docItem,
          isPinned: !docItem.isPinned,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.error("Gagal memperbarui sematan di database:", err);
        showToast("Gagal memperbarui data ke server.", "error");
        return;
      }
    } else {
      showToast("Sistem offline, gagal menyimpan perubahan ke database.", "error");
      return;
    }
    showToast(docItem.isPinned ? "Arsip dilepas dari sematan." : "Arsip diprioritaskan!");
  };

  // -------------------------------------------------------------
  // FITUR PILIH BANYAK (BULK SELECTION)
  // -------------------------------------------------------------
  const handleToggleSelectDoc = (id, e) => {
    if (e) e.stopPropagation();
    setSelectedItemsForAction(prev => {
      if (prev.includes(id)) {
        const newArr = prev.filter(item => item !== id);
        if (newArr.length === 0) setIsSelectionMode(false);
        return newArr;
      } else {
        if (!isSelectionMode) setIsSelectionMode(true);
        return [...prev, id];
      }
    });
  };

  const handleBulkDelete = () => {
    if (selectedItemsForAction.length === 0) return;
    if (adminUser?.role !== 'superadmin') return;
    setConfirmDialog({
      isOpen: true,
      message: `Anda akan memindahkan ${selectedItemsForAction.length} arsip terpilih ke Sampah (Recycle Bin). Nomor urut akan langsung tersedia kembali. Lanjutkan?`,
      onConfirm: async () => {
        const nowIso = new Date().toISOString();
        if (db && fbUser) {
          try {
            const batch = writeBatch(db);
            selectedItemsForAction.forEach((id) => {
               const docItem = documents.find(d => d.id === id);
               if (docItem) {
                 const lockId = `lock_${docItem.jenisSurat.replace(/\s+/g, '')}_${docItem.nomorUrut}`;
                 const existingHistory = Array.isArray(docItem.history) ? docItem.history : [];
                 const trashHistoryEntry = {
                   version: `v${existingHistory.length + 1}.0`,
                   date: nowIso,
                   updatedBy: adminUser ? adminUser.username : 'Super Admin',
                   description: 'Arsip dipindahkan ke Sampah (Recycle Bin).'
                 };
                 batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'laskar_docs', id), {
                   ...docItem,
                   isDeleted: true,
                   deletedAt: nowIso,
                   deletedBy: adminUser ? adminUser.username : 'Super Admin',
                   isPinned: false,
                   history: [trashHistoryEntry, ...existingHistory]
                 }, { merge: true });
                 batch.delete(doc(db, 'artifacts', appId, 'public', 'data', 'laskar_locks', lockId));
               }
            });
            await batch.commit();
            showToast(`${selectedItemsForAction.length} arsip dipindahkan ke Sampah!`);
          } catch (e) {
            console.error("Bulk Soft Delete Error", e);
            showToast("Sebagian data gagal dipindahkan ke Sampah.", "error");
          }
        } else {
          showToast("Sistem offline, gagal memindahkan ke Sampah.", "error");
        }
        setSelectedItemsForAction([]);
        setIsSelectionMode(false);
      }
    });
  };

  // Pulihkan satu arsip dari Sampah (Recycle Bin) dengan validasi gembok di database
  const handleRestoreDoc = async (docItem, e) => {
    if (e) e.stopPropagation();
    if (adminUser?.role !== 'superadmin') return;
    if (!db || !fbUser) {
      showToast("Sistem offline, tidak dapat memulihkan arsip.", "error");
      return;
    }

    const nowIso = new Date().toISOString();
    try {
      await runTransaction(db, async (transaction) => {
        const lockId = `lock_${docItem.jenisSurat.replace(/\s+/g, '')}_${docItem.nomorUrut}`;
        const lockRef = doc(db, 'artifacts', appId, 'public', 'data', 'laskar_locks', lockId);
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'laskar_docs', docItem.id);

        const [lockSnap, docSnap] = await Promise.all([
          transaction.get(lockRef),
          transaction.get(docRef)
        ]);

        if (!docSnap.exists()) {
          throw new Error("DOC_NOT_FOUND");
        }

        if (lockSnap.exists()) {
          const lockData = lockSnap.data();
          if (lockData.docId && lockData.docId !== docItem.id) {
            const linkedDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'laskar_docs', lockData.docId);
            const linkedDocSnap = await transaction.get(linkedDocRef);
            if (linkedDocSnap.exists()) {
              const linkedData = linkedDocSnap.data();
              if (!linkedData.isDeleted && Number(linkedData.nomorUrut) === Number(docItem.nomorUrut) && linkedData.jenisSurat === docItem.jenisSurat) {
                throw new Error("NUM_TAKEN");
              }
            }
          }
        }

        const currentData = docSnap.data();
        const existingHistory = Array.isArray(currentData.history) ? currentData.history : [];
        const restoreHistoryEntry = {
          version: `v${existingHistory.length + 1}.0`,
          date: nowIso,
          updatedBy: adminUser ? adminUser.username : 'Super Admin',
          description: 'Arsip dipulihkan dari Sampah (Recycle Bin).'
        };

        transaction.set(lockRef, { docId: docItem.id, timestamp: nowIso });
        transaction.set(docRef, {
          ...currentData,
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
          updatedAt: nowIso,
          updatedBy: adminUser ? adminUser.username : 'Super Admin',
          history: [restoreHistoryEntry, ...existingHistory]
        }, { merge: true });
      });

      showToast(`Arsip #${docItem.nomorUrut} berhasil dipulihkan ke Arsip Aktif!`);
    } catch (err) {
      console.error("Restore failed:", err);
      if (err.message === "NUM_TAKEN") {
        showToast(`Gagal memulihkan: Nomor Agenda #${docItem.nomorUrut} (${docItem.jenisSurat}) sudah dipakai arsip aktif lain!`, "error");
      } else if (err.message === "DOC_NOT_FOUND") {
        showToast("Arsip tidak ditemukan di database.", "error");
      } else {
        showToast("Terjadi kesalahan saat memulihkan arsip.", "error");
      }
    }
  };

  // Pulihkan banyak arsip sekaligus dari Sampah
  const handleBulkRestore = async () => {
    if (selectedItemsForAction.length === 0 || adminUser?.role !== 'superadmin') return;
    if (!db || !fbUser) {
      showToast("Sistem offline, tidak dapat memulihkan arsip.", "error");
      return;
    }

    let restoredCount = 0;
    let conflictNumbers = [];
    const nowIso = new Date().toISOString();

    for (const id of selectedItemsForAction) {
      const docItem = trashedDocuments.find(d => d.id === id);
      if (!docItem) continue;
      try {
        await runTransaction(db, async (transaction) => {
          const lockId = `lock_${docItem.jenisSurat.replace(/\s+/g, '')}_${docItem.nomorUrut}`;
          const lockRef = doc(db, 'artifacts', appId, 'public', 'data', 'laskar_locks', lockId);
          const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'laskar_docs', docItem.id);

          const [lockSnap, docSnap] = await Promise.all([
            transaction.get(lockRef),
            transaction.get(docRef)
          ]);

          if (!docSnap.exists()) return;

          if (lockSnap.exists()) {
            const lockData = lockSnap.data();
            if (lockData.docId && lockData.docId !== docItem.id) {
              const linkedDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'laskar_docs', lockData.docId);
              const linkedDocSnap = await transaction.get(linkedDocRef);
              if (linkedDocSnap.exists()) {
                const linkedData = linkedDocSnap.data();
                if (!linkedData.isDeleted && Number(linkedData.nomorUrut) === Number(docItem.nomorUrut) && linkedData.jenisSurat === docItem.jenisSurat) {
                  throw new Error("NUM_TAKEN");
                }
              }
            }
          }

          const currentData = docSnap.data();
          const existingHistory = Array.isArray(currentData.history) ? currentData.history : [];
          const restoreHistoryEntry = {
            version: `v${existingHistory.length + 1}.0`,
            date: nowIso,
            updatedBy: adminUser ? adminUser.username : 'Super Admin',
            description: 'Arsip dipulihkan massal dari Sampah.'
          };

          transaction.set(lockRef, { docId: docItem.id, timestamp: nowIso });
          transaction.set(docRef, {
            ...currentData,
            isDeleted: false,
            deletedAt: null,
            deletedBy: null,
            updatedAt: nowIso,
            updatedBy: adminUser ? adminUser.username : 'Super Admin',
            history: [restoreHistoryEntry, ...existingHistory]
          }, { merge: true });
        });
        restoredCount++;
      } catch (err) {
        if (err.message === "NUM_TAKEN") {
          conflictNumbers.push(`#${docItem.nomorUrut}`);
        }
      }
    }

    setSelectedItemsForAction([]);
    setIsSelectionMode(false);

    if (restoredCount > 0 && conflictNumbers.length === 0) {
      showToast(`${restoredCount} arsip berhasil dipulihkan!`);
    } else if (restoredCount > 0 && conflictNumbers.length > 0) {
      showToast(`${restoredCount} arsip dipulihkan. Nomor ${conflictNumbers.join(', ')} dilewati karena sudah dipakai.`, "error");
    } else if (conflictNumbers.length > 0) {
      showToast(`Gagal memulihkan: Nomor ${conflictNumbers.join(', ')} sudah dipakai arsip aktif lain.`, "error");
    }
  };

  // Hapus permanen satu arsip dari Sampah
  const handlePermanentDeleteDoc = (docItem, e) => {
    if (e) e.stopPropagation();
    if (adminUser?.role !== 'superadmin') return;
    setConfirmDialog({
      isOpen: true,
      message: `Hapus arsip #${docItem.nomorUrut} secara PERMANEN dari database? Tindakan ini tidak dapat dibatalkan.`,
      onConfirm: async () => {
        if (db && fbUser) {
          try {
            await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'laskar_docs', docItem.id));
            showToast(`Arsip #${docItem.nomorUrut} dihapus permanen dari database!`);
          } catch (err) {
            console.error("Permanent Delete Error:", err);
            showToast("Gagal menghapus arsip secara permanen.", "error");
          }
        } else {
          showToast("Sistem offline, gagal menghapus permanen.", "error");
        }
      }
    });
  };

  // Hapus permanen massal dari Sampah
  const handleBulkPermanentDelete = () => {
    if (selectedItemsForAction.length === 0 || adminUser?.role !== 'superadmin') return;
    setConfirmDialog({
      isOpen: true,
      message: `Hapus ${selectedItemsForAction.length} arsip terpilih secara PERMANEN dari database? Tindakan ini tidak dapat dibatalkan.`,
      onConfirm: async () => {
        if (db && fbUser) {
          try {
            const batch = writeBatch(db);
            selectedItemsForAction.forEach((id) => {
              batch.delete(doc(db, 'artifacts', appId, 'public', 'data', 'laskar_docs', id));
            });
            await batch.commit();
            showToast(`${selectedItemsForAction.length} arsip dihapus permanen!`);
          } catch (err) {
            console.error("Bulk Permanent Delete Error:", err);
            showToast("Gagal menghapus permanen sebagian arsip.", "error");
          }
        } else {
          showToast("Sistem offline, gagal menghapus permanen.", "error");
        }
        setSelectedItemsForAction([]);
        setIsSelectionMode(false);
      }
    });
  };

  // Kosongkan seluruh isi Sampah (Recycle Bin)
  const handleEmptyTrash = () => {
    if (trashedDocuments.length === 0 || adminUser?.role !== 'superadmin') return;
    setConfirmDialog({
      isOpen: true,
      message: `Kosongkan seluruh Sampah (${trashedDocuments.length} arsip) secara PERMANEN dari database? Tindakan ini tidak dapat dibatalkan.`,
      onConfirm: async () => {
        if (db && fbUser) {
          try {
            const chunkSize = 400;
            for (let i = 0; i < trashedDocuments.length; i += chunkSize) {
              const chunk = trashedDocuments.slice(i, i + chunkSize);
              const batch = writeBatch(db);
              chunk.forEach((item) => {
                batch.delete(doc(db, 'artifacts', appId, 'public', 'data', 'laskar_docs', item.id));
              });
              await batch.commit();
            }
            setSelectedItemsForAction([]);
            setIsSelectionMode(false);
            showToast("Seluruh isi Sampah berhasil dikosongkan permanen!");
          } catch (err) {
            console.error("Empty Trash Error:", err);
            showToast("Gagal mengosongkan Sampah.", "error");
          }
        } else {
          showToast("Sistem offline, gagal mengosongkan Sampah.", "error");
        }
      }
    });
  };

  // SISTEM PENGUNCIAN TRANSAKSI & LOGIKA AUTO APPEND
  const handleSaveDoc = async (e) => {
    e.preventDefault();
    if (isSubmitting) return; 
    setIsSubmitting(true);    
    
    const isTwoPart = formData.formatSurat === 'Naskah Dinas Penetapan' || formData.formatSurat === 'Naskah Dinas Korespondensi/ Khusus';

    try {
      if (editingDoc) {
        if (adminUser?.role !== 'superadmin') {
          showToast("Hanya Super Admin yang memiliki izin untuk mengedit arsip!", "error");
          setShowDocForm(false);
          return;
        }

        if (!db || !fbUser) {
          showToast("Sistem offline, perubahan tidak dapat disimpan ke database.", "error");
          return;
        }
        
        let formattedNomorBerkas = '';
        if (isTwoPart) {
            formattedNomorBerkas = `${formData.nomorBerkas.trim()}${formData.nomorUrut}${formData.nomorBerkasBelakang.trim()}`;
        } else {
            formattedNomorBerkas = `${formData.nomorBerkas.trim()}${formData.nomorUrut}`;
        }

        const finalDataToSave = { 
            ...formData, 
            nomorBerkasDepan: formData.nomorBerkas.trim(),
            nomorBerkasBelakang: isTwoPart ? formData.nomorBerkasBelakang.trim() : '',
            nomorBerkas: formattedNomorBerkas 
        };

        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'laskar_docs', editingDoc.id);
        const latestSnap = await getDoc(docRef);
        const baseDoc = latestSnap.exists() ? { id: latestSnap.id, ...latestSnap.data() } : editingDoc;
        const existingHistory = Array.isArray(baseDoc.history) ? baseDoc.history : [];

        // Catat rincian kolom yang berubah saat pengeditan
        const changedFields = [];
        if (baseDoc.jenisSurat !== finalDataToSave.jenisSurat) changedFields.push(`Jenis Surat (${baseDoc.jenisSurat || '-'} → ${finalDataToSave.jenisSurat})`);
        if (Number(baseDoc.nomorUrut) !== Number(finalDataToSave.nomorUrut)) changedFields.push(`No. Agenda (#${baseDoc.nomorUrut} → #${finalDataToSave.nomorUrut})`);
        if ((baseDoc.nomorBerkas || '') !== (finalDataToSave.nomorBerkas || '')) changedFields.push(`No. Berkas`);
        if ((baseDoc.alamatPenerima || '') !== (finalDataToSave.alamatPenerima || '')) changedFields.push(finalDataToSave.jenisSurat === 'Surat Masuk' ? 'Alamat Pengirim' : 'Alamat Penerima');
        if ((baseDoc.tanggal || '') !== (finalDataToSave.tanggal || '')) changedFields.push('Tanggal');
        if ((baseDoc.perihal || '') !== (finalDataToSave.perihal || '')) changedFields.push('Perihal');

        const nowIso = new Date().toISOString();
        const newHistoryEntry = {
          version: `v${existingHistory.length + 1}.0`,
          date: nowIso,
          updatedBy: adminUser ? adminUser.username : 'Super Admin',
          description: changedFields.length > 0
            ? `Data arsip diperbarui (${changedFields.join(', ')}).`
            : `Data arsip diperbarui.`
        };

        const updatedDoc = {
          ...baseDoc,
          ...finalDataToSave,
          updatedBy: adminUser ? adminUser.username : 'Super Admin',
          updatedAt: nowIso,
          history: [newHistoryEntry, ...existingHistory]
        };

        const batch = writeBatch(db);
        batch.set(docRef, updatedDoc);
        if (baseDoc.jenisSurat !== updatedDoc.jenisSurat || Number(baseDoc.nomorUrut) !== Number(updatedDoc.nomorUrut)) {
            const oldLockId = `lock_${baseDoc.jenisSurat.replace(/\s+/g, '')}_${baseDoc.nomorUrut}`;
            const newLockId = `lock_${updatedDoc.jenisSurat.replace(/\s+/g, '')}_${updatedDoc.nomorUrut}`;
            batch.delete(doc(db, 'artifacts', appId, 'public', 'data', 'laskar_locks', oldLockId));
            batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'laskar_locks', newLockId), { docId: updatedDoc.id, timestamp: nowIso });
        }
        await batch.commit();
        showToast("Data Arsip berhasil diperbarui ke Database!");
        setShowDocForm(false);
        
      } else {
        const exactDate = formData.tanggal;
        const dateCode = exactDate.replace(/-/g, '').substring(2,8);
        // Gunakan timestamp + random agar ID dokumen tidak pernah bentrok/menimpa surat lain di hari yang sama
        const uniqueSuffix = `${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const newId = `DOC-${dateCode}-${uniqueSuffix}`;
        
        if (db && fbUser) {
          const defaultExpectedNumber = formData.jenisSurat === 'Surat Masuk' 
              ? getNextNomorUrut('Surat Masuk', documents) 
              : getNextNomorUrut('Surat Keluar', documents);

          const isSuperAdminCustomOverride = (adminUser?.role === 'superadmin' && Number(formData.nomorUrut) !== Number(defaultExpectedNumber));
          
          let success = false;
          let attempt = 0;
          let currentTarget = isSuperAdminCustomOverride ? Number(formData.nomorUrut) : Number(defaultExpectedNumber);
          let numberWasChanged = false; 
          let savedNomorBerkas = '';

          while (!success && attempt < 30) {
              try {
                  await runTransaction(db, async (transaction) => {
                      const lockId = `lock_${formData.jenisSurat.replace(/\s+/g, '')}_${currentTarget}`;
                      const lockRef = doc(db, 'artifacts', appId, 'public', 'data', 'laskar_locks', lockId);

                      const lockSnap = await transaction.get(lockRef);
                      if (lockSnap.exists()) {
                          const lockData = lockSnap.data();
                          if (lockData.docId) {
                              const linkedDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'laskar_docs', lockData.docId);
                              const linkedDocSnap = await transaction.get(linkedDocRef);
                              if (linkedDocSnap.exists()) {
                                  const linkedData = linkedDocSnap.data();
                                  // Hanya dianggap terpakai jika dokumen tertaut masih aktif (tidak di Sampah) dan memegang nomor & jenis surat ini
                                  if (!linkedData.isDeleted && Number(linkedData.nomorUrut) === Number(currentTarget) && linkedData.jenisSurat === formData.jenisSurat) {
                                      throw new Error("NUM_TAKEN");
                                  }
                              }
                          }
                          // Jika gembok yatim/usang (tanpa docId, dokumen sudah terhapus, atau nomornya sudah berubah), gembok otomatis diambil alih
                      }

                      let formattedNomorBerkas = '';
                      if (isTwoPart) {
                          formattedNomorBerkas = `${formData.nomorBerkas.trim()}${currentTarget}${formData.nomorBerkasBelakang.trim()}`;
                      } else {
                          formattedNomorBerkas = `${formData.nomorBerkas.trim()}${currentTarget}`;
                      }
                      savedNomorBerkas = formattedNomorBerkas;

                      const newDocData = { 
                        ...formData,
                        nomorUrut: currentTarget,
                        nomorBerkasDepan: formData.nomorBerkas.trim(),
                        nomorBerkasBelakang: isTwoPart ? formData.nomorBerkasBelakang.trim() : '',
                        nomorBerkas: formattedNomorBerkas,
                        id: newId, 
                        updatedBy: adminUser ? adminUser.username : 'Sistem TU',
                        history: [{ 
                          version: "1.0", 
                          date: new Date().toISOString(), 
                          updatedBy: adminUser ? adminUser.username : 'Petugas', 
                          description: `Pencatatan arsip baru.` 
                        }],
                        isPinned: false
                      };

                      const newDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'laskar_docs', newId);

                      transaction.set(lockRef, { docId: newId, timestamp: new Date().toISOString() });
                      transaction.set(newDocRef, newDocData);
                  }); 
                  
                  success = true;
              } catch (err) {
                  if (err.message === "NUM_TAKEN") {
                      if (isSuperAdminCustomOverride) {
                          throw new Error("MANUAL_TAKEN");
                      }
                      numberWasChanged = true; 
                      attempt++;
                      let nextNum = Number(currentTarget) + 1;
                      while (documents.some(d => !d.isDeleted && d.jenisSurat === formData.jenisSurat && Number(d.nomorUrut) === nextNum)) {
                          nextNum++;
                      }
                      currentTarget = nextNum;
                  } else {
                      throw err; 
                  }
              }
          }

          if (success) {
             if (numberWasChanged) {
                 showToast(`Nomor telah digunakan perangkat lain! Dicatat di urutan baru: #${currentTarget}`, "success", savedNomorBerkas);
             } else {
                 showToast(`Arsip #${currentTarget} berhasil dicatat!`, "success", savedNomorBerkas);
             }
             setShowDocForm(false);
          } else {
             showToast("Gagal menyimpan setelah beberapa kali percobaan. Server sibuk.", "error");
          }
        } else {
            showToast("Sistem offline, tidak bisa menyimpan.", "error");
        }
      }
    } catch (e) {
      console.error("Save failed: ", e);
      if (e.message === "MANUAL_TAKEN") {
          showToast(`Nomor Agenda ${formData.nomorUrut} sudah digunakan! Silakan pilih nomor lain.`, "error");
      } else {
          showToast("Terjadi kesalahan saat menyimpan arsip. Silakan coba lagi.", "error");
      }
    } finally {
      setIsSubmitting(false); 
    }
  };

  const handleDeleteDoc = (id, e) => {
    e.stopPropagation();
    if (adminUser?.role !== 'superadmin') return;
    setConfirmDialog({
      isOpen: true,
      message: "Pindahkan data arsip ini ke Sampah (Recycle Bin)? Anda masih dapat memulihkannya nanti.",
      onConfirm: async () => {
        const nowIso = new Date().toISOString();
        if (db && fbUser) {
          const docItem = documents.find(d => d.id === id);
          if (docItem) {
            try {
              const batch = writeBatch(db);
              const lockId = `lock_${docItem.jenisSurat.replace(/\s+/g, '')}_${docItem.nomorUrut}`;
              const existingHistory = Array.isArray(docItem.history) ? docItem.history : [];
              const trashHistoryEntry = {
                version: `v${existingHistory.length + 1}.0`,
                date: nowIso,
                updatedBy: adminUser ? adminUser.username : 'Super Admin',
                description: 'Arsip dipindahkan ke Sampah (Recycle Bin).'
              };
              batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'laskar_docs', id), {
                ...docItem,
                isDeleted: true,
                deletedAt: nowIso,
                deletedBy: adminUser ? adminUser.username : 'Super Admin',
                isPinned: false,
                history: [trashHistoryEntry, ...existingHistory]
              }, { merge: true });
              batch.delete(doc(db, 'artifacts', appId, 'public', 'data', 'laskar_locks', lockId));
              await batch.commit();
              showToast("Arsip dipindahkan ke Sampah! Nomor urut kini tersedia kembali.");
            } catch (err) {
              console.error("Gagal memindahkan ke Sampah:", err);
              showToast("Gagal memindahkan arsip ke Sampah.", "error");
            }
          }
        } else {
          showToast("Sistem offline, gagal memindahkan ke Sampah.", "error");
        }
      }
    });
  };

  const generateTableHtml = (docsList = filteredAndSortedDocs) => {
    let html = '<table border="1" style="border-collapse: collapse; width: 100%; font-family: sans-serif; font-size: 12px;"><thead><tr style="background-color: #f0f0f0;">';
    html += '<th style="padding: 8px;">No. Urut</th><th style="padding: 8px;">Jenis Surat</th><th style="padding: 8px;">Nomor Berkas</th><th style="padding: 8px;">Alamat Pengirim/Penerima</th><th style="padding: 8px;">Tanggal</th><th style="padding: 8px;">Perihal</th>';
    html += '</tr></thead><tbody>';
    docsList.forEach(d => {
      html += `<tr><td style="padding: 8px;">${d.nomorUrut}</td><td style="padding: 8px;">${d.jenisSurat}</td><td style="padding: 8px;">${d.nomorBerkas}</td><td style="padding: 8px;">${d.alamatPenerima}</td><td style="padding: 8px;">${d.tanggal}</td><td style="padding: 8px;">${d.perihal || '-'}</td></tr>`;
    });
    html += '</tbody></table>';
    return html;
  };

  const handleExportExcel = (customDocs) => {
    const targetDocs = Array.isArray(customDocs) ? customDocs : filteredAndSortedDocs;
    const html = generateTableHtml(targetDocs);
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Laporan_SIGAP_${new Date().toISOString().split('T')[0]}.xls`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`Laporan Excel (${targetDocs.length} arsip) berhasil diunduh!`);
  };

  const handleExportWord = (customDocs) => {
    const targetDocs = Array.isArray(customDocs) ? customDocs : filteredAndSortedDocs;
    const html = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Laporan SIGAP</title></head>
      <body>
        <h2 style="text-align: center; font-family: sans-serif;">LAPORAN ARSIP SURAT LAPAS KALABAHI</h2>
        <p style="text-align: center; font-family: sans-serif;">Dicetak pada: ${new Date().toLocaleString('id-ID')}</p>
        <br/>
        ${generateTableHtml(targetDocs)}
      </body>
      </html>
    `;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Laporan_SIGAP_${new Date().toISOString().split('T')[0]}.doc`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`Laporan Word (${targetDocs.length} arsip) berhasil diunduh!`);
  };

  const handlePrintReport = (customDocs) => {
    const targetDocs = Array.isArray(customDocs) ? customDocs : filteredAndSortedDocs;
    const printWindow = window.open('', '', 'width=900,height=650');
    printWindow.document.write(`
      <html>
        <head>
          <title>Cetak Laporan SIGAP</title>
          <style>
            body { font-family: 'Arial', sans-serif; padding: 20px; color: #333; }
            h2 { text-align: center; margin-bottom: 5px; text-transform: uppercase; }
            p { text-align: center; font-size: 14px; margin-top: 0; color: #666; margin-bottom: 20px;}
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; }
            th { background-color: #f4f4f4; }
            @media print {
              @page { size: landscape; margin: 15mm; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h2>LAPORAN ARSIP SURAT MASUK DAN KELUAR</h2>
          <p>SIGAP - Lapas Kelas IIB Kalabahi<br/><span style="font-size: 11px;">Dicetak pada: ${new Date().toLocaleString('id-ID')} • Total: ${targetDocs.length} Arsip</span></p>
          ${generateTableHtml(targetDocs)}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  const selectedDocsList = useMemo(
    () => documents.filter(d => selectedItemsForAction.includes(d.id)),
    [documents, selectedItemsForAction]
  );

  const hasActiveFilters = filterType !== 'Semua' || filterYear !== 'Semua' || Boolean(dateFrom) || Boolean(dateTo) || Boolean(searchTerm);

  // Helper Preset Filter Waktu 1-Klik
  const getDatePresetRange = (preset) => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const toLocalISO = (d) => new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
    const todayStr = toLocalISO(now);

    if (preset === 'today') {
      return { from: todayStr, to: todayStr };
    }
    if (preset === '7days') {
      const past = new Date(now);
      past.setDate(now.getDate() - 6);
      return { from: toLocalISO(past), to: todayStr };
    }
    if (preset === 'thisMonth') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toLocalISO(firstDay), to: todayStr };
    }
    return { from: '', to: '' };
  };

  const activeDatePreset = useMemo(() => {
    if (!dateFrom || !dateTo) return null;
    for (const key of ['today', '7days', 'thisMonth']) {
      const range = getDatePresetRange(key);
      if (dateFrom === range.from && dateTo === range.to) return key;
    }
    return null;
  }, [dateFrom, dateTo]);

  const handleApplyDatePreset = (preset) => {
    if (activeDatePreset === preset) {
      setDateFrom('');
      setDateTo('');
      return;
    }
    const range = getDatePresetRange(preset);
    setFilterYear('Semua');
    setDateFrom(range.from);
    setDateTo(range.to);
  };

  return (
    <div className={`min-h-screen ${bgSettings.image ? 'bg-transparent has-custom-bg' : 'bg-slate-100 dark:bg-slate-950'} text-slate-950 dark:text-slate-100 transition-colors duration-500 font-sans selection:bg-emerald-800/30 overflow-x-hidden relative flex justify-center pb-24`}>
      {/* CUSTOM BACKGROUND PHOTO LAYER */}
      {bgSettings.image && (
        <div className="fixed inset-0 -z-20 bg-slate-100 dark:bg-slate-950 pointer-events-none overflow-hidden">
          <div
            className="w-full h-full transition-all duration-300"
            style={{
              backgroundImage: `url(${bgSettings.image})`,
              backgroundSize: bgSettings.size || 'cover',
              backgroundPosition: bgSettings.position || 'center',
              backgroundRepeat: 'no-repeat',
              filter: `blur(${bgSettings.blur || 0}px) brightness(${bgSettings.brightness ?? 100}%)`,
              transform: (bgSettings.blur || 0) > 0 ? 'scale(1.06)' : 'scale(1)'
            }}
          />
          <div
            className="absolute inset-0 bg-slate-950 transition-opacity duration-300"
            style={{ opacity: (bgSettings.overlay ?? 40) / 100 }}
          />
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200;400;600;800&display=swap');
        * { font-family: 'Plus Jakarta Sans', sans-serif; }
        
        button, select, label[for], input[type="checkbox"], input[type="file"] { cursor: pointer !important; }
        
        .glass-card { 
          background: rgba(255, 255, 255, 0.85); 
          backdrop-filter: blur(24px); 
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(16, 185, 129, 0.2); 
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.02) inset; 
        }
        .dark .glass-card { 
          background: rgba(15, 23, 42, 0.7); 
          border: 1px solid rgba(16, 185, 129, 0.15); 
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.02) inset; 
        }
        /* Menjaga kontras teks tetap tajam saat foto background aktif */
        .has-custom-bg .glass-card {
          background: rgba(255, 255, 255, 0.93);
          border-color: rgba(16, 185, 129, 0.28);
        }
        .dark .has-custom-bg .glass-card {
          background: rgba(15, 23, 42, 0.88);
          border-color: rgba(16, 185, 129, 0.24);
        }
        
        .btn-3d { 
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); 
          box-shadow: 0 6px 0 rgba(6, 95, 70, 0.6), 0 15px 20px rgba(6, 95, 70, 0.3); 
        }
        .btn-3d:hover { transform: translateY(-2px); box-shadow: 0 8px 0 rgba(6, 95, 70, 0.6), 0 20px 25px rgba(6, 95, 70, 0.4); }
        .btn-3d:active { transform: translateY(4px); box-shadow: 0 2px 0 rgba(6, 95, 70, 0.6), 0 5px 10px rgba(6, 95, 70, 0.2); }
        
        .btn-3d-orange { 
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); 
          box-shadow: 0 6px 0 rgba(234, 88, 12, 0.6), 0 15px 20px rgba(234, 88, 12, 0.3); 
        }
        .btn-3d-orange:hover { transform: translateY(-2px); box-shadow: 0 8px 0 rgba(234, 88, 12, 0.6), 0 20px 25px rgba(234, 88, 12, 0.4); }
        .btn-3d-orange:active { transform: translateY(4px); box-shadow: 0 2px 0 rgba(234, 88, 12, 0.6), 0 5px 10px rgba(234, 88, 12, 0.2); }

        .premium-input {
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(16, 185, 129, 0.3);
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
        }
        .dark .premium-input {
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(16, 185, 129, 0.2);
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
        }
        .premium-input:focus {
          border-color: #065f46;
          box-shadow: 0 0 0 4px rgba(6, 95, 70, 0.15), inset 0 2px 4px rgba(0,0,0,0.02);
          background: #ffffff;
        }
        .dark .premium-input:focus {
          border-color: #34d399;
          box-shadow: 0 0 0 4px rgba(52, 211, 153, 0.15), inset 0 2px 4px rgba(0,0,0,0.2);
          background: #0f172a;
        }

        /* Motion Hover Card */
        .sigap-doc-card {
          transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.35s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.3s ease;
          will-change: transform, opacity;
        }
        .sigap-doc-card:hover {
          transform: translateY(-8px) scale(1.015);
          box-shadow: 0 25px 40px -12px rgba(6, 95, 70, 0.22);
        }
        .dark .sigap-doc-card:hover {
          box-shadow: 0 25px 40px -12px rgba(16, 185, 129, 0.18);
        }

        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #6ee7b7; border-radius: 10px; }
        .dark ::-webkit-scrollbar-thumb { background: #065f46; }
        ::-webkit-scrollbar-thumb:hover { background: #34d399; }
      `}</style>

      {/* DYNAMIC BACKGROUND BLOBS */}
      <div className="fixed top-[-10%] left-[-10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] bg-emerald-800/20 dark:bg-emerald-600/10 rounded-full blur-[100px] -z-10 animate-pulse pointer-events-none mix-blend-multiply dark:mix-blend-lighten" style={{animationDuration: '8s'}}></div>
      <div className="fixed bottom-[-10%] right-[-5%] w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] bg-orange-500/20 dark:bg-orange-600/10 rounded-full blur-[120px] -z-10 animate-pulse pointer-events-none mix-blend-multiply dark:mix-blend-lighten" style={{animationDuration: '10s'}}></div>

      {/* GLOBAL TOAST */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[300] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-10 fade-in duration-300 backdrop-blur-md border max-w-[92vw] ${toast.type === 'error' ? 'bg-rose-600/95 border-rose-500 text-white' : 'bg-emerald-600/95 border-emerald-500 text-white'}`}>
          {toast.type === 'error' ? <AlertCircle size={22} className="shrink-0"/> : <CheckCircle2 size={22} className="shrink-0"/>}
          <span className="text-xs font-bold uppercase tracking-widest text-white">{toast.message}</span>
          {toast.copyText && (
            <button
              type="button"
              onClick={(e) => handleCopyText(toast.copyText, 'toast-copy', e)}
              className="ml-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shrink-0 transition-colors"
            >
              <Copy size={13}/> Salin Nomor
            </button>
          )}
        </div>
      )}

      {/* FLOAT BULK ACTION BAR UNTUK SUPERADMIN */}
      {isSelectionMode && adminUser?.role === 'superadmin' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex flex-wrap items-center justify-center gap-2 sm:gap-3 bg-slate-900/95 backdrop-blur-md text-white px-5 py-3.5 rounded-3xl sm:rounded-full shadow-2xl border border-slate-700 animate-in slide-in-from-bottom-10 fade-in duration-300 max-w-[95vw]">
           <span className="text-xs sm:text-sm font-black whitespace-nowrap"><span className="text-orange-500">{selectedItemsForAction.length}</span> Terpilih</span>
           <div className="w-px h-5 bg-slate-700 hidden sm:block"></div>
           <button
             type="button"
             onClick={() => {
               const pageIds = paginatedDocs.map(d => d.id);
               const allSelected = pageIds.length > 0 && pageIds.every(id => selectedItemsForAction.includes(id));
               if (allSelected) {
                 setSelectedItemsForAction(prev => prev.filter(id => !pageIds.includes(id)));
               } else {
                 setSelectedItemsForAction(prev => Array.from(new Set([...prev, ...pageIds])));
               }
             }}
             className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-full text-[10px] font-black uppercase tracking-wider transition-colors"
           >
             {paginatedDocs.length > 0 && paginatedDocs.every(d => selectedItemsForAction.includes(d.id)) ? 'Batal Hal Ini' : 'Pilih Hal Ini'}
           </button>
           {isTrashView ? (
             <>
               <button
                 type="button"
                 onClick={handleBulkRestore}
                 disabled={selectedItemsForAction.length === 0}
                 className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all"
               >
                 <RotateCcw size={13}/> Pulihkan
               </button>
               <button
                 type="button"
                 onClick={handleBulkPermanentDelete}
                 disabled={selectedItemsForAction.length === 0}
                 className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all"
               >
                 <Trash2 size={13}/> Hapus Permanen
               </button>
             </>
           ) : (
             <>
               <button
                 type="button"
                 onClick={() => handleExportExcel(selectedDocsList)}
                 disabled={selectedItemsForAction.length === 0}
                 className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all"
                 title="Ekspor Terpilih ke Excel"
               >
                 <Table size={13}/> Excel
               </button>
               <button
                 type="button"
                 onClick={() => handleExportWord(selectedDocsList)}
                 disabled={selectedItemsForAction.length === 0}
                 className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all"
                 title="Ekspor Terpilih ke Word"
               >
                 <FileText size={13}/> Word
               </button>
               <button
                 type="button"
                 onClick={() => handlePrintReport(selectedDocsList)}
                 disabled={selectedItemsForAction.length === 0}
                 className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all"
                 title="Cetak Terpilih"
               >
                 <Printer size={13}/> Print
               </button>
               <button onClick={handleBulkDelete} disabled={selectedItemsForAction.length === 0} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all">
                 <Trash2 size={13}/> Ke Sampah
               </button>
             </>
           )}
           <button onClick={() => { setIsSelectionMode(false); setSelectedItemsForAction([]); }} className="p-1.5 text-slate-400 hover:text-white transition-colors" title="Tutup Mode Pilih">
             <X size={16}/>
           </button>
        </div>
      )}

      {/* HEADER GLOBAL */}
      <header className="fixed top-0 left-1/2 -translate-x-1/2 z-50 px-6 py-4 flex justify-between items-center pointer-events-none transition-all duration-500 w-full max-w-full">
        <div className="glass-card px-3 py-2.5 rounded-2xl pointer-events-auto flex items-center gap-2 shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-1.5">
            {adminUser?.role === 'superadmin' && (
              <button onClick={handleOpenSettings} className="p-1.5 rounded-xl bg-orange-100 dark:bg-orange-800/40 hover:bg-orange-200 transition-all" title="Pengaturan Sistem">
                <Settings className="text-orange-600 dark:text-orange-500" size={20}/>
              </button>
            )}
            <button
              onClick={() => isAdmin ? handleLogout() : setShowLoginModal(true)}
              className={`rounded-xl transition-all flex items-center justify-center ${
                isAdmin
                  ? 'p-1.5 bg-rose-100 dark:bg-rose-900/40 hover:bg-rose-200'
                  : logoSettings.image
                    ? 'p-0.5 hover:scale-105'
                    : 'p-1.5 bg-emerald-100 dark:bg-emerald-800/40 hover:bg-emerald-200'
              }`}
              title={isAdmin ? "Keluar Mode Petugas" : "Login Petugas"}
            >
              {isAdmin ? (
                <LogOut className="text-rose-600 dark:text-rose-500" size={20}/>
              ) : logoSettings.image ? (
                <div
                  className="overflow-hidden flex items-center justify-center shrink-0"
                  style={{
                    width: `${logoSettings.headerSize ?? 32}px`,
                    height: `${logoSettings.headerSize ?? 32}px`,
                    borderRadius: `${logoSettings.radius ?? 12}%`
                  }}
                >
                  <img
                    src={logoSettings.image}
                    alt="Logo SIGAP"
                    className="w-full h-full object-contain pointer-events-none select-none"
                    style={{
                      transform: `translate(${logoSettings.offsetX ?? 0}px, ${logoSettings.offsetY ?? 0}px) scale(${(logoSettings.scale ?? 100) / 100})`
                    }}
                  />
                </div>
              ) : (
                <Shield className="text-emerald-800 dark:text-emerald-400" size={20} />
              )}
            </button>
          </div>
        </div>
        
        <div className="flex gap-2 pointer-events-auto items-center">
          {/* Indikator Status Koneksi (Online/Offline) */}
          <div
            className={`flex items-center gap-1.5 px-3 py-2.5 glass-card rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm border ${
              isOnline && (!db || fbUser)
                ? 'text-emerald-700 dark:text-emerald-400 border-emerald-300/60 dark:border-emerald-700/50'
                : 'text-rose-600 dark:text-rose-400 border-rose-300/60 dark:border-rose-700/50'
            }`}
            title={isOnline && (!db || fbUser) ? 'Terhubung ke Database Server' : 'Koneksi Terputus / Offline'}
          >
            <span className="relative flex h-2 w-2 shrink-0">
              {isOnline && (!db || fbUser) && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isOnline && (!db || fbUser) ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
            </span>
            {isOnline && (!db || fbUser) ? <Wifi size={13} /> : <WifiOff size={13} />}
            <span className="hidden md:inline">{isOnline && (!db || fbUser) ? 'Online' : 'Offline'}</span>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-4 py-2.5 glass-card rounded-full text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 shadow-sm">
            <Clock size={14} className="text-orange-500" />
            {formatLiveTime(currentTime)}
          </div>
        </div>
      </header>

      <main className="pt-24 px-6 mx-auto relative z-10 flex flex-col transition-all duration-500 w-full max-w-7xl">
        
        {/* HERO SECTION (DIPADATKAN AGAR KONTEN UTAMA LANGSUNG TERLIHAT) */}
        <div className="text-center mb-8 gsap-hero-trigger">
          {logoSettings.image && logoSettings.showInHero !== false && (
            <div className="flex justify-center mb-4">
              <div
                className="overflow-hidden flex items-center justify-center"
                style={{
                  width: `${logoSettings.heroSize ?? 84}px`,
                  height: `${logoSettings.heroSize ?? 84}px`,
                  borderRadius: `${logoSettings.radius ?? 12}%`
                }}
              >
                <img
                  src={logoSettings.image}
                  alt="Logo SIGAP"
                  className="w-full h-full object-contain pointer-events-none select-none"
                  style={{
                    transform: `translate(${logoSettings.offsetX ?? 0}px, ${logoSettings.offsetY ?? 0}px) scale(${(logoSettings.scale ?? 100) / 100})`
                  }}
                />
              </div>
            </div>
          )}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 dark:bg-emerald-800/20 text-emerald-800 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-200/50 dark:border-emerald-700/30 shadow-sm mb-3">
            <div className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></div>
            Layanan Administrasi Pemasyarakatan
          </div>
          <h1 className="font-black tracking-tighter leading-[1.05] text-slate-900 dark:text-white mb-2 transition-all duration-500 text-4xl md:text-5xl">
            <span className="inline-block gsap-word">SIGAP</span>
          </h1>
          <h2 className="font-black tracking-widest text-emerald-800 dark:text-emerald-400 mb-2 uppercase transition-all duration-500 text-xs md:text-sm">
            {'Sistem Informasi Gabungan Arsip Pemasyarakatan'.split(' ').map((word, i) => (
              <span key={i} className="inline-block gsap-word mr-2">{word}</span>
            ))}
          </h2>
          <p className="max-w-2xl mx-auto font-semibold text-slate-600 dark:text-slate-400 leading-relaxed transition-all duration-500 text-xs md:text-sm">
            Sistem pengarsipan dan manajemen persuratan (Surat Masuk & Surat Keluar) Tata Usaha Lapas Kelas IIB Kalabahi.
          </p>
        </div>

        {/* DASHBOARD STATISTIK */}
        <div className="max-w-5xl mx-auto mb-6 animate-in fade-in zoom-in duration-500 w-full">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card p-5 md:p-6 rounded-[2rem] shadow-xl border border-emerald-500/20 relative overflow-hidden flex items-center gap-5 group hover:shadow-2xl hover:border-emerald-500/40 transition-all">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800/50 group-hover:scale-110 transition-transform">
                <Inbox size={26} className="text-emerald-700 dark:text-emerald-400" />
              </div>
              <div className="text-left relative z-10 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Total Surat Masuk</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-emerald-800 to-emerald-400 leading-none">
                    {activeDocuments.filter(d => d.jenisSurat === 'Surat Masuk').length}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="glass-card p-5 md:p-6 rounded-[2rem] shadow-xl border border-orange-500/20 relative overflow-hidden flex items-center gap-5 group hover:shadow-2xl hover:border-orange-500/40 transition-all">
              <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/40 rounded-full flex items-center justify-center shrink-0 border border-orange-200 dark:border-orange-800/50 group-hover:scale-110 transition-transform">
                <Send size={26} className="text-orange-600 dark:text-orange-400" />
              </div>
              <div className="text-left relative z-10 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Total Surat Keluar</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-orange-600 to-orange-400 leading-none">
                    {activeDocuments.filter(d => d.jenisSurat === 'Surat Keluar').length}
                  </p>
                </div>
              </div>
            </div>

            <div className="glass-card p-5 md:p-6 rounded-[2rem] shadow-xl border border-blue-500/20 relative overflow-hidden flex items-center gap-5 group hover:shadow-2xl hover:border-blue-500/40 transition-all">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-800/50 group-hover:scale-110 transition-transform">
                <FileText size={26} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-left relative z-10 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Total Arsip Keseluruhan</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-blue-600 to-blue-400 leading-none">
                    {activeDocuments.length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SEARCH, FILTER, RENTANG TANGGAL, SORTING & VIEW TOGGLE BAR */}
        <div className="max-w-5xl mx-auto glass-card p-4 rounded-[2rem] flex flex-col gap-3 shadow-xl border border-white/40 dark:border-slate-700/50 w-full">
          <div className="flex gap-3 flex-col md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                ref={searchInputRef}
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari No Berkas, Perihal, Alamat... (Tekan /)" 
                className="w-full pl-12 pr-14 py-3.5 bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-800/20 focus:border-emerald-800 transition-all text-slate-900 dark:text-white"
              />
              {searchTerm ? (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-rose-500"
                  title="Hapus Pencarian"
                >
                  <X size={16}/>
                </button>
              ) : (
                <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-[10px] font-black text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none">/</kbd>
              )}
            </div>
            
            <div className="flex gap-2.5 flex-wrap sm:flex-nowrap">
              {/* Filter Jenis Surat */}
              <div className="relative shrink-0 sm:w-36">
                <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <select 
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full pl-9 pr-8 py-3.5 bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl text-[11px] font-bold uppercase tracking-wide outline-none appearance-none cursor-pointer transition-all text-slate-900 dark:text-white"
                  title="Filter Jenis Surat"
                >
                  <option value="Semua">Semua Surat</option>
                  <option value="Surat Masuk">Surat Masuk</option>
                  <option value="Surat Keluar">Surat Keluar</option>
                </select>
                <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none rotate-90" size={14}/>
              </div>

              {/* Filter Cepat Berdasarkan Tahun */}
              <div className="relative shrink-0 sm:w-36">
                <CalendarDays className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <select 
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="w-full pl-9 pr-8 py-3.5 bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl text-[11px] font-bold uppercase tracking-wide outline-none appearance-none cursor-pointer transition-all text-slate-900 dark:text-white"
                  title="Filter Berdasarkan Tahun"
                >
                  <option value="Semua">Semua Tahun</option>
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>Tahun {yr}</option>
                  ))}
                </select>
                <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none rotate-90" size={14}/>
              </div>

              {/* Urutkan */}
              <div className="relative shrink-0 sm:w-44">
                <ArrowUpDown className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full pl-9 pr-8 py-3.5 bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl text-[11px] font-bold uppercase tracking-wide outline-none appearance-none cursor-pointer transition-all text-slate-900 dark:text-white"
                  title="Urutkan Arsip"
                >
                  <option value="Nomor Urut Terbaru">Terbaru</option>
                  <option value="Nomor Urut Terlama">Terlama</option>
                </select>
                <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none rotate-90" size={14}/>
              </div>

              {/* Toggle Grid / Table View */}
              <div className="flex items-center p-1 bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl shrink-0 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-emerald-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
                  title="Tampilan Kartu (Grid)"
                >
                  <LayoutGrid size={16}/>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`p-2.5 rounded-xl transition-all ${viewMode === 'table' ? 'bg-emerald-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
                  title="Tampilan Tabel (Baris)"
                >
                  <List size={16}/>
                </button>
              </div>
            </div>
          </div>

          {/* Filter Rentang Tanggal */}
          <div className="flex items-center gap-3 pt-2 border-t border-slate-200/70 dark:border-slate-800/70 flex-wrap">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <CalendarDays size={14} className="text-emerald-600 dark:text-emerald-400"/>
              <span>Rentang Tanggal:</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3.5 py-2 bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold outline-none focus:border-emerald-700 text-slate-900 dark:text-white"
                title="Dari Tanggal"
              />
              <span className="text-[10px] font-black uppercase text-slate-400 text-center">s/d</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3.5 py-2 bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold outline-none focus:border-emerald-700 text-slate-900 dark:text-white"
                title="Sampai Tanggal"
              />
            </div>

            {/* Preset Filter Waktu 1-Klik */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: 'today', label: 'Hari Ini' },
                { key: '7days', label: '7 Hari Terakhir' },
                { key: 'thisMonth', label: 'Bulan Ini' }
              ].map((preset) => {
                const isActive = activeDatePreset === preset.key;
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => handleApplyDatePreset(preset.key)}
                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                      isActive
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm shadow-emerald-700/20'
                        : 'bg-white/80 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-400'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-[10px] font-bold text-slate-500">
                Menampilkan <strong className="text-slate-800 dark:text-slate-200">{filteredAndSortedDocs.length}</strong> arsip
              </span>
            </div>
          </div>

          {/* Filter Chips (Indikator Filter Aktif) */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800/70 animate-in fade-in duration-200">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mr-1">Filter Aktif:</span>
              {searchTerm && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-black">
                  Cari: "{searchTerm}"
                  <button type="button" onClick={() => setSearchTerm('')} className="hover:text-rose-600 transition-colors" title="Hapus kata kunci"><X size={12}/></button>
                </span>
              )}
              {filterType !== 'Semua' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-black">
                  Jenis: {filterType}
                  <button type="button" onClick={() => setFilterType('Semua')} className="hover:text-rose-600 transition-colors" title="Hapus filter jenis"><X size={12}/></button>
                </span>
              )}
              {filterYear !== 'Semua' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[10px] font-black">
                  Tahun: {filterYear}
                  <button type="button" onClick={() => setFilterYear('Semua')} className="hover:text-rose-600 transition-colors" title="Hapus filter tahun"><X size={12}/></button>
                </span>
              )}
              {dateFrom && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10px] font-black">
                  Dari: {formatDateIndo(dateFrom)}
                  <button type="button" onClick={() => setDateFrom('')} className="hover:text-rose-600 transition-colors" title="Hapus tanggal mulai"><X size={12}/></button>
                </span>
              )}
              {dateTo && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10px] font-black">
                  Sampai: {formatDateIndo(dateTo)}
                  <button type="button" onClick={() => setDateTo('')} className="hover:text-rose-600 transition-colors" title="Hapus tanggal akhir"><X size={12}/></button>
                </span>
              )}
              <button
                type="button"
                onClick={() => { setSearchTerm(''); setFilterType('Semua'); setFilterYear('Semua'); setDateFrom(''); setDateTo(''); }}
                className="ml-auto px-3 py-1 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1 transition-colors"
              >
                <RotateCcw size={11}/> Reset Semua
              </button>
            </div>
          )}
        </div>

        {/* TOMBOL AKSI LAPORAN & TAMBAH MANUAL (HANYA MUNCUL JIKA ADA ADMIN LOGIN) */}
        {isAdmin && (
          <div className="max-w-5xl mx-auto mt-6 flex justify-between animate-in fade-in zoom-in duration-500 gap-3 w-full flex-wrap">
            <div className="flex flex-wrap gap-2">
                {!isTrashView && (
                  <button 
                    onClick={() => { 
                      setEditingDoc(null); 
                      resetForm();
                      setShowDocForm(true); 
                    }} 
                    className="px-8 py-4 bg-emerald-800 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest btn-3d flex items-center justify-center gap-3 shadow-emerald-900/30 shrink-0"
                  >
                    <Plus size={18} /> Tambah Arsip Baru
                  </button>
                )}
                {adminUser?.role === 'superadmin' && (isTrashView ? trashedDocuments.length > 0 : activeDocuments.length > 0) && (
                   <button 
                      onClick={() => {
                        setIsSelectionMode(!isSelectionMode);
                        setSelectedItemsForAction([]);
                      }} 
                      className={`px-5 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-2 transition-all ${isSelectionMode ? 'bg-orange-500 text-white shadow-orange-500/30 btn-3d-orange' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}
                   >
                     <CheckSquare size={18} /> {isSelectionMode ? 'Batal Pilih' : 'Pilih Banyak'}
                   </button>
                )}
                {adminUser?.role === 'superadmin' && (
                  <button
                    onClick={() => {
                      setIsTrashView(!isTrashView);
                      setIsSelectionMode(false);
                      setSelectedItemsForAction([]);
                    }}
                    className={`px-5 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-2 transition-all ${
                      isTrashView
                        ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                        : 'bg-rose-100/80 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-600 hover:text-white'
                    }`}
                    title="Buka Sampah / Recycle Bin"
                  >
                    <Trash2 size={17} />
                    <span>{isTrashView ? 'Kembali ke Arsip' : 'Sampah'}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${isTrashView ? 'bg-white/20 text-white' : 'bg-rose-600 text-white'}`}>
                      {trashedDocuments.length}
                    </span>
                  </button>
                )}
            </div>
            
            {!isTrashView && (
              <div className="flex gap-2">
                <button onClick={() => handleExportExcel()} className="px-5 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest btn-3d flex items-center justify-center gap-2 shadow-emerald-600/30 flex-1 sm:flex-none" title="Ekspor ke Excel">
                  <Table size={18} /> <span className="hidden sm:inline">Excel</span>
                </button>
                <button onClick={() => handleExportWord()} className="px-5 py-4 bg-blue-700 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest btn-3d flex items-center justify-center gap-2 shadow-blue-700/30 flex-1 sm:flex-none" title="Ekspor ke Word">
                  <FileText size={18} /> <span className="hidden sm:inline">Word</span>
                </button>
                <button onClick={() => handlePrintReport()} className="px-5 py-4 bg-slate-700 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest btn-3d flex items-center justify-center gap-2 shadow-slate-700/30 flex-1 sm:flex-none" title="Cetak/Print Laporan">
                  <Printer size={18} /> <span className="hidden sm:inline">Print</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* BANNER MODE SAMPAH / RECYCLE BIN */}
        {isTrashView && adminUser?.role === 'superadmin' && (
          <div className="max-w-5xl mx-auto mt-5 glass-card p-5 rounded-[2rem] border border-rose-300 dark:border-rose-800/70 bg-rose-50/80 dark:bg-rose-950/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full animate-in fade-in duration-300">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 size={22}/>
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-rose-700 dark:text-rose-400">Sampah / Recycle Bin ({trashedDocuments.length} Arsip)</h3>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-0.5">
                  Arsip yang dihapus sementara tersimpan di database. Anda dapat memulihkannya kembali atau menghapusnya secara permanen.
                </p>
              </div>
            </div>
            {trashedDocuments.length > 0 && (
              <button
                type="button"
                onClick={handleEmptyTrash}
                className="px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shrink-0 shadow-md shadow-rose-600/20 transition-colors"
              >
                <Trash2 size={14}/> Kosongkan Sampah
              </button>
            )}
          </div>
        )}

        {/* DOCUMENTS GRID / TABLE VIEW / SKELETON LOADING */}
        {isLoadingDocs ? (
          <div className="grid gap-6 mt-8 mb-10 w-full grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="glass-card p-6 rounded-[2rem] border border-slate-200/70 dark:border-slate-800/70 animate-pulse flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <div className="h-12 w-20 rounded-xl bg-slate-200 dark:bg-slate-800"></div>
                  <div className="h-7 w-24 rounded-xl bg-slate-200 dark:bg-slate-800"></div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-2.5 w-16 rounded bg-slate-200 dark:bg-slate-800"></div>
                    <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-800"></div>
                  </div>
                </div>
                <div className="h-12 w-full rounded-xl bg-slate-200 dark:bg-slate-800"></div>
                <div className="space-y-2">
                  <div className="h-3 w-full rounded bg-slate-200 dark:bg-slate-800"></div>
                  <div className="h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-800"></div>
                </div>
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                  <div className="h-3 w-28 rounded bg-slate-200 dark:bg-slate-800"></div>
                  <div className="h-9 w-9 rounded-xl bg-slate-200 dark:bg-slate-800"></div>
                </div>
              </div>
            ))}
          </div>
        ) : paginatedDocs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center animate-in fade-in duration-500 opacity-60 mt-16">
            {isTrashView ? <Trash2 size={80} className="text-rose-400 dark:text-rose-600 mb-6" /> : <FileText size={80} className="text-slate-400 dark:text-slate-600 mb-6" />}
            <h3 className="text-xl font-black text-slate-800 dark:text-slate-200 mb-2">{isTrashView ? 'Sampah Kosong' : 'Data Arsip Kosong'}</h3>
            <p className="text-sm font-bold text-slate-500">{isTrashView ? 'Tidak ada arsip yang dihapus sementara di Recycle Bin.' : 'Silakan sesuaikan filter kata kunci, tahun, atau rentang tanggal Anda.'}</p>
          </div>
        ) : viewMode === 'table' ? (
          <div className="glass-card rounded-[2rem] border border-slate-300 dark:border-slate-700/50 shadow-xl mt-8 mb-10 overflow-hidden w-full">
            <div data-lenis-prevent className="overflow-auto max-h-[68vh]">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-20 bg-slate-100/95 dark:bg-slate-900/95 backdrop-blur-md shadow-sm">
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {isSelectionMode && <th className="py-4 px-4 w-10 text-center">Pilih</th>}
                    <th className="py-4 px-4 whitespace-nowrap">Agenda</th>
                    <th className="py-4 px-4 whitespace-nowrap">Jenis</th>
                    <th className="py-4 px-4 whitespace-nowrap">No. Berkas</th>
                    <th className="py-4 px-4 whitespace-nowrap">Pengirim / Penerima</th>
                    <th className="py-4 px-4 min-w-[220px]">Perihal</th>
                    <th className="py-4 px-4 whitespace-nowrap">Tanggal</th>
                    <th className="py-4 px-4 text-right whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70 text-xs">
                  {paginatedDocs.map((docItem) => {
                    const isSelected = selectedItemsForAction.includes(docItem.id);
                    return (
                      <tr
                        key={docItem.id}
                        onClick={isSelectionMode ? () => handleToggleSelectDoc(docItem.id) : () => { setSelectedDoc(docItem); setShowHistory(false); }}
                        className={`transition-colors cursor-pointer ${isSelected ? 'bg-orange-50/70 dark:bg-orange-900/20' : 'hover:bg-emerald-50/50 dark:hover:bg-slate-800/50'}`}
                      >
                        {isSelectionMode && (
                          <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleToggleSelectDoc(docItem.id)}
                              className={`w-5 h-5 rounded border-2 inline-flex items-center justify-center transition-colors ${isSelected ? 'bg-orange-500 border-orange-500 text-white' : 'border-slate-400 dark:border-slate-500'}`}
                            >
                              {isSelected && <Check size={13}/>}
                            </button>
                          </td>
                        )}
                        <td className="py-3.5 px-4 whitespace-nowrap font-black text-slate-900 dark:text-white">
                          <div className="flex items-center gap-1.5">
                            <span className="text-emerald-500">#</span>{highlightText(docItem.nomorUrut, searchTerm)}
                            {docItem.isPinned && <Pin size={12} className="text-emerald-500 fill-current"/>}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${getStatusBadgeClass(docItem.jenisSurat)}`}>
                            {docItem.jenisSurat}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900 dark:text-white">{highlightText(docItem.nomorBerkas, searchTerm)}</span>
                            {docItem.nomorBerkas && (
                              <button
                                type="button"
                                onClick={(e) => handleCopyText(docItem.nomorBerkas, docItem.id, e)}
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                                title="Salin Nomor Berkas"
                              >
                                {copiedId === docItem.id ? <Check size={13} className="text-emerald-500"/> : <Copy size={13}/>}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-700 dark:text-slate-300 max-w-[180px] truncate">
                          {highlightText(docItem.alamatPenerima, searchTerm)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-medium">
                          <p className="line-clamp-2">{highlightText(docItem.perihal, searchTerm)}</p>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap font-bold text-slate-500 dark:text-slate-400">
                          {formatDateIndo(docItem.tanggal)}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center gap-1.5">
                            {isTrashView && adminUser?.role === 'superadmin' ? (
                              <>
                                <button
                                  onClick={(e) => handleRestoreDoc(docItem, e)}
                                  className="px-2.5 py-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 rounded-lg hover:bg-emerald-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-wider flex items-center gap-1"
                                  title="Pulihkan ke Arsip Aktif"
                                >
                                  <RotateCcw size={12}/> Pulihkan
                                </button>
                                <button
                                  onClick={(e) => handlePermanentDeleteDoc(docItem, e)}
                                  className="p-1.5 bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400 rounded-lg hover:bg-rose-600 hover:text-white transition-all"
                                  title="Hapus Permanen"
                                >
                                  <Trash2 size={13}/>
                                </button>
                              </>
                            ) : (
                              <>
                                {!isSelectionMode && isAdmin && (
                                  <button
                                    onClick={(e) => handleDuplicateDoc(docItem, e)}
                                    className="p-1.5 bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 rounded-lg hover:bg-blue-600 hover:text-white transition-all"
                                    title="Duplikat / Buat Serupa"
                                  >
                                    <CopyPlus size={13}/>
                                  </button>
                                )}
                                {!isSelectionMode && adminUser?.role === 'superadmin' && (
                                  <>
                                    <button onClick={(e) => handleTogglePin(docItem.id, e)} className={`p-1.5 rounded-lg transition-all ${docItem.isPinned ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-600 hover:text-white dark:bg-emerald-900/40'}`} title={docItem.isPinned ? "Lepas Sematan" : "Prioritaskan"}><Pin size={13} className={docItem.isPinned ? "fill-current" : ""}/></button>
                                    <button onClick={(e) => handleOpenEditDoc(docItem, e)} className="p-1.5 bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400 rounded-lg hover:bg-orange-600 hover:text-white transition-all" title="Edit Data"><Edit size={13}/></button>
                                    <button onClick={(e) => handleDeleteDoc(docItem.id, e)} className="p-1.5 bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400 rounded-lg hover:bg-rose-600 hover:text-white transition-all" title="Pindahkan ke Sampah"><Trash2 size={13}/></button>
                                  </>
                                )}
                              </>
                            )}
                            <button
                              onClick={() => { setSelectedDoc(docItem); setShowHistory(false); }}
                              className="p-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-400 rounded-lg hover:bg-emerald-800 hover:text-white transition-all"
                              title="Lihat Detail"
                            >
                              <ChevronRight size={15}/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 mt-8 mb-10 w-full grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {paginatedDocs.map((docItem, idx) => {
              const isSelected = selectedItemsForAction.includes(docItem.id);

              return (
                <div 
                  key={docItem.id} 
                  onClick={isSelectionMode ? () => handleToggleSelectDoc(docItem.id) : undefined}
                  className={`sigap-doc-card glass-card p-6 rounded-[2rem] border shadow-lg group flex flex-col h-full relative overflow-hidden ${isSelectionMode ? 'cursor-pointer hover:border-orange-500 hover:ring-2 hover:ring-orange-500/20' : ''} ${isSelected ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-900/20 ring-2 ring-orange-500/30' : 'border-slate-300 dark:border-slate-700/50 bg-white/60 dark:bg-slate-900/40'}`}
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${getStatusBadgeClass(docItem.jenisSurat).split(' ')[0]}`}></div>

                  <div className="flex justify-between items-start gap-3 mb-5 pl-2 relative z-20">
                    <div className="flex flex-col items-start bg-white/80 dark:bg-slate-900/80 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm backdrop-blur-sm shrink-0">
                      <span className="text-[8px] uppercase tracking-[0.2em] font-black text-slate-400 dark:text-slate-500 mb-0.5">No. Agenda</span>
                      <div className="text-xl font-black text-slate-800 dark:text-white drop-shadow-sm flex items-center gap-1 leading-none">
                        <span className="text-emerald-500">#</span>{highlightText(docItem.nomorUrut, searchTerm)}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2.5 min-w-0">
                      <div className="flex flex-wrap justify-end items-center gap-1.5">
                        {docItem.isPinned && (
                          <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-xl text-[9px] font-black uppercase tracking-widest border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 shadow-sm"><Pin size={10} className="fill-current"/> Prioritas</span>
                        )}
                        <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm border border-transparent whitespace-nowrap ${getStatusBadgeClass(docItem.jenisSurat)}`}>
                          {docItem.jenisSurat}
                        </span>
                        {isSelectionMode && (
                          <div className={`w-6 h-6 rounded flex items-center justify-center transition-colors border-2 shrink-0 ${isSelected ? 'bg-orange-500 border-orange-500 text-white' : 'border-slate-400 dark:border-slate-500 bg-white/50 dark:bg-slate-800/50'}`}>
                            {isSelected && <CheckSquare size={16} className="text-white"/>}
                          </div>
                        )}
                      </div>

                      {!isSelectionMode && isAdmin && (
                        isTrashView && adminUser?.role === 'superadmin' ? (
                          <div className="flex items-center gap-2">
                            <button onClick={(e) => handleRestoreDoc(docItem, e)} className="px-2.5 py-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm text-[10px] font-black uppercase tracking-wider flex items-center gap-1" title="Pulihkan ke Arsip Aktif"><RotateCcw size={12}/> Pulihkan</button>
                            <button onClick={(e) => handlePermanentDeleteDoc(docItem, e)} className="p-2 bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm" title="Hapus Permanen"><Trash2 size={14}/></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300">
                            <button onClick={(e) => handleDuplicateDoc(docItem, e)} className="p-2 bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm" title="Duplikat / Buat Serupa"><CopyPlus size={14}/></button>
                            {adminUser?.role === 'superadmin' && (
                              <>
                                <button onClick={(e) => handleTogglePin(docItem.id, e)} className={`p-2 rounded-xl transition-all shadow-sm ${docItem.isPinned ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-600 hover:text-white dark:bg-emerald-900/40'}`} title={docItem.isPinned ? "Lepas Sematan" : "Prioritaskan"}><Pin size={14} className={docItem.isPinned ? "fill-current" : ""}/></button>
                                <button onClick={(e) => handleOpenEditDoc(docItem, e)} className="p-2 bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400 rounded-xl hover:bg-orange-600 hover:text-white transition-all shadow-sm" title="Edit Data"><Edit size={14}/></button>
                                <button onClick={(e) => handleDeleteDoc(docItem.id, e)} className="p-2 bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm" title="Pindahkan ke Sampah"><Trash2 size={14}/></button>
                              </>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                  
                  <div className="flex-1 mb-4 pl-2">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-emerald-800 dark:text-emerald-400 shrink-0 border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <FileText size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">No. Berkas</p>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-black leading-snug text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors line-clamp-1">
                            {highlightText(docItem.nomorBerkas, searchTerm)}
                          </h3>
                          {docItem.nomorBerkas && !isSelectionMode && (
                            <button
                              type="button"
                              onClick={(e) => handleCopyText(docItem.nomorBerkas, docItem.id, e)}
                              className="p-1 rounded-lg text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors shrink-0"
                              title="Salin Nomor Berkas"
                            >
                              {copiedId === docItem.id ? <Check size={14} className="text-emerald-500"/> : <Copy size={14}/>}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/50 mb-2.5">
                      <Building size={16} className="text-orange-600 shrink-0"/>
                      <div className="overflow-hidden flex-1">
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                          {docItem.jenisSurat === 'Surat Masuk' ? 'Pengirim' : 'Penerima'}
                        </p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{highlightText(docItem.alamatPenerima, searchTerm)}</p>
                      </div>
                    </div>

                    {/* Perihal Surat Langsung Tampil di Kartu */}
                    <div className="px-1">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Perihal</p>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 line-clamp-2 leading-relaxed">
                        {highlightText(docItem.perihal, searchTerm)}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between mt-auto pl-2">
                    <div className="text-[10px] font-bold text-slate-500 flex flex-col gap-1">
                      <span className="flex items-center gap-1.5"><CalendarDays size={12} className="text-emerald-600 dark:text-emerald-400"/> {formatDateIndo(docItem.tanggal)}</span>
                      {isTrashView && docItem.deletedAt && (
                        <span className="text-[9px] text-rose-600 dark:text-rose-400">
                          Dihapus: {formatDateTimeIndo(docItem.deletedAt)}
                        </span>
                      )}
                    </div>
                    <button 
                      onClick={(e) => { 
                         if(isSelectionMode) return; 
                         e.stopPropagation(); 
                         setSelectedDoc(docItem); setShowHistory(false); 
                      }}
                      className={`p-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center ${isSelectionMode ? 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-400 hover:bg-emerald-800 hover:text-white group/btn'}`}
                      title="Lihat Detail Surat"
                    >
                      <ChevronRight size={18} className={isSelectionMode ? "" : "group-hover/btn:translate-x-0.5 transition-transform"} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* PAGINATION CONTROLS */}
        {filteredAndSortedDocs.length > 0 && (
          <div className="pt-6 flex justify-between items-center gap-4 glass-card p-4 rounded-[2rem] w-full flex-col sm:flex-row">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <ListOrdered size={18} className="text-slate-400 shrink-0"/>
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 shrink-0">Tampilkan:</span>
              
              {itemsPerPage === 'custom' ? (
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    min="1" 
                    max="1000"
                    placeholder="Jml..."
                    className="w-16 bg-white dark:bg-slate-900 border border-emerald-500 rounded-xl px-2 py-1.5 text-xs font-bold outline-none text-slate-800 dark:text-white"
                    onBlur={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val > 0) setItemsPerPage(val);
                      else setItemsPerPage(10);
                    }}
                    onKeyDown={(e) => {
                       if (e.key === 'Enter') {
                          const val = parseInt(e.currentTarget.value);
                          if (!isNaN(val) && val > 0) setItemsPerPage(val);
                          else setItemsPerPage(10);
                       }
                    }}
                    autoFocus
                  />
                  <button onClick={() => setItemsPerPage(10)} className="p-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg text-slate-500 hover:text-rose-500"><X size={14}/></button>
                </div>
              ) : (
                <select 
                  value={itemsPerPage} 
                  onChange={(e) => {
                     const val = e.target.value;
                     if (val === 'custom') setItemsPerPage('custom');
                     else setItemsPerPage(Number(val));
                  }}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold outline-none cursor-pointer text-slate-800 dark:text-white"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={30}>30</option>
                  <option value={40}>40</option>
                  <option value={50}>50</option>
                  <option value="custom">Custom...</option>
                </select>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                disabled={Number(currentPage) <= 1 || currentPage === ''}
                onClick={() => setCurrentPage(p => (Number(p) || 1) - 1)}
                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
              >
                <ChevronRight size={14} className="rotate-180"/> Prev
              </button>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                Hal 
                <input 
                  type="number" 
                  value={currentPage}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCurrentPage(val === '' ? '' : parseInt(val));
                  }}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value);
                    if (isNaN(val) || val < 1) setCurrentPage(1);
                    else if (val > totalPages) setCurrentPage(totalPages);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                  }}
                  min="1"
                  max={totalPages || 1}
                  className="w-12 px-1 py-1 text-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                /> 
                dari {totalPages || 1}
              </span>
              <button 
                disabled={Number(currentPage) >= totalPages || totalPages === 0 || currentPage === ''}
                onClick={() => setCurrentPage(p => (Number(p) || 1) + 1)}
                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
              >
                Next <ChevronRight size={14}/>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* MODAL LOGIN ADMIN */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[800] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass-card p-10 rounded-[3rem] w-full max-w-sm shadow-2xl relative text-center border border-emerald-800/30 overflow-hidden">
            <button onClick={() => { setShowLoginModal(false); setLoginError(''); }} className="absolute top-6 right-6 p-2 text-slate-500 hover:text-rose-500 transition-colors"><X size={18}/></button>
            {logoSettings.image ? (
              <div
                className="mx-auto mb-6 overflow-hidden flex items-center justify-center drop-shadow-md"
                style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: `${logoSettings.radius ?? 12}%`
                }}
              >
                <img
                  src={logoSettings.image}
                  alt="Logo SIGAP"
                  className="w-full h-full object-contain pointer-events-none select-none"
                  style={{
                    transform: `translate(${logoSettings.offsetX ?? 0}px, ${logoSettings.offsetY ?? 0}px) scale(${(logoSettings.scale ?? 100) / 100})`
                  }}
                />
              </div>
            ) : (
              <Shield size={60} className="text-emerald-800 mx-auto mb-6 drop-shadow-md"/>
            )}
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Akses Petugas</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-8">Login untuk Mengelola SIGAP</p>

            {loginError && (
              <div className="mb-4 p-3 bg-rose-100/80 border border-rose-300 dark:bg-rose-900/30 dark:border-rose-800 rounded-2xl text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-center gap-2 animate-in fade-in zoom-in duration-300">
                <AlertCircle size={16} />
                {loginError}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Username</label>
                <input type="text" value={loginCreds.username} onChange={e=>setLoginCreds({...loginCreds, username: e.target.value})} className="w-full px-5 py-4 bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-emerald-800 font-bold text-sm transition-all" placeholder="admin" required autoFocus/>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Password</label>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} value={loginCreds.password} onChange={e=>setLoginCreds({...loginCreds, password: e.target.value})} className="w-full px-5 py-4 bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-emerald-800 font-black text-center tracking-[0.3em] text-sm transition-all" placeholder="password" required/>
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-800 transition-colors p-1" title={showPassword ? "Sembunyikan Password" : "Tampilkan Password"}>
                    {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                  </button>
                </div>
              </div>
              <button type="submit" className="w-full py-4 mt-2 bg-emerald-800 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest btn-3d transition-colors hover:text-white">Masuk Sistem</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETAIL DOKUMEN */}
      {selectedDoc && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setSelectedDoc(null)}>
          <div className="glass-card p-0 rounded-[3rem] w-full max-w-2xl shadow-[0_0_50px_rgba(6,95,70,0.15)] relative border border-emerald-800/30 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
            
            <div className="p-8 pb-6 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 relative shrink-0">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-800 to-orange-500"></div>
              <button onClick={() => setSelectedDoc(null)} className="absolute top-6 right-6 p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors">
                <X size={18}/>
              </button>
              
              <div className="flex items-center gap-4 mb-4 mt-2">
                <div>
                  <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest text-white ${getStatusBadgeClass(selectedDoc.jenisSurat)}`}>
                    {selectedDoc.jenisSurat}
                  </span>
                </div>
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white leading-tight mb-2">{selectedDoc.perihal || 'Tanpa Perihal'}</h2>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Building size={16} className="text-orange-600"/> 
                  {selectedDoc.jenisSurat === 'Surat Masuk' ? 'Pengirim' : 'Penerima'}: 
                  <span className="text-slate-900 dark:text-white bg-orange-50 dark:bg-orange-900/30 px-2 py-0.5 rounded border border-orange-200 dark:border-orange-800/50">{selectedDoc.alamatPenerima || '-'}</span>
                </p>
              </div>
            </div>

            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 shrink-0 px-8 pt-4 overflow-x-auto hide-scrollbar">
               <button onClick={()=>setShowHistory(false)} className={`pb-3 px-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${!showHistory ? 'border-emerald-800 text-emerald-800 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Detail Arsip</button>
               <button onClick={()=>setShowHistory(true)} className={`pb-3 px-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${showHistory ? 'border-emerald-800 text-emerald-800 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                 Riwayat Edit {selectedDoc.history && selectedDoc.history.length > 0 && <span className="bg-orange-500 text-white px-1.5 rounded-full text-[9px]">{selectedDoc.history.length}</span>}
               </button>
            </div>

            <div data-lenis-prevent className="p-8 overflow-y-auto bg-white/30 dark:bg-slate-900/30 flex-1">
              {!showHistory ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/60 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <p className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1.5 mb-1"><CalendarDays size={12}/> Tanggal</p>
                      <p className="text-sm font-black text-slate-900 dark:text-white">{formatDateIndo(selectedDoc.tanggal)}</p>
                    </div>
                    <div className="bg-white/60 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <p className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1.5 mb-1"><ListOrdered size={12}/> No. Agenda</p>
                      <p className="text-sm font-black text-slate-900 dark:text-white">#{selectedDoc.nomorUrut}</p>
                    </div>
                    <div className="bg-white/60 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm col-span-2">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1.5"><FileText size={12}/> No. Berkas</p>
                        {selectedDoc.nomorBerkas && (
                          <button
                            type="button"
                            onClick={(e) => handleCopyText(selectedDoc.nomorBerkas, `detail-${selectedDoc.id}`, e)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-700 hover:text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-colors"
                          >
                            {copiedId === `detail-${selectedDoc.id}` ? <><Check size={12}/> Tersalin</> : <><Copy size={12}/> Salin</>}
                          </button>
                        )}
                      </div>
                      <p className="text-sm font-black text-slate-900 dark:text-white break-all">{selectedDoc.nomorBerkas || '-'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                     <p className="text-[10px] font-bold text-slate-400">Pembaruan Terakhir Oleh: <span className="text-orange-600">{selectedDoc.updatedBy}</span></p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                   <div className="relative pl-6 border-l-2 border-emerald-800/30 space-y-8">
                     {selectedDoc.history && selectedDoc.history.length > 0 ? (
                       selectedDoc.history.map((hist, i) => (
                         <div key={i} className="relative">
                           <span className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-4 border-white dark:border-slate-900 shadow-sm ${i===0 ? 'bg-emerald-800' : 'bg-slate-300 dark:bg-slate-600'}`}></span>
                           <div className={`p-4 rounded-2xl border ${i===0 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50' : 'bg-white/60 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800'}`}>
                             <div className="flex justify-between items-start mb-2">
                               <span className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400">Update {hist.version}</span>
                               <span className="text-[10px] font-bold text-slate-500">{formatDateTimeIndo(hist.date)}</span>
                             </div>
                             <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Oleh: {hist.updatedBy}</p>
                             <p className="text-[12px] font-medium text-slate-800 dark:text-slate-200 bg-white/50 dark:bg-slate-900/50 p-2.5 rounded-lg mt-2 border border-slate-100 dark:border-slate-800">{hist.description}</p>
                           </div>
                         </div>
                       ))
                     ) : (
                       <p className="text-xs font-bold text-slate-500 ml-2">Belum ada riwayat pembaruan data.</p>
                     )}
                   </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 flex flex-col sm:flex-row gap-3 mt-auto shrink-0">
              {isAdmin && (
                <button
                  type="button"
                  onClick={(e) => handleDuplicateDoc(selectedDoc, e)}
                  className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest transition-colors flex items-center justify-center gap-2 shadow-md shadow-blue-600/20"
                >
                  <CopyPlus size={16}/> Buat Serupa
                </button>
              )}
              <button onClick={() => setSelectedDoc(null)} className="flex-1 py-4 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FORM TAMBAH/EDIT ARSIP */}
      {showDocForm && isAdmin && (
        <div
          className="fixed inset-0 z-[700] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300"
          onClick={handleRequestCloseDocForm}
        >
          <div
            className="glass-card p-0 rounded-[3rem] w-full max-w-2xl shadow-[0_0_50px_rgba(6,95,70,0.15)] relative border border-emerald-800/30 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300"
            onClick={e => e.stopPropagation()}
          >
            
            <div className="p-8 pb-6 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 relative shrink-0">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-700 to-orange-500"></div>
              <button onClick={handleRequestCloseDocForm} className="absolute top-6 right-6 p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors">
                <X size={18}/>
              </button>
              <div className="flex items-center gap-4 mb-2">
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-800/30 rounded-2xl flex items-center justify-center border border-emerald-200 dark:border-emerald-700/50">
                   {editingDoc ? <Edit size={24} className="text-emerald-800 dark:text-emerald-400"/> : <Plus size={24} className="text-emerald-800 dark:text-emerald-400"/>}
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">{editingDoc ? 'Edit Data Arsip' : 'Tambah Arsip Surat'}</h2>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">SIGAP Lapas Kalabahi • Petugas: {adminUser.username}</p>
                </div>
              </div>
            </div>

            <div data-lenis-prevent className="p-8 overflow-y-auto bg-white/30 dark:bg-slate-900/30 flex-1 hide-scrollbar">
              <form id="docFormAdmin" onSubmit={handleSaveDoc} className="space-y-5 text-left">
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 ml-1">Jenis Surat</label>
                    <select 
                      value={formData.jenisSurat} 
                      onChange={e => setFormData({...formData, jenisSurat: e.target.value})} 
                      className="w-full px-5 py-4 premium-input rounded-2xl text-xs font-bold outline-none transition-all text-slate-900 dark:text-white cursor-pointer disabled:opacity-70"
                      disabled={editingDoc !== null && adminUser?.role !== 'superadmin'}
                    >
                      <option value="Surat Keluar">Surat Keluar</option>
                      <option value="Surat Masuk">Surat Masuk</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 ml-1">Format Surat</label>
                    <select 
                      value={formData.formatSurat || 'Naskah Dinas Pengaturan/ Penugasan'} 
                      onChange={e => setFormData({...formData, formatSurat: e.target.value})} 
                      className="w-full px-5 py-4 premium-input rounded-2xl text-xs font-bold outline-none transition-all text-slate-900 dark:text-white cursor-pointer"
                    >
                      <option value="Naskah Dinas Pengaturan/ Penugasan">Naskah Dinas Pengaturan/ Penugasan</option>
                      <option value="Naskah Dinas Penetapan">Naskah Dinas Penetapan (SK)</option>
                      <option value="Naskah Dinas Korespondensi/ Khusus">Naskah Dinas Korespondensi/ Khusus</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 ml-1">Nomor Urut Agenda</label>
                    <input 
                      type="number" 
                      value={formData.nomorUrut} 
                      onChange={e => setFormData({...formData, nomorUrut: Number(e.target.value)})} 
                      readOnly={adminUser?.role !== 'superadmin'}
                      className={`w-full px-5 py-4 rounded-2xl text-xs font-bold outline-none transition-all text-slate-900 dark:text-white ${adminUser?.role === 'superadmin' ? 'premium-input' : 'bg-slate-100 dark:bg-slate-800 border-none text-slate-500 cursor-not-allowed'}`} 
                    />
                  </div>
                </div>

                <div className={`grid gap-5 ${(formData.formatSurat === 'Naskah Dinas Penetapan' || formData.formatSurat === 'Naskah Dinas Korespondensi/ Khusus') ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 ml-1">
                      {(formData.formatSurat === 'Naskah Dinas Penetapan' || formData.formatSurat === 'Naskah Dinas Korespondensi/ Khusus') ? 'Nomor Berkas (Depan)' : 'Nomor Berkas'}
                    </label>
                    <textarea 
                      value={formData.nomorBerkas} 
                      onChange={e=>setFormData({...formData, nomorBerkas: e.target.value})} 
                      placeholder={
                        formData.formatSurat === 'Naskah Dinas Penetapan' ? 'Contoh: WP.22.PAS.6/' : 
                        (formData.formatSurat === 'Naskah Dinas Korespondensi/ Khusus' ? 'Contoh: WP.22.PAS.6/PK.05.01/' : 'Contoh: WP.22.PAS.6/PK.05.01/')
                      } 
                      className="w-full px-5 py-4 premium-input rounded-2xl text-xs font-bold outline-none transition-all resize-y focus:min-h-[100px] text-slate-900 dark:text-white" 
                      rows={1} required></textarea>
                  </div>
                  
                  {(formData.formatSurat === 'Naskah Dinas Penetapan' || formData.formatSurat === 'Naskah Dinas Korespondensi/ Khusus') && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 ml-1">Nomor Berkas (Belakang)</label>
                      <textarea 
                        value={formData.nomorBerkasBelakang || ''} 
                        onChange={e=>setFormData({...formData, nomorBerkasBelakang: e.target.value})} 
                        placeholder={
                          formData.formatSurat === 'Naskah Dinas Penetapan' ? 'Contoh: /SA.04.01/2026' : 'Contoh: /2026'
                        } 
                        className="w-full px-5 py-4 premium-input rounded-2xl text-xs font-bold outline-none transition-all resize-y focus:min-h-[100px] text-slate-900 dark:text-white" 
                        rows={1} required></textarea>
                    </div>
                  )}
                </div>

                {/* Live Preview Hasil Gabungan Nomor Berkas */}
                <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <FileText size={12}/> Pratinjau Hasil Nomor Surat
                    </span>
                    {previewNomorBerkas && previewNomorBerkas.includes('//') && (
                      <span className="text-[9px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1">
                        <AlertCircle size={12}/> Terdeteksi tanda "//" ganda
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-black text-slate-900 dark:text-white break-all">
                    {previewNomorBerkas || <span className="text-slate-400 font-semibold italic">Ketik nomor berkas untuk melihat hasil gabungan...</span>}
                  </p>
                </div>

                <div className="space-y-1.5 relative">
                  <label className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 ml-1">
                    {formData.jenisSurat === 'Surat Masuk' ? 'Alamat Pengirim' : 'Alamat Penerima'}
                  </label>
                  <input
                    type="text"
                    value={formData.alamatPenerima}
                    onChange={e => {
                      setFormData({...formData, alamatPenerima: e.target.value});
                      setShowAlamatSuggestions(true);
                    }}
                    onFocus={() => setShowAlamatSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowAlamatSuggestions(false), 150)}
                    placeholder="Nama instansi atau orang (saran otomatis tersedia)"
                    autoComplete="off"
                    className="w-full px-5 py-4 premium-input rounded-2xl text-xs font-bold outline-none transition-all text-slate-900 dark:text-white"
                    required
                  />
                  {showAlamatSuggestions && filteredAlamatSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/70 rounded-2xl shadow-2xl overflow-hidden max-h-52 overflow-y-auto">
                      <div className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-100 dark:border-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-400">
                        Saran dari Riwayat Arsip
                      </div>
                      {filteredAlamatSuggestions.map((suggestion, sIdx) => (
                        <button
                          key={sIdx}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setFormData(prev => ({ ...prev, alamatPenerima: suggestion }));
                            setShowAlamatSuggestions(false);
                          }}
                          className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-800 dark:hover:text-emerald-300 flex items-center gap-2 transition-colors border-b last:border-b-0 border-slate-100 dark:border-slate-800/60"
                        >
                          <Building size={13} className="text-orange-500 shrink-0"/>
                          <span className="truncate">{suggestion}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 ml-1">Tanggal</label>
                  <input type="date" value={formData.tanggal} onChange={e=>setFormData({...formData, tanggal: e.target.value})} className="w-full px-5 py-4 premium-input rounded-2xl text-xs font-bold outline-none transition-all text-slate-900 dark:text-white" required />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 ml-1">Perihal</label>
                  <textarea value={formData.perihal} onChange={e=>setFormData({...formData, perihal: e.target.value})} rows={3} placeholder="Perihal surat..." className="w-full px-5 py-4 premium-input rounded-2xl text-xs font-bold outline-none transition-all resize-y text-slate-900 dark:text-white" required></textarea>
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 flex gap-3 mt-auto shrink-0">
              <button onClick={handleRequestCloseDocForm} disabled={isSubmitting} className="flex-1 py-4 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                Batal
              </button>
              <button type="submit" form="docFormAdmin" disabled={isSubmitting} className={`flex-[2] py-4 ${isSubmitting ? 'bg-slate-400 cursor-not-allowed' : 'bg-emerald-800 btn-3d'} text-white rounded-2xl font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-2 transition-all`}>
                <CheckCircle2 size={18} /> {isSubmitting ? 'Memproses...' : 'Simpan Data'}
              </button>
            </div>
            
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI LOGOUT */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[800] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-card p-8 rounded-3xl w-full max-w-sm shadow-2xl relative text-center border border-rose-500/30">
            <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
              <AlertCircle size={32} className="text-rose-600 dark:text-rose-500"/>
            </div>
            <h3 className="text-lg font-black mb-2 text-slate-900 dark:text-white">Keluar Sesi Petugas?</h3>
            <p className="text-sm font-bold text-slate-500 mb-8">Anda harus login kembali untuk mengelola data SIGAP.</p>
            
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 py-3 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">Batal</button>
              <button onClick={() => { setAdminUser(null); setShowLogoutConfirm(false); showToast("Berhasil Keluar"); }} className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-rose-700 transition-colors shadow-md shadow-rose-600/20">Ya, Keluar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PENGATURAN ADMIN */}
      {showSettings && (
        <div className="fixed inset-0 z-[900] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass-card p-0 rounded-[3rem] w-full max-w-2xl shadow-[0_0_50px_rgba(245,158,11,0.15)] relative border border-orange-500/30 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
            <div className="p-8 pb-6 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 relative shrink-0">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-orange-400 to-orange-600"></div>
              <button onClick={() => setShowSettings(false)} className="absolute top-6 right-6 p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors">
                <X size={18}/>
              </button>
              <div className="flex items-center gap-4 mb-2">
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center border border-orange-200 dark:border-orange-800/50">
                   <Settings size={24} className="text-orange-600 dark:text-orange-500"/>
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">Pengaturan Sistem</h2>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">Kelola Kredensial & Sistem</p>
                </div>
              </div>
            </div>

            <div data-lenis-prevent className="p-8 overflow-y-auto bg-white/30 dark:bg-slate-900/30 flex-1 space-y-8 hide-scrollbar">
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2"><Shield size={16}/> Akun Super Admin</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 ml-1">Username Super Admin</label>
                    <input type="text" value={settingsForm.superUsername || ''} onChange={e=>setSettingsForm({...settingsForm, superUsername: e.target.value})} className="w-full px-4 py-3 premium-input rounded-xl text-xs font-bold outline-none transition-all text-slate-900 dark:text-white" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 ml-1">Password Super Admin</label>
                    <div className="relative">
                      <input type={showSettingsPassword ? "text" : "password"} value={settingsForm.superPassword || ''} onChange={e=>setSettingsForm({...settingsForm, superPassword: e.target.value})} className="w-full px-4 py-3 premium-input rounded-xl text-xs font-bold outline-none transition-all text-slate-900 dark:text-white" />
                      <button type="button" onClick={() => setShowSettingsPassword(!showSettingsPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-600 transition-colors p-1">
                        {showSettingsPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <hr className="border-slate-200 dark:border-slate-800"/>

              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2"><ListOrdered size={16}/> Awal Nomor Agenda (Auto)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 ml-1">Mulai Surat Masuk</label>
                    <select
                      value={settingsForm.agendaModeMasuk || 'auto'}
                      onChange={e => setSettingsForm({ ...settingsForm, agendaModeMasuk: e.target.value })}
                      className="w-full px-4 py-3 premium-input rounded-xl text-xs font-bold outline-none transition-all text-slate-900 dark:text-white cursor-pointer"
                    >
                      <option value="auto">Otomatis (Ikuti Nomor Terbaru)</option>
                      <option value="custom">Kustom (Atur Manual)</option>
                    </select>
                    {(settingsForm.agendaModeMasuk || 'auto') === 'custom' ? (
                      <input type="number" min="1" value={settingsForm.startAgendaMasuk || ''} onChange={e=>setSettingsForm({...settingsForm, startAgendaMasuk: parseInt(e.target.value) || 1})} className="w-full px-4 py-3 premium-input rounded-xl text-xs font-bold outline-none transition-all text-slate-900 dark:text-white" placeholder="Masukkan nomor awal..." />
                    ) : (
                      <div className="w-full px-4 py-3 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60">
                        Nomor berikutnya otomatis: #{getNextNomorUrut('Surat Masuk', documents, 'auto')}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 ml-1">Mulai Surat Keluar</label>
                    <select
                      value={settingsForm.agendaModeKeluar || 'auto'}
                      onChange={e => setSettingsForm({ ...settingsForm, agendaModeKeluar: e.target.value })}
                      className="w-full px-4 py-3 premium-input rounded-xl text-xs font-bold outline-none transition-all text-slate-900 dark:text-white cursor-pointer"
                    >
                      <option value="auto">Otomatis (Ikuti Nomor Terbaru)</option>
                      <option value="custom">Kustom (Atur Manual)</option>
                    </select>
                    {(settingsForm.agendaModeKeluar || 'auto') === 'custom' ? (
                      <input type="number" min="1" value={settingsForm.startAgendaKeluar || ''} onChange={e=>setSettingsForm({...settingsForm, startAgendaKeluar: parseInt(e.target.value) || 1})} className="w-full px-4 py-3 premium-input rounded-xl text-xs font-bold outline-none transition-all text-slate-900 dark:text-white" placeholder="Masukkan nomor awal..." />
                    ) : (
                      <div className="w-full px-4 py-3 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60">
                        Nomor berikutnya otomatis: #{getNextNomorUrut('Surat Keluar', documents, 'auto')}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <hr className="border-slate-200 dark:border-slate-800"/>

              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2"><Users size={16}/> Akun Petugas Biasa (TU)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 ml-1">Username Petugas</label>
                    <input type="text" value={settingsForm.username || ''} onChange={e=>setSettingsForm({...settingsForm, username: e.target.value})} className="w-full px-4 py-3 premium-input rounded-xl text-xs font-bold outline-none transition-all text-slate-900 dark:text-white" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 ml-1">Password Petugas</label>
                    <div className="relative">
                      <input type={showSettingsPassword ? "text" : "password"} value={settingsForm.password || ''} onChange={e=>setSettingsForm({...settingsForm, password: e.target.value})} className="w-full px-4 py-3 premium-input rounded-xl text-xs font-bold outline-none transition-all text-slate-900 dark:text-white" />
                      <button type="button" onClick={() => setShowSettingsPassword(!showSettingsPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-600 transition-colors p-1">
                        {showSettingsPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 ml-1">Batas Waktu Auto Logout (Menit)</label>
                    <input type="number" min="1" value={settingsForm.autoLogoutMinutes || ''} onChange={e=>setSettingsForm({...settingsForm, autoLogoutMinutes: parseInt(e.target.value) || 1})} className="w-full px-4 py-3 premium-input rounded-xl text-xs font-bold outline-none transition-all text-slate-900 dark:text-white" />
                  </div>
                </div>
              </div>

              <hr className="border-slate-200 dark:border-slate-800"/>

              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2"><ImageIcon size={16}/> Background Website (Foto & Efek)</h3>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="px-4 py-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 transition-colors shadow-sm">
                      <Upload size={15}/> Upload Foto Background
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const compressedDataUrl = await compressBackgroundImage(file);
                            setSettingsForm(prev => ({
                              ...prev,
                              bgSettings: {
                                ...DEFAULT_BG_SETTINGS,
                                ...(prev.bgSettings || {}),
                                image: compressedDataUrl
                              }
                            }));
                            showToast('Foto background berhasil dimuat! Klik Simpan Pengaturan untuk menerapkan.');
                          } catch (err) {
                            console.error('Gagal memproses foto:', err);
                            showToast('Gagal memproses foto background.', 'error');
                          } finally {
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>
                    {settingsForm.bgSettings?.image && (
                      <button
                        type="button"
                        onClick={() => setSettingsForm(prev => ({
                          ...prev,
                          bgSettings: { ...DEFAULT_BG_SETTINGS }
                        }))}
                        className="px-4 py-3 bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 transition-colors"
                      >
                        <Trash2 size={15}/> Hapus Background
                      </button>
                    )}
                  </div>

                  {settingsForm.bgSettings?.image && (
                    <div className="space-y-4 p-4 rounded-2xl bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
                      {/* Preview Foto Background */}
                      <div className="relative w-full h-36 rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 bg-slate-900">
                        <div
                          className="w-full h-full transition-all duration-200"
                          style={{
                            backgroundImage: `url(${settingsForm.bgSettings.image})`,
                            backgroundSize: settingsForm.bgSettings.size || 'cover',
                            backgroundPosition: settingsForm.bgSettings.position || 'center',
                            backgroundRepeat: 'no-repeat',
                            filter: `blur(${settingsForm.bgSettings.blur || 0}px) brightness(${settingsForm.bgSettings.brightness ?? 100}%)`,
                            transform: (settingsForm.bgSettings.blur || 0) > 0 ? 'scale(1.06)' : 'scale(1)'
                          }}
                        />
                        <div
                          className="absolute inset-0 bg-slate-950"
                          style={{ opacity: (settingsForm.bgSettings.overlay ?? 40) / 100 }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="px-3 py-1.5 rounded-lg bg-black/50 backdrop-blur-sm text-white text-[10px] font-black uppercase tracking-widest">
                            Pratinjau Background
                          </span>
                        </div>
                      </div>

                      {/* Slider Efek */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">
                            <span>Blur</span>
                            <span className="text-orange-500">{settingsForm.bgSettings.blur ?? 0}px</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="20"
                            value={settingsForm.bgSettings.blur ?? 0}
                            onChange={e => setSettingsForm(prev => ({
                              ...prev,
                              bgSettings: { ...prev.bgSettings, blur: Number(e.target.value) }
                            }))}
                            className="w-full accent-orange-500"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">
                            <span>Kecerahan</span>
                            <span className="text-orange-500">{settingsForm.bgSettings.brightness ?? 100}%</span>
                          </div>
                          <input
                            type="range"
                            min="30"
                            max="150"
                            value={settingsForm.bgSettings.brightness ?? 100}
                            onChange={e => setSettingsForm(prev => ({
                              ...prev,
                              bgSettings: { ...prev.bgSettings, brightness: Number(e.target.value) }
                            }))}
                            className="w-full accent-orange-500"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">
                            <span>Overlay Gelap</span>
                            <span className="text-orange-500">{settingsForm.bgSettings.overlay ?? 40}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="85"
                            value={settingsForm.bgSettings.overlay ?? 40}
                            onChange={e => setSettingsForm(prev => ({
                              ...prev,
                              bgSettings: { ...prev.bgSettings, overlay: Number(e.target.value) }
                            }))}
                            className="w-full accent-orange-500"
                          />
                        </div>
                      </div>

                      {/* Ukuran & Posisi */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 ml-1">Ukuran Tampilan</label>
                          <select
                            value={settingsForm.bgSettings.size || 'cover'}
                            onChange={e => setSettingsForm(prev => ({
                              ...prev,
                              bgSettings: { ...prev.bgSettings, size: e.target.value }
                            }))}
                            className="w-full px-4 py-3 premium-input rounded-xl text-xs font-bold outline-none transition-all text-slate-900 dark:text-white cursor-pointer"
                          >
                            <option value="cover">Penuh (Cover)</option>
                            <option value="contain">Sesuaikan Utuh (Contain)</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 ml-1">Posisi Foto</label>
                          <select
                            value={settingsForm.bgSettings.position || 'center'}
                            onChange={e => setSettingsForm(prev => ({
                              ...prev,
                              bgSettings: { ...prev.bgSettings, position: e.target.value }
                            }))}
                            className="w-full px-4 py-3 premium-input rounded-xl text-xs font-bold outline-none transition-all text-slate-900 dark:text-white cursor-pointer"
                          >
                            <option value="center">Tengah (Center)</option>
                            <option value="top">Atas (Top)</option>
                            <option value="bottom">Bawah (Bottom)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <hr className="border-slate-200 dark:border-slate-800"/>

              {/* PENGATURAN LOGO WEBSITE (KHUSUS SUPER ADMIN & FORMAT PNG) */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2"><Shield size={16}/> Logo Website (Format PNG)</h3>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="px-4 py-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 transition-colors shadow-sm">
                      <Upload size={15}/> Upload Logo (.PNG)
                      <input
                        type="file"
                        accept=".png,image/png"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const pngDataUrl = await compressLogoPng(file);
                            setSettingsForm(prev => ({
                              ...prev,
                              logoSettings: {
                                ...DEFAULT_LOGO_SETTINGS,
                                ...(prev.logoSettings || {}),
                                image: pngDataUrl
                              }
                            }));
                            showToast('Logo PNG berhasil dimuat! Sesuaikan tampilan lalu klik Simpan Pengaturan.');
                          } catch (err) {
                            if (err.message === 'INVALID_FORMAT') {
                              showToast('Format file harus PNG (.png)!', 'error');
                            } else {
                              console.error('Gagal memproses logo:', err);
                              showToast('Gagal memproses file logo PNG.', 'error');
                            }
                          } finally {
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>
                    {settingsForm.logoSettings?.image && (
                      <>
                        <button
                          type="button"
                          onClick={() => setSettingsForm(prev => ({
                            ...prev,
                            logoSettings: {
                              ...DEFAULT_LOGO_SETTINGS,
                              image: prev.logoSettings.image
                            }
                          }))}
                          className="px-4 py-3 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 transition-colors"
                        >
                          <RotateCcw size={14}/> Reset Posisi
                        </button>
                        <button
                          type="button"
                          onClick={() => setSettingsForm(prev => ({
                            ...prev,
                            logoSettings: { ...DEFAULT_LOGO_SETTINGS }
                          }))}
                          className="px-4 py-3 bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 transition-colors"
                        >
                          <Trash2 size={15}/> Hapus Logo
                        </button>
                      </>
                    )}
                  </div>
                  <p className="text-[10px] font-bold text-slate-500">
                    * Hanya menerima file berformat <span className="text-emerald-600 dark:text-emerald-400 font-black">.PNG</span> (mendukung latar transparan).
                  </p>

                  {settingsForm.logoSettings?.image && (
                    <div className="space-y-5 p-4 rounded-2xl bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
                      {/* Tampilan Pratinjau Langsung (Header & Hero) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 flex flex-col items-center justify-center gap-3 min-h-[120px]">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Pratinjau Header</span>
                          <div className="px-3 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-emerald-500/20 shadow-md flex items-center justify-center">
                            <div
                              className="overflow-hidden flex items-center justify-center shrink-0"
                              style={{
                                width: `${settingsForm.logoSettings.headerSize ?? 32}px`,
                                height: `${settingsForm.logoSettings.headerSize ?? 32}px`,
                                borderRadius: `${settingsForm.logoSettings.radius ?? 12}%`
                              }}
                            >
                              <img
                                src={settingsForm.logoSettings.image}
                                alt="Preview Header"
                                className="w-full h-full object-contain pointer-events-none select-none"
                                style={{
                                  transform: `translate(${settingsForm.logoSettings.offsetX ?? 0}px, ${settingsForm.logoSettings.offsetY ?? 0}px) scale(${(settingsForm.logoSettings.scale ?? 100) / 100})`
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="p-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 flex flex-col items-center justify-center gap-2 min-h-[120px]">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Pratinjau Hero</span>
                          {settingsForm.logoSettings.showInHero !== false ? (
                            <div
                              className="overflow-hidden flex items-center justify-center"
                              style={{
                                width: `${Math.min(settingsForm.logoSettings.heroSize ?? 84, 110)}px`,
                                height: `${Math.min(settingsForm.logoSettings.heroSize ?? 84, 110)}px`,
                                borderRadius: `${settingsForm.logoSettings.radius ?? 12}%`
                              }}
                            >
                              <img
                                src={settingsForm.logoSettings.image}
                                alt="Preview Hero"
                                className="w-full h-full object-contain pointer-events-none select-none"
                                style={{
                                  transform: `translate(${settingsForm.logoSettings.offsetX ?? 0}px, ${settingsForm.logoSettings.offsetY ?? 0}px) scale(${(settingsForm.logoSettings.scale ?? 100) / 100})`
                                }}
                              />
                            </div>
                          ) : (
                            <span className="text-[11px] font-bold text-slate-400 italic">Disembunyikan di Hero</span>
                          )}
                        </div>
                      </div>

                      {/* Slider Penyesuaian Logo */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">
                            <span>Ukuran Header</span>
                            <span className="text-orange-500">{settingsForm.logoSettings.headerSize ?? 32}px</span>
                          </div>
                          <input
                            type="range"
                            min="20"
                            max="56"
                            value={settingsForm.logoSettings.headerSize ?? 32}
                            onChange={e => setSettingsForm(prev => ({
                              ...prev,
                              logoSettings: { ...prev.logoSettings, headerSize: Number(e.target.value) }
                            }))}
                            className="w-full accent-orange-500"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">
                            <span>Ukuran Hero</span>
                            <span className="text-orange-500">{settingsForm.logoSettings.heroSize ?? 84}px</span>
                          </div>
                          <input
                            type="range"
                            min="48"
                            max="160"
                            value={settingsForm.logoSettings.heroSize ?? 84}
                            onChange={e => setSettingsForm(prev => ({
                              ...prev,
                              logoSettings: { ...prev.logoSettings, heroSize: Number(e.target.value) }
                            }))}
                            className="w-full accent-orange-500"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">
                            <span>Zoom / Skala</span>
                            <span className="text-orange-500">{settingsForm.logoSettings.scale ?? 100}%</span>
                          </div>
                          <input
                            type="range"
                            min="50"
                            max="200"
                            value={settingsForm.logoSettings.scale ?? 100}
                            onChange={e => setSettingsForm(prev => ({
                              ...prev,
                              logoSettings: { ...prev.logoSettings, scale: Number(e.target.value) }
                            }))}
                            className="w-full accent-orange-500"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">
                            <span>Geser Horizontal (X)</span>
                            <span className="text-orange-500">{settingsForm.logoSettings.offsetX ?? 0}px</span>
                          </div>
                          <input
                            type="range"
                            min="-30"
                            max="30"
                            value={settingsForm.logoSettings.offsetX ?? 0}
                            onChange={e => setSettingsForm(prev => ({
                              ...prev,
                              logoSettings: { ...prev.logoSettings, offsetX: Number(e.target.value) }
                            }))}
                            className="w-full accent-orange-500"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">
                            <span>Geser Vertikal (Y)</span>
                            <span className="text-orange-500">{settingsForm.logoSettings.offsetY ?? 0}px</span>
                          </div>
                          <input
                            type="range"
                            min="-30"
                            max="30"
                            value={settingsForm.logoSettings.offsetY ?? 0}
                            onChange={e => setSettingsForm(prev => ({
                              ...prev,
                              logoSettings: { ...prev.logoSettings, offsetY: Number(e.target.value) }
                            }))}
                            className="w-full accent-orange-500"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">
                            <span>Kelengkungan Sudut</span>
                            <span className="text-orange-500">{settingsForm.logoSettings.radius ?? 12}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="50"
                            value={settingsForm.logoSettings.radius ?? 12}
                            onChange={e => setSettingsForm(prev => ({
                              ...prev,
                              logoSettings: { ...prev.logoSettings, radius: Number(e.target.value) }
                            }))}
                            className="w-full accent-orange-500"
                          />
                        </div>
                      </div>

                      <label className="flex items-center gap-2.5 pt-1 text-xs font-bold text-slate-700 dark:text-slate-300 select-none">
                        <input
                          type="checkbox"
                          checked={settingsForm.logoSettings.showInHero !== false}
                          onChange={e => setSettingsForm(prev => ({
                            ...prev,
                            logoSettings: { ...prev.logoSettings, showInHero: e.target.checked }
                          }))}
                          className="w-4 h-4 accent-emerald-600 rounded"
                        />
                        <span>Tampilkan Logo di Bagian Utama (Hero)</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 flex gap-3 mt-auto shrink-0">
              <button onClick={() => setShowSettings(false)} className="flex-1 py-4 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
                Batal
              </button>
              <button onClick={async () => {
                const newConfig = { 
                  adminUsername: settingsForm.username, 
                  adminPassword: settingsForm.password,
                  superUsername: settingsForm.superUsername, 
                  superPassword: settingsForm.superPassword,
                  autoLogoutMinutes: settingsForm.autoLogoutMinutes,
                  startAgendaMasuk: Number(settingsForm.startAgendaMasuk) || 1,
                  startAgendaKeluar: Number(settingsForm.startAgendaKeluar) || 1,
                  agendaModeMasuk: settingsForm.agendaModeMasuk || 'auto',
                  agendaModeKeluar: settingsForm.agendaModeKeluar || 'auto',
                  bgSettings: settingsForm.bgSettings ? { ...DEFAULT_BG_SETTINGS, ...settingsForm.bgSettings } : DEFAULT_BG_SETTINGS,
                  logoSettings: settingsForm.logoSettings ? { ...DEFAULT_LOGO_SETTINGS, ...settingsForm.logoSettings } : DEFAULT_LOGO_SETTINGS
                };
                
                if (db && fbUser) {
                  try {
                    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'laskar_config', 'global_settings'), newConfig, { merge: true });
                  } catch (error) {
                    console.error("Gagal menyimpan ke Firebase:", error);
                    showToast("Gagal menyimpan pengaturan ke server", "error");
                    return; 
                  }
                }
                
                setAdminCreds({ username: newConfig.adminUsername, password: newConfig.adminPassword });
                setSuperAdminCreds({ username: newConfig.superUsername, password: newConfig.superPassword });
                setAutoLogoutMinutes(newConfig.autoLogoutMinutes);
                setStartAgendaMasuk(newConfig.startAgendaMasuk);
                setStartAgendaKeluar(newConfig.startAgendaKeluar);
                setAgendaModeMasuk(newConfig.agendaModeMasuk);
                setAgendaModeKeluar(newConfig.agendaModeKeluar);
                setBgSettings(newConfig.bgSettings);
                setLogoSettings(newConfig.logoSettings);

                localStorage.setItem('laskarAdminCreds', JSON.stringify({ username: newConfig.adminUsername, password: newConfig.adminPassword }));
                localStorage.setItem('laskarSuperAdminCreds', JSON.stringify({ username: newConfig.superUsername, password: newConfig.superPassword }));
                localStorage.setItem('laskarAutoLogout', newConfig.autoLogoutMinutes.toString());
                try {
                  localStorage.setItem('laskarBgSettings', JSON.stringify(newConfig.bgSettings));
                  localStorage.setItem('laskarLogoSettings', JSON.stringify(newConfig.logoSettings));
                } catch (e) { /* abaikan jika kuota localStorage penuh */ }
                
                showToast('Pengaturan Berhasil Disimpan ke Database!');
                setShowSettings(false);
              }} className="flex-[2] py-4 bg-orange-500 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest btn-3d-orange flex items-center justify-center gap-2">
                <CheckCircle2 size={18} /> Simpan Pengaturan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI GENERIC */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-card p-8 rounded-3xl w-full max-w-sm shadow-2xl relative text-center border border-rose-500/30">
            <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
              <AlertCircle size={32} className="text-rose-600 dark:text-rose-500"/>
            </div>
            <h3 className="text-lg font-black mb-2 text-slate-900 dark:text-white">Konfirmasi</h3>
            <p className="text-sm font-bold text-slate-500 mb-8">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDialog({ isOpen: false, message: '', onConfirm: null })} className="flex-1 py-3 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">Batal</button>
              <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog({ isOpen: false, message: '', onConfirm: null }); }} className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-rose-700 transition-colors shadow-md shadow-rose-600/20">Ya, Lanjutkan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
