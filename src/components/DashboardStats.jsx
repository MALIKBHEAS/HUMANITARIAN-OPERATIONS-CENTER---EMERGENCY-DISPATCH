import React from 'react';
import { Shield, AlertTriangle, Activity, LogOut, Siren, Wifi, HeartPulse, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function DashboardStats({
  incidents = [],
  wsStatus = 'DISCONNECTED',
  systemHealth = null,
  onTriggerSOS,
}) {
  const { user, logout } = useAuth();

  const totalIncidents = incidents.length;
  const totalDispatches = incidents.reduce((acc, curr) => acc + (curr.dispatches?.length || 0), 0);
  const manualOverrides = incidents.filter((i) => i.status === 'MANUAL_OVERRIDE').length;

  const overallStatus = systemHealth?.overallStatus || (wsStatus === 'CONNECTED' ? 'ONLINE' : 'DEGRADED');
  const apiStatus = systemHealth?.apiStatus || 'ONLINE';
  const apiLatency = systemHealth?.apiLatencyMs;
  const lastSync = systemHealth?.lastSyncTime;

  return (
    <header className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-4 select-none font-sans z-20">
      
      {/* Brand & Humanitarian System Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-600/20 text-red-500 border border-red-500/30">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight text-white font-mono">
              HUMANITARIAN OPERATIONS CENTER
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
              EOC LEVEL-1 READY
            </span>
          </div>
          <p className="text-[10px] font-mono text-slate-400">
            EMERGENCY RESPONSE & DISPATCH PLATFORM
          </p>
        </div>
      </div>

      {/* Real-Time Metrics & Independent Health Strip */}
      <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto py-1">
        
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

        {/* Health 1: System Overall Status Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              overallStatus === 'ONLINE'
                ? 'bg-emerald-400 animate-pulse'
                : overallStatus === 'DEGRADED'
                ? 'bg-amber-400 animate-ping'
                : 'bg-red-500'
            }`}
          />
          <div>
            <div className="text-[10px] font-mono text-slate-400 uppercase leading-none">SYSTEM STATUS</div>
            <div className="text-xs font-mono font-bold leading-tight">
              {overallStatus === 'ONLINE' ? (
                <span className="text-emerald-400 font-extrabold">ONLINE</span>
              ) : overallStatus === 'DEGRADED' ? (
                <span className="text-amber-400">DEGRADED</span>
              ) : (
                <span className="text-red-400">OFFLINE</span>
              )}
            </div>
          </div>
        </div>

        {/* Health 2: REST API & Latency */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
          <span
            className={`w-2 h-2 rounded-full ${apiStatus === 'ONLINE' ? 'bg-emerald-400' : 'bg-red-500'}`}
          />
          <div>
            <div className="text-[10px] font-mono text-slate-400 uppercase leading-none">API LINK</div>
            <div className="text-xs font-mono font-bold text-slate-200 leading-tight">
              {apiStatus} {apiLatency !== null && apiLatency !== undefined && (
                <span className="text-cyan-400">({apiLatency}ms)</span>
              )}
            </div>
          </div>
        </div>

        {/* Health 3: Last Sync Time */}
        {lastSync && (
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-400">
            <span>SYNC:</span>
            <span className="text-slate-200">{lastSync}</span>
          </div>
        )}

        {/* Immediate SOS / Emergency Button */}
        <button
          type="button"
          onClick={onTriggerSOS}
          title="Broadcast Critical Duress / Emergency Alert"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-mono font-black text-xs uppercase border-2 border-red-400 shadow-xl shadow-red-950 animate-pulse hover:animate-none active:scale-95 transition-all cursor-pointer min-h-[38px]"
        >
          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
          <span>[EMERGENCY SOS]</span>
        </button>

      </div>

      {/* Operator Session & Logout */}
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <div className="text-xs font-mono text-slate-200 font-bold">{user?.callSign || 'COMMANDER'}</div>
          <div className="text-[10px] font-mono text-slate-500">{user?.agency || 'HUMANITARIAN EOC'}</div>
        </div>

        <button
          onClick={logout}
          title="Disconnect Terminal Session"
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-red-600/30 text-slate-300 hover:text-red-300 border border-slate-700 hover:border-red-500/50 rounded-lg text-xs font-mono transition-colors min-h-[36px]"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden md:inline">LOGOUT</span>
        </button>
      </div>

    </header>
  );
}
