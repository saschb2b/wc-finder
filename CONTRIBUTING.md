# Contributing to WC Finder

Thank you for helping make WC Finder better! This guide explains how to contribute toilet data.

## 🚀 Quick Ways to Contribute

### 1. Report from the App (Easiest)
Tap **"+ Melden"** in the app → Select report type → Fill details → Submit

### 2. Open a GitHub Issue
Go to [Issues](https://github.com/saschb2b/wc-finder/issues) → Click "New Issue" → Choose a template

### 3. Add Directly to OpenStreetMap
WC Finder syncs from OSM. Add toilets at [openstreetmap.org](https://www.openstreetmap.org):
- Tag: `amenity=toilets`
- Tag: `wheelchair=yes` (or `limited`)
- Optional: `eurokey=yes`, `opening_hours=24/7`

---

## 📋 Report Types

| Type | Use When | What Happens |
|------|----------|--------------|
| **New Toilet** | You found a toilet we don't have | Added to review queue, merged weekly |
| **Data Correction** | Info is wrong (hours, location, etc.) | Updated in next data refresh |
| **Closed** | Toilet no longer exists | Removed from dataset |
| **Missing in Area** | You searched and found nothing | Flagged for data enrichment |

---

## 🔄 How It Works

```
User Report → GitHub Issue → Review Queue → Verification → Merge → App Update
```

### Timeline
- **Immediate**: Issue created, confirmation comment posted
- **Within 7 days**: Maintainer reviews and validates
- **Weekly (Sundays)**: Approved changes merged and tiles regenerated
- **Next release**: New APK published with updated data

---

## 🗺️ Data Sources Priority

When merging, we prioritize (highest first):

1. **Curated city data** (Hannover, Dortmund official open data)
2. **Community reports** (verified manual additions)
3. **OpenStreetMap** (fresh weekly sync)
4. **Fuel stations** (OSM amenity=fuel)
5. **Legacy sources** (toilettenhero.de)

---

## ✅ Verification Criteria

Before a report is approved, we check:

- [ ] **Location exists**: Google Maps Street View or personal visit
- [ ] **Wheelchair accessible**: Has grab bars, wide door, accessible sink
- [ ] **Not a duplicate**: Within 50m of existing entry
- [ ] **Publicly accessible**: Not private/residential only
- [ ] **Reasonable name**: Clear what/where it is

---

## 🛠️ For Developers

### Adding Data Programmatically

```bash
# 1. Add to manual-curated.json
# 2. Regenerate tiles
npx tsx scripts/merge-sources.ts
npx tsx scripts/split-tiles.ts
npx tsx scripts/gen-tile-loader.ts

# 3. Test locally
pnpm start

# 4. Submit PR
git add -A
git commit -m "data: Add 5 new toilets in Hamburg"
git push origin main
```

### Automated Weekly Update

The `update-data.yml` workflow runs every Sunday:
1. Fetches fresh OSM data
2. Fetches fuel stations
3. Merges all sources
4. Creates PR for review
5. Merges if tests pass

---

## 📊 Current Data Stats

| Source | Toilets | Last Updated |
|--------|---------|--------------|
| OSM (basic) | ~16,000 | Weekly |
| Fuel stations | ~11,000 | Weekly |
| Manual curation | ~100 | On change |
| City data (HAN/DO) | ~200 | On change |
| **Total** | **~11,300** | — |

---

## 🏆 Recognition

Contributors are recognized in:
- Release notes
- GitHub contributor graph
- App "About" section (coming soon)

---

## ❓ Questions?

- **Discord**: [Join our server](https://discord.gg/invite-link-here)
- **Email**: sascha@example.com
- **GitHub Discussions**: [Start a discussion](https://github.com/saschb2b/wc-finder/discussions)

---

Thank you for helping wheelchair users find accessible toilets! ♿🚽
