export interface NavItem {
  key: string;
  label: string;
  path: string;
  icon?: string;
}

export interface PlatformModuleDefinition {
  key: string;
  name: string;
  description: string;
  routes: NavItem[];
  entities: string[];
  reusable: boolean;
}

export interface AppDefinition {
  key: string;
  name: string;
  description: string;
  modules: PlatformModuleDefinition[];
  navigation: NavItem[];
}

export interface RouteDefinition {
  path: string;
  label: string;
}

export function defineModule(module: PlatformModuleDefinition): PlatformModuleDefinition {
  return module;
}

export function defineApp(app: AppDefinition): AppDefinition {
  return app;
}