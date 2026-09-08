import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM, VirtualConsole } from "jsdom";
import { createMapDocument, mapCommandScript, serializeForScript } from "./document";
import { parseMapEvent, type MapEvent, type MapPin } from "./types";

const region = { latitude: 52.3759, longitude: 9.732, latitudeDelta: 0.04, longitudeDelta: 0.04 };
const pin: MapPin = { id: "test", name: "Hannover WC", lat: region.latitude, lon: region.longitude, color: "#1a73e8", opacity: 1, selected: false };

function openMap(initiallyHidden = false) {
  let hidden = initiallyHidden;
  let resize = () => {};
  const events: MapEvent[] = [];
  const errors: Error[] = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", error => errors.push(error));
  const dom = new JSDOM(createMapDocument(region), {
    runScripts: "dangerously", pretendToBeVisual: true, url: "https://saschb2b.github.io/wc-finder/", virtualConsole,
    // No external resources are loaded: this tests the actual embedded Leaflet code offline.
    beforeParse(window) {
      Object.defineProperties(window.HTMLElement.prototype, {
        clientWidth: { get: () => hidden ? 0 : 390 }, clientHeight: { get: () => hidden ? 0 : 600 },
      });
      Object.defineProperty(window.SVGSVGElement.prototype, "createSVGRect", { value: () => ({}) });
      window.ResizeObserver = class {
        constructor(callback: () => void) { resize = callback; }
        observe() {} unobserve() {} disconnect() {}
      };
      window.ReactNativeWebView = { postMessage: (raw: string) => {
        const event = parseMapEvent(raw);
        if (event) events.push(event);
      } };
    },
  });
  assert.deepEqual(errors, []);
  return { dom, events, errors, document: dom.window.document, show: () => { hidden = false; resize(); } };
}

test("map fits its initial region after an iframe receives its first layout", () => {
  const { dom, events, show } = openMap(true);
  try {
    show();
    const last = events.filter(event => event.type === "region").at(-1)!;
    assert.ok(last.region.latitudeDelta < 0.2);
    assert.ok(Math.abs(last.region.latitude - region.latitude) < 0.001);
    assert.equal(last.isGesture, false);
  } finally { dom.window.close(); }
});

test("map starts offline with attribution and requests only key-free HTTPS tiles", () => {
  const { dom, document, events } = openMap();
  try {
    assert.ok(events.some(event => event.type === "ready"));
    assert.ok(events.some(event => event.type === "region" && !event.isGesture));
    assert.equal(document.querySelector('.leaflet-control-attribution a')?.getAttribute("href"), "https://www.openstreetmap.org/copyright");
    const tiles = [...document.querySelectorAll<HTMLImageElement>(".leaflet-tile")];
    assert.ok(tiles.length > 0);
    for (const tile of tiles) assert.match(tile.src, /^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/);
    assert.equal(document.querySelectorAll("script[src]").length, 0);
  } finally { dom.window.close(); }
});

test("pins update without remounting, preserve text safely, and send select/navigation events", () => {
  const { dom, document, events, errors } = openMap();
  try {
    const unsafeName = '<img src=x onerror="window.injected=true">';
    const data = { pins: [{ ...pin, name: unsafeName }], userLocation: { lat: 52.37, lon: 9.73 } };
    dom.window.eval(mapCommandScript({ type: "data", data }));
    const marker = document.querySelector<HTMLElement>(".wc-marker")!;
    assert.ok(marker);
    marker.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    assert.deepEqual(events.at(-1), { type: "select", id: pin.id });
    // No popup: the selection is shown in the sheet, and untrusted names never become markup.
    assert.equal(document.querySelector(".leaflet-popup"), null);
    assert.equal(document.querySelector('img[src="x"]'), null);
    assert.equal(marker.getAttribute("title"), unsafeName);
    dom.window.eval(mapCommandScript({ type: "data", data }));
    assert.equal(document.querySelector(".wc-marker"), marker);
    dom.window.eval(mapCommandScript({ type: "data", data: { ...data, pins: [{ ...data.pins[0], selected: true }] } }));
    assert.ok(document.querySelector(".wc-pin-selected"));
    document.getElementById("map")!.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    assert.deepEqual(events.at(-1), { type: "deselect" });
    dom.window.eval(mapCommandScript({ type: "data", data: { ...data, pins: [] } }));
    assert.equal(document.querySelectorAll(".wc-marker").length, 0);
    assert.equal(document.querySelectorAll(".leaflet-overlay-pane path").length, 1);
    assert.deepEqual(errors, []);
  } finally { dom.window.close(); }
});

