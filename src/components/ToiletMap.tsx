import React, { forwardRef, useCallback, useRef, useState } from "react";
import { Linking, StyleSheet, Text, View, Pressable } from "react-native";
import { WebView } from "react-native-webview";
import { createMapDocument, MAP_BASE_URL, MAP_USER_AGENT, mapCommandScript } from "../map/document";
import { useMapBridge } from "../map/useMapBridge";
import type { MapCommand, ToiletMapHandle, ToiletMapProps } from "../map/types";
import { t } from "../i18n";
import { mapStrings } from "../map/strings";

export const ToiletMap = forwardRef<ToiletMapHandle, ToiletMapProps>(function ToiletMap(props, ref) {
  const webView = useRef<WebView>(null);
  const [source] = useState(() => ({ html: createMapDocument(props.initialRegion, mapStrings()), baseUrl: MAP_BASE_URL }));
  const send = useCallback((command: MapCommand) => webView.current?.injectJavaScript(mapCommandScript(command)), []);
  const { receive, reset } = useMapBridge(props, ref, send);

  return <WebView
    ref={webView}
    source={source}
    style={styles.map}
    originWhitelist={["*"]}
    applicationNameForUserAgent={MAP_USER_AGENT}
    cacheEnabled
    cacheMode="LOAD_DEFAULT"
    javaScriptEnabled
    domStorageEnabled
    scrollEnabled={false}
    overScrollMode="never"
    setSupportMultipleWindows={false}
    onLoadStart={reset}
    onLoadEnd={() => send({ type: "sync" })}
    onMessage={event => receive(event.nativeEvent.data)}
    onShouldStartLoadWithRequest={request => {
      if (request.url === "about:blank" || request.url === MAP_BASE_URL) return true;
      if (request.url.startsWith("https://www.openstreetmap.org/")) void Linking.openURL(request.url);
      return false;
    }}
    onContentProcessDidTerminate={() => webView.current?.reload()}
    onRenderProcessGone={() => webView.current?.reload()}
    renderError={() => <View style={styles.error}>
      <Text>{t("map.loadError")}</Text>
      <Pressable onPress={() => webView.current?.reload()} accessibilityRole="button">
        <Text style={styles.retry}>{t("action.retry")}</Text>
      </Pressable>
    </View>}
  />;
});

const styles = StyleSheet.create({
  map: { flex: 1, backgroundColor: "#e9eee7" },
  error: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20, gap: 12 },
  retry: { color: "#1a73e8", padding: 12 },
});
