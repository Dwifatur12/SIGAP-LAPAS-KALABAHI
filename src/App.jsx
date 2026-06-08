import React, { useState, useEffect, useMemo } from 'react';
import { 
  Shield, Moon, Sun, Clock, Search, 
  FileText, CheckCircle2, AlertCircle, X,
  ChevronRight, Lock, Users, Settings,
  Plus, Edit, Trash2, Eye, EyeOff,
  LogOut, ArrowUpDown, ListOrdered, Pin,
  Smartphone, Monitor, UserCheck, CalendarDays, Ticket, Building,
  Printer, Table, Send, Inbox
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';

// ==========================================
// FIREBASE SETUP
// ==========================================
const CUSTOM_FIREBASE_CONFIG = {};
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

// ==========================================
// MOCK DATA: DAFTAR ARSIP SURAT
// ==========================================
const MOCK_DOC_DATA = [
  {
    id: "DOC-2405-001",
    nomorUrut: 1,
    jenisSurat: "Surat Masuk",
    nomorBerkas: "W22.PAS.PAS.4.PK.01.04-01",
    alamatPenerima: "Kakanwil Kemenkumham NTT",
    tanggal: new Date().toISOString().split('T')[0],
    perihal: "Laporan Bulanan Lapas Kalabahi",
    nomorPetunjuk: "01.04",
    updatedBy: "Sistem",
    isPinned: true,
    history: []
  },
  {
    id: "DOC-2405-002",
    nomorUrut: 1,
    jenisSurat: "Surat Keluar",
    nomorBerkas: "W22.PAS.PAS.4.UM.01.01-102",
    alamatPenerima: "Dinas Kesehatan Kab. Alor",
    tanggal: new Date().toISOString().split('T')[0],
    perihal: "Permohonan Bantuan Tenaga Medis",
    nomorPetunjuk: "01.01",
    updatedBy: "Sistem",
    isPinned: false,
    history: []
  }
];

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

const getStatusBadgeClass = (jenisSurat) => {
  return jenisSurat === 'Surat Masuk' 
    ? 'bg-emerald-500 text-white shadow-emerald-500/30' 
    : 'bg-orange-500 text-white shadow-orange-500/30';
};

// ==========================================
// KOMPONEN UTAMA
// ==========================================
export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('darkMode') !== 'false');
  const [isMobileView, setIsMobileView] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [toast, setToast] = useState(null);
  
  // State Data Dokumen
  const [documents, setDocuments] = useState(MOCK_DOC_DATA);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [fbUser, setFbUser] = useState(null);

  // State Manajemen Admin (Auth)
  const [adminUser, setAdminUser] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loginCreds, setLoginCreds] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const isAdmin = adminUser !== null;

  // State Pengaturan Akun
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
    return saved ? parseInt(saved) : 30; // default 30 menit
  });
  
  const [showSettings, setShowSettings] = useState(false);
  const [showSettingsPassword, setShowSettingsPassword] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ 
    ...adminCreds, 
    superUsername: superAdminCreds.username,
    superPassword: superAdminCreds.password,
    autoLogoutMinutes 
  });
  const [loginError, setLoginError] = useState('');

  // State Form Dokumen
  const [showDocForm, setShowDocForm] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  
  const getNextNomorUrut = (jenisSuratType, currentDocs) => {
    const filtered = currentDocs.filter(d => d.jenisSurat === jenisSuratType);
    if (filtered.length === 0) return 1;
    const maxUrut = Math.max(...filtered.map(d => Number(d.nomorUrut) || 0));
    return maxUrut + 1;
  };

  const [formData, setFormData] = useState({
    jenisSurat: 'Surat Masuk',
    nomorUrut: 1,
    nomorBerkas: '', 
    alamatPenerima: '', 
    tanggal: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0], 
    perihal: '',
    nomorPetunjuk: ''
  });

  const resetForm = () => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISODate = (new Date(now - tzOffset)).toISOString().split('T')[0];
    
    setFormData({
      jenisSurat: 'Surat Masuk',
      nomorUrut: getNextNomorUrut('Surat Masuk', documents),
      nomorBerkas: '', 
      alamatPenerima: '', 
      tanggal: localISODate, 
      perihal: '',
      nomorPetunjuk: ''
    });
  };

  // State Modal Konfirmasi
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: '', onConfirm: null });

  // State Filtering, Sorting, Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTime, setSelectedTime] = useState('Semua Waktu');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('Terbaru');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // FIREBASE AUTH & FETCH DATA
  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) { console.error("Firebase Auth Error:", e); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setFbUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!fbUser || !db) return;
    const docsRef = collection(db, 'artifacts', appId, 'public', 'data', 'laskar_docs');
    const unsubscribe = onSnapshot(docsRef, (snapshot) => {
      const fetchedDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (fetchedDocs.length > 0) {
        setDocuments(fetchedDocs);
      } else {
        // First time setup
        MOCK_DOC_DATA.forEach(mockDoc => {
          setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'laskar_docs', mockDoc.id), mockDoc);
        });
      }
    }, (error) => console.error("Firestore Error:", error));
    return () => unsubscribe();
  }, [fbUser]);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('darkMode', isDarkMode);
  }, [isDarkMode]);

  // Efek Jam Live
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Efek Auto Logout (Inaktivitas)
  useEffect(() => {
    let timeoutId;
    const resetTimer = () => {
      if (adminUser) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          setAdminUser(null);
          showToast("Sesi habis. Anda telah otomatis logout karena tidak ada aktivitas.", "error");
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

  // Reset Halaman ke-1 setiap kali filter berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedTime, startDate, endDate, sortBy, itemsPerPage]);

  // Update nomor urut otomatis saat jenis surat berubah di form (jika bukan mode edit)
  useEffect(() => {
    if (!editingDoc && showDocForm) {
      setFormData(prev => ({
        ...prev,
        nomorUrut: getNextNomorUrut(prev.jenisSurat, documents)
      }));
    }
  }, [formData.jenisSurat, documents, editingDoc, showDocForm]);

  // Filter Waktu 
  const timeFilteredDocs = useMemo(() => {
    if (selectedTime === 'Semua Waktu' && !startDate && !endDate) return documents;
    
    return documents.filter(d => {
      let matchTime = true;
      const docDate = new Date(d.tanggal);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      docDate.setHours(0, 0, 0, 0);
      
      if (startDate && endDate) {
        const sDate = new Date(startDate);
        const eDate = new Date(endDate);
        sDate.setHours(0,0,0,0);
        eDate.setHours(23,59,59,999);
        matchTime = docDate.getTime() >= sDate.getTime() && docDate.getTime() <= eDate.getTime();
      } else if (startDate) {
        const sDate = new Date(startDate);
        sDate.setHours(0,0,0,0);
        matchTime = docDate.getTime() >= sDate.getTime();
      } else if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23,59,59,999);
        matchTime = docDate.getTime() <= eDate.getTime();
      }
      
      return matchTime;
    });
  }, [documents, selectedTime, startDate, endDate]);

  // Filter & Sort Logika
  const filteredAndSortedDocs = useMemo(() => {
    let result = timeFilteredDocs.filter(d => {
      const searchLower = searchTerm.toLowerCase();
      return d.nomorBerkas.toLowerCase().includes(searchLower) || 
             d.alamatPenerima.toLowerCase().includes(searchLower) ||
             (d.perihal && d.perihal.toLowerCase().includes(searchLower)) ||
             d.id.toLowerCase().includes(searchLower);
    });

    switch(sortBy) {
      case 'Terlama':
        result.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
        break;
      case 'Surat Masuk':
        result.sort((a, b) => a.jenisSurat === 'Surat Masuk' ? -1 : 1);
        break;
      case 'Surat Keluar':
        result.sort((a, b) => a.jenisSurat === 'Surat Keluar' ? -1 : 1);
        break;
      case 'Terbaru':
      default:
        result.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
        break;
    }

    result.sort((a, b) => (b.isPinned === true ? 1 : 0) - (a.isPinned === true ? 1 : 0));
    return result;
  }, [searchTerm, sortBy, timeFilteredDocs]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedDocs.length / itemsPerPage);
  const paginatedDocs = filteredAndSortedDocs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Fungsi Autentikasi
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
  };

  const handleTogglePin = async (id, e) => {
    e.stopPropagation();
    const docItem = documents.find(d => d.id === id);
    if (!docItem) return;
    
    if (db && fbUser) {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'laskar_docs', id), { ...docItem, isPinned: !docItem.isPinned }, { merge: true });
    } else {
      setDocuments(prev => prev.map(d => d.id === id ? { ...d, isPinned: !d.isPinned } : d));
    }
    showToast(docItem.isPinned ? "Arsip dilepas dari sematan." : "Arsip diprioritaskan!");
  };

  const handleSaveDoc = async (e) => {
    e.preventDefault();
    if (editingDoc) {
      const newHistoryEntry = {
        version: `v${(editingDoc.history?.length || 0) + 1}.0`,
        date: new Date().toISOString().split('T')[0],
        updatedBy: adminUser ? adminUser.username : 'Sistem',
        description: `Data arsip diperbarui.`
      };

      const updatedHistory = [newHistoryEntry, ...(editingDoc.history || [])];
      const updatedDoc = {
        ...editingDoc,
        ...formData,
        updatedBy: adminUser ? adminUser.username : 'Petugas',
        history: updatedHistory
      };

      if (db && fbUser) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'laskar_docs', updatedDoc.id), updatedDoc);
      } else {
        setDocuments(documents.map(d => d.id === editingDoc.id ? updatedDoc : d));
      }
      showToast("Data Arsip berhasil diperbarui!");
      setShowDocForm(false);
    } else {
      const exactDate = formData.tanggal;
      const dateCode = exactDate.replace(/-/g, '').substring(2,8);
      const newId = `DOC-${dateCode}-${Math.floor(Math.random()*1000).toString().padStart(3, '0')}`;
      
      const newDoc = { 
        ...formData, 
        id: newId, 
        updatedBy: adminUser ? adminUser.username : 'Sistem TU',
        history: [{ 
          version: "1.0", 
          date: new Date().toISOString().split('T')[0], 
          updatedBy: adminUser ? adminUser.username : 'Petugas', 
          description: `Pencatatan arsip baru.` 
        }],
        isPinned: false
      };

      if (db && fbUser) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'laskar_docs', newId), newDoc);
      } else {
        setDocuments([newDoc, ...documents]);
      }
      showToast("Arsip Baru berhasil dicatat!");
      setShowDocForm(false);
    }
  };

  const handleDeleteDoc = (id, e) => {
    e.stopPropagation();
    setConfirmDialog({
      isOpen: true,
      message: "Apakah Anda yakin ingin menghapus data arsip ini secara permanen?",
      onConfirm: async () => {
        if (db && fbUser) {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'laskar_docs', id));
        } else {
          setDocuments(prev => prev.filter(d => d.id !== id));
        }
        showToast("Data arsip berhasil dihapus!");
      }
    });
  };

  // ==========================================
  // FUNGSI EKSPORT & CETAK LAPORAN (ADMIN)
  // ==========================================
  const generateTableHtml = () => {
    let html = '<table border="1" style="border-collapse: collapse; width: 100%; font-family: sans-serif; font-size: 12px;"><thead><tr style="background-color: #f0f0f0;">';
    html += '<th style="padding: 8px;">No. Urut</th><th style="padding: 8px;">Jenis Surat</th><th style="padding: 8px;">Nomor Berkas</th><th style="padding: 8px;">Alamat Penerima</th><th style="padding: 8px;">Tanggal</th><th style="padding: 8px;">Perihal</th><th style="padding: 8px;">No. Petunjuk</th>';
    html += '</tr></thead><tbody>';
    filteredAndSortedDocs.forEach(d => {
      html += `<tr><td style="padding: 8px;">${d.nomorUrut}</td><td style="padding: 8px;">${d.jenisSurat}</td><td style="padding: 8px;">${d.nomorBerkas}</td><td style="padding: 8px;">${d.alamatPenerima}</td><td style="padding: 8px;">${d.tanggal}</td><td style="padding: 8px;">${d.perihal || '-'}</td><td style="padding: 8px;">${d.nomorPetunjuk}</td></tr>`;
    });
    html += '</tbody></table>';
    return html;
  };

  const handleExportExcel = () => {
    const html = generateTableHtml();
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Laporan_SIGAP_${new Date().toISOString().split('T')[0]}.xls`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Laporan Excel berhasil diunduh!");
  };

  const handleExportWord = () => {
    const html = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Laporan SIGAP</title></head>
      <body>
        <h2 style="text-align: center; font-family: sans-serif;">LAPORAN ARSIP SURAT LAPAS KALABAHI</h2>
        <p style="text-align: center; font-family: sans-serif;">Dicetak pada: ${new Date().toLocaleString('id-ID')}</p>
        <br/>
        ${generateTableHtml()}
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
    showToast("Laporan Word berhasil diunduh!");
  };

  const handlePrintReport = () => {
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
          <p>SIGAP - Lapas Kelas IIB Kalabahi<br/><span style="font-size: 11px;">Dicetak pada: ${new Date().toLocaleString('id-ID')}</span></p>
          ${generateTableHtml()}
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

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-950 dark:text-slate-100 transition-colors duration-500 font-sans selection:bg-emerald-800/30 overflow-x-hidden relative flex justify-center">
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
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[300] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-10 fade-in duration-300 backdrop-blur-md border ${toast.type === 'error' ? 'bg-rose-600/90 border-rose-500 text-white' : 'bg-emerald-600/90 border-emerald-500 text-white'}`}>
          {toast.type === 'error' ? <AlertCircle size={22}/> : <CheckCircle2 size={22}/>}
          <span className="text-xs font-bold uppercase tracking-widest text-white">{toast.message}</span>
        </div>
      )}

      {/* HEADER GLOBAL */}
      <header className={`fixed top-0 left-1/2 -translate-x-1/2 z-50 px-6 py-4 flex justify-between items-center pointer-events-none transition-all duration-500 w-full ${isMobileView ? 'max-w-[480px]' : 'max-w-full'}`}>
        <div className="glass-card px-5 py-3 rounded-2xl pointer-events-auto flex items-center gap-3 shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-1">
            {adminUser?.role === 'superadmin' && (
              <button onClick={() => { 
                setSettingsForm({ 
                  ...adminCreds, 
                  superUsername: superAdminCreds.username, 
                  superPassword: superAdminCreds.password, 
                  autoLogoutMinutes 
                }); 
                setShowSettings(true); 
              }} className="p-1.5 rounded-xl bg-orange-100 dark:bg-orange-800/40 hover:bg-orange-200 transition-all" title="Pengaturan Sistem">
                <Settings className="text-orange-600 dark:text-orange-500" size={20}/>
              </button>
            )}
            <button onClick={() => isAdmin ? handleLogout() : setShowLoginModal(true)} className={`p-1.5 rounded-xl transition-all ${isAdmin ? 'bg-rose-100 dark:bg-rose-900/40 hover:bg-rose-200' : 'bg-emerald-100 dark:bg-emerald-800/40 hover:bg-emerald-200'}`} title={isAdmin ? "Keluar Mode Petugas" : "Login Petugas"}>
              {isAdmin ? <LogOut className="text-rose-600 dark:text-rose-500" size={20}/> : <Shield className="text-emerald-800 dark:text-emerald-400" size={20} />}
            </button>
          </div>
          <span className="font-black tracking-tighter text-[15px] bg-clip-text text-transparent bg-gradient-to-r from-emerald-800 to-orange-500 dark:from-emerald-400 dark:to-orange-400">SIGAP</span>
        </div>
        
        <div className="flex gap-2 pointer-events-auto items-center">
          <div className={`${isMobileView ? 'hidden' : 'hidden sm:flex'} items-center gap-2 px-4 py-2.5 glass-card rounded-full text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 shadow-sm`}>
            <Clock size={14} className="text-orange-500" />
            {formatLiveTime(currentTime)}
          </div>
          
          <button onClick={() => setIsMobileView(!isMobileView)} className="p-3.5 glass-card rounded-2xl hover:scale-105 hover:shadow-lg transition-all text-slate-600 dark:text-slate-300 border border-transparent hover:border-emerald-300 dark:hover:border-emerald-700" title={isMobileView ? "Beralih ke Mode Desktop" : "Beralih ke Mode Mobile"}>
            {isMobileView ? <Monitor size={18} className="text-orange-600"/> : <Smartphone size={18} className="text-emerald-600"/>}
          </button>
          
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-3.5 glass-card rounded-2xl hover:scale-105 hover:shadow-lg transition-all text-slate-600 dark:text-slate-300 border border-transparent hover:border-emerald-300 dark:hover:border-emerald-700" title={isDarkMode ? "Beralih Mode Terang" : "Beralih Mode Gelap"}>
            {isDarkMode ? <Sun size={18} className="text-orange-400"/> : <Moon size={18} className="text-emerald-600"/>}
          </button>
        </div>
      </header>

      {}
      <main className={`pt-32 pb-20 px-6 mx-auto relative z-10 min-h-screen flex flex-col transition-all duration-500 w-full ${isMobileView ? 'max-w-[480px]' : 'max-w-7xl'}`}>
        
        {/* HERO SECTION */}
        <div className="text-center mb-16 animate-in slide-in-from-bottom-8 duration-700">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-50 dark:bg-emerald-800/20 text-emerald-800 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-200/50 dark:border-emerald-700/30 shadow-sm mb-6">
            <div className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></div>
            Layanan Administrasi Pemasyarakatan
          </div>
          <h1 className={`font-black tracking-tighter leading-[1.1] text-slate-900 dark:text-white mb-4 transition-all duration-500 ${isMobileView ? 'text-4xl' : 'text-5xl md:text-7xl'}`}>
            SIGAP
          </h1>
          <h2 className={`font-black tracking-widest text-emerald-800 dark:text-emerald-400 mb-6 uppercase transition-all duration-500 ${isMobileView ? 'text-xs' : 'text-sm md:text-lg'}`}>
            Sistem Informasi Gabungan Arsip Pemasyarakatan
          </h2>
          <p className={`max-w-2xl mx-auto font-semibold text-slate-600 dark:text-slate-400 leading-relaxed transition-all duration-500 ${isMobileView ? 'text-xs' : 'text-sm md:text-base'} mb-10`}>
            Sistem pengarsipan dan manajemen persuratan (Surat Masuk & Surat Keluar) untuk efisiensi tata usaha Lapas Kelas IIB Kalabahi.
          </p>
        </div>

        {/* DASHBOARD STATISTIK */}
        <div className="max-w-4xl mx-auto mb-10 animate-in fade-in zoom-in duration-500 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card p-6 md:p-8 rounded-[2.5rem] shadow-xl border border-emerald-500/20 relative overflow-hidden flex items-center gap-6 group hover:shadow-2xl hover:border-emerald-500/40 transition-all">
              <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800/50 group-hover:scale-110 transition-transform">
                <Inbox size={32} className="text-emerald-700 dark:text-emerald-400" />
              </div>
              <div className="text-left relative z-10 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Total Surat Masuk</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-emerald-800 to-emerald-400 leading-none">
                    {documents.filter(d => d.jenisSurat === 'Surat Masuk').length}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="glass-card p-6 md:p-8 rounded-[2.5rem] shadow-xl border border-orange-500/20 relative overflow-hidden flex items-center gap-6 group hover:shadow-2xl hover:border-orange-500/40 transition-all">
              <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/40 rounded-full flex items-center justify-center shrink-0 border border-orange-200 dark:border-orange-800/50 group-hover:scale-110 transition-transform">
                <Send size={32} className="text-orange-600 dark:text-orange-400" />
              </div>
              <div className="text-left relative z-10 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Total Surat Keluar</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-orange-600 to-orange-400 leading-none">
                    {documents.filter(d => d.jenisSurat === 'Surat Keluar').length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {}
        {/* SEARCH, FILTER & SORTING BAR */}
        <div className={`max-w-5xl mx-auto glass-card p-4 rounded-[2rem] flex gap-4 shadow-xl border border-white/40 dark:border-slate-700/50 w-full ${isMobileView ? 'flex-col' : 'flex-col md:flex-row'}`}>
          <div className="relative flex-1">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari ID, No Berkas, Perihal, Alamat..." 
              className="w-full pl-14 pr-6 py-4 bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-800/20 focus:border-emerald-800 transition-all text-slate-900 dark:text-white"
            />
          </div>
          
          <div className={`flex gap-3 ${isMobileView ? 'flex-col' : 'flex-col sm:flex-row flex-wrap'}`}>
            <div className={`relative shrink-0 ${isMobileView ? 'w-full' : 'sm:w-44'}`}>
              <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10" size={16} />
              
              <select 
                value={selectedTime}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedTime(val);
                  if (val === 'Semua Waktu') {
                    setStartDate('');
                    setEndDate('');
                  } else if (val !== 'custom') {
                    const today = new Date();
                    let start = new Date(today);
                    let end = new Date(today);

                    if (val === 'Kemarin') {
                      start.setDate(today.getDate() - 1);
                      end.setDate(today.getDate() - 1);
                    } else if (val === '7 Hari Terakhir') {
                      start.setDate(today.getDate() - 7);
                    } else if (val === '30 Hari Terakhir') {
                      start.setDate(today.getDate() - 30);
                    } else if (val === 'Bulan Ini') {
                      start = new Date(today.getFullYear(), today.getMonth(), 1);
                      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                    } else if (val === 'Bulan Lalu') {
                      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                      end = new Date(today.getFullYear(), today.getMonth(), 0);
                    } else if (val === 'Tahun Ini') {
                      start = new Date(today.getFullYear(), 0, 1);
                      end = new Date(today.getFullYear(), 11, 31);
                    }

                    const tzOffset = start.getTimezoneOffset() * 60000;
                    const localStart = (new Date(start - tzOffset)).toISOString().split('T')[0];
                    const localEnd = (new Date(end - tzOffset)).toISOString().split('T')[0];

                    setStartDate(localStart);
                    setEndDate(localEnd);
                  }
                }}
                className="w-full pl-10 pr-8 py-4 bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl text-[11px] font-bold uppercase tracking-wide outline-none appearance-none cursor-pointer transition-all text-slate-900 dark:text-white"
              >
                <option value="Semua Waktu">Semua Waktu</option>
                <option value="Hari Ini">Hari Ini</option>
                <option value="Kemarin">Kemarin</option>
                <option value="7 Hari Terakhir">7 Hari Terakhir</option>
                <option value="30 Hari Terakhir">30 Hari Terakhir</option>
                <option value="Bulan Ini">Bulan Ini</option>
                <option value="Bulan Lalu">Bulan Lalu</option>
                <option value="Tahun Ini">Tahun Ini</option>
                <option value="custom">🗓️ Rentang Waktu...</option>
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none rotate-90" size={14}/>
            </div>

            <div className={`flex items-center gap-2 ${isMobileView ? 'w-full flex-col' : 'flex-row'}`}>
              <input 
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setSelectedTime('custom'); }}
                className="w-full sm:w-auto px-4 py-4 bg-white/80 dark:bg-slate-900/60 border border-emerald-400 dark:border-emerald-600 shadow-[0_0_0_2px_rgba(52,211,153,0.2)] rounded-2xl text-[11px] font-bold uppercase tracking-wide outline-none transition-all text-slate-900 dark:text-white"
                title="Dari Tanggal"
              />
              <span className="text-slate-400 font-bold text-xs hidden sm:block">-</span>
              <input 
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setSelectedTime('custom'); }}
                className="w-full sm:w-auto px-4 py-4 bg-white/80 dark:bg-slate-900/60 border border-emerald-400 dark:border-emerald-600 shadow-[0_0_0_2px_rgba(52,211,153,0.2)] rounded-2xl text-[11px] font-bold uppercase tracking-wide outline-none transition-all text-slate-900 dark:text-white"
                title="Sampai Tanggal"
              />
              <button onClick={() => { setSelectedTime('Semua Waktu'); setStartDate(''); setEndDate(''); }} className={`p-3 bg-rose-100 text-rose-600 rounded-2xl hover:bg-rose-500 hover:text-white transition-colors ${isMobileView ? 'w-full flex justify-center' : ''}`} title="Reset Filter">
                <X size={16}/>
              </button>
            </div>

            <div className={`relative shrink-0 ${isMobileView ? 'w-full' : 'sm:w-40'}`}>
              <ArrowUpDown className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full pl-10 pr-8 py-4 bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl text-[11px] font-bold uppercase tracking-wide outline-none appearance-none cursor-pointer transition-all text-slate-900 dark:text-white"
              >
                <option value="Terbaru">Terbaru</option>
                <option value="Terlama">Terlama</option>
                <option value="Surat Masuk">Surat Masuk</option>
                <option value="Surat Keluar">Surat Keluar</option>
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none rotate-90" size={14}/>
            </div>
          </div>
        </div>

        {/* TOMBOL AKSI LAPORAN & TAMBAH MANUAL (HANYA MUNCUL JIKA ADA ADMIN LOGIN) */}
        {isAdmin && (
          <div className={`max-w-5xl mx-auto mt-6 flex justify-between animate-in fade-in zoom-in duration-500 gap-3 ${isMobileView ? 'flex-col px-4' : 'flex-wrap'}`}>
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
            
            <div className="flex gap-2">
              <button onClick={handleExportExcel} className="px-5 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest btn-3d flex items-center justify-center gap-2 shadow-emerald-600/30 flex-1 sm:flex-none" title="Ekspor ke Excel">
                <Table size={18} /> <span className={isMobileView ? 'inline' : 'hidden sm:inline'}>Excel</span>
              </button>
              <button onClick={handleExportWord} className="px-5 py-4 bg-blue-700 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest btn-3d flex items-center justify-center gap-2 shadow-blue-700/30 flex-1 sm:flex-none" title="Ekspor ke Word">
                <FileText size={18} /> <span className={isMobileView ? 'inline' : 'hidden sm:inline'}>Word</span>
              </button>
              <button onClick={handlePrintReport} className="px-5 py-4 bg-slate-700 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest btn-3d flex items-center justify-center gap-2 shadow-slate-700/30 flex-1 sm:flex-none" title="Cetak/Print Laporan">
                <Printer size={18} /> <span className={isMobileView ? 'inline' : 'hidden sm:inline'}>Print</span>
              </button>
            </div>
          </div>
        )}

        {}
        {/* DOCUMENTS GRID */}
        {paginatedDocs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center animate-in fade-in duration-500 opacity-60 mt-20">
            <FileText size={80} className="text-slate-400 dark:text-slate-600 mb-6" />
            <h3 className="text-xl font-black text-slate-800 dark:text-slate-200 mb-2">Data Arsip Kosong</h3>
            <p className="text-sm font-bold text-slate-500">Silakan sesuaikan filter tanggal atau kata kunci Anda.</p>
          </div>
        ) : (
          <div className={`grid gap-6 animate-in slide-in-from-bottom-12 duration-1000 delay-150 mt-10 mb-10 w-full ${isMobileView ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
            {paginatedDocs.map((docItem, idx) => {
              return (
                <div 
                  key={docItem.id} 
                  className="glass-card p-6 rounded-[2rem] border border-slate-300 dark:border-slate-700/50 shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 group flex flex-col h-full bg-white/60 dark:bg-slate-900/40 relative overflow-hidden"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  {/* Status Line Indicator */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${getStatusBadgeClass(docItem.jenisSurat).split(' ')[0]}`}></div>

                  {/* NOMOR URUT */}
                  <div className="absolute top-5 right-6 z-10 transition-all duration-300 group-hover:opacity-0 flex items-baseline gap-1 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm pointer-events-none">
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">No.</span>
                    <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-br from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-300">
                      {docItem.nomorUrut}
                    </span>
                  </div>

                  {/* TOMBOL AKSI SUPER ADMIN */}
                  {adminUser?.role === 'superadmin' && (
                    <div className="absolute top-5 right-6 flex gap-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <button onClick={(e) => handleTogglePin(docItem.id, e)} className={`p-2 rounded-xl transition-all shadow-sm ${docItem.isPinned ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-600 hover:text-white dark:bg-emerald-900/40'}`} title={docItem.isPinned ? "Lepas Sematan" : "Prioritaskan"}><Pin size={14} className={docItem.isPinned ? "fill-current" : ""}/></button>
                      <button onClick={(e) => { e.stopPropagation(); setEditingDoc(docItem); setFormData({...docItem}); setShowDocForm(true); }} className="p-2 bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400 rounded-xl hover:bg-orange-600 hover:text-white transition-all shadow-sm" title="Edit Data"><Edit size={14}/></button>
                      <button onClick={(e) => handleDeleteDoc(docItem.id, e)} className="p-2 bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm" title="Hapus Data"><Trash2 size={14}/></button>
                    </div>
                  )}
                  {adminUser?.role !== 'superadmin' && docItem.isPinned && (
                    <div className="absolute top-5 right-6 flex gap-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <span className="p-2 rounded-xl bg-emerald-500 text-white shadow-sm" title="Prioritas"><Pin size={14} className="fill-current"/></span>
                    </div>
                  )}

                  <div className="flex justify-end items-start mb-4 pr-24 gap-2 relative z-20 pointer-events-none">
                    {docItem.isPinned && (
                      <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-xl text-[9px] font-black uppercase tracking-widest border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 shadow-sm"><Pin size={10} className="fill-current"/> Prioritas</span>
                    )}
                    <span className={`px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm border border-transparent ${getStatusBadgeClass(docItem.jenisSurat)}`}>
                      {docItem.jenisSurat}
                    </span>
                  </div>
                  
                  <div className="flex-1 mb-4 pl-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1 flex items-center gap-1.5">
                      {docItem.id}
                    </p>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-emerald-800 dark:text-emerald-400 shrink-0 border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <FileText size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">No. Berkas</p>
                        <h3 className="text-sm font-black leading-snug text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors line-clamp-1">
                          {docItem.nomorBerkas || '-'}
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/50 mb-2">
                      <Building size={16} className="text-orange-600 shrink-0"/>
                      <div className="overflow-hidden flex-1">
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Alamat / Penerima</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{docItem.alamatPenerima || '-'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between mt-auto pl-2">
                    <div className="text-[10px] font-bold text-slate-500 flex flex-col gap-1.5">
                      <span className="flex items-center gap-1.5"><CalendarDays size={12} className="text-emerald-600 dark:text-emerald-400"/> {formatDateIndo(docItem.tanggal)}</span>
                    </div>
                    <button 
                      onClick={() => { setSelectedDoc(docItem); setShowHistory(false); }}
                      className="p-2.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-400 rounded-xl hover:bg-emerald-800 hover:text-white transition-all shadow-sm group/btn"
                      title="Lihat Detail Surat"
                    >
                      <ChevronRight size={18} className="group-hover/btn:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* PAGINATION CONTROLS */}
        {filteredAndSortedDocs.length > 0 && (
          <div className={`mt-auto pt-6 flex justify-between items-center gap-4 glass-card p-4 rounded-[2rem] w-full ${isMobileView ? 'flex-col' : 'flex-col sm:flex-row'}`}>
            <div className="flex items-center gap-3">
              <ListOrdered size={18} className="text-slate-400"/>
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Tampilkan:</span>
              <select 
                value={itemsPerPage} 
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold outline-none cursor-pointer text-slate-800 dark:text-white"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={30}>30</option>
              </select>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
              >
                <ChevronRight size={14} className="rotate-180"/> Prev
              </button>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                Hal {currentPage} dari {totalPages || 1}
              </span>
              <button 
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() => setCurrentPage(p => p + 1)}
                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
              >
                Next <ChevronRight size={14}/>
              </button>
            </div>
          </div>
        )}
      </main>

      {}
      {/* MODAL LOGIN ADMIN */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[800] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass-card p-10 rounded-[3rem] w-full max-w-sm shadow-2xl relative text-center border border-emerald-800/30 overflow-hidden">
            <button onClick={() => { setShowLoginModal(false); setLoginError(''); }} className="absolute top-6 right-6 p-2 text-slate-500 hover:text-rose-500 transition-colors"><X size={18}/></button>
            <Shield size={60} className="text-emerald-800 mx-auto mb-6 drop-shadow-md"/>
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
            
            {/* Modal Header */}
            <div className="p-8 pb-6 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 relative shrink-0">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-800 to-orange-500"></div>
              <button onClick={() => setSelectedDoc(null)} className="absolute top-6 right-6 p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors">
                <X size={18}/>
              </button>
              
              <div className="flex items-center gap-4 mb-4">
                <div>
                  <span className="inline-block px-2.5 py-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-black uppercase tracking-widest mb-2 border border-slate-300 dark:border-slate-700 mr-2">
                    ID: {selectedDoc.id}
                  </span>
                  <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest text-white ${getStatusBadgeClass(selectedDoc.jenisSurat)}`}>
                    {selectedDoc.jenisSurat}
                  </span>
                </div>
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white leading-tight mb-2">{selectedDoc.perihal || 'Tanpa Perihal'}</h2>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Building size={16} className="text-orange-600"/> Alamat: <span className="text-slate-900 dark:text-white bg-orange-50 dark:bg-orange-900/30 px-2 py-0.5 rounded border border-orange-200 dark:border-orange-800/50">{selectedDoc.alamatPenerima || '-'}</span>
                </p>
              </div>
            </div>

            {/* Modal Body with TABS */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 shrink-0 px-8 pt-4 overflow-x-auto hide-scrollbar">
               <button onClick={()=>setShowHistory(false)} className={`pb-3 px-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${!showHistory ? 'border-emerald-800 text-emerald-800 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Detail Arsip</button>
               <button onClick={()=>setShowHistory(true)} className={`pb-3 px-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${showHistory ? 'border-emerald-800 text-emerald-800 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                 Riwayat Edit {selectedDoc.history && selectedDoc.history.length > 0 && <span className="bg-orange-500 text-white px-1.5 rounded-full text-[9px]">{selectedDoc.history.length}</span>}
               </button>
            </div>

            <div className="p-8 overflow-y-auto bg-white/30 dark:bg-slate-900/30 flex-1">
              {!showHistory ? (
                // TAB 1: INFO DETAIL
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/60 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <p className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1.5 mb-1"><CalendarDays size={12}/> Tanggal</p>
                      <p className="text-sm font-black text-slate-900 dark:text-white">{formatDateIndo(selectedDoc.tanggal)}</p>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800/50 shadow-sm relative overflow-hidden">
                      <div className="absolute -right-2 -bottom-2 text-emerald-200/50 dark:text-emerald-800/30"><ListOrdered size={48}/></div>
                      <p className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 mb-1 relative z-10"><ListOrdered size={12}/> No. Urut</p>
                      <p className="text-xl font-black text-emerald-900 dark:text-emerald-100 relative z-10">{selectedDoc.nomorUrut}</p>
                    </div>
                    <div className="bg-white/60 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <p className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1.5 mb-1"><FileText size={12}/> No. Berkas</p>
                      <p className="text-sm font-black text-slate-900 dark:text-white">{selectedDoc.nomorBerkas || '-'}</p>
                    </div>
                    <div className="bg-white/60 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <p className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1.5 mb-1"><FileText size={12}/> No. Petunjuk</p>
                      <p className="text-sm font-black text-slate-900 dark:text-white">{selectedDoc.nomorPetunjuk || '-'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                     <p className="text-[10px] font-bold text-slate-400">Pembaruan Terakhir Oleh: <span className="text-orange-600">{selectedDoc.updatedBy}</span></p>
                  </div>
                </div>
              ) : (
                // TAB 2: RIWAYAT
                <div className="space-y-6">
                   <div className="relative pl-6 border-l-2 border-emerald-800/30 space-y-8">
                     {selectedDoc.history && selectedDoc.history.length > 0 ? (
                       selectedDoc.history.map((hist, i) => (
                         <div key={i} className="relative">
                           <span className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-4 border-white dark:border-slate-900 shadow-sm ${i===0 ? 'bg-emerald-800' : 'bg-slate-300 dark:bg-slate-600'}`}></span>
                           <div className={`p-4 rounded-2xl border ${i===0 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50' : 'bg-white/60 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800'}`}>
                             <div className="flex justify-between items-start mb-2">
                               <span className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400">Update {hist.version}</span>
                               <span className="text-[10px] font-bold text-slate-500">{formatDateIndo(hist.date)}</span>
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

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 flex flex-col sm:flex-row gap-3 mt-auto shrink-0">
              <button onClick={() => setSelectedDoc(null)} className="w-full py-4 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FORM TAMBAH/EDIT ARSIP (HANYA UNTUK ADMIN) */}
      {showDocForm && isAdmin && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass-card p-0 rounded-[3rem] w-full max-w-2xl shadow-[0_0_50px_rgba(6,95,70,0.15)] relative border border-emerald-800/30 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
            
            <div className="p-8 pb-6 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 relative shrink-0">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-700 to-orange-500"></div>
              <button onClick={() => setShowDocForm(false)} className="absolute top-6 right-6 p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors">
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

            <div className="p-8 overflow-y-auto bg-white/30 dark:bg-slate-900/30 flex-1 hide-scrollbar">
              <form id="docFormAdmin" onSubmit={handleSaveDoc} className="space-y-5 text-left">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 ml-1">Jenis Surat</label>
                    <select 
                      value={formData.jenisSurat} 
                      onChange={e => setFormData({...formData, jenisSurat: e.target.value})} 
                      className="w-full px-5 py-4 premium-input rounded-2xl text-xs font-bold outline-none transition-all text-slate-900 dark:text-white"
                      disabled={editingDoc !== null}
                    >
                      <option value="Surat Masuk">Surat Masuk</option>
                      <option value="Surat Keluar">Surat Keluar</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 ml-1">Nomor Urut (Otomatis)</label>
                    <input 
                      type="number" 
                      value={formData.nomorUrut} 
                      readOnly
                      className="w-full px-5 py-4 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-xs font-bold outline-none text-slate-500 cursor-not-allowed" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 ml-1">Nomor Berkas</label>
                    <input type="text" value={formData.nomorBerkas} onChange={e=>setFormData({...formData, nomorBerkas: e.target.value})} placeholder="Contoh: W22.PAS..." className="w-full px-5 py-4 premium-input rounded-2xl text-xs font-bold outline-none transition-all text-slate-900 dark:text-white" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 ml-1">Nomor Petunjuk</label>
                    <input type="text" value={formData.nomorPetunjuk} onChange={e=>setFormData({...formData, nomorPetunjuk: e.target.value})} placeholder="Kode petunjuk surat" className="w-full px-5 py-4 premium-input rounded-2xl text-xs font-bold outline-none transition-all text-slate-900 dark:text-white" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 ml-1">Alamat / Penerima / Pengirim</label>
                  <input type="text" value={formData.alamatPenerima} onChange={e=>setFormData({...formData, alamatPenerima: e.target.value})} placeholder="Nama instansi atau orang" className="w-full px-5 py-4 premium-input rounded-2xl text-xs font-bold outline-none transition-all text-slate-900 dark:text-white" required />
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
              <button onClick={() => setShowDocForm(false)} className="flex-1 py-4 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
                Batal
              </button>
              <button type="submit" form="docFormAdmin" className="flex-[2] py-4 bg-emerald-800 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest btn-3d flex items-center justify-center gap-2">
                <CheckCircle2 size={18} /> Simpan Data
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

            <div className="p-8 overflow-y-auto bg-white/30 dark:bg-slate-900/30 flex-1 space-y-8 hide-scrollbar">
              {/* Seksi Akun Super Admin */}
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

              {/* Seksi Akun Petugas */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2"><Users size={16}/> Akun Petugas Biasa (TU)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 ml-1">Username Petugas</label>
                    <input type="text" value={settingsForm.username} onChange={e=>setSettingsForm({...settingsForm, username: e.target.value})} className="w-full px-4 py-3 premium-input rounded-xl text-xs font-bold outline-none transition-all text-slate-900 dark:text-white" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 ml-1">Password Petugas</label>
                    <div className="relative">
                      <input type={showSettingsPassword ? "text" : "password"} value={settingsForm.password} onChange={e=>setSettingsForm({...settingsForm, password: e.target.value})} className="w-full px-4 py-3 premium-input rounded-xl text-xs font-bold outline-none transition-all text-slate-900 dark:text-white" />
                      <button type="button" onClick={() => setShowSettingsPassword(!showSettingsPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-600 transition-colors p-1">
                        {showSettingsPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-400 ml-1">Batas Waktu Auto Logout (Menit)</label>
                    <input type="number" min="1" value={settingsForm.autoLogoutMinutes} onChange={e=>setSettingsForm({...settingsForm, autoLogoutMinutes: parseInt(e.target.value) || 1})} className="w-full px-4 py-3 premium-input rounded-xl text-xs font-bold outline-none transition-all text-slate-900 dark:text-white" />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 flex gap-3 mt-auto shrink-0">
              <button onClick={() => setShowSettings(false)} className="flex-1 py-4 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
                Batal
              </button>
              <button onClick={() => {
                const newAdminCreds = { username: settingsForm.username, password: settingsForm.password };
                const newSuperAdminCreds = { username: settingsForm.superUsername, password: settingsForm.superPassword };
                
                setAdminCreds(newAdminCreds);
                localStorage.setItem('laskarAdminCreds', JSON.stringify(newAdminCreds));
                
                setSuperAdminCreds(newSuperAdminCreds);
                localStorage.setItem('laskarSuperAdminCreds', JSON.stringify(newSuperAdminCreds));
                
                setAutoLogoutMinutes(settingsForm.autoLogoutMinutes);
                localStorage.setItem('laskarAutoLogout', settingsForm.autoLogoutMinutes.toString());
                
                showToast('Pengaturan Berhasil Disimpan!');
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
