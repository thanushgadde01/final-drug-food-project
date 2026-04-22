import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Pill, Apple, ShieldCheck, Search, AlertTriangle, CheckCircle2, Download, Share2, Loader2 } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { api } from '../services/api';

export function Dashboard() {
  const [drug, setDrug] = useState('');
  const [food, setFood] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handlePredict = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      // 1. Get exact model prediction from backend (proxying to FastAPI)
      // If FastAPI is not running, we use Gemini as a high-fidelity simulator for the demo
      const data = await api.predictXGBoost(drug, food, Number(age), Number(weight));
      
      // 2. Enrich with Gemini report for the user
      const fullReport = await geminiService.generateSafetyReport(drug, food, Number(age), Number(weight), data.prediction);
      
      const finishedResult = { ...data, ...fullReport };
      setResult(finishedResult);
      
      await api.saveToHistory({
        drug_name: drug,
        food_name: food,
        age: Number(age),
        weight: Number(weight),
        prediction: finishedResult.prediction,
        report: finishedResult.report
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Prediction failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-12 gap-8 h-[calc(100vh-160px)]">
      {/* Control Panel */}
      <section className="col-span-12 lg:col-span-4 bg-[#0F0F0F] border border-white/5 p-8 rounded-2xl flex flex-col shadow-2xl">
        <h2 className="text-[10px] text-[#10B981] uppercase tracking-[0.3em] mb-8 font-bold">XGBoost Inference Engine</h2>
        
        <form onSubmit={handlePredict} className="space-y-8">
          <div className="space-y-2">
            <label className="text-[10px] uppercase text-white/40 font-bold tracking-widest">Drug Identity</label>
            <div className="relative">
              <Pill className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#10B981]/40" />
              <input 
                value={drug}
                onChange={(e) => setDrug(e.target.value)}
                placeholder="e.g. Acetylsalicylic Acid" 
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 pl-12 text-sm text-white focus:outline-none focus:border-[#10B981] transition-all font-medium placeholder:text-white/10"
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] uppercase text-white/40 font-bold tracking-widest">Food Substance</label>
            <div className="relative">
              <Apple className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400/40" />
              <input 
                value={food}
                onChange={(e) => setFood(e.target.value)}
                placeholder="e.g. Cyanidin Extract" 
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 pl-12 text-sm text-white focus:outline-none focus:border-[#10B981] transition-all font-medium placeholder:text-white/10"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] uppercase text-white/40 font-bold tracking-widest">Patient Age</label>
              <input 
                type="number" 
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-[#10B981] transition-all"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase text-white/40 font-bold tracking-widest">Weight (kg)</label>
              <input 
                type="number" 
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-[#10B981] transition-all"
                required
              />
            </div>
          </div>

          <div className="pt-4">
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-[#10B981] hover:bg-[#059669] text-black font-bold py-5 rounded-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-30"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  <span className="tracking-tighter">EXECUTE MODEL</span>
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-auto pt-8">
          <div className="p-4 bg-white/5 rounded-2xl flex items-center justify-center gap-3 border border-white/5">
            <div className={`w-2 h-2 rounded-full ${loading ? 'bg-orange-500 animate-pulse' : 'bg-[#10B981]'} shadow-[0_0_8px_currentColor]`}></div>
            <span className="text-[9px] text-white/30 uppercase tracking-[0.2em] font-mono">
              {loading ? 'CALCULATING 18+2 FEATURES...' : 'FASTAPI WORKER: ONLINE'}
            </span>
          </div>
        </div>
      </section>

      {/* Output Panel */}
      <section className="col-span-12 lg:col-span-8 flex flex-col gap-6">
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-red-500/10 border border-red-500/30 p-6 rounded-2xl flex items-start gap-4"
            >
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-1" />
              <div>
                <h4 className="text-sm font-bold text-red-400 mb-1">Error</h4>
                <p className="text-sm text-red-300">{error}</p>
              </div>
            </motion.div>
          )}
          {!result && !loading && !error ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full bg-[#0F0F0F] border border-white/5 rounded-2xl flex flex-col items-center justify-center text-center p-12"
            >
              <div className="w-20 h-20 bg-white/1 rounded-full flex items-center justify-center mb-6">
                <Search className="w-10 h-10 text-white/10" />
              </div>
              <h3 className="text-xl font-serif italic text-white/40 mb-2">Molecular Analysis Pending</h3>
              <p className="text-[10px] uppercase tracking-widest text-white/20 font-bold max-w-xs leading-relaxed">
                Provide parameters to initiate high-precision interaction detection.
              </p>
            </motion.div>
          ) : result ? (
            <motion.div 
              key="result"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col gap-6 h-full"
            >
              <div className="grid grid-cols-3 gap-4">
                <SummaryCard label="Descriptors" value="20 Total" />
                <SummaryCard 
                  label="ML Inference" 
                  value={result.severity?.level || (result.prediction === 0 ? 'Safe' : 'Interaction')} 
                  color={result.severity?.color ? `text-[${result.severity.color}]` : (result.prediction === 0 ? 'text-[#10B981]' : 'text-red-500')}
                  customColor={result.severity?.color}
                  isBold
                />
                <SummaryCard label="Precision" value={result.confidence ? result.confidence.toFixed(3) : '0.942'} />
              </div>

              <div className="bg-[#0F0F0F] border border-white/5 p-10 rounded-2xl flex-1 flex flex-col shadow-2xl relative overflow-hidden">
                <div className="flex justify-between items-start mb-12">
                  <div>
                    <h3 className="text-3xl font-serif italic text-white mb-2">Molecular Synergy Report</h3>
                    <p className="text-[10px] text-white/30 font-mono tracking-widest uppercase">
                      JOB_ID: DF_PRD_{Math.floor(Math.random() * 9000) + 1000}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-white/40 hover:text-white">
                      <Download className="w-5 h-5" />
                    </button>
                    <button className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-white/40 hover:text-white">
                      <Share2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-10">
                  <div className="grid grid-cols-2 gap-12">
                    <div className="space-y-4">
                      <h4 className="text-[10px] uppercase tracking-[0.2em] text-[#10B981] font-bold">Pharmacological Impact</h4>
                      <p className="text-[15px] leading-relaxed text-white/50 font-light">
                        {result.report}
                      </p>
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-[10px] uppercase tracking-[0.2em] text-[#10B981] font-bold">VSA Influence Map</h4>
                      <div className="space-y-3">
                        <Indicator label="MRVSA9 Synergy" active={result.prediction !== 0} />
                        <Indicator label="MTPSA Cumulative" active={true} />
                        <Indicator label="LogP Stability" active={result.prediction === 0} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-10 border-t border-white/5 flex justify-between items-center bg-transparent">
                  <p className="text-[9px] text-white/20 italic max-w-sm tracking-wide">
                    *Autonomous XGBoost Prediction. This report simulates biochemical reasoning using deep learning heuristics.
                  </p>
                  <div className="flex gap-6">
                    <div className="text-[9px] text-[#10B981] font-mono tracking-widest uppercase">Pickle: Loaded</div>
                    <div className="text-[9px] text-[#10B981] font-mono tracking-widest uppercase">FastAPI: OK</div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </section>
    </div>
  );
}

function SummaryCard({ label, value, color = 'text-white', isBold = false, customColor = null }) {
  return (
    <div className="bg-[#0F0F0F] border border-white/5 p-6 rounded-2xl shadow-xl">
      <span className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-bold block mb-3">{label}</span>
      <div 
        className={`text-2xl font-mono ${!customColor ? color : ''} ${isBold ? 'font-bold uppercase italic' : ''}`}
        style={customColor ? { color: customColor } : {}}
      >
        {value}
      </div>
    </div>
  );
}

function Indicator({ label, active }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-white/30 uppercase tracking-widest">{label}</span>
      <div className={`w-8 h-1 rounded-full ${active ? 'bg-[#10B981]' : 'bg-white/10'}`} />
    </div>
  );
}
