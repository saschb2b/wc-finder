import * as L from "leaflet";
import { DEFAULT_MAP_STRINGS, isMapRegion } from "./types";
import type { MapCommand, MapData, MapEvent, MapPin, MapRegion, MapStrings } from "./types";

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void };
    wcMapReceive: (command: MapCommand) => void;
    wcMapInitial: MapRegion;
    wcMapStrings?: MapStrings;
  }
}

const strings: MapStrings = { ...DEFAULT_MAP_STRINGS, ...window.wcMapStrings };

const post = (event: MapEvent) => {
  const message = JSON.stringify(event);
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(message);
  else window.parent.postMessage(message, "*");
};

const map = L.map("map", {
  zoomControl: false,
  minZoom: 5,
  maxZoom: 19,
  maxBounds: [[-85, -180], [85, 180]],
  maxBoundsViscosity: 1,
});
// Pinch and double-tap cover zoom on touch screens; buttons only help pointer devices.
if (!window.matchMedia?.("(pointer: coarse)").matches) {
  L.control.zoom({ position: "bottomleft", zoomInTitle: strings.zoomIn, zoomOutTitle: strings.zoomOut }).addTo(map);
}
map.on("click", () => post({ type: "deselect" }));
map.attributionControl.setPrefix(false);
const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: `&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">${strings.contributors.replace(/</g, "&lt;")}</a>`,
  maxZoom: 19,
  noWrap: true,
  // Request only the visible area when movement ends; never prefetch offline regions.
  updateWhenIdle: true,
  keepBuffer: 0,
}).addTo(map);

const status = document.getElementById("tile-status")!;
const failedTiles = new Set<string>();
tiles.on("tileerror", event => { failedTiles.add(event.tile.src); status.hidden = false; });
tiles.on("tileload", event => { failedTiles.delete(event.tile.src); status.hidden = failedTiles.size === 0; });
window.addEventListener("offline", () => { status.hidden = false; });
window.addEventListener("online", () => { failedTiles.clear(); tiles.redraw(); });

let gesture = false;
const container = map.getContainer();
for (const event of ["pointerdown", "touchstart", "wheel", "keydown"]) {
  container.addEventListener(event, input => {
    // Marker taps and popup actions must not turn an in-flight camera move
    // into a user pan, which would clear the app's explicit selection.
    if (input.target instanceof Element && input.target.closest(".wc-marker, .leaflet-popup, .leaflet-control-attribution")) return;
    if (input instanceof KeyboardEvent && !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "+", "=", "-"].includes(input.key)) return;
    gesture = true;
  }, { passive: true });
}
// A drag that starts over a marker still counts once the map actually moves.
map.on("dragstart boxzoomstart", () => { gesture = true; });
// Capture before Leaflet handles the click, including keyboard activation.
container.addEventListener("click", input => {
  if (input.target instanceof Element && input.target.closest(".leaflet-control-zoom")) gesture = true;
}, { capture: true });
function sendRegion() {
  const center = map.getCenter();
  const bounds = map.getBounds();
  post({ type: "region", isGesture: gesture, region: {
    latitude: center.lat,
    longitude: center.lng,
    latitudeDelta: Math.min(180, bounds.getNorth() - bounds.getSouth()),
    longitudeDelta: Math.min(360, bounds.getEast() - bounds.getWest()),
  } });
  gesture = false;
}
map.on("moveend", sendRegion);

function stopForSelection() {
  // stop() can synchronously emit moveend for the previous animation.
  gesture = false;
  map.stop();
}

let pendingLayoutRegion: MapRegion | null = null;
function focus(region: MapRegion, duration: number) {
  // A web iframe may execute before its first layout. Refit once it has a size.
  pendingLayoutRegion = container.clientWidth && container.clientHeight ? null : region;
  stopForSelection();
  const bounds = L.latLngBounds(
    [region.latitude - region.latitudeDelta / 2, region.longitude - region.longitudeDelta / 2],
    [region.latitude + region.latitudeDelta / 2, region.longitude + region.longitudeDelta / 2],
  );
  map.fitBounds(bounds, { animate: duration > 0, duration: duration / 1000 });
}

const markers = new Map<string, { marker: L.Marker; pin: MapPin }>();
let locationMarker: L.CircleMarker | null = null;

function makeIcon(pin: MapPin) {
  const element = document.createElement("span");
  element.className = "wc-pin" + (pin.selected ? " wc-pin-selected" : "");
  element.style.backgroundColor = pin.color;
  element.textContent = "WC";
  return L.divIcon({ html: element, className: "wc-marker", iconSize: [36, 44], iconAnchor: [18, 42], popupAnchor: [0, -38] });
}

function updateData(data: MapData) {
  const ids = new Set(data.pins.map(pin => pin.id));
  for (const [id, entry] of markers) {
    if (!ids.has(id)) { entry.marker.remove(); markers.delete(id); }
  }
  for (const pin of data.pins) {
    let entry = markers.get(pin.id);
    if (!entry) {
      // Selection is shown by the sheet, not a popup, so the map stays uncluttered.
      const marker = L.marker([pin.lat, pin.lon], { icon: makeIcon(pin), title: pin.name, alt: pin.name, keyboard: true }).addTo(map);
      marker.on("click", () => {
        // Stop before crossing the async WebView bridge so no late movement
        // from the previous selection can override this tap.
        stopForSelection();
        post({ type: "select", id: pin.id });
      });
      entry = { marker, pin };
      markers.set(pin.id, entry);
    } else {
      if (entry.pin.color !== pin.color || entry.pin.selected !== pin.selected) entry.marker.setIcon(makeIcon(pin));
      if (entry.pin.lat !== pin.lat || entry.pin.lon !== pin.lon) entry.marker.setLatLng([pin.lat, pin.lon]);
      entry.pin = pin;
    }
    entry.marker.setOpacity(pin.opacity).setZIndexOffset(pin.selected ? 1000 : 0);
  }
  if (data.userLocation) {
    const latlng: L.LatLngTuple = [data.userLocation.lat, data.userLocation.lon];
    if (!locationMarker) {
      locationMarker = L.circleMarker(latlng, { radius: 8, color: "white", weight: 3, fillColor: "#1a73e8", fillOpacity: 1 })
        .bindTooltip(strings.myLocation).addTo(map);
    } else locationMarker.setLatLng(latlng);
  } else if (locationMarker) {
    locationMarker.remove();
    locationMarker = null;
  }
}

window.wcMapReceive = command => {
  if (command.type === "sync") { post({ type: "ready" }); sendRegion(); }
  else if (command.type === "data") updateData(command.data);
  else if (command.type === "theme") document.documentElement.classList.toggle("dark", command.colorScheme === "dark");
  else if (command.type === "focus" && isMapRegion(command.region)) focus(command.region, command.duration);
};
window.addEventListener("message", event => {
  if (event.source !== window.parent || typeof event.data !== "string") return;
  try { window.wcMapReceive(JSON.parse(event.data)); } catch { /* Ignore other frame messages. */ }
});
new ResizeObserver(() => {
  map.invalidateSize({ pan: false });
  if (pendingLayoutRegion && container.clientWidth && container.clientHeight) {
    focus(pendingLayoutRegion, 0);
  }
}).observe(container);
focus(window.wcMapInitial, 0);
post({ type: "ready" });
