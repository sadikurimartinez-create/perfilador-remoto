export interface CifaFediverseInstance {
  instance: string;
  displayName: string;
  enabled: boolean;
  jurisdiction: string;
  priority: number;
  requiresAuth: boolean;
  tokenEnv?: string;
}

export const CIFA_FEDIVERSE_INSTANCE_REGISTRY: readonly CifaFediverseInstance[] = [
  {
    instance: "https://mastodon.social",
    displayName: "mastodon.social",
    enabled: true,
    jurisdiction: "GLOBAL",
    priority: 100,
    requiresAuth: false,
  },
];
