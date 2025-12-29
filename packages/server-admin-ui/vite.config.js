import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { federation } from '@module-federation/vite'

// Validate peer dependencies for Module Federation compatibility
import '@signalk/server-admin-ui-dependencies'

export default defineConfig({
  base: './',
  publicDir: 'public_src',
  plugins: [
    react({
      babel: {
        presets: ['@babel/preset-react']
      }
    }),
    federation({
      name: 'adminUI',
      filename: 'remoteEntry.js',
      remotes: {},
      shared: {
        react: {
          singleton: true,
          requiredVersion: '^16.14.0'
        },
        'react-dom': {
          singleton: true,
          requiredVersion: '^16.14.0'
        }
      }
    })
  ],
  css: {
    preprocessorOptions: {
      scss: {
        // Silence deprecation warnings from Bootstrap 4 (legacy dependency)
        // These warnings are from Bootstrap's old Sass code and will be resolved when upgrading to Bootstrap 5
        quietDeps: true,
        silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'slash-div', 'if-function', 'abs-percent']
      }
    }
  },
  build: {
    outDir: 'public',
    sourcemap: true,
    target: 'es2022',
    assetsInlineLimit: 0, // Prevent inlining assets to allow server-side logo override
    rollupOptions: {
      output: {
        manualChunks(id) {
          // More conservative chunking to avoid breaking module resolution
          if (id.includes('node_modules')) {
            // Split large vendor libraries into separate chunks
            if (id.includes('@rjsf')) {
              return 'vendor-forms'
            }
            if (id.includes('react') || id.includes('redux')) {
              return 'vendor-react'
            }
            if (id.includes('bootstrap') || id.includes('reactstrap')) {
              return 'vendor-bootstrap'
            }
            if (id.includes('@fortawesome')) {
              return 'vendor-icons'
            }
            // Other node_modules go into vendor chunk
            return 'vendor'
          }
        }
      }
    }
  },
  resolve: {
    alias: {
      path: false,
      // Polyfill Node.js modules for browser compatibility
      events: 'events',
      buffer: 'buffer'
    }
  }
})
