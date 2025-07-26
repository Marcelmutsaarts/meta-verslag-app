/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  
  // Fix for pdf-parse and canvas dependencies (Next.js 15+ syntax)
  serverExternalPackages: ['pdf-parse', 'canvas'],
  
  webpack: (config, { isServer }) => {
    // Fix canvas dependency issues
    config.resolve.alias.canvas = false
    
    // Additional fixes for pdf-parse dependencies
    if (isServer) {
      config.externals.push({
        'canvas': 'canvas',
        'pdf-parse': 'pdf-parse'
      })
    }
    
    // Ignore native modules warnings
    config.module.rules.push({
      test: /\.node$/,
      loader: 'ignore-loader'
    })
    
    return config
  }
}

module.exports = nextConfig 