export interface Toilet {
  id: string;
  lat: number;
  lon: number;
  name: string;
  city?: string;
  tags?: string[];
  distance?: number; // in meters, calculated client-side
}
