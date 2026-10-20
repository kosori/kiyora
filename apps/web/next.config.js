/** @type {import('next').NextConfig} */
const nextConfig = {
  // The editor owns the bottom-left corner: the zoom cluster lives there, and
  // Next's development indicator would sit on top of it.
  devIndicators: { position: 'bottom-right' },
  transpilePackages: ['@kiyora/dsl', '@kiyora/editor', '@kiyora/model'],
};

export default nextConfig;
