import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Shield, Navigation, Building2, Flame } from 'lucide-react';
import { API_BASE_URL } from '../api';

const DEFAULT_CENTER = [31.5326, 35.0998];

// Preset Global Operations Sectors
export const GLOBAL_SECTORS = [
  { id: 'hebron', name: 'Hebron (الخليل)', center: [31.5326, 35.0998], zoom: 13 },
  { id: 'tokyo', name: 'Tokyo (Shinjuku)', center: [35.6938, 139.6917], zoom: 13 },
  { id: 'madrid', name: 'Madrid (M-30)', center: [40.4816, -3.6872], zoom: 13 },
  { id: 'newyork', name: 'New York (Manhattan)', center: [40.7580, -73.9855], zoom: 13 },
  { id: 'riyadh', name: 'Riyadh (الرياض)', center: [24.7136, 46.6753], zoom: 13 },
];

// Auto-Focus helper component: smoothly flies camera to new incident GPS coordinates
export function MapFlyTo({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position && position[0] && position[1]) {
      map.flyTo(position, 14, { duration: 1.5 });
    }
  }, [position, map]);
  return null;
}

// Custom DivIcons: Hospitals, Police, and Aggressively Pulsing Incidents
const createIncidentIcon = (severity) =>
  L.divIcon({
    className: 'custom-pin-incident',
    html: `
      <div class="relative flex items-center justify-center w-10 h-10">
        <span class="absolute w-10 h-10 rounded-full bg-red-600/50 ${severity >= 4 ? 'pulsing-incident-beacon' : 'animate-ping'}"></span>
        <div class="relative w-8 h-8 rounded-full bg-red-600 border-2 border-white flex items-center justify-center shadow-2xl text-white font-bold text-sm">
          🚨
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

const createHospitalIcon = (beds) =>
  L.divIcon({
    className: 'custom-pin-hospital',
    html: `
      <div class="relative flex items-center justify-center w-8 h-8">
        <div class="w-7 h-7 rounded-full bg-emerald-600 border-2 border-white flex items-center justify-center shadow-lg text-white font-bold text-xs">
          🏥
        </div>
        <span class="absolute -top-1.5 -right-2 bg-emerald-950 border border-emerald-400 text-emerald-300 text-[10px] px-1 py-0.2 rounded-full font-mono font-bold leading-tight">
          ${beds}
        </span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

const createPoliceIcon = (patrols) =>
  L.divIcon({
    className: 'custom-pin-police',
    html: `
      <div class="relative flex items-center justify-center w-8 h-8">
        <div class="w-7 h-7 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center shadow-lg text-white font-bold text-xs">
          🚓
        </div>
        <span class="absolute -top-1.5 -right-2 bg-blue-950 border border-blue-400 text-blue-300 text-[10px] px-1 py-0.2 rounded-full font-mono font-bold leading-tight">
          ${patrols}
        </span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

export default function LiveMap({ incidents = [], latestIncident = null }) {
  const [resources, setResources] = useState({ hospitals: [], police_stations: [] });
  const [selectedSector, setSelectedSector] = useState(GLOBAL_SECTORS[0]);

  // Load registered emergency resources from backend API
  useEffect(() => {
    const loadResources = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/resources/all`);
        if (res.ok) {
          const data = await res.json();
          setResources({
            hospitals: (data.hospitals || []).map((h) => ({
              ...h,
              location_lat: h.location_lat ?? h.latitude,
              location_lon: h.location_lon ?? h.longitude,
            })),
            police_stations: (data.police_stations || []).map((p) => ({
              ...p,
              location_lat: p.location_lat ?? p.latitude,
              location_lon: p.location_lon ?? p.longitude,
            })),
          });
          return;
        }
      } catch (e) {
        // Continue to fallback
      }

      // Default high-availability infrastructure dataset
      setResources({
        hospitals: [
          { id: 101, name: 'Al-Ahli Hospital (المستشفى الأهلي)', location_lat: 31.5435, location_lon: 35.0872, icu_beds_available: 15, blood_units_available: 75, contact_info: '+970-2-222-7777' },
          { id: 102, name: 'Princess Alia Hospital (مستشفى الأميرة عالية)', location_lat: 31.5310, location_lon: 35.1010, icu_beds_available: 6, blood_units_available: 35, contact_info: '+970-2-222-8888' },
          { id: 103, name: 'Tokyo Medical University Hospital', location_lat: 35.6948, location_lon: 139.6910, icu_beds_available: 24, blood_units_available: 120, contact_info: '+81-3-3342-6111' },
          { id: 104, name: 'Hospital Universitario La Paz (Madrid)', location_lat: 40.4816, location_lon: -3.6872, icu_beds_available: 18, blood_units_available: 95, contact_info: '+34-917-27-70-00' },
          { id: 105, name: 'NYU Langone Medical Center (New York)', location_lat: 40.7423, location_lon: -73.9741, icu_beds_available: 30, blood_units_available: 150, contact_info: '+1-212-263-7300' },
          { id: 106, name: 'King Faisal Specialist Hospital (Riyadh)', location_lat: 24.6712, location_lon: 46.6775, icu_beds_available: 20, blood_units_available: 110, contact_info: '+966-11-464-7272' },
        ],
        police_stations: [
          { id: 201, name: 'Industrial Zone Police Post (الخليل)', location_lat: 31.5260, location_lon: 35.0960, patrols_available: 4, security_level: 'High', contact_info: '+970-2-229-8888' },
          { id: 202, name: 'Hebron Central Police Directorate', location_lat: 31.5285, location_lon: 35.0920, patrols_available: 8, security_level: 'Maximum', contact_info: '+970-2-229-9999' },
          { id: 203, name: 'Shinjuku Police Station (Tokyo)', location_lat: 35.6931, location_lon: 139.6932, patrols_available: 12, security_level: 'High', contact_info: '+81-3-3346-0110' },
          { id: 204, name: 'Comisaria Centro Madrid', location_lat: 40.4190, location_lon: -3.7050, patrols_available: 9, security_level: 'High', contact_info: '+34-913-22-34-00' },
          { id: 205, name: 'NYPD Midtown South Precinct', location_lat: 40.7516, location_lon: -73.9877, patrols_available: 14, security_level: 'Maximum', contact_info: '+1-212-239-9811' },
          { id: 206, name: 'Olaya Police Station (Riyadh)', location_lat: 24.7080, location_lon: 46.6820, patrols_available: 7, security_level: 'High', contact_info: '+966-11-465-1111' },
        ],
      });
    };

    loadResources();
  }, []);

  const latestCoords =
    latestIncident?.coordinates?.lat && latestIncident?.coordinates?.lon
      ? [latestIncident.coordinates.lat, latestIncident.coordinates.lon]
      : selectedSector.center;

  // Active Dispatch Routing Vector Lines
  const dispatchLines = useMemo(() => {
    const lines = [];
    incidents.forEach((inc) => {
      const incLat = inc.coordinates?.lat || inc.location?.lat;
      const incLon = inc.coordinates?.lon || inc.location?.lon;
      if (!incLat || !incLon || !inc.dispatches) return;

      inc.dispatches.forEach((d) => {
        const target =
          resources.hospitals.find((h) => h.id === d.institution_id || h.name === d.institution_name) ||
          resources.police_stations.find((p) => p.id === d.institution_id || p.name === d.institution_name);

        if (target && target.location_lat && target.location_lon) {
          lines.push({
            id: `line-${inc.incident_id || 'inc'}-${d.institution_id}`,
            positions: [
              [incLat, incLon],
              [target.location_lat, target.location_lon],
            ],
            color: d.resource_type === 'HOSPITAL' ? '#10b981' : '#3b82f6',
          });
        }
      });
    });
    return lines;
  }, [incidents, resources]);

  return (
    <div className="relative w-full h-full min-h-[350px] bg-slate-900 overflow-hidden font-sans">
      
      {/* Top Sector Selector Ribbon */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-wrap items-center gap-1.5 p-1 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-lg shadow-2xl">
        <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold text-slate-300">
          <Navigation className="w-3.5 h-3.5 text-red-500 animate-pulse" />
          <span className="hidden sm:inline">SECTOR:</span>
        </div>
        {GLOBAL_SECTORS.map((sec) => (
          <button
            key={sec.id}
            onClick={() => setSelectedSector(sec)}
            className={`px-2.5 py-1 rounded text-xs font-mono transition-all flex items-center gap-1.5 ${
              selectedSector.id === sec.id
                ? 'bg-red-600 text-white shadow-md font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>{sec.name}</span>
          </button>
        ))}
      </div>

      {/* Map Legend Overlay */}
      <div className="absolute bottom-4 left-3 z-[1000] flex items-center gap-3 px-3 py-2 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-lg shadow-lg text-[11px] font-mono text-slate-300">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping"></span>
          <span>INCIDENTS ({incidents.length})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span>HOSPITALS ({resources.hospitals.length})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
          <span>POLICE ({resources.police_stations.length})</span>
        </div>
      </div>

      <MapContainer
        center={selectedSector.center}
        zoom={selectedSector.zoom}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        {/* CRITICAL: Standard OpenStreetMap TileLayer (Familiar GPS Style - Zero API Key) */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        {/* Auto-focus to latest incident coordinates */}
        <MapFlyTo position={latestCoords} />

        {/* Dynamic Dispatch Vector Routes */}
        {dispatchLines.map((line) => (
          <Polyline
            key={line.id}
            positions={line.positions}
            pathOptions={{
              color: line.color,
              weight: 3,
              dashArray: '6, 6',
              opacity: 0.9,
            }}
          />
        ))}

        {/* Hospitals */}
        {resources.hospitals.map((hospital) => (
          <Marker
            key={`hosp-${hospital.id}`}
            position={[hospital.location_lat, hospital.location_lon]}
            icon={createHospitalIcon(hospital.icu_beds_available)}
          >
            <Popup>
              <div className="p-1 space-y-1.5 text-xs font-sans">
                <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                  <Building2 className="w-4 h-4" />
                  <span>{hospital.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px] text-slate-300">
                  <div>ICU Beds: <span className="font-bold text-emerald-400">{hospital.icu_beds_available}</span></div>
                  <div>Blood Units: <span className="font-bold text-red-400">{hospital.blood_units_available}</span></div>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">Contact: {hospital.contact_info}</div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Police Stations */}
        {resources.police_stations.map((police) => (
          <Marker
            key={`pol-${police.id}`}
            position={[police.location_lat, police.location_lon]}
            icon={createPoliceIcon(police.patrols_available)}
          >
            <Popup>
              <div className="p-1 space-y-1.5 text-xs font-sans">
                <div className="flex items-center gap-1.5 font-bold text-blue-400">
                  <Shield className="w-4 h-4" />
                  <span>{police.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px] text-slate-300">
                  <div>Patrols Ready: <span className="font-bold text-blue-400">{police.patrols_available}</span></div>
                  <div>Security: <span className="font-bold text-slate-200">{police.security_level}</span></div>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">Contact: {police.contact_info}</div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Incidents with Aggressively Pulsing Beacon Markers */}
        {incidents.map((incident, idx) => {
          const lat = incident.coordinates?.lat || incident.location?.lat;
          const lon = incident.coordinates?.lon || incident.location?.lon;
          if (!lat || !lon) return null;

          return (
            <Marker
              key={`inc-${incident.incident_id || idx}`}
              position={[lat, lon]}
              icon={createIncidentIcon(incident.severity_level || 4)}
            >
              <Popup>
                <div className="p-1 space-y-2 text-xs font-sans">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-1">
                    <span className="font-bold text-red-400 flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5" />
                      INCIDENT #{incident.incident_id || 'EDGE'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-red-600/30 text-red-300">
                      LVL {incident.severity_level || 5}
                    </span>
                  </div>
                  <p className="text-slate-200 font-medium leading-relaxed">
                    {incident.incident_summary}
                  </p>
                  
                  {incident.dispatches && incident.dispatches.length > 0 && (
                    <div className="pt-1.5 border-t border-slate-700">
                      <p className="text-[10px] font-mono text-slate-400 uppercase mb-1">
                        Dispatched Resources ({incident.dispatches.length}):
                      </p>
                      <ul className="space-y-1 text-[11px] font-mono">
                        {incident.dispatches.map((d, dIdx) => (
                          <li key={dIdx} className="text-emerald-400 flex items-center justify-between">
                            <span>• {d.institution_name?.split('(')[0] || 'Unit'}</span>
                            <span className="text-slate-400 font-bold">ETA: {d.eta_minutes}m</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
