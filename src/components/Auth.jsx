import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, Loader2, ArrowRight, Activity } from 'lucide-react';
import { api } from '../services/api';

export function Auth({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = isLogin 
        ? await api.login(email, password)
        : await api.signup(email, password);
      
      localStorage.setItem('token', data.token);
      onAuthSuccess(data.user);
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 selection:bg-[#10B981]/30">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-[#10B981]/5 rounded-full blur-[140px] animate-pulse" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md relative"
      >
        <div className="flex flex-col items-center mb-12 text-center">
          <div className="w-16 h-16 bg-[#10B981] rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
            <Activity className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-4xl font-serif italic text-white tracking-tight mb-2">
            InterCheck<span className="text-[#10B981] font-sans font-bold not-italic">AI</span>
          </h1>
          <p className="text-[10px] uppercase font-bold tracking-[0.25em] text-white/30">Pharmacological Ensemble</p>
        </div>

        <div className="bg-[#0F0F0F] border border-white/5 rounded-[32px] p-10 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-[#10B981] uppercase tracking-[0.2em] ml-1">Terminal ID</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white outline-none focus:border-[#10B981] transition-all font-medium placeholder:text-white/5"
                  placeholder="name@institute.edu"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-[#10B981] uppercase tracking-[0.2em] ml-1">Access Key</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white outline-none focus:border-[#10B981] transition-all font-medium placeholder:text-white/5"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 bg-red-500/5 border border-red-500/10 rounded-xl text-red-500 text-[10px] font-mono uppercase tracking-widest text-center"
              >
                Error: {error}
              </motion.div>
            )}

            <div className="pt-4">
              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 text-black font-bold py-5 rounded-xl flex items-center justify-center gap-3 transition-all group"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span className="uppercase tracking-widest text-sm">{isLogin ? 'Initialize' : 'Register Service'}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-10 pt-8 border-t border-white/5 flex flex-col items-center">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 hover:text-white transition-colors"
            >
              {isLogin ? "Generate New Credentials" : "Existing Identifier Login"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
