import * as L from "leaflet";
import { isMapRegion } from "./types";
import type { MapCommand, MapData, MapEvent, MapPin, MapRegion } from "./types";

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void };
    wcMapReceive: (command: MapCommand) => void;
    wcMapInitial: MapRegion;
  }
}

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
L.control.zoom({ position: "bottomleft", zoomInTitle: "Vergrößern", zoomOutTitle: "Verkleinern" }).addTo(map);
map.attributionControl.setPrefix(false);
const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap-Mitwirkende</a>',
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
  container.addEventListener(event, () => { gesture = true; }, { passive: true });
}
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

function focus(region: MapRegion, duration: number) {
  map.stop();
  gesture = false;
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

function popup(pin: MapPin) {
  const content = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = pin.name || "Öffentliche Toilette";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "route-button";
  button.textContent = "Route starten";
  button.addEventListener("click", () => post({ type: "navigate", id: pin.id }));
  content.append(title, button);
  return content;
}

function updateData(data: MapData) {
  const ids = new Set(data.pins.map(pin => pin.id));
  for (const [id, entry] of markers) {
    if (!ids.has(id)) { entry.marker.remove(); markers.delete(id); }
  }
  for (const pin of data.pins) {
    let entry = markers.get(pin.id);
    if (!entry) {
      const marker = L.marker([pin.lat, pin.lon], { icon: makeIcon(pin), title: pin.name, alt: pin.name, keyboard: true })
        .bindPopup(popup(pin), { autoPan: false, maxWidth: 240 })
        .addTo(map);
      marker.on("click", () => post({ type: "select", id: pin.id }));
      entry = { marker, pin };
      markers.set(pin.id, entry);
    } else {
      if (entry.pin.color !== pin.color || entry.pin.selected !== pin.selected) entry.marker.setIcon(makeIcon(pin));
      if (entry.pin.lat !== pin.lat || entry.pin.lon !== pin.lon) entry.marker.setLatLng([pin.lat, pin.lon]);
      if (entry.pin.name !== pin.name) entry.marker.setPopupContent(popup(pin));
      entry.pin = pin;
    }
    entry.marker.setOpacity(pin.opacity).setZIndexOffset(pin.selected ? 1000 : 0);
    if (pin.selected) entry.marker.openPopup();
    else entry.marker.closePopup();
  }
  if (data.userLocation) {
    const latlng: L.LatLngTuple = [data.userLocation.lat, data.userLocation.lon];
    if (!locationMarker) {
      locationMarker = L.circleMarker(latlng, { radius: 8, color: "white", weight: 3, fillColor: "#1a73e8", fillOpacity: 1 })
        .bindTooltip("Mein Standort").addTo(map);
    } else locationMarker.setLatLng(latlng);
  } else if (locationMarker) {
    locationMarker.remove();
    locationMarker = null;
  }
}

window.wcMapReceive = command => {
  if (command.type === "sync") { post({ type: "ready" }); sendRegion(); }
  else if (command.type === "data") updateData(command.data);
  else if (command.type === "focus" && isMapRegion(command.region)) focus(command.region, command.duration);
};
window.addEventListener("message", event => {
  if (event.source !== window.parent || typeof event.data !== "string") return;
  try { window.wcMapReceive(JSON.parse(event.data)); } catch { /* Ignore other frame messages. */ }
});
new ResizeObserver(() => map.invalidateSize({ pan: false })).observe(container);
focus(window.wcMapInitial, 0);
post({ type: "ready" });
