import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { federation } from '@module-federation/vite'
import path from 'path'

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
  build: {
    outDir: 'public',
    sourcemap: true,
    target: 'es2022'
  },
  resolve: {
    alias: {
      path: false
    }
  },
  server: {
    port: 3000
  }
})
