import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const syncApi = {
  // Get current sync status
  getCurrentStatus: async () => {
    const response = await api.get('/sync/status');
    return response.data;
  },

  // Get pending sync items
  getPendingItems: async () => {
    const response = await api.get('/sync/pending');
    return response.data;
  },

  // Get recent sync history
  getRecentHistory: async () => {
    const response = await api.get('/sync/history');
    return response.data;
  },

  // Trigger sync
  triggerSync: async () => {
    const response = await api.post('/sync/trigger');
    return response.data;
  },

  // Retry failed items
  retryFailedItems: async () => {
    const response = await api.post('/sync/retry');
    return response.data;
  },
};

export default api; 