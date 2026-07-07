import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar as CalendarIcon, 
  ListTodo, 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  MapPin, 
  User, 
  Clock, 
  Clipboard, 
  Camera, 
  X, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  Image as ImageIcon,
  Check,
  Eye,
  EyeOff,
  Bell
} from 'lucide-react';
import { api } from './services/api';

// Función para comprimir la imagen en el cliente
const compressImage = (file, maxWidth = 1200, maxHeight = 1200, quality = 0.85) => {
  return new Promise((resolve, reject) => {
    // Si no es una imagen, no la comprimimos
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file); // fallback al original
              return;
            }
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

const PALETTE_COLORS = [
  '#2563eb', // Azul
  '#16a34a', // Verde
  '#7c3aed', // Morado
  '#ea580c', // Naranja
  '#db2777', // Rosa
  '#0891b2', // Cian
  '#e11d48', // Rojo
  '#ca8a04', // Amarillo oscuro
  '#475569', // Gris pizarra
  '#0d9488', // Teal
];

function App() {
  // Estados de carga y datos
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estados de navegación e interfaz
  const [activeTab, setActiveTab] = useState('citas'); // 'citas', 'calendario', 'pacientes', 'agregar'
  const [selectedPatientFilter, setSelectedPatientFilter] = useState(null);
  const [showPastAppointments, setShowPastAppointments] = useState(false);
  const [lightboxImages, setLightboxImages] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Estado para la vista de Calendario
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState(new Date().toISOString().split('T')[0]);

  // Estados para formularios
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [formAppointment, setFormAppointment] = useState({
    title: '',
    type: 'cita',
    patientId: '',
    doctor: '',
    date: '',
    time: '',
    location: '',
    notes: '',
    imageUrl: null,
    imageUrls: []
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);

  const [editingPatient, setEditingPatient] = useState(null);
  const [formPatient, setFormPatient] = useState({
    name: '',
    relation: '',
    color: PALETTE_COLORS[0]
  });

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const navigationStateRef = useRef({ lightboxImages: [], activeTab: 'citas', editingAppointment: null, editingPatient: null });

  // Sincronizar el ref de navegación para evitar clausuras obsoletas en popstate
  useEffect(() => {
    navigationStateRef.current = { lightboxImages, activeTab, editingAppointment, editingPatient };
  }, [lightboxImages, activeTab, editingAppointment, editingPatient]);

  // Estados de Autenticación
  const [isAuthenticated, setIsAuthenticated] = useState(localStorage.getItem('family_app_logged') === 'true');
  const [userRole, setUserRole] = useState(localStorage.getItem('family_app_role') || 'readonly');
  const [loginUser, setLoginUser] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  const handleLogin = (e) => {
    e.preventDefault();
    const userClean = loginUser.trim().toLowerCase();
    
    if (userClean === 'luciano' && loginPassword === 'Luciano*1210*+-*') {
      localStorage.setItem('family_app_logged', 'true');
      localStorage.setItem('family_app_role', 'admin');
      setIsAuthenticated(true);
      setUserRole('admin');
      setLoginError('');
    } else if (
      (userClean === 'luciano' || userClean === 'carmen') && 
      loginPassword === '1234'
    ) {
      localStorage.setItem('family_app_logged', 'true');
      localStorage.setItem('family_app_role', 'readonly');
      setIsAuthenticated(true);
      setUserRole('readonly');
      setLoginError('');
    } else {
      setLoginError('Usuario o contraseña incorrectos');
    }
  };

  const handleLogout = () => {
    if (window.confirm('¿Seguro que deseas salir de la aplicación?')) {
      localStorage.removeItem('family_app_logged');
      localStorage.removeItem('family_app_role');
      setIsAuthenticated(false);
      setUserRole('readonly');
      setLoginUser('');
      setLoginPassword('');
      setShowPassword(false);
    }
  };

  const touchStartRef = useRef({
    distance: 0,
    zoom: 1,
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
    isPinching: false,
    isPanning: false
  });

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      // Pinch zoom start
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartRef.current = {
        ...touchStartRef.current,
        distance: dist,
        zoom: zoomScale,
        isPinching: true,
        isPanning: false
      };
    } else if (e.touches.length === 1) {
      // Pan drag start
      touchStartRef.current = {
        ...touchStartRef.current,
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        panX: panX,
        panY: panY,
        isPanning: zoomScale > 1, // Only drag if zoomed
        isPinching: false
      };
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && touchStartRef.current.isPinching) {
      e.preventDefault(); // Prevent body scroll
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / touchStartRef.current.distance;
      const newScale = Math.max(1, Math.min(touchStartRef.current.zoom * factor, 4));
      setZoomScale(newScale);
      if (newScale === 1) {
        setPanX(0);
        setPanY(0);
      }
    } else if (e.touches.length === 1 && touchStartRef.current.isPanning) {
      e.preventDefault(); // Prevent native scroll
      const deltaX = e.touches[0].clientX - touchStartRef.current.x;
      const deltaY = e.touches[0].clientY - touchStartRef.current.y;
      setPanX(touchStartRef.current.panX + deltaX);
      setPanY(touchStartRef.current.panY + deltaY);
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current.isPinching = false;
    touchStartRef.current.isPanning = false;
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = 0.15;
    let newScale = zoomScale + (e.deltaY < 0 ? zoomFactor : -zoomFactor);
    newScale = Math.max(1, Math.min(newScale, 4));
    setZoomScale(newScale);
    if (newScale === 1) {
      setPanX(0);
      setPanY(0);
    }
  };

  const handleZoomIn = (e) => {
    e.stopPropagation();
    setZoomScale(prev => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = (e) => {
    e.stopPropagation();
    const newScale = Math.max(zoomScale - 0.5, 1);
    setZoomScale(newScale);
    if (newScale === 1) {
      setPanX(0);
      setPanY(0);
    }
  };

  const handleZoomReset = (e) => {
    e.stopPropagation();
    setZoomScale(1);
    setPanX(0);
    setPanY(0);
  };

  const closeLightbox = () => {
    setLightboxImages([]);
    setLightboxIndex(0);
    setZoomScale(1);
    setPanX(0);
    setPanY(0);
  };

  const handleExportBackup = async () => {
    try {
      const data = await api.exportBackup();
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(data, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', `copia-seguridad-citas-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      alert('Error al exportar la copia de seguridad: ' + err.message);
    }
  };

  const handleImportBackup = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!window.confirm('¿Seguro que deseas restaurar esta copia de seguridad? Esto reemplazará todas las citas y familiares actuales por los del archivo.')) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backupData = JSON.parse(event.target.result);
        await api.importBackup(backupData);
        alert('Copia de seguridad restaurada correctamente.');
        await fetchData();
      } catch (err) {
        alert('Error al importar la copia de seguridad: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Carga inicial
  useEffect(() => {
    fetchData();
  }, []);

  // Interceptar botón atrás nativo del móvil (PWA/Android back trap)
  useEffect(() => {
    // Empujar estado inicial para crear la trampa en el historial
    window.history.pushState({ trap: true }, '');

    const handlePopState = (e) => {
      const { lightboxImages: images, activeTab: tab, editingAppointment: editApp, editingPatient: editPat } = navigationStateRef.current;

      // 1. Si hay fotos abiertas en pantalla grande, cerrarlas
      if (images && images.length > 0) {
        closeLightbox();
        window.history.pushState({ trap: true }, '');
        return;
      }

      // 2. Si estamos editando o en una pestaña que no es la de inicio (Citas), volver a Citas
      if (tab !== 'citas' || editApp !== null || editPat !== null) {
        setActiveTab('citas');
        resetAppointmentForm();
        setEditingPatient(null);
        window.history.pushState({ trap: true }, '');
        return;
      }

      // 3. Si ya estamos en el inicio de la app ('citas'), preguntar antes de salir
      if (window.confirm('¿Seguro que deseas salir de la aplicación?')) {
        // Permitir salida yendo atrás de verdad
        window.history.back();
      } else {
        // Volver a empujar el estado trampa para interceptar el siguiente atrás
        window.history.pushState({ trap: true }, '');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [fetchedAppointments, fetchedPatients] = await Promise.all([
        api.getAppointments(),
        api.getPatients()
      ]);
      setAppointments(fetchedAppointments);
      setPatients(fetchedPatients);
      
      // Auto-seleccionar primer paciente en el formulario de citas si hay alguno
      if (fetchedPatients.length > 0 && !formAppointment.patientId) {
        setFormAppointment(prev => ({ ...prev, patientId: fetchedPatients[0].id }));
      }
      
      setError(null);
    } catch (err) {
      setError('Error al cargar la información. ¿Está encendido el servidor?');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Helper para mapear colores e info del paciente
  const getPatientInfo = (patientId) => {
    const patient = patients.find(p => p.id === patientId);
    return patient || { name: 'Desconocido', color: '#64748b', relation: '' };
  };

  // ==================== LÓGICA DE CITAS ====================
  
  const handleSaveAppointment = async (e) => {
    e.preventDefault();
    if (!formAppointment.title || !formAppointment.patientId || !formAppointment.date) {
      alert('Por favor rellena los campos obligatorios: Título, Paciente y Fecha.');
      return;
    }

    try {
      if (editingAppointment) {
        await api.updateAppointment(editingAppointment.id, formAppointment);
      } else {
        await api.createAppointment(formAppointment);
      }
      
      // Reiniciar formulario y refrescar
      resetAppointmentForm();
      setActiveTab('citas');
      await fetchData();
    } catch (err) {
      alert('Error al guardar la cita: ' + err.message);
    }
  };

  const handleEditAppointment = (appointment) => {
    setEditingAppointment(appointment);
    setFormAppointment({
      title: appointment.title,
      type: appointment.type || 'cita',
      patientId: appointment.patientId,
      doctor: appointment.doctor,
      date: appointment.date,
      time: appointment.time,
      location: appointment.location,
      notes: appointment.notes,
      imageUrl: appointment.imageUrl
    });
    setActiveTab('agregar');
  };

  const handleDeleteAppointment = async (id) => {
    if (window.confirm('¿Seguro que deseas eliminar esta cita médica?')) {
      try {
        await api.deleteAppointment(id);
        await fetchData();
      } catch (err) {
        alert('Error al eliminar la cita: ' + err.message);
      }
    }
  };

  const handleImageCapture = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploadingImage(true);
    setUploadProgress(`Procesando ${files.length} archivo(s)...`);
    
    try {
      const newUrls = [];
      for (let i = 0; i < files.length; i++) {
        setUploadProgress(`Comprimiendo imagen ${i + 1} de ${files.length}...`);
        const compressedFile = await compressImage(files[i]);
        
        setUploadProgress(`Subiendo imagen ${i + 1} de ${files.length}...`);
        const response = await api.uploadImage(compressedFile);
        newUrls.push(response.imageUrl);
      }
      
      setFormAppointment(prev => ({
        ...prev,
        imageUrls: [...(prev.imageUrls || []), ...newUrls],
        imageUrl: prev.imageUrl || newUrls[0]
      }));
    } catch (err) {
      alert('Error al procesar las imágenes: ' + err.message);
    } finally {
      setUploadingImage(false);
      setUploadProgress(null);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const resetAppointmentForm = () => {
    setEditingAppointment(null);
    setFormAppointment({
      title: '',
      type: 'cita',
      patientId: patients.length > 0 ? patients[0].id : '',
      doctor: '',
      date: '',
      time: '',
      location: '',
      notes: '',
      imageUrl: null,
      imageUrls: []
    });
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  // ==================== LÓGICA DE PACIENTES ====================

  const handleSavePatient = async (e) => {
    e.preventDefault();
    if (!formPatient.name) {
      alert('El nombre del paciente es obligatorio.');
      return;
    }

    try {
      if (editingPatient) {
        await api.updatePatient(editingPatient.id, formPatient);
      } else {
        await api.createPatient(formPatient);
      }

      setEditingPatient(null);
      setFormPatient({
        name: '',
        relation: '',
        color: PALETTE_COLORS[0]
      });
      await fetchData();
    } catch (err) {
      alert('Error al guardar el paciente: ' + err.message);
    }
  };

  const handleEditPatient = (patient) => {
    setEditingPatient(patient);
    setFormPatient({
      name: patient.name,
      relation: patient.relation,
      color: patient.color
    });
  };

  const handleDeletePatient = async (id) => {
    if (window.confirm('¿Seguro que deseas eliminar este familiar?')) {
      try {
        await api.deletePatient(id);
        await fetchData();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  // ==================== LÓGICA DE CALENDARIO ====================

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days = [];
    
    // Obtener los días vacíos del mes anterior para alinear con el lunes (lunes = 1, domingo = 0)
    let startDayOfWeek = firstDay.getDay(); 
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // Adaptar a lunes inicio

    // Días del mes anterior
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({
        date: prevDate,
        isCurrentMonth: false,
        str: prevDate.toISOString().split('T')[0]
      });
    }

    // Días del mes actual
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const currDate = new Date(year, month, i);
      days.push({
        date: currDate,
        isCurrentMonth: true,
        str: currDate.toISOString().split('T')[0]
      });
    }

    // Días del mes siguiente para completar la cuadrícula (múltiplo de 7)
    const totalDays = days.length;
    const remainingDays = totalDays % 7 === 0 ? 0 : 7 - (totalDays % 7);
    for (let i = 1; i <= remainingDays; i++) {
      const nextDate = new Date(year, month + 1, i);
      days.push({
        date: nextDate,
        isCurrentMonth: false,
        str: nextDate.toISOString().split('T')[0]
      });
    }

    return days;
  };

  const changeMonth = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + direction);
      return newDate;
    });
  };

  const getAppointmentsForDate = (dateStr) => {
    return appointments.filter(app => app.date === dateStr);
  };

  // ==================== RENDERIZADO DE VISTAS ====================

  // Filtrado de citas del Dashboard
  const todayStr = new Date().toISOString().split('T')[0];
  
  const filteredAppointments = appointments
    .filter(app => {
      // Filtro de paciente
      if (selectedPatientFilter && app.patientId !== selectedPatientFilter) {
        return false;
      }
      
      // Filtro de pasadas/próximas
      if (showPastAppointments) {
        return app.date < todayStr;
      } else {
        return app.date >= todayStr;
      }
    })
    .sort((a, b) => {
      // Citas próximas: Orden cronológico normal (más cercana primero)
      // Citas pasadas: Orden cronológico inverso (más reciente primero)
      if (showPastAppointments) {
        return `${b.date}T${b.time || '23:59'}`.localeCompare(`${a.date}T${a.time || '23:59'}`);
      } else {
        return `${a.date}T${a.time || '00:00'}`.localeCompare(`${b.date}T${b.time || '00:00'}`);
      }
    });

  if (!isAuthenticated) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', minHeight: '100vh', paddingBottom: '20px' }}>
        <div style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <div style={{ 
              width: '80px', 
              height: '80px', 
              borderRadius: '24px', 
              background: 'linear-gradient(135deg, var(--primary), var(--accent))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              margin: '0 auto 16px auto',
              boxShadow: 'var(--shadow-md)'
            }}>
              <CalendarIcon size={40} />
            </div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)' }}>Acceso Familiar</h1>
            <p style={{ color: 'var(--text-light)', marginTop: '6px', fontSize: '0.95rem' }}>
              Introduce las credenciales para acceder a la agenda médica compartida
            </p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Usuario</label>
              <input 
                type="text" 
                placeholder="Ej. Luciano"
                value={loginUser}
                onChange={e => setLoginUser(e.target.value)}
                className="form-input"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Contraseña</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  placeholder="Contraseña"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  className="form-input"
                  style={{ paddingRight: '48px' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    width: '36px',
                  }}
                  title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {loginError && (
              <div style={{ color: 'var(--danger)', fontSize: '0.9rem', fontWeight: 600, textAlign: 'center' }}>
                {loginError}
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: '10px' }}>
              Entrar en la Agenda
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Encabezado */}
      <header className="app-header">
        <div className="header-top">
          <div>
            <h1 className="header-title">Agenda Médica</h1>
            <p className="header-subtitle">Calendario familiar compartido</p>
          </div>
          {activeTab === 'citas' && userRole === 'admin' && (
            <button 
              className="btn btn-primary btn-icon-only" 
              onClick={() => {
                resetAppointmentForm();
                setActiveTab('agregar');
              }}
              style={{ width: '48px', height: '48px', backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
              aria-label="Agregar cita"
            >
              <Plus size={24} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="content-area">
        {loading && <div className="loader"></div>}

        {error && (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--danger)' }}>
            <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>{error}</p>
            <button className="btn btn-secondary" onClick={fetchData} style={{ marginTop: '16px', marginInline: 'auto' }}>
              Reintentar Conexión
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* VISTA 1: DASHBOARD DE CITAS */}
            {activeTab === 'citas' && (
              <div>
                {/* Selector de Pacientes */}
                <div className="patient-filter-bar">
                  <button 
                    className={`filter-badge ${selectedPatientFilter === null ? 'active' : ''}`}
                    onClick={() => setSelectedPatientFilter(null)}
                    style={selectedPatientFilter === null ? { backgroundColor: 'var(--primary)', color: 'white' } : {}}
                  >
                    <span>Todos</span>
                  </button>
                  {patients.map(p => (
                    <button 
                      key={p.id}
                      className={`filter-badge ${selectedPatientFilter === p.id ? 'active' : ''}`}
                      onClick={() => setSelectedPatientFilter(p.id)}
                      style={selectedPatientFilter === p.id ? { backgroundColor: p.color, color: 'white' } : {}}
                    >
                      <span className="patient-dot" style={{ backgroundColor: selectedPatientFilter === p.id ? 'white' : p.color }}></span>
                      {p.name}
                    </button>
                  ))}
                </div>

                {/* Título de Sección y Toggle Citas Pasadas */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 className="section-title" style={{ margin: 0 }}>
                    <ListTodo size={22} />
                    {showPastAppointments ? 'Historial de Citas' : 'Próximas Citas'}
                  </h2>
                  <button 
                    onClick={() => setShowPastAppointments(!showPastAppointments)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      textDecoration: 'underline'
                    }}
                  >
                    {showPastAppointments ? 'Ver próximas' : 'Ver historial'}
                  </button>
                </div>

                {/* Listado de Citas */}
                {filteredAppointments.length === 0 ? (
                  <div className="empty-state">
                    <ListTodo />
                    <p className="empty-state-title">No hay citas registradas</p>
                    <p>
                      {showPastAppointments 
                        ? 'No tienes citas guardadas en el pasado.' 
                        : '¡Excelente! No tienes citas médicas programadas por ahora.'}
                    </p>
                    {!showPastAppointments && userRole === 'admin' && (
                      <button className="btn btn-primary" onClick={() => { resetAppointmentForm(); setActiveTab('agregar'); }} style={{ marginTop: '12px' }}>
                        Programar Primera Cita
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="appointment-list">
                    {filteredAppointments.map((app, index) => {
                      const patient = getPatientInfo(app.patientId);
                      
                      // Formatear Fecha
                      const dateObj = new Date(app.date + 'T00:00:00');
                      const dayName = dateObj.toLocaleDateString('es-ES', { weekday: 'long' });
                      const dayNum = dateObj.getDate();
                      const monthName = dateObj.toLocaleDateString('es-ES', { month: 'long' });
                      
                      // Agrupar por mes en el listado
                      const showMonthHeader = index === 0 || 
                        filteredAppointments[index - 1].date.substring(0, 7) !== app.date.substring(0, 7);

                      return (
                        <React.Fragment key={app.id}>
                          {showMonthHeader && (
                            <div className="date-divider">
                              {(() => {
                                const str = dateObj.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
                                return str.charAt(0).toUpperCase() + str.slice(1);
                              })()}
                            </div>
                          )}
                          <div 
                            className="appointment-card" 
                            style={{ 
                              '--patient-color': patient.color,
                              borderStyle: app.type === 'recordatorio' ? 'dashed' : 'solid',
                              borderWidth: '1px',
                              borderColor: 'var(--border)',
                              borderLeft: app.type === 'recordatorio' ? '6px dashed var(--patient-color)' : '6px solid var(--patient-color)',
                              backgroundColor: app.type === 'recordatorio' ? '#fafafb' : 'white'
                            }}
                          >
                            <div className="appointment-card-header">
                              <div>
                                <span className="appointment-badge" style={{ backgroundColor: patient.color, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  {app.type === 'recordatorio' ? <Bell size={12} /> : null}
                                  {patient.name} ({app.type === 'recordatorio' ? 'Recordatorio' : patient.relation})
                                </span>
                                <h3 className="appointment-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {app.type === 'recordatorio' && <Bell size={18} style={{ color: 'var(--primary)' }} />}
                                  {app.title}
                                </h3>
                              </div>
                              
                              {/* Cargar adjuntos rápidamente */}
                              {((app.imageUrls && app.imageUrls.length > 0) || app.imageUrl) && (
                                <button 
                                  className="attachment-preview-button" 
                                  onClick={() => {
                                    const images = app.imageUrls && app.imageUrls.length > 0 
                                      ? app.imageUrls 
                                      : [app.imageUrl];
                                    setLightboxImages(images);
                                    setLightboxIndex(0);
                                  }}
                                  title="Ver documentación adjunta"
                                >
                                  <Camera size={16} />
                                  <span>
                                    {app.imageUrls && app.imageUrls.length > 1 
                                      ? `Docs (${app.imageUrls.length})` 
                                      : 'Documento'}
                                  </span>
                                </button>
                              )}
                            </div>

                            <div className="appointment-info-grid">
                              <div className="info-item highlight">
                                <Clock size={18} />
                                <span>
                                  {dayName.charAt(0).toUpperCase() + dayName.slice(1)} {dayNum} de {monthName}{app.time ? ` a las ${app.time}` : ''}
                                </span>
                              </div>
                              
                              {app.doctor && (
                                <div className="info-item">
                                  <User size={18} />
                                  <span>{app.doctor}</span>
                                </div>
                              )}

                              {app.location && (
                                <div className="info-item">
                                  <MapPin size={18} />
                                  <span>{app.location}</span>
                                </div>
                              )}
                            </div>

                            {app.notes && (
                              <div className="appointment-notes">
                                <strong>Indicaciones:</strong> {app.notes}
                              </div>
                            )}

                            {userRole === 'admin' && (
                              <div className="appointment-actions">
                                <button 
                                  className="btn btn-secondary" 
                                  onClick={() => handleEditAppointment(app)}
                                  style={{ minHeight: '40px', padding: '6px 12px', fontSize: '0.85rem', borderRadius: '10px' }}
                                >
                                  <Edit size={14} />
                                  <span>Editar</span>
                                </button>
                                <button 
                                  className="btn btn-danger" 
                                  onClick={() => handleDeleteAppointment(app.id)}
                                  style={{ minHeight: '40px', padding: '6px 12px', fontSize: '0.85rem', borderRadius: '10px' }}
                                >
                                  <Trash2 size={14} />
                                  <span>Eliminar</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* VISTA 2: CALENDARIO MENSUAL */}
            {activeTab === 'calendario' && (
              <div>
                <h2 className="section-title">
                  <CalendarIcon size={22} />
                  Calendario Compartido
                </h2>

                <div className="calendar-wrapper">
                  {/* Selector de Mes */}
                  <div className="calendar-header">
                    <button className="btn-icon-only" onClick={() => changeMonth(-1)} aria-label="Mes anterior">
                      <ChevronLeft size={24} />
                    </button>
                    <span className="calendar-month-title">
                      {currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                    </span>
                    <button className="btn-icon-only" onClick={() => changeMonth(1)} aria-label="Mes siguiente">
                      <ChevronRight size={24} />
                    </button>
                  </div>

                  {/* Cabecera días de la semana */}
                  <div className="calendar-grid-header">
                    <span>L</span>
                    <span>M</span>
                    <span>X</span>
                    <span>J</span>
                    <span>V</span>
                    <span>S</span>
                    <span>D</span>
                  </div>

                  {/* Días del Calendario */}
                  <div className="calendar-grid">
                    {getDaysInMonth(currentDate).map((day, idx) => {
                      const dayApps = getAppointmentsForDate(day.str);
                      const isSelected = selectedDateStr === day.str;
                      const isToday = day.str === todayStr;

                      return (
                        <button
                          key={idx}
                          className={`calendar-day ${!day.isCurrentMonth ? 'other-month' : ''} ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                          onClick={() => setSelectedDateStr(day.str)}
                        >
                          <span style={{ fontSize: '0.95rem' }}>{day.date.getDate()}</span>
                          <div className="calendar-day-indicators">
                            {dayApps.slice(0, 3).map(app => {
                              const p = getPatientInfo(app.patientId);
                              const isReminder = app.type === 'recordatorio';
                              return (
                                <span 
                                  key={app.id} 
                                  className="day-dot" 
                                  style={{ 
                                    backgroundColor: isReminder ? 'transparent' : p.color,
                                    border: isReminder ? `1.5px solid ${p.color}` : 'none',
                                    boxSizing: 'border-box'
                                  }}
                                ></span>
                              );
                            })}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Citas del Día Seleccionado */}
                <div style={{ marginTop: '24px' }}>
                  <h3 className="section-title" style={{ fontSize: '1.1rem' }}>
                    Citas para el {new Date(selectedDateStr + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                  </h3>
                  
                  {getAppointmentsForDate(selectedDateStr).length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', backgroundColor: 'var(--bg-primary)', borderRadius: '16px', color: 'var(--text-light)' }}>
                      No hay citas agendadas para este día.
                    </div>
                  ) : (
                    <div className="appointment-list">
                      {getAppointmentsForDate(selectedDateStr).map(app => {
                        const patient = getPatientInfo(app.patientId);
                        return (
                          <div 
                            key={app.id} 
                            className="appointment-card" 
                            style={{ 
                              '--patient-color': patient.color,
                              padding: '14px 16px',
                              borderRadius: '16px',
                              borderStyle: app.type === 'recordatorio' ? 'dashed' : 'solid',
                              borderWidth: '1px',
                              borderColor: 'var(--border)',
                              borderLeft: app.type === 'recordatorio' ? '6px dashed var(--patient-color)' : '6px solid var(--patient-color)',
                              backgroundColor: app.type === 'recordatorio' ? '#fafafb' : 'white'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <span className="appointment-badge" style={{ backgroundColor: patient.color, fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  {app.type === 'recordatorio' ? <Bell size={10} /> : null}
                                  {patient.name} ({app.type === 'recordatorio' ? 'Recordatorio' : patient.relation})
                                </span>
                                <h4 style={{ margin: '4px 0 0 0', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {app.type === 'recordatorio' && <Bell size={14} style={{ color: 'var(--primary)' }} />}
                                  {app.title}
                                </h4>
                              </div>
                              {((app.imageUrls && app.imageUrls.length > 0) || app.imageUrl) && (
                                <button 
                                  className="attachment-preview-button" 
                                  onClick={() => {
                                    const images = app.imageUrls && app.imageUrls.length > 0 
                                      ? app.imageUrls 
                                      : [app.imageUrl];
                                    setLightboxImages(images);
                                    setLightboxIndex(0);
                                  }} 
                                  style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                >
                                  <Camera size={14} />
                                  <span>
                                    {app.imageUrls && app.imageUrls.length > 1 
                                      ? `Docs (${app.imageUrls.length})` 
                                      : 'Ver Doc'}
                                  </span>
                                </button>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                              {app.time && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Clock size={14} /> {app.time} hs
                                </span>
                              )}
                              {app.doctor && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <User size={14} /> {app.doctor}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* VISTA 3: FORMULARIO AGREGAR / EDITAR CITA */}
            {activeTab === 'agregar' && (
              <div>
                <h2 className="section-title">
                  <CalendarIcon size={22} />
                  {editingAppointment ? 'Editar Cita Médica' : 'Nueva Cita Médica'}
                </h2>

                <form onSubmit={handleSaveAppointment} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  
                  {/* Tipo de Evento */}
                  <div className="form-group">
                    <label className="form-label">Tipo de Evento</label>
                    <select
                      value={formAppointment.type || 'cita'}
                      onChange={e => setFormAppointment(prev => ({ ...prev, type: e.target.value }))}
                      className="form-input form-select"
                    >
                      <option value="cita">🩺 Cita Médica (Consulta, Análisis, etc.)</option>
                      <option value="recordatorio">🔔 Recordatorio (Pedir cita, comprar pastillas, etc.)</option>
                    </select>
                  </div>

                  {/* Título de la cita */}
                  <div className="form-group">
                    <label className="form-label">
                      {formAppointment.type === 'recordatorio' ? '¿Qué hay que recordar? *' : 'Especialidad / Tipo de Cita *'}
                    </label>
                    <input 
                      type="text" 
                      placeholder={formAppointment.type === 'recordatorio' ? 'Ej. Pedir cita para hacer análisis' : 'Ej. Oftalmólogo, Dentista, Análisis de sangre'}
                      value={formAppointment.title}
                      onChange={e => setFormAppointment(prev => ({ ...prev, title: e.target.value }))}
                      className="form-input"
                      required
                    />
                  </div>

                  {/* Paciente (Familia) */}
                  <div className="form-group">
                    <label className="form-label">¿Para quién es la cita? *</label>
                    <select
                      value={formAppointment.patientId}
                      onChange={e => setFormAppointment(prev => ({ ...prev, patientId: e.target.value }))}
                      className="form-input form-select"
                      required
                    >
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.relation})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Doctor */}
                  <div className="form-group">
                    <label className="form-label">Nombre del Médico (opcional)</label>
                    <input 
                      type="text" 
                      placeholder="Ej. Dr. Martínez"
                      value={formAppointment.doctor}
                      onChange={e => setFormAppointment(prev => ({ ...prev, doctor: e.target.value }))}
                      className="form-input"
                    />
                  </div>

                  {/* Centro Médico */}
                  <div className="form-group">
                    <label className="form-label">
                      {formAppointment.type === 'recordatorio' ? 'Ubicación / Notas de contacto (opcional)' : 'Centro Médico / Hospital (opcional)'}
                    </label>
                    <input 
                      type="text" 
                      placeholder={formAppointment.type === 'recordatorio' ? 'Ej. Llamar por teléfono o a través de la web' : 'Ej. Centro de Salud El Centro, Box 4'}
                      value={formAppointment.location}
                      onChange={e => setFormAppointment(prev => ({ ...prev, location: e.target.value }))}
                      className="form-input"
                    />
                  </div>

                  {/* Fecha y Hora */}
                  <div className="form-input-row">
                    <div className="form-group">
                      <label className="form-label">Fecha *</label>
                      <input 
                        type="date" 
                        value={formAppointment.date}
                        onChange={e => setFormAppointment(prev => ({ ...prev, date: e.target.value }))}
                        className="form-input"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Hora (opcional)</label>
                      <input 
                        type="time" 
                        value={formAppointment.time}
                        onChange={e => setFormAppointment(prev => ({ ...prev, time: e.target.value }))}
                        className="form-input"
                      />
                    </div>
                  </div>

                  {/* Notas / Indicaciones */}
                  <div className="form-group">
                    <label className="form-label">Indicaciones / Notas importantes</label>
                    <textarea 
                      placeholder="Ej. Ir en ayunas, llevar radiografía previa, tomar la pastilla a las 8..."
                      value={formAppointment.notes}
                      onChange={e => setFormAppointment(prev => ({ ...prev, notes: e.target.value }))}
                      className="form-input"
                      rows="3"
                      style={{ resize: 'none', minHeight: '80px' }}
                    ></textarea>
                  </div>

                  {/* Scanner / Captura de Volante */}
                  <div className="form-group">
                    <label className="form-label">Escanear / Adjuntar Documentos (Fotos)</label>
                    
                    {/* Lista de imágenes ya añadidas */}
                    {formAppointment.imageUrls && formAppointment.imageUrls.length > 0 && (
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', 
                        gap: '10px', 
                        marginBottom: '12px' 
                      }}>
                        {formAppointment.imageUrls.map((url, idx) => (
                          <div key={idx} style={{ position: 'relative', aspectRatio: '1', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                            <img src={url} alt={`Doc ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <button
                              type="button"
                              onClick={() => {
                                setFormAppointment(prev => {
                                  const updatedUrls = prev.imageUrls.filter((_, i) => i !== idx);
                                  return {
                                    ...prev,
                                    imageUrls: updatedUrls,
                                    imageUrl: updatedUrls.length > 0 ? updatedUrls[0] : null
                                  };
                                });
                              }}
                              style={{
                                position: 'absolute',
                                top: '4px',
                                right: '4px',
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                backgroundColor: 'rgba(239, 68, 68, 0.95)',
                                color: 'white',
                                border: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: '12px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                              }}
                                  title="Eliminar foto"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', alignItems: 'center' }}>
                      <label 
                        className="btn btn-secondary" 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          gap: '8px', 
                          minHeight: '48px', 
                          cursor: 'pointer',
                          margin: 0,
                          fontSize: '0.85rem',
                          padding: '8px 12px'
                        }}
                      >
                        <Camera size={18} />
                        <span>Hacer Foto</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          capture="environment"
                          onChange={handleImageCapture} 
                          ref={cameraInputRef} 
                          style={{ display: 'none' }}
                        />
                      </label>

                      <label 
                        className="btn btn-secondary" 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          gap: '8px', 
                          minHeight: '48px', 
                          cursor: 'pointer',
                          margin: 0,
                          fontSize: '0.85rem',
                          padding: '8px 12px'
                        }}
                      >
                        <ImageIcon size={18} />
                        <span>Subir de Galería</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleImageCapture} 
                          ref={galleryInputRef} 
                          style={{ display: 'none' }}
                          multiple
                        />
                      </label>
                    </div>

                    {uploadingImage && (
                      <div className="progress-bar" style={{ marginTop: '8px', height: '16px', borderRadius: '8px', backgroundColor: 'var(--bg-primary)', overflow: 'hidden', position: 'relative' }}>
                        <div className="progress-bar-fill" style={{ width: '100%', height: '100%', backgroundColor: 'var(--primary)', opacity: 0.6, animation: 'pulse 1.5s infinite' }}></div>
                        <span style={{ position: 'absolute', width: '100%', textAlign: 'center', left: 0, top: 0, fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', lineHeight: '16px' }}>{uploadProgress}</span>
                      </div>
                    )}
                  </div>

                  {/* Botones de acción */}
                  <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                    <button 
                      type="button" 
                      className="btn btn-secondary btn-full" 
                      onClick={() => {
                        resetAppointmentForm();
                        setActiveTab('citas');
                      }}
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit" 
                      className="btn btn-primary btn-full"
                      disabled={uploadingImage}
                    >
                      {editingAppointment ? 'Guardar Cambios' : 'Agendar Cita'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* VISTA 4: PACIENTES / FAMILIA */}
            {activeTab === 'pacientes' && (
              <div>
                <h2 className="section-title">
                  <Users size={22} />
                  Miembros de la Familia
                </h2>

                {/* Formulario Agregar/Editar Paciente */}
                {userRole === 'admin' && (
                  <div style={{ backgroundColor: 'var(--bg-primary)', padding: '16px', borderRadius: '20px', marginBottom: '24px', border: '1px solid var(--border)' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {editingPatient ? 'Editar Familiar' : 'Agregar Nuevo Familiar'}
                    </h3>
                    
                    <form onSubmit={handleSavePatient} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div className="form-input-row" style={{ gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <input 
                          type="text" 
                          placeholder="Nombre (Ej. Papá)"
                          value={formPatient.name}
                          onChange={e => setFormPatient(prev => ({ ...prev, name: e.target.value }))}
                          className="form-input"
                          style={{ padding: '10px 12px', fontSize: '0.9rem' }}
                          required
                        />
                        <input 
                          type="text" 
                          placeholder="Relación (Ej. Suegro)"
                          value={formPatient.relation}
                          onChange={e => setFormPatient(prev => ({ ...prev, relation: e.target.value }))}
                          className="form-input"
                          style={{ padding: '10px 12px', fontSize: '0.9rem' }}
                        />
                      </div>

                      <div>
                        <span className="form-label" style={{ fontSize: '0.85rem', marginBottom: '6px', display: 'block' }}>
                          Selecciona un Color Distintivo:
                        </span>
                        <div className="color-picker-grid">
                          {PALETTE_COLORS.map(c => (
                            <div 
                              key={c}
                              className={`color-option ${formPatient.color === c ? 'selected' : ''}`}
                              style={{ backgroundColor: c }}
                              onClick={() => setFormPatient(prev => ({ ...prev, color: c }))}
                            ></div>
                          ))}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                        {editingPatient && (
                          <button 
                            type="button" 
                            className="btn btn-secondary" 
                            onClick={() => {
                              setEditingPatient(null);
                              setFormPatient({ name: '', relation: '', color: PALETTE_COLORS[0] });
                            }}
                            style={{ minHeight: '40px', padding: '8px 16px', fontSize: '0.85rem', flexGrow: 1 }}
                          >
                            Cancelar
                          </button>
                        )}
                        <button 
                          type="submit" 
                          className="btn btn-primary"
                          style={{ minHeight: '40px', padding: '8px 16px', fontSize: '0.85rem', flexGrow: 2 }}
                        >
                          {editingPatient ? 'Guardar Cambios' : 'Añadir Familiar'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Listado de Pacientes */}
                <div className="patient-list">
                  {patients.map(p => (
                    <div key={p.id} className="patient-card">
                      <div className="patient-info">
                        <div className="patient-avatar" style={{ backgroundColor: p.color }}>
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="patient-details">
                          <span className="patient-name">{p.name}</span>
                          {p.relation && <span className="patient-relation">{p.relation}</span>}
                        </div>
                      </div>
                      
                      {/* Acciones (Editar/Eliminar) */}
                      {/* No permitimos borrar los pacientes iniciales si tienen citas para no romper historial, la validación la hace el backend */}
                      {userRole === 'admin' && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button 
                            className="btn-icon-only" 
                            onClick={() => handleEditPatient(p)} 
                            title="Editar nombre/color"
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            className="btn-icon-only" 
                            onClick={() => handleDeletePatient(p.id)} 
                            title="Eliminar miembro"
                            style={{ color: 'var(--danger)' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Copia de Seguridad */}
                {userRole === 'admin' && (
                  <div style={{ 
                    backgroundColor: 'var(--bg-primary)', 
                    padding: '20px', 
                    borderRadius: '20px', 
                    marginTop: '24px', 
                    border: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                      Copia de Seguridad
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', margin: 0 }}>
                      Descarga una copia de todas las citas y familiares en tu dispositivo para guardarla, o restáurala si has cambiado de móvil.
                    </p>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>
                      <button 
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleExportBackup}
                        style={{ minHeight: '44px', padding: '8px 12px', fontSize: '0.85rem' }}
                      >
                        Exportar Datos
                      </button>
                      
                      <label 
                        className="btn btn-primary"
                        style={{ 
                          minHeight: '44px', 
                          padding: '8px 12px', 
                          fontSize: '0.85rem',
                          margin: 0,
                          cursor: 'pointer'
                        }}
                      >
                        Importar Datos
                        <input 
                          type="file" 
                          accept=".json" 
                          onChange={handleImportBackup} 
                          style={{ display: 'none' }}
                        />
                      </label>
                    </div>
                  </div>
                )}

                {/* Botón de Cerrar Sesión */}
                <button 
                  className="btn btn-secondary btn-full" 
                  onClick={handleLogout} 
                  style={{ marginTop: '24px', color: 'var(--danger)', borderColor: 'rgba(220, 38, 38, 0.2)' }}
                >
                  Cerrar Sesión (Cerrar Agenda)
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Navegación Inferior Móvil-First */}
      <nav className="bottom-nav">
        <button 
          className={`nav-button ${activeTab === 'citas' ? 'active' : ''}`}
          onClick={() => setActiveTab('citas')}
        >
          <ListTodo />
          <span>Citas</span>
        </button>
        <button 
          className={`nav-button ${activeTab === 'calendario' ? 'active' : ''}`}
          onClick={() => setActiveTab('calendario')}
        >
          <CalendarIcon />
          <span>Calendario</span>
        </button>
         {userRole === 'admin' && (
          <button 
            className={`nav-button ${activeTab === 'agregar' ? 'active' : ''}`}
            onClick={() => {
              resetAppointmentForm();
              setActiveTab('agregar');
            }}
          >
            <Plus />
            <span>Nueva Cita</span>
          </button>
        )}
        <button 
          className={`nav-button ${activeTab === 'pacientes' ? 'active' : ''}`}
          onClick={() => setActiveTab('pacientes')}
        >
          <Users />
          <span>Familia</span>
        </button>
      </nav>

      {/* Modal Lightbox para Ampliar Documentos Adjuntos */}
      {/* Modal Lightbox para Ampliar Documentos Adjuntos */}
      {lightboxImages.length > 0 && (
        <div className="lightbox-backdrop" onClick={closeLightbox}>
          <button 
            className="lightbox-close" 
            onClick={closeLightbox}
            aria-label="Cerrar vista"
          >
            <X size={24} />
          </button>

          {/* Indicador de Páginas */}
          {lightboxImages.length > 1 && (
            <div style={{
              position: 'absolute',
              top: '20px',
              backgroundColor: 'rgba(15, 23, 42, 0.75)',
              color: 'white',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.85rem',
              fontWeight: '600',
              zIndex: 1100
            }}>
              Documento {lightboxIndex + 1} de {lightboxImages.length}
            </div>
          )}

          {/* Controles de Zoom */}
          <div 
            style={{ 
              display: 'flex', 
              gap: '12px', 
              marginBottom: '16px', 
              zIndex: 1100 
            }}
            onClick={e => e.stopPropagation()}
          >
            <button 
              className="btn btn-secondary" 
              onClick={handleZoomOut}
              disabled={zoomScale <= 1}
              style={{ minHeight: '44px', minWidth: '44px', padding: '0 16px', fontSize: '1.2rem', fontWeight: 'bold' }}
            >
              -
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={handleZoomReset}
              style={{ minHeight: '44px', padding: '0 16px', fontSize: '0.9rem' }}
            >
              100%
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={handleZoomIn}
              disabled={zoomScale >= 4}
              style={{ minHeight: '44px', minWidth: '44px', padding: '0 16px', fontSize: '1.2rem', fontWeight: 'bold' }}
            >
              +
            </button>
          </div>

          <div 
            className="lightbox-image-wrapper"
            style={{
              maxWidth: '100%',
              maxHeight: '65vh',
              width: '100%',
              overflow: 'hidden',
              borderRadius: '12px',
              backgroundColor: '#192231',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              position: 'relative',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Navegación del Carrusel (Izquierda/Derecha) */}
            {lightboxImages.length > 1 && (
              <>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex(prev => (prev - 1 + lightboxImages.length) % lightboxImages.length);
                    setZoomScale(1);
                    setPanX(0);
                    setPanY(0);
                  }}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    backgroundColor: 'rgba(30, 41, 59, 0.85)',
                    color: 'white',
                    border: 'none',
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 1200
                  }}
                  aria-label="Anterior documento"
                >
                  <ChevronLeft size={22} />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex(prev => (prev + 1) % lightboxImages.length);
                    setZoomScale(1);
                    setPanX(0);
                    setPanY(0);
                  }}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    backgroundColor: 'rgba(30, 41, 59, 0.85)',
                    color: 'white',
                    border: 'none',
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 1200
                  }}
                  aria-label="Siguiente documento"
                >
                  <ChevronRight size={22} />
                </button>
              </>
            )}

            <img 
              src={lightboxImages[lightboxIndex]} 
              alt="Documentación Médica Ampliada" 
              style={{
                width: '100%',
                maxHeight: '65vh',
                objectFit: 'contain',
                display: 'block',
                transform: `translate(${panX}px, ${panY}px) scale(${zoomScale})`,
                transformOrigin: 'center center',
                touchAction: 'none',
                transition: touchStartRef.current.isPinching || touchStartRef.current.isPanning ? 'none' : 'transform 0.2s ease',
                cursor: zoomScale > 1 ? 'grab' : 'default',
              }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onWheel={handleWheel}
              onClick={e => e.stopPropagation()}
            />
          </div>

          <a 
            href={lightboxImages[lightboxIndex]} 
            download={`documento-medico-${Date.now()}`}
            className="lightbox-download"
            onClick={e => e.stopPropagation()}
            style={{ marginTop: '16px' }}
          >
            <Download size={18} />
            <span>Guardar Foto Actual</span>
          </a>
        </div>
      )}
    </div>
  );
}

export default App;
