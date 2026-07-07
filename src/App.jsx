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
  EyeOff
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
  const [lightboxImage, setLightboxImage] = useState(null);

  // Estado para la vista de Calendario
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState(new Date().toISOString().split('T')[0]);

  // Estados para formularios
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [formAppointment, setFormAppointment] = useState({
    title: '',
    patientId: '',
    doctor: '',
    date: '',
    time: '',
    location: '',
    notes: '',
    imageUrl: null
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);

  const [editingPatient, setEditingPatient] = useState(null);
  const [formPatient, setFormPatient] = useState({
    name: '',
    relation: '',
    color: PALETTE_COLORS[0]
  });

  const fileInputRef = useRef(null);

  // Estados de Autenticación
  const [isAuthenticated, setIsAuthenticated] = useState(localStorage.getItem('family_app_logged') === 'true');
  const [loginUser, setLoginUser] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    if (loginUser.trim().toLowerCase() === 'luciano' && loginPassword === 'Luciano*1210*+-*') {
      localStorage.setItem('family_app_logged', 'true');
      setIsAuthenticated(true);
      setLoginError('');
    } else {
      setLoginError('Usuario o contraseña incorrectos');
    }
  };

  const handleLogout = () => {
    if (window.confirm('¿Seguro que deseas salir de la aplicación?')) {
      localStorage.removeItem('family_app_logged');
      setIsAuthenticated(false);
      setLoginUser('');
      setLoginPassword('');
      setShowPassword(false);
    }
  };

  // Carga inicial
  useEffect(() => {
    fetchData();
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
    const file = e.target.files[0];
    if (!file) return;

    setUploadingImage(true);
    setUploadProgress('Comprimiendo imagen...');
    
    try {
      // 1. Comprimir en cliente
      const compressedFile = await compressImage(file);
      
      // 2. Subir al servidor
      setUploadProgress('Subiendo al servidor...');
      const response = await api.uploadImage(compressedFile);
      
      setFormAppointment(prev => ({
        ...prev,
        imageUrl: response.imageUrl
      }));
    } catch (err) {
      alert('Error al procesar la imagen: ' + err.message);
    } finally {
      setUploadingImage(false);
      setUploadProgress(null);
    }
  };

  const handleRemoveImage = () => {
    setFormAppointment(prev => ({
      ...prev,
      imageUrl: null
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resetAppointmentForm = () => {
    setEditingAppointment(null);
    setFormAppointment({
      title: '',
      patientId: patients.length > 0 ? patients[0].id : '',
      doctor: '',
      date: '',
      time: '',
      location: '',
      notes: '',
      imageUrl: null
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
          {activeTab === 'citas' && (
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
                    {!showPastAppointments && (
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
                      const monthName = dateObj.toLocaleDateString('es-ES', { month: 'short' });
                      
                      // Agrupar por mes en el listado
                      const showMonthHeader = index === 0 || 
                        filteredAppointments[index - 1].date.substring(0, 7) !== app.date.substring(0, 7);

                      return (
                        <React.Fragment key={app.id}>
                          {showMonthHeader && (
                            <div className="date-divider">
                              {dateObj.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                            </div>
                          )}
                          <div className="appointment-card" style={{ '--patient-color': patient.color }}>
                            <div className="appointment-card-header">
                              <div>
                                <span className="appointment-badge" style={{ backgroundColor: patient.color }}>
                                  {patient.name} ({patient.relation})
                                </span>
                                <h3 className="appointment-title">{app.title}</h3>
                              </div>
                              
                              {/* Cargar adjunto rápidamente */}
                              {app.imageUrl && (
                                <button 
                                  className="attachment-preview-button" 
                                  onClick={() => setLightboxImage(app.imageUrl)}
                                  title="Ver documento adjunto"
                                >
                                  <Camera size={16} />
                                  <span>Documento</span>
                                </button>
                              )}
                            </div>

                            <div className="appointment-info-grid">
                              <div className="info-item highlight">
                                <Clock size={18} />
                                <span style={{ textTransform: 'capitalize' }}>
                                  {dayName} {dayNum} de {monthName} {app.time ? `a las ${app.time}` : ''}
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
                              return (
                                <span 
                                  key={app.id} 
                                  className="day-dot" 
                                  style={{ backgroundColor: p.color }}
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
                              borderRadius: '16px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <span className="appointment-badge" style={{ backgroundColor: patient.color, fontSize: '0.7rem' }}>
                                  {patient.name}
                                </span>
                                <h4 style={{ margin: '4px 0 0 0', fontSize: '1rem', fontWeight: 700 }}>{app.title}</h4>
                              </div>
                              {app.imageUrl && (
                                <button className="attachment-preview-button" onClick={() => setLightboxImage(app.imageUrl)} style={{ padding: '6px 10px', fontSize: '0.75rem' }}>
                                  <Camera size={14} />
                                  <span>Ver Doc</span>
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
                  
                  {/* Título de la cita */}
                  <div className="form-group">
                    <label className="form-label">Especialidad / Tipo de Cita *</label>
                    <input 
                      type="text" 
                      placeholder="Ej. Oftalmólogo, Dentista, Análisis de sangre"
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
                    <label className="form-label">Centro Médico / Hospital (opcional)</label>
                    <input 
                      type="text" 
                      placeholder="Ej. Centro de Salud El Centro, Box 4"
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
                    <label className="form-label">Escanear / Adjuntar Documento (Foto)</label>
                    
                    {!formAppointment.imageUrl ? (
                      <div className="scanner-container">
                        <input 
                          type="file" 
                          accept="image/*" 
                          capture="environment" // Habilita la cámara trasera nativa en móviles
                          onChange={handleImageCapture}
                          className="scanner-input"
                          ref={fileInputRef}
                          disabled={uploadingImage}
                        />
                        <div className="scanner-content">
                          <Camera size={36} />
                          <strong>
                            {uploadingImage ? 'Procesando...' : 'Hacer Foto al Volante / Receta'}
                          </strong>
                          <span style={{ fontSize: '0.85rem' }}>
                            {uploadProgress || 'Usa la cámara del móvil o selecciona un archivo'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="scanner-preview-wrapper">
                        <img 
                          src={formAppointment.imageUrl} 
                          alt="Previsualización de documento" 
                          className="scanner-preview" 
                        />
                        <button 
                          type="button" 
                          className="remove-image-btn" 
                          onClick={handleRemoveImage}
                          title="Eliminar foto"
                        >
                          <X size={18} />
                        </button>
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
                    </div>
                  ))}
                </div>

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
        <button 
          className={`nav-button ${activeTab === 'pacientes' ? 'active' : ''}`}
          onClick={() => setActiveTab('pacientes')}
        >
          <Users />
          <span>Familia</span>
        </button>
      </nav>

      {/* Modal Lightbox para Ampliar Documentos Adjuntos */}
      {lightboxImage && (
        <div className="lightbox-backdrop" onClick={() => setLightboxImage(null)}>
          <button 
            className="lightbox-close" 
            onClick={() => setLightboxImage(null)}
            aria-label="Cerrar vista"
          >
            <X size={24} />
          </button>
          
          <img 
            src={lightboxImage} 
            alt="Documentación Médica Ampliada" 
            className="lightbox-content"
            onClick={e => e.stopPropagation()} // Evitar cerrar al tocar la imagen
          />

          <a 
            href={lightboxImage} 
            download={`documento-medico-${Date.now()}`}
            className="lightbox-download"
            onClick={e => e.stopPropagation()}
          >
            <Download size={18} />
            <span>Guardar Foto</span>
          </a>
        </div>
      )}
    </div>
  );
}

export default App;
