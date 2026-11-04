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

// ==========================================
// MOCK DATA
// ==========================================
const MOCK_DOC_DATA = [];

// ==========================================
// FUNGSI HELPER GLOBAL
// ==========================================
const formatLiveTime = (date) => {
  const optionsDate = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const optionsTime = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
  return `${new Intl.DateTimeFormat('id-ID', optionsDate).format(date)} -${new Intl.DateTimeFormat('id-ID', optionsTime).format(date)} WITA`;
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

  // State Pengaturan Akun Lokal (Fallback)
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

  // Konfigurasi Nomor Urut Agenda
  const [startAgendaMasuk, setStartAgendaMasuk] = useState(1);
  const [startAgendaKeluar, setStartAgendaKeluar] = useState(1);
  
  const [showSettings, setShowSettings] = useState(false);
  const [showSettingsPassword, setShowSettingsPassword] = useState(false);
  const [settingsForm, setSettingsForm] = useState({});
  const [loginError, setLoginError] = useState('');

  // State Form Dokumen
  const [showDocForm, setShowDocForm] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  
  // LOGIKA AUTO-INCREMENT (PENGISIAN CELAH)
  const getNextNomorUrut = (jenisSuratType, currentDocs) => {
    const filtered = currentDocs.filter(d => d.jenisSurat === jenisSuratType);
    const baseNumber = jenisSuratType === 'Surat Masuk' ? startAgendaMasuk : startAgendaKeluar;
    
    let nextNum = baseNumber;
    while (filtered.some(d => Number(d.nomorUrut) === nextNum)) {
      nextNum++;
    }
    return nextNum;
  };

  const [formData, setFormData] = useState({
    jenisSurat: 'Surat Keluar',
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
      jenisSurat: 'Surat Keluar',
      nomorUrut: getNextNomorUrut('Surat Keluar', documents),
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
  const [sortBy, setSortBy] = useState('Nomor Urut');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // 1. FIREBASE AUTHENTICATION
  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          try {
            await signInWithCustomToken(auth, __initial_auth_token);
          } catch (tokenErr) {
            console.warn("Custom token mismatch, fallback to anonymous", tokenErr);
            await signInAnonymously(auth);
          }
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) { console.error("Firebase Auth Error:", e); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setFbUser);
    return () => unsubscribe();
  }, []);

  // 2. FETCH DATA DOKUMEN & KONFIGURASI SISTEM DARI FIREBASE
  useEffect(() => {
    if (!fbUser || !db) return;
    
    // Fetch Dokumen Arsip
    const docsRef = collection(db, 'artifacts', appId, 'public', 'data', 'laskar_docs');
    const unsubscribeDocs = onSnapshot(docsRef, (snapshot) => {
      const fetchedDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDocuments(fetchedDocs);
    }, (error) => console.error("Firestore Docs Error:", error));

    // Fetch Konfigurasi (Pengaturan Sistem)
    const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'laskar_config', 'global_settings');
    const unsubscribeConfig = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.superUsername) setSuperAdminCreds({ username: data.superUsername, password: data.superPassword });
        if (data.adminUsername) setAdminCreds({ username: data.adminUsername, password: data.adminPassword });
        if (data.autoLogoutMinutes) setAutoLogoutMinutes(data.autoLogoutMinutes);
        if (data.startAgendaMasuk) setStartAgendaMasuk(Number(data.startAgendaMasuk));
        if (data.startAgendaKeluar) setStartAgendaKeluar(Number(data.startAgendaKeluar));
      }
    }, (error) => console.error("Firestore Config Error:", error));

    return () => {
      unsubscribeDocs();
      unsubscribeConfig();
    };
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

  // Reset Halaman ke-1 setiap kali filter berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedTime, startDate, endDate, sortBy, itemsPerPage]);

  // Update nomor urut otomatis saat jenis surat berubah di form
  useEffect(() => {
    if (!editingDoc && showDocForm) {
      setFormData(prev => ({
        ...prev,
        nomorUrut: getNextNomorUrut(prev.jenisSurat, documents)
      }));
    }
  }, [formData.jenisSurat, documents, editingDoc, showDocForm, startAgendaMasuk, startAgendaKeluar]);

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
      const isTypeMatch = sortBy === 'Surat Masuk' ? d.jenisSurat === 'Surat Masuk' :
                          sortBy === 'Surat Keluar' ? d.jenisSurat === 'Surat Keluar' : true;
      
      const isSearchMatch = d.nomorBerkas.toLowerCase().includes(searchLower) || 
                            d.alamatPenerima.toLowerCase().includes(searchLower) ||
                            (d.perihal && d.perihal.toLowerCase().includes(searchLower)) ||
                            d.id.toLowerCase().includes(searchLower) ||
                            (d.nomorUrut && d.nomorUrut.toString().includes(searchLower));
                            
      return isTypeMatch && isSearchMatch;
    });

    switch(sortBy) {
      case 'Terlama':
        result.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
        break;
      case 'Terbaru':
        result.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
        break;
      case 'Surat Masuk':
      case 'Surat Keluar':
      case 'Nomor Urut':
      default:
         result.sort((a, b) => {
            const numA = Number(a.nomorUrut) || 0;
            const numB = Number(b.nomorUrut) || 0;
            if (numA !== numB) return numA - numB; 
            return new Date(a.tanggal) - new Date(b.tanggal);
         });
        break;
    }

    result.sort((a, b) => (b.isPinned === true ? 1 : 0) - (a.isPinned === true ? 1 : 0));
    return result;
  }, [searchTerm, sortBy, timeFilteredDocs]);

  // Pagination
  const safeItemsPerPage = isNaN(itemsPerPage) ? 10 : itemsPerPage;
  const totalPages = Math.ceil(filteredAndSortedDocs.length / safeItemsPerPage);
  const safePage = Number(currentPage) || 1;
  const paginatedDocs = filteredAndSortedDocs.slice((safePage - 1) * safeItemsPerPage, safePage * safeItemsPerPage);

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

  // Fungsi Simpan Data Baru/Edit
  const handleSaveDoc = async (e) => {
    e.preventDefault();
    
    // Auto-append: Format string nomor berkas agar ditutup dengan /NomorUrut
    let formattedNomorBerkas = formData.nomorBerkas.trim();
    const urutSuffix = `/${formData.nomorUrut}`;  // Cek jika nomor berkas sudah ada tempelan angka di ujungnya (misal .../101) lalu hapus if (formattedNomorBerkas.match(/\/\d+$/)) { formattedNomorBerkas = formattedNomorBerkas.replace(/\/\d+$/, ''); } formattedNomorBerkas = formattedNomorBerkas + urutSuffix;  const finalDataToSave = { ...formData, nomorBerkas: formattedNomorBerkas };  if (editingDoc) { const newHistoryEntry = { version: `v${(editingDoc.history?.length || 0) + 1}.0`,
        date: new Date().toISOString().split('T')[0],
        updatedBy: adminUser ? adminUser.username : 'Sistem',
        description: `Data arsip diperbarui.`
      };

      const updatedDoc = {
        ...editingDoc,
        ...finalDataToSave,
        updatedBy: adminUser ? adminUser.username : 'Petugas',
        history: [newHistoryEntry, ...(editingDoc.history || [])]
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
        ...finalDataToSave, 
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
      html += `<tr><td style="padding: 8px;">${d.nomorUrut}</td><td style="padding: 8px;">${d.jenisSurat}</td><td style="padding: 8px;">${d.nomorBerkas}</td><td style="padding: 8px;">${d.alamatPenerima}</td><td style="padding: 8px;">${d.tanggal}</td><td style="padding: 8px;">${d.perihal || '-'}</td><td style="padding: 8px;">${d.nomorPetunjuk}</td></tr>`; }); html += '</tbody></table>'; return html; };  const handleExportExcel = () => { const html = generateTableHtml(); const blob = new Blob([html], { type: 'application/vnd.ms-excel' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `Laporan_SIGAP_${new Date().toISOString().split('T')[0]}.xls`;
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
          <p>SIGAP - Lapas Kelas IIB Kalabahi<br/><span style="font-size: 11px;">Dicetak pada: ${new Date().toLocaleString('id-ID')}</span></p>${generateTableHtml()}
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
                  username: adminCreds.username,
                  password: adminCreds.password,
                  superUsername: superAdminCreds.username, 
                  superPassword: superAdminCreds.password, 
                  autoLogoutMinutes,
                  startAgendaMasuk: startAgendaMasuk,
                  startAgendaKeluar: startAgendaKeluar
                }); 
                setShowSettings(true); 
              }} className="p-1.5 rounded-xl bg-orange-100 dark:bg-orange-800/40 hover:bg-orange-200 transition-all" title="Pengaturan Sistem">
                <Settings className="text-orange-600 dark:text-orange-500" size={20}/>
              </button>
            )}
            <button onClick={() => isAdmin ? handleLogout() : setShowLoginModal(true)} className={`p-1.5 rounded-
