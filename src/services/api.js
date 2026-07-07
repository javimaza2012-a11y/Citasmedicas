// Servicios para consumir la API del servidor de Citas Médicas

const BASE_URL = ''; // En desarrollo, Vite redirige las peticiones al proxy configurado.

// Helper genérico para peticiones HTTP
const fetchJson = async (url, options = {}) => {
  try {
    const response = await fetch(`${BASE_URL}${url}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Error en la petición: ${response.status}`);
    }
    
    // Si la respuesta no tiene contenido (ej. 204 o DELETE)
    if (response.status === 204) return null;
    
    return await response.json();
  } catch (error) {
    console.error(`Error en API fetch (${url}):`, error);
    throw error;
  }
};

export const api = {
  // --- Pacientes ---
  getPatients: () => fetchJson('/api/patients'),
  
  createPatient: (patient) => fetchJson('/api/patients', {
    method: 'POST',
    body: JSON.stringify(patient),
  }),
  
  updatePatient: (id, patient) => fetchJson(`/api/patients/${id}`, {
    method: 'PUT',
    body: JSON.stringify(patient),
  }),
  
  deletePatient: (id) => fetchJson(`/api/patients/${id}`, {
    method: 'DELETE',
  }),

  // --- Citas ---
  getAppointments: () => fetchJson('/api/appointments'),
  
  createAppointment: (appointment) => fetchJson('/api/appointments', {
    method: 'POST',
    body: JSON.stringify(appointment),
  }),
  
  updateAppointment: (id, appointment) => fetchJson(`/api/appointments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(appointment),
  }),
  
  deleteAppointment: (id) => fetchJson(`/api/appointments/${id}`, {
    method: 'DELETE',
  }),

  // --- Subida de Imágenes (Scanner) ---
  uploadImage: async (file) => {
    try {
      const formData = new FormData();
      formData.append('document', file);
      
      const response = await fetch(`${BASE_URL}/api/upload`, {
        method: 'POST',
        body: formData,
        // No establecer 'Content-Type', el navegador lo establecerá con el boundary de multipart/form-data
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al subir la imagen');
      }
      
      return await response.json(); // Retorna { imageUrl }
    } catch (error) {
      console.error('Error subiendo imagen:', error);
      throw error;
    }
  }
};
