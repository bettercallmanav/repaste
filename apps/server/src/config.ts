import { Layer, ServiceMap } from "effect";

export const DEFAULT_PORT = 3847;

export interface ServerConfigShape {
  readonly port: number;
  readonly host: string;
  readonly stateDir: string;
  readonly authToken: string | undefined;
}

export class ServerConfig extends ServiceMap.Service<ServerConfig, ServerConfigShape>()(
  "@clipm/server/config/ServerConfig",
) {
  static readonly layer = (overrides?: Partial<ServerConfigShape>) =>
    Layer.succeed(
      ServerConfig,
      {
        port: overrides?.port ?? DEFAULT_PORT,
        host: overrides?.host ?? "127.0.0.1",
        stateDir: overrides?.stateDir ?? process.cwd(),
        authToken: overrides?.authToken,
      } satisfies ServerConfigShape,
    );
}
