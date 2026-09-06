import type { Toilet } from '../types/toilet';
import { tiles } from './tile-index.json';

// Web exports fetch regional JSON instead of embedding the whole directory in JS.
const cache = new Map<string, Promise<Toilet[]>>();

function loadTile(key: string): Promise<Toilet[]> {
  const cached = cache.get(key);
  if (cached) return cached;
  const request = fetch(new URL(`data/tiles/tile_${key}.json`, document.baseURI))
    .then(async response => {
      if (!response.ok) throw new Error(`Tile ${key}: HTTP ${response.status}`);
      return await response.json() as Toilet[];
    })
    .catch(error => {
      cache.delete(key);
      throw error;
    });
  cache.set(key, request);
  return request;
}

export async function loadNearbyTiles(lat: number, lon: number): Promise<Toilet[]> {
  return loadTilesInBounds(Math.floor(lat) - 1, Math.floor(lat) + 1,
    Math.floor(lon) - 1, Math.floor(lon) + 1);
}

export async function loadTilesInBounds(
  latMin: number, latMax: number, lonMin: number, lonMax: number,
): Promise<Toilet[]> {
  const needed = tiles.filter(tile => tile.latMin >= Math.floor(latMin)
    && tile.latMin <= Math.floor(latMax) && tile.lonMin >= Math.floor(lonMin)
    && tile.lonMin <= Math.floor(lonMax));
  return (await Promise.all(needed.map(tile => loadTile(tile.key)))).flat();
}
