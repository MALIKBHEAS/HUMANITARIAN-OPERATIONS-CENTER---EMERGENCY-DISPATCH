/**
 * EOA Global - Sovereign Satellite Layer Provider
 * Enforces strict commercial licensing per ADR-0002:
 * 1. Default: Commercial provider slot (MapTiler Satellite first, or enterprise tile feed via VITE_COMMERCIAL_SATELLITE_URL)
 * 2. Remote EOX: Strictly gated behind VITE_DEV_ONLY_REMOTE_EOX=true (prohibited in production)
 */

export const SATELLITE_PROVIDERS = {
  COMMERCIAL: 'commercial',
  DEV_EOX: 'dev_eox',
}

export const getSatelliteConfig = () => {
  const isProd = import.meta.env.MODE === 'production'
  const allowRemoteEox = import.meta.env.VITE_DEV_ONLY_REMOTE_EOX === 'true' && !isProd
  const commercialUrl = import.meta.env.VITE_COMMERCIAL_SATELLITE_URL

  // 1. Commercial Provider (Production Default)
  if (commercialUrl) {
    return {
      id: SATELLITE_PROVIDERS.COMMERCIAL,
      name: 'Commercial Satellite (Licensed)',
      tiles: [commercialUrl],
      maxZoom: 20,
      tileSize: 256,
      attribution: 'Commercial Satellite Feed | EOA Mission Control',
      isAvailable: true,
      noticeKey: 'satellite.commercial_active',
    }
  }

  // 2. Dev-Only Remote EOX (Non-commercial testing only per ADR-0002)
  if (allowRemoteEox) {
    return {
      id: SATELLITE_PROVIDERS.DEV_EOX,
      name: 'Sentinel-2 Cloudless (DEV ONLY)',
      tiles: [
        'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{x}/{y}.jpg',
      ],
      maxZoom: 16,
      tileSize: 256,
      attribution:
        'EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data)',
      isAvailable: true,
      noticeKey: 'satellite.dev_eox_notice',
    }
  }

  // Production fallback when no commercial license URL is provided
  return {
    id: 'unconfigured',
    name: 'Satellite Feed Unconfigured',
    tiles: [],
    maxZoom: 18,
    tileSize: 256,
    attribution: 'EOA Mission Control',
    isAvailable: false,
    noticeKey: 'satellite.unconfigured_notice',
  }
}
