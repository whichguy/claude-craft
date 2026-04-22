interface AppConfig {
  retries: number;
  timeout: number;
  debug: boolean;
}

export class ConfigManager {
  private config: AppConfig;

  constructor(overrides: Partial<AppConfig>) {
    this.config = {
      retries: overrides.retries || 3,
      timeout: overrides.timeout || 5000,
      debug: overrides.debug || false,
    };
  }

  getConfig(): AppConfig {
    return this.config;
  }
}
