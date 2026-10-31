import React, { useState, useEffect } from 'react';
import { Video, X, Crosshair, ZoomIn, Eye, Activity, Shield, Camera, Maximize2 } from 'lucide-react';

export const CCTVPanel = ({
  isOpen,
  onClose,
  activeIncident,
  initialVisionMode = 'DAY',
  onCaptureSnapshot,
}) => {
  const [visionMode, setVisionMode] = useState(initialVisionMode);
  const [zoom, setZoom] = useState(1);
  const [showAiBBoxes, setShowAiBBoxes] = useState(true);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    if (initialVisionMode) setVisionMode(initialVisionMode);
  }, [initialVisionMode]);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const utc = now.toISOString().slice(11, 23) + 'Z';
      setCurrentTime(utc);
    };
    update();
    const timer = setInterval(update, 64);
    return () => clearInterval(timer);
  }, []);

  if (!isOpen) return null;

  const lat = activeIncident?.latitude || activeIncident?.lat || 31.5125;
  const lng = activeIncident?.longitude || activeIncident?.lng || 34.4533;
  const targetId = activeIncident?.id || 'TGT-ALPHA-01';
  const locationName = activeIncident?.location || 'TACTICAL SECTOR';

  return (
    <div className="fixed inset-0 z-[2500] flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-md select-none font-mono text-xs">
      <div className="bg-[#0a0e17] border-2 border-cyan-400/90 rounded-lg w-full max-w-4xl overflow-hidden shadow-[0_0_40px_rgba(6,182,212,0.35)] relative flex flex-col">
        
        {/* TOP C4ISR MODAL HEADER */}
        <div className="px-3 py-2 bg-[#0f1522] border-b border-slate-700 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-cyan-950 border border-cyan-500 flex items-center justify-center text-cyan-400">
              <Video className="w-3.5 h-3.5 animate-pulse" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-black text-white uppercase tracking-wider text-xs">
                UAV-RECON TACTICAL FEED // MIL-STD-810H
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-red-600/30 text-red-400 border border-red-500/50 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                LIVE REC
              </span>
            </div>
          </div>

          {/* Mode Switcher Buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setVisionMode('DAY')}
              className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-all border cursor-pointer ${
                visionMode === 'DAY'
                  ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-md shadow-cyan-950 font-extrabold'
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-cyan-400 hover:border-cyan-600'
              }`}
            >
              [ DAY ]
            </button>

            <button
              type="button"
              onClick={() => setVisionMode('IR')}
              className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-all border cursor-pointer ${
                visionMode === 'IR'
                  ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow-md shadow-emerald-950 animate-pulse font-extrabold'
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-emerald-400 hover:border-emerald-600'
              }`}
            >
              [ IR ]
            </button>

            <button
              type="button"
              onClick={() => setVisionMode('FLIR')}
              className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-all border cursor-pointer ${
                visionMode === 'FLIR'
                  ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md shadow-amber-950 animate-pulse font-extrabold'
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-amber-400 hover:border-amber-600'
              }`}
            >
              [ FLIR ]
            </button>

            <button
              type="button"
              onClick={() => setShowAiBBoxes(!showAiBBoxes)}
              className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition-all border ms-1.5 cursor-pointer ${
                showAiBBoxes
                  ? 'bg-purple-950/80 text-purple-300 border-purple-500'
                  : 'bg-slate-900 text-slate-500 border-slate-700'
              }`}
            >
              AI HUD: {showAiBBoxes ? 'ON' : 'OFF'}
            </button>

            <div className="flex items-center bg-slate-950 rounded border border-slate-700 ms-1 p-0.5">
              {[1, 2, 4].map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setZoom(z)}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer ${
                    zoom === z ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {z}X
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors ms-2 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* REALISTIC MILITARY CAMERA VIEWPORT */}
        <div className="relative h-[420px] bg-slate-950 overflow-hidden select-none">
          <div
            className="w-full h-full relative transition-transform duration-300 ease-out origin-center"
            style={{
              transform: `scale(${zoom})`,
              filter:
                visionMode === 'IR'
                  ? 'grayscale(100%) brightness(130%) contrast(165%) sepia(100%) hue-rotate(85deg) saturate(380%) drop-shadow(0 0 10px rgba(34,197,94,0.45))'
                  : visionMode === 'FLIR'
                  ? 'contrast(220%) brightness(110%) sepia(100%) hue-rotate(280deg) saturate(600%)'
                  : 'contrast(115%) brightness(105%)',
            }}
          >
            <div
              className="w-full h-full"
              style={{
                backgroundColor: visionMode === 'IR' ? '#041d0e' : visionMode === 'FLIR' ? '#0d0722' : '#080d17',
                backgroundImage: `
                  radial-gradient(circle at 50% 50%, ${visionMode === 'IR' ? '#0e3a1f' : visionMode === 'FLIR' ? '#240b47' : '#101c30'} 0%, transparent 80%),
                  linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)
                `,
                backgroundSize: '100% 100%, 32px 32px, 32px 32px',
              }}
            >
              <svg className="w-full h-full opacity-65" viewBox="0 0 800 450">
                <path d="M 50,380 Q 200,260 400,290 T 750,220" fill="none" stroke={visionMode === 'FLIR' ? '#f43f5e' : visionMode === 'IR' ? '#22c55e' : '#38bdf8'} strokeWidth="1" strokeDasharray="3 4" opacity="0.6" />
                <path d="M 20,410 Q 220,290 420,320 T 780,250" fill="none" stroke={visionMode === 'FLIR' ? '#fbbf24' : visionMode === 'IR' ? '#4ade80' : '#0284c7'} strokeWidth="1" strokeDasharray="2 3" opacity="0.5" />
                <path d="M 120,440 Q 300,340 520,360 T 790,300" fill="none" stroke={visionMode === 'FLIR' ? '#c026d3' : visionMode === 'IR' ? '#16a34a' : '#0369a1'} strokeWidth="1" opacity="0.4" />

                <g transform="translate(400, 225)">
                  {visionMode === 'FLIR' ? (
                    <>
                      <circle cx="0" cy="0" r="75" fill="#f43f5e" opacity="0.25" className="animate-pulse" />
                      <circle cx="0" cy="0" r="50" fill="#f97316" opacity="0.5" />
                      <circle cx="0" cy="0" r="30" fill="#facc15" opacity="0.8" />
                      <circle cx="0" cy="0" r="14" fill="#ffffff" />
                      <circle cx="-90" cy="45" r="18" fill="#ea580c" opacity="0.75" />
                      <circle cx="-90" cy="45" r="7" fill="#fef08a" />
                      <circle cx="110" cy="-35" r="22" fill="#c026d3" opacity="0.7" />
                      <circle cx="110" cy="-35" r="8" fill="#f43f5e" />
                    </>
                  ) : visionMode === 'IR' ? (
                    <>
                      <circle cx="0" cy="0" r="65" fill="#22c55e" opacity="0.2" className="animate-pulse" />
                      <circle cx="0" cy="0" r="38" fill="#4ade80" opacity="0.5" />
                      <circle cx="0" cy="0" r="16" fill="#86efac" opacity="0.85" />
                      <circle cx="0" cy="0" r="6" fill="#ffffff" />
                      <circle cx="-90" cy="45" r="12" fill="#22c55e" opacity="0.6" />
                      <circle cx="110" cy="-35" r="14" fill="#16a34a" opacity="0.6" />
                    </>
                  ) : (
                    <>
                      <circle cx="0" cy="0" r="45" fill="#0284c7" opacity="0.2" className="animate-pulse" />
                      <circle cx="0" cy="0" r="24" fill="#38bdf8" opacity="0.4" />
                      <circle cx="0" cy="0" r="8" fill="#f8fafc" />
                      <circle cx="-90" cy="45" r="10" fill="#64748b" opacity="0.5" />
                      <circle cx="110" cy="-35" r="12" fill="#475569" opacity="0.5" />
                    </>
                  )}
                </g>

                {showAiBBoxes && (
                  <g>
                    <g transform="translate(345, 175)">
                      <rect x="0" y="0" width="110" height="95" fill="none" stroke="#ef4444" strokeWidth="1.5" />
                      <line x1="-5" y1="0" x2="5" y2="0" stroke="#ef4444" strokeWidth="2" />
                      <line x1="105" y1="0" x2="115" y2="0" stroke="#ef4444" strokeWidth="2" />
                      <line x1="-5" y1="95" x2="5" y2="95" stroke="#ef4444" strokeWidth="2" />
                      <line x1="105" y1="95" x2="115" y2="95" stroke="#ef4444" strokeWidth="2" />
                      <text x="2" y="-5" fill="#ef4444" fontSize="9" fontWeight="bold" fontFamily="monospace">
                        {visionMode === 'FLIR' ? 'TGT CORE: +642.8°C' : 'TGT HAZARD: 99.8%'}
                      </text>
                      <text x="2" y="108" fill="#f87171" fontSize="8" fontFamily="monospace">
                        ID: {targetId} [DEFCON-1]
                      </text>
                    </g>

                    <g transform="translate(230, 245)">
                      <rect x="0" y="0" width="70" height="45" fill="none" stroke="#22c55e" strokeWidth="1" strokeDasharray="3 2" />
                      <text x="2" y="-4" fill="#4ade80" fontSize="8" fontWeight="bold" fontFamily="monospace">
                        UNIT-MEDEVAC: 98.4%
                      </text>
                    </g>

                    <g transform="translate(485, 160)">
                      <rect x="0" y="0" width="65" height="45" fill="none" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3 2" />
                      <text x="2" y="-4" fill="#7dd3fc" fontSize="8" fontWeight="bold" fontFamily="monospace">
                        PATROL-SWAT: 99.1%
                      </text>
                    </g>
                  </g>
                )}
              </svg>
            </div>
          </div>

          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, #000 0px, #000 1px, transparent 1px, transparent 3px)',
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at 50% 50%, transparent 45%, rgba(0, 0, 0, 0.75) 100%)',
            }}
          />

          {/* Corner Framing Brackets */}
          <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-cyan-400 opacity-80 pointer-events-none" />
          <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-cyan-400 opacity-80 pointer-events-none" />
          <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-cyan-400 opacity-80 pointer-events-none" />
          <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-cyan-400 opacity-80 pointer-events-none" />

          {/* Top HUD Telemetry */}
          <div className="absolute top-4 inset-x-6 z-20 flex items-start justify-between text-[11px] font-mono text-cyan-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] pointer-events-none">
            <div>
              <div className="font-black tracking-widest text-white text-xs">
                CAM-01 // {locationName}
              </div>
              <div className="text-[10px] text-cyan-200 font-mono mt-0.5">
                GRID: {Number(lat).toFixed(6)}°N, {Number(lng).toFixed(6)}°E
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5">
                SENSOR: {visionMode === 'DAY' ? 'OPTICAL 4K CMOS' : visionMode === 'IR' ? 'NIGHT GAIN 850nm' : 'LWIR MICROBOLOMETER'}
              </div>
            </div>

            <div className="text-end text-[10px]">
              <div className="font-black text-yellow-300 tracking-wider">
                ZULU: {currentTime}
              </div>
              <div className="text-emerald-400 font-bold mt-0.5">
                FPS: 30.0 | BITRATE: 6.2 MBPS | ZOOM: {zoom}X
              </div>
              <div className="text-slate-400 text-[9px] mt-0.5">
                STREAM: AES-256 ENCRYPTED
              </div>
            </div>
          </div>

          {/* Center Precision Military Targeting Reticle */}
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <div className="w-28 h-28 border border-cyan-400/60 rounded-full flex items-center justify-center">
                <div className="absolute w-full h-[1px] bg-cyan-400/50" />
                <div className="absolute h-full w-[1px] bg-cyan-400/50" />
                <div className="w-10 h-10 border border-cyan-300/80 rounded-full flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
                </div>
              </div>

              <div className="absolute -top-3 text-[8px] font-mono font-bold text-cyan-300">N 000°</div>
              <div className="absolute -bottom-3 text-[8px] font-mono font-bold text-cyan-300">S 180°</div>
              <div className="absolute -left-4 text-[8px] font-mono font-bold text-cyan-300">W</div>
              <div className="absolute -right-4 text-[8px] font-mono font-bold text-cyan-300">E</div>
            </div>

            <div className="mt-2 text-[10px] font-black uppercase tracking-wider text-cyan-200 drop-shadow bg-slate-950/80 px-2.5 py-0.5 rounded border border-cyan-500/40">
              {visionMode === 'DAY' && 'DAYLIGHT OPTICAL RECON // TARGET ACQUIRED'}
              {visionMode === 'IR' && 'IR NIGHT ILLUMINATOR ACTIVE // RANGE: 412M'}
              {visionMode === 'FLIR' && 'THERMAL CORE: +642.8°C | AMBIENT: +21.4°C'}
            </div>
          </div>

          {/* Bottom HUD Bar & FLIR Color Scale */}
          <div className="absolute bottom-3 inset-x-6 z-20 flex items-center justify-between text-[10px] font-mono text-slate-300 bg-slate-950/85 px-3 py-1 rounded border border-slate-700 pointer-events-none">
            <div>
              AZ: <span className="text-white font-bold">182.4°</span> | EL: <span className="text-white font-bold">-03.2°</span> | DEFCON-1
            </div>

            {visionMode === 'FLIR' && (
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-cyan-300 font-bold">15°C</span>
                <div className="w-36 h-2 rounded bg-gradient-to-r from-blue-700 via-purple-600 via-pink-500 via-red-500 via-yellow-400 to-white border border-slate-600" />
                <span className="text-[9px] text-red-400 font-bold">650°C</span>
              </div>
            )}

            <div className="text-yellow-400 font-bold">
              LOCK: {targetId}
            </div>
          </div>
        </div>

        {/* MODAL FOOTER CONTROLS */}
        <div className="p-2.5 bg-[#0f1522] border-t border-slate-700 flex justify-between items-center text-[10px]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCaptureSnapshot}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-700 hover:bg-cyan-600 text-white font-bold cursor-pointer transition-colors shadow-sm"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>CAPTURE TACTICAL SNAPSHOT</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold cursor-pointer border border-slate-600 transition-colors"
          >
            CLOSE FEED
          </button>
        </div>

      </div>
    </div>
  );
};

export default CCTVPanel;
