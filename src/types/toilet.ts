export type ToiletCategory = 'public_24h' | 'station' | 'gastro' | 'other';

export interface Toilet {
  id: string;
  lat: number;
  lon: number;
  name: string;
  city?: string;
  category: ToiletCategory;
  tags?: string[];
  opening_hours?: string;
  operator?: string;
  fee?: string;
  distance?: number;
}

export const CATEGORY_LABELS: Record<ToiletCategory, string> = {
  public_24h: '24/7 Öffentlich',
  station: 'Bahnhof',
  gastro: 'Gastronomie',
  other: 'Sonstige',
};

export const CATEGORY_COLORS: Record<ToiletCategory, string> = {
  public_24h: '#34a853',
  station: '#f5a623',
  gastro: '#999',
  other: '#999',
};
