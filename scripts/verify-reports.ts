/**
 * Data verification helper for community reports
 * Helps moderators validate and merge community contributions
 *
 * Usage: npx tsx scripts/verify-reports.ts [issue-number]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface Report {
  issue_number: number;
  title: string;
  body: string;
  created_at: string;
  url: string;
}

interface ToiletEntry {
  id: string;
  lat: number;
  lon: number;
  name: string;
  city: string;
  category: 'public_24h' | 'station' | 'gastro' | 'other';
  tags: string[];
  opening_hours?: string;
  operator?: string;
  fee?: string;
}

function parseNewToiletReport(body: string): Partial<ToiletEntry> | null {
  const lines = body.split('\n');
  const data: Partial<ToiletEntry> = {
    tags: [],
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes('Location Name')) {
      data.name = lines[i + 2]?.replace(/^\s*[-*]\s*/, '').trim();
    }
    if (line.includes('Coordinates')) {
      const coordMatch = line.match(/(\d+\.\d+)[,\s]+(\d+\.\d+)/);
      if (coordMatch) {
        data.lat = parseFloat(coordMatch[1]);
        data.lon = parseFloat(coordMatch[2]);
      }
    }
    if (line.includes('Category')) {
      const cat = lines[i + 2]?.toLowerCase() || '';
      if (cat.includes('24/7')) data.category = 'public_24h';
      else if (cat.includes('station') || cat.includes('rest stop')) data.category = 'station';
      else if (cat.includes('restaurant') || cat.includes('cafe') || cat.includes('food')) data.category = 'gastro';
      else data.category = 'other';
    }
    if (line.includes('Opening Hours')) {
      data.opening_hours = lines[i + 2]?.replace(/^\s*[-*]\s*/, '').trim();
    }
    if (line.includes('Eurokey')) {
      data.tags?.push('eurokey');
    }
    if (line.includes('Wheelchair accessible')) {
      data.tags?.push('barrierefrei');
    }
    if (line.includes('Free')) {
      data.fee = 'no';
    }
  }

  if (!data.name || !data.lat || !data.lon) {
    return null;
  }

  return data;
}

function generateId(name: string, lat: number, lon: number): string {
  const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20);
  return `community_${cleanName}_${Math.floor(lat * 100)}_${Math.floor(lon * 100)}`;
}

function main() {
  const queueDir = path.join(__dirname, '..', '.github', 'data-queue');

  if (!fs.existsSync(queueDir)) {
    console.log('No reports in queue.');
    return;
  }

  const files = fs.readdirSync(queueDir).filter(f => f.endsWith('.json'));

  if (files.length === 0) {
    console.log('No reports in queue.');
    return;
  }

  console.log(`Found ${files.length} reports in queue:\n`);

  for (const file of files) {
    const report: Report = JSON.parse(fs.readFileSync(path.join(queueDir, file), 'utf-8'));

    console.log(`Issue #${report.issue_number}: ${report.title}`);
    console.log(`URL: ${report.url}`);
    console.log(`Created: ${report.created_at}`);

    const toilet = parseNewToiletReport(report.body);
    if (toilet) {
      console.log('\n📍 Parsed data:');
      console.log(`  Name: ${toilet.name}`);
      console.log(`  Lat: ${toilet.lat}`);
      console.log(`  Lon: ${toilet.lon}`);
      console.log(`  Category: ${toilet.category}`);
      console.log(`  Tags: ${toilet.tags?.join(', ') || 'none'}`);
      console.log(`  Hours: ${toilet.opening_hours || 'unknown'}`);
      console.log(`\n  Proposed ID: ${generateId(toilet.name!, toilet.lat!, toilet.lon!)}`);

      // Check for duplicates
      const dataDir = path.join(__dirname, '..', 'src', 'data');
      const mainData = JSON.parse(fs.readFileSync(path.join(dataDir, 'toilets.json'), 'utf-8'));

      const nearby = mainData.toilets.filter((t: any) => {
        const dLat = Math.abs(t.lat - toilet.lat!);
        const dLon = Math.abs(t.lon - toilet.lon!);
        return dLat < 0.001 && dLon < 0.001; // ~100m
      });

      if (nearby.length > 0) {
        console.log(`\n⚠️  WARNING: ${nearby.length} existing toilet(s) within 100m!`);
        nearby.forEach((t: any) => console.log(`     - ${t.name} (${t.id})`));
      }

      console.log(`\n✅ To approve, add this entry to manual-curated.json`);
    } else {
      console.log('\n❌ Could not parse report data');
    }

    console.log('\n---\n');
  }
}

main();
