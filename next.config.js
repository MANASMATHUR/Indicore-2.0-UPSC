/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/chat/:path*',
        destination: '/api/chat/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
