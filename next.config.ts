import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Necessário quando acedes ao dev server por um IP de rede local em vez de
   * "localhost" (ex: através do adaptador virtual do WSL2 no Windows, ou a
   * partir de outro dispositivo na mesma rede). Sem isto, o Next.js bloqueia
   * os pedidos de HMR e dos chunks JS/CSS por segurança, e a app fica sem
   * estilos nem interatividade.
   *
   * Adiciona aqui o(s) IP(s) que aparecem no aviso "Blocked cross-origin
   * request ... from '<IP>'." no terminal.
   */
  allowedDevOrigins: ["172.30.240.1"],
};

export default nextConfig;
