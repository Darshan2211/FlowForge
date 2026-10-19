import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, 
});

export const errMsg = (e) => {
  if (!e.response) return 'Cannot reach the server. Check your connection.';
  return e.response.data?.message || e.response.data?.error || 'Something went wrong. Try again.';
};
export default api;