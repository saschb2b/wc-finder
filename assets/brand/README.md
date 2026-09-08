# WC Finder brand assets

The selected identity is a cobalt enamel toilet lid with a large ivory accessibility inlay, fine metal hinges, and a porcelain seat reveal. Preserve the tactile early-iOS character, with one clear emblem and controlled highlights. Primary UI blue is `#1554b7`; dark-mode blue is `#94bcff`.

## Sources and exports

- `icon-master.png`: approved generated production master, with the blue surface extended into opaque square corners. Keep this source unchanged when exporting.
- `app-icon.png`: 256px image used by the React Native `BrandIcon` component, clipped by the UI to match launcher corners.
- `../icon.png`: opaque 1024px launcher artwork; the OS supplies the iOS mask.
- `../adaptive-icon.png`: 1024px transparent Android foreground, with inset artwork. The central accessibility emblem stays within the Android safe circle; decorative outer edges may be masked.
- `../splash-icon.png` and `../splash-icon-dark.png`: identical 1024px artwork with genuinely transparent rounded corners. Backgrounds stay in `app.config.js` and match `src/theme/colors.ts`.
- `../favicon.png`, `../../docs/icon.png`, `../../docs/icon-192.png`, `../../docs/favicon.png`: website and browser exports (48, 512, 192, 48px).

Run `pnpm build:brand` to regenerate exports using the image tooling included with Expo. It only resizes and applies platform masks to the selected artwork; the generated source preserves the visual design. The original screenshot assets remain factual app captures, separate from the brand artwork.

## Generation

Artwork generated using the built-in image generator on 2026-09-08. Concept 1 was selected by the user. The tool has no model-selection argument; the generated master's embedded C2PA metadata identifies gpt-image version 2.0.

A generated background-extraction attempt returned an opaque checkerboard and was rejected. Production transparency is applied as a deterministic rounded launcher mask during export, using the approved opaque master. No checkerboard artwork is used in the app.

### Selected concept prompt

```text
Use case: logo-brand
Asset type: one beautiful final app-icon concept for WC Finder, 1024 x 1024.
Input image: the existing app icon is a reference for the original idea (a blue toilet lid and accessibility), not a geometry or quality constraint. Completely redesign and re-render it at a much higher level of art direction.
Primary request: design a memorable, exceptionally well-crafted old-school iPhone app icon. It should have the tactile charm of a great iOS 6 utility icon, with the restraint and exquisite form of industrial design. This is an accessible toilet finder.
The entire square icon is a luxurious deep cobalt-blue enamel object. Its central motif is a sculpted CLOSED BLUE TOILET LID seen almost directly from above: a confident gently tapering rounded rectangle, not a map pin, not a circular badge. It has one elegantly rolled edge and a very thin warm-ivory seat reveal underneath, which makes its function recognizable. Two tiny satin-nickel hinge details at the top are integrated cleanly, not overdescribed. Rich deep navy contact shadows give believable shallow depth.
The lid is a single pristine plane with beautiful broad softbox reflections. Inlaid in its center is one bold warm-ivory International Symbol of Access wheelchair pictogram, around a third of the lid width, optically centered and perfectly clear. Accurate standard wheelchair symbol with round head, seated torso, bent leg and large open wheel, not a person sitting on a chair.
Composition: one iconic physical object fills the canvas confidently, front-on with a tiny amount of natural perspective; strong simple silhouette, no surrounding scene. Harmonious corners, every curve feels intentional, impeccable material quality. Square full-bleed dark cobalt background. Fine bright edge highlights, generous smooth surfaces, rounded tactile geometry.
Art direction: inviting, confident, polished, sophisticated nostalgic iOS. A collectible little blue ceramic object you want to tap. More beautiful object design, fewer details. Deep ultramarine enamel, porcelain ivory, small nickel hinges. Subtle surface realism without noisy texture.
Avoid: WC text, map pins, generic flat logos, badge-on-gradient template, cheap toy plastic, balloon 3D, rubber, oversize metallic borders, dramatic lens flare, fake app mockup, explanatory captions, watermarks. Output ONLY the finished square icon artwork, no text labels.
```

### Production adaptation prompt

```text
Use case: precise-object-edit
Asset type: final production iOS/Expo app icon, opaque full-bleed square.
Input image: the APPROVED WC Finder brand icon; preserve its design and physical object exactly.
Change ONLY the black background in the four outer corners of the image into matching deep cobalt-blue enamel, extending the existing blue base surface smoothly to all four square image corners and edges. The exported icon must be a completely filled square with NO black corner patches, NO transparency and NO empty surround. The phone OS applies its own rounded mask later.
Preserve the blue toilet lid, existing large warm ivory wheelchair pictogram, its exact shape and position, ivory seat reveal, hinges, rolled edges, shading, lighting, proportions, and level of detail. Do not redesign, change colors, add anything, or zoom/crop the artwork. Maintain the approved centered composition.
Output one 1024 x 1024 square PNG of the finished icon artwork, no mockup or captions.
```
