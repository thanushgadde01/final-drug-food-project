const API_BASE = '/api';

export const api = {
  async signup(email, password) {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async login(email, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getMe() {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('No token');
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async predictXGBoost(drug_name, food_name, age, weight) {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}/predict`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ drug_name, food_name, age, weight }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async saveToHistory(entry) {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}/history`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify(entry),
    });
    return res.json();
  },

  async getHistory() {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}/history`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return res.json();
  }
};
