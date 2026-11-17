import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// Creazione istanza Axios centralizzata
const api = axios.create({
  baseURL: API_BASE_URL,
});

// Interceptor per allegare automaticamente il Bearer token quando presente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dpp_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Autenticazione e rilascio token JWT
export const loginUser = async (credentials) => {
  const response = await api.post('/auth/login', credentials);
  return response.data;
};

// Recupero dei metadati completi del passaporto da MongoDB
export const getPassportById = async (productId) => {
  const response = await api.get(`/passports/${productId}`);
  return response.data;
};

// Creazione off-chain e prima notarizzazione on-chain del passaporto
export const createPassport = async (productData) => {
  const response = await api.post('/passports/create', productData);
  return response.data;
};

// Aggiunta di una fase di lavorazione con controllo preventivo di integrità (Pre-audit)
export const addRegenerationStep = async (productId, stepData) => {
  const response = await api.post(`/passports/${productId}/step`, stepData);
  return response.data;
};

// Invio delle immagini dell'etichetta per l'estrazione della composizione con Gemini
export const analyzeMaterialWithAI = async (formData) => {
  // Lasciamo che Axios e il browser impostino automaticamente multipart/form-data con il corretto boundary
  const response = await api.post('/ai/analyze-material', formData);
  return response.data;
};

// Accreditamento nuovo produttore da parte del SuperAdmin
export const registerBrand = async (brandData) => {
  const response = await api.post('/auth/register-brand', brandData);
  return response.data;
};

// Aggiornamento della password al primo accesso per sbloccare l'account
export const changePassword = async (passwordData) => {
  const response = await api.post('/auth/change-password', passwordData);
  return response.data;
};

// Audit crittografico on-chain: verifica la corrispondenza dell'impronta Keccak-256 su Polygon
export const verifyPassport = async (productId) => {
  const response = await api.get(`/passports/verify/${productId}`);
  return response.data;
};

export default api;