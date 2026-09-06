import { leafletCss, leafletScript } from "./leaflet-assets.generated";
import type { MapCommand, MapRegion } from "./types";

export const MAP_BASE_URL = "https://saschb2b.github.io/wc-finder/";
export const MAP_USER_AGENT = `WC-Finder/1.0 (+${MAP_BASE_URL})`;

export function serializeForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

export function mapCommandScript(command: MapCommand): string {
  return `if (window.wcMapReceive) window.wcMapReceive(${serializeForScript(command)}); true;`;
}

export function createMapDocument(region: MapRegion): string {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<meta name="referrer" content="strict-origin-when-cross-origin">
<style>${leafletCss}
html,body,#map{height:100%;width:100%;margin:0}body{font-family:system-ui,sans-serif}
#map{background:#e9eee7}.leaflet-control-attribution{font-size:11px!important}
.wc-marker{background:none;border:0}.wc-pin{display:flex;align-items:center;justify-content:center;width:32px;height:32px;border:2px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px #0005;color:transparent;font-weight:800}
.wc-pin:after{content:'WC';color:white;transform:rotate(45deg);position:absolute;font-size:11px}
.wc-pin-selected{outline:3px solid #1a73e8;outline-offset:3px}
.route-button{display:block;margin-top:10px;width:100%;border:0;border-radius:8px;padding:10px 14px;background:#1a73e8;color:white;font-weight:600;font-size:14px;cursor:pointer}
.leaflet-popup-content{font-size:14px;line-height:1.4}.leaflet-control-zoom a{width:38px!important;height:38px!important;line-height:38px!important}
#tile-status{position:absolute;top:60px;left:12px;right:12px;z-index:1000;padding:10px;border-radius:8px;background:#fff3cd;color:#594500;font-size:13px;box-shadow:0 1px 5px #0002;pointer-events:none}
</style></head><body><div id="map" aria-label="Karte mit öffentlichen Toiletten"></div>
<div id="tile-status" role="status" hidden>Kartenhintergrund nicht verfügbar. Toiletten und Liste bleiben nutzbar.</div>
<script>window.wcMapInitial=${serializeForScript(region)};</script>
<script>${leafletScript.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
}
