import { useCallback, useImperativeHandle, useRef, useEffect, type Ref } from "react";
import { parseMapEvent, type MapCommand, type ToiletMapHandle, type ToiletMapProps } from "./types";

export function useMapBridge(props: ToiletMapProps, ref: Ref<ToiletMapHandle>, send: (command: MapCommand) => void) {
  const ready = useRef(false);
  const latest = useRef(props);
  const pendingFocus = useRef<MapCommand | null>(null);
  useEffect(() => { latest.current = props; });

  const sendData = useCallback(() => {
    const { pins, userLocation } = latest.current;
    send({ type: "data", data: { pins, userLocation } });
  }, [send]);

  useEffect(() => { if (ready.current) sendData(); }, [props.pins, props.userLocation, sendData]);

  useImperativeHandle(ref, () => ({
    animateToRegion(region, duration = 500) {
      const command: MapCommand = { type: "focus", region, duration };
      if (ready.current) send(command);
      else pendingFocus.current = command;
    },
  }), [send]);

  const receive = useCallback((raw: string) => {
    const event = parseMapEvent(raw);
    if (!event) return;
    if (event.type === "ready") {
      ready.current = true;
      sendData();
      if (pendingFocus.current) { send(pendingFocus.current); pendingFocus.current = null; }
    } else if (event.type === "region") latest.current.onRegionChange(event.region, event.isGesture);
    else if (event.type === "select") latest.current.onSelect(event.id);
    else if (event.type === "deselect") latest.current.onDeselect?.();
    else if (event.type === "navigate") latest.current.onNavigate(event.id);
  }, [send, sendData]);

  return { receive, reset: () => { ready.current = false; } };
}
