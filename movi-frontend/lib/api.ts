import Constants from "expo-constants";

/**
 * Compute API base URL that works in Expo/native and web.
 * Priority: EXPO_PUBLIC_API_BASE_URL -> Expo debugger/host -> localhost.
 */
export function getApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim();
  }

  const host =
    (Constants as any)?.expoGoConfig?.debuggerHost ||
    (Constants as any)?.expoConfig?.hostUri ||
    (Constants as any)?.manifest2?.extra?.expoClient?.hostUri ||
    (Constants as any)?.manifest?.hostUri;

  if (typeof host === "string") {
    const hostPort = host.replace(/^https?:\/\//, "");
    const hostname = hostPort.split(":")[0];
    if (hostname) {
      return `http://${hostname}:3000`;
    }
  }

  return "http://127.0.0.1:3000";
}

