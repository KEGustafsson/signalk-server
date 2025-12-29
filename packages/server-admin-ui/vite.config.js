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
        manualChunks: {
          // Split vendor code into separate chunks to improve caching
          'vendor-react': ['react', 'react-dom', 'react-redux', 'redux', 'redux-thunk'],
          'vendor-bootstrap': ['bootstrap', 'reactstrap', 'react-bootstrap'],
          'vendor-icons': ['@fortawesome/fontawesome-svg-core', '@fortawesome/free-solid-svg-icons', '@fortawesome/free-regular-svg-icons', '@fortawesome/react-fontawesome'],
          'vendor-forms': ['@rjsf/core', '@rjsf/bootstrap-4', '@rjsf/utils', '@rjsf/validator-ajv8']
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
