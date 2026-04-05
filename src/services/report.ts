import { Linking } from 'react-native';
import { Toilet } from '../types/toilet';

const REPO = 'saschb2b/wc-finder';
const ISSUE_URL = `https://github.com/${REPO}/issues/new`;

type ReportType = 'wrong' | 'closed' | 'new' | 'info';

const LABELS: Record<ReportType, string> = {
  wrong: 'Falsche Daten',
  closed: 'Toilette existiert nicht mehr',
  new: 'Neue Toilette melden',
  info: 'Zusätzliche Info',
};

const TEMPLATES: Record<ReportType, (toilet?: Toilet) => { title: string; body: string }> = {
  wrong: (t) => ({
    title: `[Korrektur] ${t?.name || 'Toilette'} – ${t?.city || 'Unbekannt'}`,
    body: buildBody(t, [
      '## Was stimmt nicht?',
      '<!-- z.B. falsche Position, falsche Öffnungszeiten, nicht barrierefrei -->',
      '',
      '',
    ]),
  }),
  closed: (t) => ({
    title: `[Geschlossen] ${t?.name || 'Toilette'} – ${t?.city || 'Unbekannt'}`,
    body: buildBody(t, [
      '## Diese Toilette existiert nicht mehr',
      '<!-- Optional: seit wann, was ist dort jetzt? -->',
      '',
      '',
    ]),
  }),
  new: () => ({
    title: '[Neu] Neue barrierefreie Toilette',
    body: [
      '## Neue Toilette melden',
      '',
      '**Ort (Adresse oder Beschreibung):**',
      '',
      '',
      '**Stadt:**',
      '',
      '',
      '**Euroschlüssel nötig?** Ja / Nein',
      '',
      '**24/7 zugänglich?** Ja / Nein',
      '',
      '**Kostenlos?** Ja / Nein',
      '',
      '**Sonstige Hinweise:**',
      '',
      '',
    ].join('\n'),
  }),
  info: (t) => ({
    title: `[Info] ${t?.name || 'Toilette'} – ${t?.city || 'Unbekannt'}`,
    body: buildBody(t, [
      '## Zusätzliche Information',
      '<!-- z.B. Öffnungszeiten, Zustand, Hinweis zum Finden -->',
      '',
      '',
    ]),
  }),
};

function buildBody(t: Toilet | undefined, extra: string[]): string {
  if (!t) return extra.join('\n');

  const lines = [
    '## Toilette',
    `- **Name:** ${t.name}`,
    `- **Stadt:** ${t.city || '–'}`,
    `- **Kategorie:** ${t.category}`,
    `- **Koordinaten:** ${t.lat}, ${t.lon}`,
    `- **ID:** ${t.id}`,
    t.opening_hours ? `- **Öffnungszeiten:** ${t.opening_hours}` : '',
    t.operator ? `- **Betreiber:** ${t.operator}` : '',
    '',
    ...extra,
  ];

  return lines.filter((l) => l !== '').join('\n');
}

export function openReport(type: ReportType, toilet?: Toilet) {
  const { title, body } = TEMPLATES[type](toilet);
  const label = LABELS[type];

  const params = new URLSearchParams({
    title,
    body,
    labels: label,
  });

  Linking.openURL(`${ISSUE_URL}?${params.toString()}`);
}
