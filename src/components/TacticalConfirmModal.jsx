import React from 'react';
import { AlertTriangle, Siren, ShieldCheck, MapPin, X, CheckCircle2, Loader2 } from 'lucide-react';

export const TacticalConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  targetCoords,
  title = 'CONFIRM EMERGENCY DISPATCH ORDER',
  incidentType = 'MEDICAL',
  severity = 5,
  isTransmitting = false,
  errorMessage = null,
}) => {
  if (!isOpen) return null;

  const latNum = targetCoords?.lat != null ? Number(targetCoords.lat) : null;
  const lngNum =
    targetCoords?.lng != null
      ? Number(targetCoords.lng)
      : targetCoords?.lon != null
      ? Number(targetCoords.lon)
      : null;

  const isValidCoords =
    latNum !== null &&
    lngNum !== null &&
    !isNaN(latNum) &&
    !isNaN(lngNum) &&
    latNum >= -90 &&
    latNum <= 90 &&
    lngNum >= -180 &&
    lngNum <= 180;

  const locationLabel = targetCoords?.location || targetCoords?.label || 'Selected Map Coordinates';

  const getReadableType = (type) => {
    switch (type) {
      case 'SOS_DURESS':
        return 'Critical Duress / Urgent Field Evacuation';
      case 'FIRE':
        return 'Structural Fire & Search/Rescue';
      case 'CRASH':
      case 'RESCUE':
        return 'Trauma Collision & Rescue Operation';
      case 'SECURITY':
        return 'Civil Defense & Perimeter Safety';
      default:
        return 'Emergency Medical & Civil Response';
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none font-sans text-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl relative flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-600/20 text-red-500 border border-red-500/30 flex items-center justify-center shadow-sm">
              <Siren className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-red-400">
                  Humanitarian EOC Protocol
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-red-950 text-red-300 border border-red-700">
                  PRIORITY {severity}
                </span>
              </div>
              <h3 className="text-base font-bold text-white tracking-wide">
                {title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isTransmitting}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-slate-950 rounded-lg p-3.5 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <MapPin className="w-3.5 h-3.5 text-red-400" />
                <span>OPERATOR-VERIFIED INCIDENT LOCATION</span>
              </span>
              <span className="text-[11px] font-mono text-emerald-400">MAP VERIFIED</span>
            </div>

            <div className="text-base font-bold text-white truncate">
              {locationLabel}
            </div>

            {isValidCoords ? (
              <div className="flex items-center gap-3 font-mono text-xs text-yellow-300 pt-1 border-t border-slate-900">
                <span>LAT: {latNum.toFixed(6)}°N</span>
                <span>•</span>
                <span>LON: {lngNum.toFixed(6)}°E</span>
              </div>
            ) : (
              <div className="p-2 rounded bg-red-950/50 border border-red-500/60 text-red-300 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>INVALID COORDINATES: Please select a point on the map before dispatching.</span>
              </div>
            )}
          </div>

          <div className="bg-slate-950/60 rounded-lg p-3.5 border border-slate-800 text-xs space-y-2">
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400 font-medium">Emergency Category:</span>
              <span className="font-semibold text-white">{getReadableType(incidentType)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400 font-medium">Response Units:</span>
              <span className="font-semibold text-emerald-400">Medical Ambulances & Civil Defense</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400 font-medium">Dispatch Routing:</span>
              <span className="font-mono text-cyan-300">Valhalla Sovereign Router (Automated Avoidance)</span>
            </div>
          </div>

          {errorMessage && (
            <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-600/70 text-xs text-red-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="text-xs text-slate-400 leading-relaxed">
            Please confirm the incident coordinates and response allocation. Confirming will notify field units and log the incident in the humanitarian manifest.
          </div>
        </div>

        <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isTransmitting}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            Review Location / Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={!isValidCoords || isTransmitting}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTransmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Transmitting Order...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm & Dispatch Units</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default TacticalConfirmModal;
