export interface UserProfile {
  id: string;
  name: string;
  role: "admin" | "editor" | "viewer";
}

export const defaultLocalUser: UserProfile = {
  id: "local-admin",
  name: "Administrador Local",
  role: "admin"
};