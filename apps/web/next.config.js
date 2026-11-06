/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '*.localhost',
    'kiyora.ccdx.dev',
  ],
  // The editor owns the bottom-left corner: the zoom cluster lives there, and
  // Next's development indicator would sit on top of it.
  devIndicators: { position: 'bottom-right' },
  // The boot hook reads the committed journal while the server starts, so a
  // standalone build must carry drizzle/ with it.
  outputFileTracingIncludes: {
    '/*': ['./drizzle/**/*'],
  },
  transpilePackages: ['@kiyora/dsl', '@kiyora/editor', '@kiyora/model'],
};

export default nextConfig;
