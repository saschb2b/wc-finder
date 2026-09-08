import React, { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { createMapDocument } from "../map/document";
import { useMapBridge } from "../map/useMapBridge";
import type { MapCommand, ToiletMapHandle, ToiletMapProps } from "../map/types";
import { t } from "../i18n";
import { mapStrings } from "../map/strings";

export const ToiletMap = forwardRef<ToiletMapHandle, ToiletMapProps>(function ToiletMap(props, ref) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const [html] = useState(() => createMapDocument(props.initialRegion, mapStrings(props.colorScheme)));
  const send = useCallback((command: MapCommand) => iframe.current?.contentWindow?.postMessage(JSON.stringify(command), "*"), []);
  const { receive } = useMapBridge(props, ref, send);
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.source === iframe.current?.contentWindow && typeof event.data === "string") receive(event.data);
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [receive]);

  return <iframe
    ref={iframe}
    title={t("map.title")}
    srcDoc={html}
    onLoad={() => receive('{"type":"ready"}')}
    sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
    referrerPolicy="strict-origin-when-cross-origin"
    style={{ border: 0, width: "100%", height: "100%", flex: 1 }}
  />;
});
