import { useEffect, useState } from "react";

export function useHashRoute(defaultPath: string) {
  const readRoute = () => {
    const value = window.location.hash.replace(/^#/, "");
    return value || defaultPath;
  };

  const [route, setRoute] = useState(readRoute);

  useEffect(() => {
    const handleChange = () => setRoute(readRoute());
    window.addEventListener("hashchange", handleChange);

    if (!window.location.hash) {
      window.location.hash = defaultPath;
    }

    return () => window.removeEventListener("hashchange", handleChange);
  }, [defaultPath]);

  return route;
}