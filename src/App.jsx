import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, LogOut, User, CheckCircle2, AlertTriangle, Loader2, X, History as HistoryIcon } from 'lucide-react';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { api } from './services/api';

const SEVERITY_MAP = {
  0: { level: 'SAFE', color: '#10B981', label: 'Negative result' },
  1: { level: 'MILD', color: '#F59E0B', label: 'Mild Hazard' },
  2: { level: 'MODERATE', color: '#EF6B3E', label: 'Moderate Hazard' },
  3: { level: 'SEVERE', color: '#DC2626', label: 'Severe Hazard' },
  4: { level: 'CRITICAL', color: '#7C2D12', label: 'Critical Hazard' },
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { user } = await api.getMe();
      setUser(user);
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#10B981] animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Auth onAuthSuccess={(user) => setUser(user)} />;
  }

  return (
    <div className="min-h-screen bg-[#050505] text-[#E0E0E0] font-sans selection:bg-[#10B981]/30">
      <nav className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#10B981] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            <Activity className="w-6 h-6 text-black" />
          </div>
          <span className="text-2xl font-serif italic tracking-tight text-white">
            InterCheck<span className="text-[#10B981] font-sans font-bold not-italic">AI</span>
          </span>
        </div>

        <div className="hidden md:flex items-center gap-10">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`text-[10px] uppercase tracking-[0.2em] font-bold transition-colors ${activeTab === 'dashboard' ? 'text-[#10B981]' : 'text-white/50 hover:text-white'}`}
          >
            Analysis
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`text-[10px] uppercase tracking-[0.2em] font-bold transition-colors ${activeTab === 'history' ? 'text-[#10B981]' : 'text-white/50 hover:text-white'}`}
          >
            History
          </button>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden sm:block px-4 py-1.5 border border-white/20 rounded-full text-[10px] uppercase tracking-widest text-white/60">
            User: {user.email.split('@')[0]}
          </div>
          <button 
            onClick={handleLogout}
            className="bg-white text-black px-6 py-2 rounded-full text-xs font-bold uppercase tracking-tighter hover:bg-[#10B981] transition-colors"
          >
            Log Out
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' ? (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            >
              <Dashboard />
            </motion.div>
          ) : (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <HistoryView />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function HistoryView() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const data = await api.getHistory();
      setHistory(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="py-20 text-center text-white/40 font-mono text-sm uppercase tracking-widest">Hydrating state...</div>;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-4xl font-serif italic text-white tracking-tight">Archives</h1>
        <p className="text-white/40 mt-2 text-sm uppercase tracking-[0.2em] font-semibold">Long-term interaction audit history</p>
      </div>

      <div className="grid gap-4">
        {history.length === 0 ? (
          <div className="py-32 text-center border border-white/5 bg-[#0F0F0F] rounded-3xl">
            <HistoryIcon className="w-12 h-12 text-white/5 mx-auto mb-4" />
            <p className="text-white/20 uppercase tracking-widest text-[10px] font-bold">No historical data logs found</p>
          </div>
        ) : (
          history.map((item) => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-8 bg-[#0F0F0F] border border-white/5 rounded-2xl hover:border-white/10 transition-colors"
            >
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="flex items-center gap-6">
                  <div 
                    className="w-14 h-14 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${SEVERITY_MAP[item.prediction]?.color}15`, color: SEVERITY_MAP[item.prediction]?.color }}
                  >
                    {item.prediction === 0 ? (
                      <CheckCircle2 className="w-7 h-7" />
                    ) : (
                      <AlertTriangle className="w-7 h-7" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-serif italic text-white">{item.drug_name}</span>
                      <X className="w-3 h-3 text-white/20" />
                      <span className="text-xl font-serif italic text-white">{item.food_name}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-[10px] font-mono text-white/30 uppercase">ID: DF_{item.id}</span>
                      <span className="text-[10px] font-mono text-white/30 uppercase">{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span 
                    className="px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] border"
                    style={{ 
                      backgroundColor: `${SEVERITY_MAP[item.prediction]?.color}05`, 
                      color: SEVERITY_MAP[item.prediction]?.color,
                      borderColor: `${SEVERITY_MAP[item.prediction]?.color}33`
                    }}
                  >
                    {SEVERITY_MAP[item.prediction]?.label || 'Result'}
                  </span>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
