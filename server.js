import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Permitir JSON grandes para imágenes optimizadas
app.use(express.urlencoded({ extended: true }));

// Directorios de datos (soporte para disco persistente en Render)
const DATA_DIR = process.env.DATA_DIR || (fs.existsSync('/data') && process.platform !== 'win32' ? '/data' : path.join(__dirname, 'data'));
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const PATIENTS_FILE = path.join(DATA_DIR, 'patients.json');
const APPOINTMENTS_FILE = path.join(DATA_DIR, 'appointments.json');

// Crear directorios si no existen
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configurar almacenamiento estático de uploads
app.use('/uploads', express.static(UPLOADS_DIR));

// Pacientes predeterminados si el archivo no existe
const DEFAULT_PATIENTS = [
  { id: 'pat-1', name: 'Papá', relation: 'Suegro', color: '#2563eb' },
  { id: 'pat-2', name: 'Mamá', relation: 'Suegra', color: '#16a34a' },
  { id: 'pat-3', name: 'Ana', relation: 'Esposa', color: '#7c3aed' },
  { id: 'pat-4', name: 'Javi', relation: 'Yo', color: '#ea580c' }
];

// Helper: Leer archivo JSON con manejo de errores
const readJsonFile = (filePath, defaultValue = []) => {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf8');
      return defaultValue;
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error leyendo archivo ${filePath}:`, error);
    return defaultValue;
  }
};

// Helper: Escribir archivo JSON
const writeJsonFile = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`Error escribiendo en archivo ${filePath}:`, error);
    return false;
  }
};

// Asegurar que existan los archivos iniciales
readJsonFile(PATIENTS_FILE, DEFAULT_PATIENTS);
readJsonFile(APPOINTMENTS_FILE, []);

// Configuración de Multer para la subida de imágenes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // Nombre seguro para evitar problemas de codificación y duplicados
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `doc-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // Límite de 10MB
});

// ==================== API ENDPOINTS ====================

// --- Pacientes ---
app.get('/api/patients', (req, res) => {
  const patients = readJsonFile(PATIENTS_FILE, DEFAULT_PATIENTS);
  res.json(patients);
});

app.post('/api/patients', (req, res) => {
  const patients = readJsonFile(PATIENTS_FILE, DEFAULT_PATIENTS);
  const { name, relation, color } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }

  const newPatient = {
    id: `pat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name,
    relation: relation || '',
    color: color || '#64748b'
  };

  patients.push(newPatient);
  writeJsonFile(PATIENTS_FILE, patients);
  res.status(201).json(newPatient);
});

app.put('/api/patients/:id', (req, res) => {
  const patients = readJsonFile(PATIENTS_FILE, DEFAULT_PATIENTS);
  const { id } = req.params;
  const { name, relation, color } = req.body;

  const patientIndex = patients.findIndex(p => p.id === id);
  if (patientIndex === -1) {
    return res.status(404).json({ error: 'Paciente no encontrado' });
  }

  patients[patientIndex] = {
    ...patients[patientIndex],
    name: name !== undefined ? name : patients[patientIndex].name,
    relation: relation !== undefined ? relation : patients[patientIndex].relation,
    color: color !== undefined ? color : patients[patientIndex].color
  };

  writeJsonFile(PATIENTS_FILE, patients);
  res.json(patients[patientIndex]);
});

app.delete('/api/patients/:id', (req, res) => {
  const patients = readJsonFile(PATIENTS_FILE, DEFAULT_PATIENTS);
  const appointments = readJsonFile(APPOINTMENTS_FILE, []);
  const { id } = req.params;

  // No permitir borrar si el paciente tiene citas asociadas
  const hasAppointments = appointments.some(app => app.patientId === id);
  if (hasAppointments) {
    return res.status(400).json({ 
      error: 'No se puede eliminar el paciente porque tiene citas médicas asociadas. Elimina o reasigna las citas primero.' 
    });
  }

  const filteredPatients = patients.filter(p => p.id !== id);
  writeJsonFile(PATIENTS_FILE, filteredPatients);
  res.json({ message: 'Paciente eliminado correctamente' });
});

// --- Citas ---
app.get('/api/appointments', (req, res) => {
  const appointments = readJsonFile(APPOINTMENTS_FILE, []);
  res.json(appointments);
});

app.post('/api/appointments', (req, res) => {
  const appointments = readJsonFile(APPOINTMENTS_FILE, []);
  const { title, patientId, doctor, date, time, location, notes, imageUrl } = req.body;

  if (!title || !patientId || !date) {
    return res.status(400).json({ error: 'Los campos Título, Paciente y Fecha son obligatorios' });
  }

  const newAppointment = {
    id: `app-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title,
    patientId,
    doctor: doctor || '',
    date,
    time: time || '',
    location: location || '',
    notes: notes || '',
    imageUrl: imageUrl || null
  };

  appointments.push(newAppointment);
  writeJsonFile(APPOINTMENTS_FILE, appointments);
  res.status(201).json(newAppointment);
});

