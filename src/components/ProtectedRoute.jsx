import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield } from 'lucide-react';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white font-mono select-none">
        <div className="relative flex items-center justify-center w-16 h-16 mb-4">
          <div className="absolute inset-0 rounded-full border-2 border-red-500/20 animate-ping"></div>
          <div className="w-12 h-12 rounded-full border-2 border-red-500 border-t-transparent animate-spin"></div>
          <Shield className="w-5 h-5 text-red-500 absolute" />
        </div>
        <p className="text-xs font-bold tracking-widest text-slate-300 uppercase">
          Verifying EOC Credentials...
        </p>
        <span className="text-[10px] text-slate-500 mt-1">SECURE DISPATCH TERMINAL</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
