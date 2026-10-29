import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, KeyRound, AlertTriangle, ArrowRight, Zap, Radio } from 'lucide-react';

const QUICK_AGENCY_LOGINS = [
  { code: 'EOC-OPS', name: 'Standard Operations', flag: '🚨' },
  { code: 'EOC-HEBRON-OPS', name: 'Hebron Command', flag: '🇵🇸' },
  { code: 'EOC-TOKYO-OPS', name: 'Tokyo Response', flag: '🇯🇵' },
  { code: 'EOC-MADRID-OPS', name: 'Madrid Civil Def', flag: '🇪🇸' },
];

export default function Login() {
  const [agencyInput, setAgencyInput] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const handleAuthenticate = (codeToUse) => {
    setError('');
    const code = codeToUse || agencyInput;
    try {
      login(code);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Authorization failed.');
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen w-screen bg-slate-950 px-4 py-8 overflow-hidden select-none font-sans">
      {/* Background Grid & Ambient Glow */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:32px_32px] opacity-40"></div>
      <div className="absolute w-[500px] h-[500px] rounded-full bg-red-600/10 blur-[130px] pointer-events-none"></div>

      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-6 sm:p-8 backdrop-blur-md">
        
        {/* Top Header Badge */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-red-600/20 text-red-500 border border-red-500/30">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2 font-mono">
                EOA DISPATCH TERMINAL
              </h1>
              <p className="text-xs font-mono text-slate-400">EMERGENCY OPERATIONS CENTER</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
            READY
          </span>
        </div>

        {/* Security Alert Notice */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-300 mb-6">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p>
            Tactical emergency management terminal. Live spatial GIS routing and ReAct agent dispatches active.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400 font-mono">
            ⚠ {error}
          </div>
        )}

        {/* Login Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAuthenticate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Agency Security ID / Passcode</span>
              <span className="text-[10px] text-slate-500">FRICTIONLESS SSO</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={agencyInput}
                onChange={(e) => setAgencyInput(e.target.value)}
                placeholder="e.g. EOC-OPS or EOC-HEBRON-OPS"
                className="w-full bg-slate-950 border border-slate-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-lg px-3.5 py-2.5 text-sm font-mono text-white placeholder-slate-600 outline-none transition-all"
                autoFocus
              />
              <KeyRound className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-medium py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-lg shadow-red-600/20 text-sm tracking-wide font-mono"
          >
            <span>ENTER EMERGENCY OPERATIONS</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* 1-Click Fast Access */}
        <div className="mt-6 pt-5 border-t border-slate-800">
          <p className="text-[11px] font-mono uppercase text-slate-400 mb-3 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Fast Agency Presets (1-Click Login)</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_AGENCY_LOGINS.map((p) => (
              <button
                key={p.code}
                type="button"
                onClick={() => handleAuthenticate(p.code)}
                className="flex items-center justify-between p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg transition-all text-left group"
              >
                <div>
                  <div className="text-xs font-mono font-semibold text-slate-200 group-hover:text-white">
                    {p.name}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500">{p.code}</div>
                </div>
                <span className="text-base">{p.flag}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Security Footer */}
        <div className="mt-6 flex items-center justify-between text-[10px] font-mono text-slate-500 border-t border-slate-800/60 pt-3">
          <span className="flex items-center gap-1">
            <Radio className="w-3 h-3 text-red-500 animate-pulse" />
            EDGE STREAM ACTIVE
          </span>
          <span>WGS 84 GPS STANDARD</span>
        </div>

      </div>
    </div>
  );
}
