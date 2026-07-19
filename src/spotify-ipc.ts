import { ipcMain } from "electron";
import { IPC_CHANNELS } from "./ipc-contract";
import type { SpotifyServiceApi } from "./types";

function isSpotifyMethod(
  service: SpotifyServiceApi,
  value: unknown,
): value is keyof SpotifyServiceApi {
  return typeof value === "string"
    && Object.prototype.hasOwnProperty.call(service, value)
    && typeof service[value as keyof SpotifyServiceApi] === "function";
}

export function registerSpotifyIpc(service: SpotifyServiceApi): void {
  ipcMain.handle(
    IPC_CHANNELS.spotifyInvoke,
    async (_event, method: unknown, args: unknown) => {
      if (!isSpotifyMethod(service, method)) {
        throw new Error(`Unknown Spotify method: ${String(method)}`);
      }

      if (!Array.isArray(args)) {
        throw new TypeError("Spotify method arguments must be an array");
      }

      const handler = service[method] as unknown as (
        ...methodArgs: unknown[]
      ) => unknown;
      return Reflect.apply(handler, service, args);
    },
  );
}
