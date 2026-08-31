import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Meu Capital",
    short_name: "Meu Capital",
    description: "Gestor de património e finanças pessoais.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0B0F14",
    theme_color: "#0B0F14",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
