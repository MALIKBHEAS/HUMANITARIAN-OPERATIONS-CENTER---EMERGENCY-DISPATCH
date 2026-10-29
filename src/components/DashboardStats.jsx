import React from 'react';
import { Shield, AlertTriangle, Activity, LogOut, Siren, Wifi } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function DashboardStats({ incidents = [], wsStatus = 'DISCONNECTED' }) {
  const { user, logout } = useAuth();

  const totalIncidents = incidents.length;
  const totalDispatches = incidents.reduce((acc, curr) => acc + (curr.dispatches?.length || 0), 0);
  const manualOverrides = incidents.filter((i) => i.status === 'MANUAL_OVERRIDE').length;

  const isWsConnected = wsStatus === 'CONNECTED';
  const isWsConnecting = wsStatus === 'CONNECTING';

  return (
    <header className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-4 select-none font-sans z-20">
      
      {/* Brand & System Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-600/20 text-red-500 border border-red-500/30">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight text-white font-mono">
              EOA DISPATCH CENTER
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-red-600/30 text-red-300">
              DEFCON-1
            </span>
          </div>
          <p className="text-[10px] font-mono text-slate-400">
            AUTONOMOUS EMERGENCY OPERATIONS HUD
          </p>
        </div>
      </div>

      {/* Real-Time Metrics Strip */}
      <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto py-1">
        
        {/* Metric 1: Total Incidents */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <div>
            <div className="text-[10px] font-mono text-slate-400 uppercase leading-none">INCIDENTS</div>
            <div className="text-sm font-mono font-bold text-white leading-tight">{totalIncidents}</div>
          </div>
        </div>

        {/* Metric 2: Live Dispatches */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
          <Siren className="w-4 h-4 text-emerald-400" />
          <div>
            <div className="text-[10px] font-mono text-slate-400 uppercase leading-none">DISPATCHES</div>
            <div className="text-sm font-mono font-bold text-emerald-400 leading-tight">{totalDispatches}</div>
          </div>
        </div>

        {/* Metric 3: Manual Overrides */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
          <Activity className="w-4 h-4 text-red-400" />
          <div>
            <div className="text-[10px] font-mono text-slate-400 uppercase leading-none">OVERRIDES</div>
            <div className="text-sm font-mono font-bold text-red-400 leading-tight">{manualOverrides}</div>
          </div>
        </div>

        {/* Metric 4: WebSocket Link Indicator (Bright Green when connected) */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isWsConnected
                ? 'bg-emerald-400 animate-pulse'
                : isWsConnecting
                ? 'bg-amber-400 animate-ping'
                : 'bg-red-500'
            }`}
          />
          <div>
            <div className="text-[10px] font-mono text-slate-400 uppercase leading-none">EDGE LINK</div>
            <div className="text-xs font-mono font-bold leading-tight">
              {isWsConnected ? (
                <span className="text-emerald-400 font-extrabold">ONLINE</span>
              ) : isWsConnecting ? (
                <span className="text-amber-400">CONNECTING...</span>
              ) : (
                <span className="text-red-400">OFFLINE</span>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Operator Session & Logout */}
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <div className="text-xs font-mono text-slate-200 font-bold">{user?.callSign || 'COMMANDER'}</div>
          <div className="text-[10px] font-mono text-slate-500">{user?.agency || 'OPERATIONS'}</div>
        </div>

        <button
          onClick={logout}
          title="Disconnect Terminal Session"
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-red-600/30 text-slate-300 hover:text-red-300 border border-slate-700 hover:border-red-500/50 rounded-lg text-xs font-mono transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden md:inline">LOGOUT</span>
        </button>
      </div>

    </header>
  );
}
