/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Server Actions are enabled by default in Next 14; typed routes optional.
    typedRoutes: false,
    // nodemailer uses dynamic requires; keep it external so Next doesn't bundle it.
    // exceljs (financials upload) is large and Node-only; same treatment.
    serverComponentsExternalPackages: ['nodemailer', 'exceljs'],
  },
};

export default nextConfig;