test("programmatic focus and user zoom are distinguished; tile failure leaves pins usable", () => {
  const { dom, document, events } = openMap();
  try {
    dom.window.eval(mapCommandScript({ type: "data", data: { pins: [pin], userLocation: null } }));
    dom.window.eval(mapCommandScript({ type: "focus", region: { ...region, latitude: 52.4 }, duration: 0 }));
    const focused = events.filter(event => event.type === "region").at(-1)!;
    assert.equal(focused.isGesture, false);
    assert.ok(Math.abs(focused.region.latitude - 52.4) < 0.001);
    const zoom = document.querySelector<HTMLElement>(".leaflet-control-zoom-in")!;
    zoom.dispatchEvent(new dom.window.Event("pointerdown", { bubbles: true }));
    zoom.click();
    assert.equal(events.filter(event => event.type === "region").at(-1)?.isGesture, true);
    // Zoom controls also work without a preceding pointer event (keyboard).
    document.querySelector<HTMLElement>(".leaflet-control-zoom-out")!.click();
    assert.equal(events.filter(event => event.type === "region").at(-1)?.isGesture, true);
    const tile = document.querySelector<HTMLImageElement>(".leaflet-tile")!;
    tile.dispatchEvent(new dom.window.Event("error"));
    assert.equal(document.getElementById("tile-status")!.hidden, false);
    assert.equal(document.querySelectorAll(".wc-marker").length, 1);
    tile.dispatchEvent(new dom.window.Event("load"));
    assert.equal(document.getElementById("tile-status")!.hidden, true);
    // Appearance follows the app without reloading the document.
    dom.window.eval(mapCommandScript({ type: "theme", colorScheme: "dark" }));
    assert.equal(document.documentElement.classList.contains("dark"), true);
    dom.window.eval(mapCommandScript({ type: "theme", colorScheme: "light" }));
    assert.equal(document.documentElement.classList.contains("dark"), false);
  } finally { dom.window.close(); }
});

test("bridge rejects malformed events and safely serializes script delimiters", () => {
  for (const raw of ["broken", "null", '{"type":"navigate","id":1}', '{"type":"region","region":{}}']) {
    assert.equal(parseMapEvent(raw), null);
  }
  assert.equal(parseMapEvent(JSON.stringify({ type: "region", region: { ...region, latitude: 999 }, isGesture: true })), null);
  const value = '</script><script>alert(1)</script>\u2028\u2029';
  const encoded = serializeForScript(value);
  assert.ok(!encoded.includes("<"));
  assert.equal(JSON.parse(encoded), value);
});

test("tapping a pin during camera movement keeps the tapped selection", async () => {
  const { dom, document, events } = openMap();
  try {
    const otherPin = { ...pin, id: "other", name: "Other WC", lat: pin.lat + 0.001 };
    dom.window.eval(mapCommandScript({ type: "data", data: { pins: [pin, otherPin], userLocation: null } }));
    // Start a same-zoom animated pan, then tap before it finishes. The app
    // clears its selection whenever it receives a region marked as a gesture.
    dom.window.eval(mapCommandScript({ type: "focus", region: { ...region, latitude: pin.lat + 0.002 }, duration: 100 }));
    const marker = document.querySelector<HTMLElement>('[title="Other WC"]')!;
    marker.dispatchEvent(new dom.window.Event("pointerdown", { bubbles: true }));
    marker.dispatchEvent(new dom.window.Event("touchstart", { bubbles: true }));
    marker.click();
    const selectedIndex = events.findLastIndex(event => event.type === "select");
    assert.deepEqual(events[selectedIndex], { type: "select", id: otherPin.id });
    // Include the bridge delay and any late animation completion.
    await new Promise(resolve => setTimeout(resolve, 180));
    dom.window.eval(mapCommandScript({ type: "data", data: {
      pins: [pin, { ...otherPin, selected: true }], userLocation: null,
    } }));
    assert.equal(events.slice(selectedIndex + 1).some(event => event.type === "region" && event.isGesture), false);
    assert.ok(document.querySelector('[title="Other WC"] .wc-pin-selected'));
  } finally { dom.window.close(); }
});

test("a second pin tap can interrupt focus without triggering automatic selection", () => {
  const { dom, document, events } = openMap();
  try {
    dom.window.eval(mapCommandScript({ type: "data", data: { pins: [pin], userLocation: null } }));
    dom.window.eval(mapCommandScript({ type: "focus", region: { ...region, latitude: pin.lat + 0.002 }, duration: 500 }));
    const marker = document.querySelector<HTMLElement>(".wc-marker")!;
    marker.dispatchEvent(new dom.window.Event("pointerdown", { bubbles: true }));
    marker.click();
    const selectedIndex = events.findLastIndex(event => event.type === "select");
    dom.window.eval(mapCommandScript({ type: "focus", region, duration: 0 }));
    assert.equal(events.slice(selectedIndex + 1).some(event => event.type === "region" && event.isGesture), false);
    assert.ok(events.slice(selectedIndex + 1).some(event => event.type === "region"));
  } finally { dom.window.close(); }
});