app.put('/api/appointments/:id', (req, res) => {
  const appointments = readJsonFile(APPOINTMENTS_FILE, []);
  const { id } = req.params;
  const { title, patientId, doctor, date, time, location, notes, imageUrl } = req.body;

  const appIndex = appointments.findIndex(app => app.id === id);
  if (appIndex === -1) {
    return res.status(404).json({ error: 'Cita no encontrada' });
  }

  // Eliminar la imagen anterior del disco si se reemplaza o elimina
  const oldImageUrl = appointments[appIndex].imageUrl;
  if (oldImageUrl && imageUrl !== oldImageUrl) {
    const oldFileName = oldImageUrl.replace('/uploads/', '');
    const oldFilePath = path.join(UPLOADS_DIR, oldFileName);
    if (fs.existsSync(oldFilePath)) {
      try {
        fs.unlinkSync(oldFilePath);
      } catch (err) {
        console.error('Error eliminando archivo de imagen viejo:', err);
      }
    }
  }

  appointments[appIndex] = {
    ...appointments[appIndex],
    title: title !== undefined ? title : appointments[appIndex].title,
    patientId: patientId !== undefined ? patientId : appointments[appIndex].patientId,
    doctor: doctor !== undefined ? doctor : appointments[appIndex].doctor,
    date: date !== undefined ? date : appointments[appIndex].date,
    time: time !== undefined ? time : appointments[appIndex].time,
    location: location !== undefined ? location : appointments[appIndex].location,
    notes: notes !== undefined ? notes : appointments[appIndex].notes,
    imageUrl: imageUrl !== undefined ? imageUrl : appointments[appIndex].imageUrl
  };

  writeJsonFile(APPOINTMENTS_FILE, appointments);
  res.json(appointments[appIndex]);
});

app.delete('/api/appointments/:id', (req, res) => {
  const appointments = readJsonFile(APPOINTMENTS_FILE, []);
  const { id } = req.params;

  const appointment = appointments.find(app => app.id === id);
  if (!appointment) {
    return res.status(404).json({ error: 'Cita no encontrada' });
  }

  // Eliminar la imagen del disco asociada
  if (appointment.imageUrl) {
    const fileName = appointment.imageUrl.replace('/uploads/', '');
    const filePath = path.join(UPLOADS_DIR, fileName);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error('Error eliminando archivo físico de imagen:', err);
      }
    }
  }

  const filteredAppointments = appointments.filter(app => app.id !== id);
  writeJsonFile(APPOINTMENTS_FILE, filteredAppointments);
  res.json({ message: 'Cita eliminada correctamente' });
});

// --- Subida de Imágenes ---
app.post('/api/upload', upload.single('document'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se subió ningún archivo' });
  }
  
  // Retorna la URL relativa para acceder a la imagen
  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ imageUrl });
});

// =======================================================

// Servir la aplicación React compilada en producción
const DIST_DIR = path.join(__dirname, 'dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      return res.sendFile(path.join(DIST_DIR, 'index.html'));
    }
    next();
  });
}

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor Express ejecutándose en http://localhost:${PORT}`);
});
