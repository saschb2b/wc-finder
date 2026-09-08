/**
 * Community reporting service
 * Creates structured GitHub issues for toilet data contributions
 */
import type { Toilet } from "../types/toilet";
import { lastCheckedLabel } from "../utils/data-freshness";

export type ReportType = "confirm" | "wrong" | "closed" | "info" | "new" | "missing";

interface ReportData {
  type: ReportType;
  toilet?: {
    id: string;
    name: string;
    lat: number;
    lon: number;
    city?: string;
  };
  details: string;
  /** What the app currently shows as the entry's last check, for the moderator. */
  lastChecked?: string;
  userName?: string;
  userEmail?: string;
}

const REPORT_TEMPLATES: Record<ReportType, { title: string; label: string }> = {
  confirm: {
    title: "✅ Confirmed On Site",
    label: "verified",
  },
  wrong: {
    title: "📝 Data Correction",
    label: "data-correction",
  },
  closed: {
    title: "🚫 Permanently Closed",
    label: "closed-toilet",
  },
  info: {
    title: "💡 Information Addition",
    label: "enhancement",
  },
  new: {
    title: "📍 New Toilet Location",
    label: "new-toilet",
  },
  missing: {
    title: "🔍 Missing in Area",
    label: "data-gap",
  },
};

/**
 * Generate a GitHub issue URL for reporting
 */
export function generateReportUrl(data: ReportData): string {
  const template = REPORT_TEMPLATES[data.type];
  const repo = "saschb2b/wc-finder";

  let body = `## ${template.title}\n\n`;

  if (data.toilet) {
    body += `### Existing Toilet\n`;
    body += `- **Name:** ${data.toilet.name}\n`;
    body += `- **ID:** ${data.toilet.id}\n`;
    body += `- **Coordinates:** ${data.toilet.lat}, ${data.toilet.lon}\n`;
    if (data.toilet.city) {
      body += `- **City:** ${data.toilet.city}\n`;
    }
    body += `- **Google Maps:** https://www.google.com/maps?q=${data.toilet.lat},${data.toilet.lon}\n`;
    if (data.lastChecked) body += `- **Data last checked:** ${data.lastChecked}\n`;
    body += "\n";
  }

  body += `### Details\n${data.details || "No details provided"}\n\n`;

  if (data.userName || data.userEmail) {
    body += `### Reporter\n`;
    if (data.userName) body += `- **Name:** ${data.userName}\n`;
    if (data.userEmail) body += `- **Email:** ${data.userEmail}\n`;
    body += "\n";
  }

  body += `---\n*This issue was created via the WC Finder app*\n`;

  const params = new URLSearchParams({
    title: `${template.title}: ${data.toilet?.name || "New Report"}`,
    body: body,
    labels: template.label,
  });

  return `https://github.com/${repo}/issues/new?${params.toString()}`;
}

/**
 * Open report in browser or GitHub app
 */
export function openReport(type: ReportType, toilet?: Toilet, details?: string) {
  const url = generateReportUrl({
    type,
    lastChecked: toilet ? lastCheckedLabel(toilet) : undefined,
    toilet: toilet
      ? {
          id: toilet.id,
          name: toilet.name,
          lat: toilet.lat,
          lon: toilet.lon,
          city: toilet.city,
        }
      : undefined,
    details: details || (type === "confirm" && toilet
      ? `Reporter was on site and confirms the entry is correct. Set verifiedAt: ${new Date().toISOString().slice(0, 10)} on ${toilet.id}.`
      : ""),
  });

  window.open(url, "_blank");
}

/**
 * Submit report via GitHub API (for authenticated users)
 * This would require a GitHub token
 */
export async function submitReportViaApi(
  token: string,
  data: ReportData,
): Promise<string | null> {
  const template = REPORT_TEMPLATES[data.type];
  const repo = "saschb2b/wc-finder";

  let body = `## ${template.title}\n\n`;

  if (data.toilet) {
    body += `### Existing Toilet\n`;
    body += `- **Name:** ${data.toilet.name}\n`;
    body += `- **ID:** ${data.toilet.id}\n`;
    body += `- **Coordinates:** ${data.toilet.lat}, ${data.toilet.lon}\n\n`;
  }

  body += `### Details\n${data.details}\n\n`;
  body += `---\n*Submitted via WC Finder API*\n`;

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: `${template.title}: ${data.toilet?.name || "New Report"}`,
        body,
        labels: [template.label],
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const result = await res.json();
    return result.html_url;
  } catch (err) {
    console.error("Failed to submit report:", err);
    return null;
  }
}
