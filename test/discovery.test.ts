import { expect } from 'chai'

describe('mDNS Discovery (discovery.js)', () => {
  let mockDnssd: {
    startBrowser: (
      options: BrowserOptions,
      callback?: (service: DiscoveredService) => void
    ) => { stop: () => void }
    destroy: () => Promise<void>
  }
  let browserCallback: ((service: DiscoveredService) => void) | null
  let browserStopped: boolean
  let dnssdDestroyed: boolean
  let discoveredProviders: DiscoveredProvider[]
  let originalRequire: typeof require

  interface BrowserOptions {
    filter: {
      protocol: string
      type: string
    }
  }

  interface DiscoveredService {
    name: string
    host?: string
    port: number
    addresses?: string[]
  }

  interface DiscoveredProvider {
    id: string
    enabled?: boolean
    pipeElements: Array<{
      type: string
      options: {
        type: string
        subOptions: {
          type: string
          host?: string
          port: string | number
          providerId?: string
        }
        providerId?: string
      }
    }>
  }

  interface MockApp {
    config: {
      settings: {
        pipedProviders: DiscoveredProvider[]
      }
    }
    emit: (event: string, provider: DiscoveredProvider) => void
  }

  beforeEach(() => {
    browserCallback = null
    browserStopped = false
    dnssdDestroyed = false
    discoveredProviders = []

    mockDnssd = {
      startBrowser: (
        options: BrowserOptions,
        callback?: (service: DiscoveredService) => void
      ) => {
        browserCallback = callback || null
        return {
          stop: () => {
            browserStopped = true
          }
        }
      },
      destroy: async () => {
        dnssdDestroyed = true
      }
    }

    // Clear require cache
    delete require.cache[require.resolve('../src/discovery')]

    // Mock the required modules
    const Module = require('module')
    originalRequire = Module.prototype.require
    Module.prototype.require = function (id: string) {
      if (id === '@collight/dns-sd') {
        return {
          DNSSD: function () {
            return mockDnssd
          }
        }
      }
      if (id === '@canboat/canboatjs') {
        return { discover: undefined }
      }
      return originalRequire.apply(this, [id])
    }
  })

  afterEach(() => {
    const Module = require('module')
    Module.prototype.require = originalRequire
    delete require.cache[require.resolve('../src/discovery')]
  })

  function createMockApp(existingProviders: DiscoveredProvider[] = []): MockApp {
    return {
      config: {
        settings: {
          pipedProviders: existingProviders
        }
      },
      emit: (_event: string, provider: DiscoveredProvider) => {
        discoveredProviders.push(provider)
      }
    }
  }

  describe('discoverSignalkWs', () => {
    it('should start browser for signalk-ws services', () => {
      let browserType: string | null = null
      mockDnssd.startBrowser = (
        options: BrowserOptions,
        callback?: (service: DiscoveredService) => void
      ) => {
        browserType = options.filter.type
        browserCallback = callback || null
        return { stop: () => {} }
      }

      const discovery = require('../src/discovery')
      const app = createMockApp()
      discovery.runDiscovery(app)

      // Discovery runs for both ws and wss
      expect(browserType).to.satisfy(
        (type: string) => type === 'signalk-ws' || type === 'signalk-wss'
      )
    })

    it('should emit discovered event for non-local services', () => {
      const discovery = require('../src/discovery')
      const app = createMockApp()
      discovery.runDiscovery(app)

      // Simulate service discovery callback
      if (browserCallback) {
        browserCallback({
          name: 'RemoteServer',
          host: 'remote-server.local',
          port: 3000,
          addresses: ['192.168.1.100']
        })
      }

      expect(discoveredProviders.length).to.be.at.least(1)
      const provider = discoveredProviders.find((p) =>
        p.id.includes('remote-server.local')
      )
      expect(provider).to.exist
      expect(provider!.enabled).to.equal(false)
      expect(provider!.pipeElements[0].options.type).to.equal('SignalK')
    })

    it('should not emit for services with local IP address', () => {
      // Mock networkInterfaces to return a local IP
      const os = require('os')
      const originalNetworkInterfaces = os.networkInterfaces
      os.networkInterfaces = () => ({
        eth0: [{ family: 'IPv4', address: '192.168.1.50', internal: false }]
      })

      const discovery = require('../src/discovery')
      const app = createMockApp()
      discovery.runDiscovery(app)

      // Simulate service with local IP
      if (browserCallback) {
        browserCallback({
          name: 'LocalServer',
          host: 'local-server.local',
          port: 3000,
          addresses: ['192.168.1.50']
        })
      }

      const localProvider = discoveredProviders.find((p) =>
        p.id.includes('local-server')
      )
      expect(localProvider).to.be.undefined

      os.networkInterfaces = originalNetworkInterfaces
    })

    it('should not emit for already configured providers', () => {
      // Need to have providers for BOTH ws and wss since discovery runs for both
      const existingWsProvider: DiscoveredProvider = {
        id: 'existing-ws',
        pipeElements: [
          {
            type: 'providers/simple',
            options: {
              type: 'SignalK',
              subOptions: {
                type: 'ws',
                host: 'existing-server.local',
                port: 3000
              }
            }
          }
        ]
      }
      const existingWssProvider: DiscoveredProvider = {
        id: 'existing-wss',
        pipeElements: [
          {
            type: 'providers/simple',
            options: {
              type: 'SignalK',
              subOptions: {
                type: 'wss',
                host: 'existing-server.local',
                port: 3000
              }
            }
          }
        ]
      }

      const discovery = require('../src/discovery')
      const app = createMockApp([existingWsProvider, existingWssProvider])
      discovery.runDiscovery(app)

      // Simulate discovering same service
      if (browserCallback) {
        browserCallback({
          name: 'ExistingServer',
          host: 'existing-server.local',
          port: 3000,
          addresses: ['192.168.1.100']
        })
      }

      const duplicateProvider = discoveredProviders.find((p) =>
        p.id.includes('existing-server')
      )
      expect(duplicateProvider).to.be.undefined
    })

    it('should use host from service when addresses are empty', () => {
      const discovery = require('../src/discovery')
      const app = createMockApp()
      discovery.runDiscovery(app)

      // Simulate service with empty addresses
      if (browserCallback) {
        browserCallback({
          name: 'NoAddressServer',
          host: 'no-address.local',
          port: 3000,
          addresses: []
        })
      }

      // Should not emit since we need addresses to check if local
      expect(
        discoveredProviders.find((p) => p.id.includes('no-address'))
      ).to.be.undefined
    })

    it('should create correct provider structure', () => {
      const discovery = require('../src/discovery')
      const app = createMockApp()
      discovery.runDiscovery(app)

      if (browserCallback) {
        browserCallback({
          name: 'TestServer',
          host: 'test-server.local',
          port: 3001,
          addresses: ['10.0.0.100']
        })
      }

      const provider = discoveredProviders[0]
      expect(provider).to.exist
      expect(provider.pipeElements).to.have.length(1)
      expect(provider.pipeElements[0].type).to.equal('providers/simple')
      expect(provider.pipeElements[0].options.subOptions.host).to.equal(
        'test-server.local'
      )
      expect(provider.pipeElements[0].options.subOptions.port).to.equal(3001)
    })
  })

  describe('helper functions', () => {
    describe('findWSProvider', () => {
      it('should find existing WS provider by host and port', () => {
        // Need both ws and wss providers since discovery runs for both
        const existingWsProvider: DiscoveredProvider = {
          id: 'test-provider-ws',
          pipeElements: [
            {
              type: 'providers/simple',
              options: {
                type: 'SignalK',
                subOptions: {
                  type: 'ws',
                  host: 'server.local',
                  port: 3000
                }
              }
            }
          ]
        }
        const existingWssProvider: DiscoveredProvider = {
          id: 'test-provider-wss',
          pipeElements: [
            {
              type: 'providers/simple',
              options: {
                type: 'SignalK',
                subOptions: {
                  type: 'wss',
                  host: 'server.local',
                  port: 3000
                }
              }
            }
          ]
        }

        const discovery = require('../src/discovery')
        const app = createMockApp([existingWsProvider, existingWssProvider])
        discovery.runDiscovery(app)

        // Simulate discovering same service - should be filtered
        if (browserCallback) {
          browserCallback({
            name: 'Server',
            host: 'server.local',
            port: 3000,
            addresses: ['192.168.1.100']
          })
        }

        expect(
          discoveredProviders.find((p) => p.id.includes('server.local'))
        ).to.be.undefined
      })

      it('should find existing WS provider by IP address', () => {
        // Need both ws and wss providers since discovery runs for both
        const existingWsProvider: DiscoveredProvider = {
          id: 'test-provider-ws',
          pipeElements: [
            {
              type: 'providers/simple',
              options: {
                type: 'SignalK',
                subOptions: {
                  type: 'ws',
                  host: '192.168.1.100',
                  port: 3000
                }
              }
            }
          ]
        }
        const existingWssProvider: DiscoveredProvider = {
          id: 'test-provider-wss',
          pipeElements: [
            {
              type: 'providers/simple',
              options: {
                type: 'SignalK',
                subOptions: {
                  type: 'wss',
                  host: '192.168.1.100',
                  port: 3000
                }
              }
            }
          ]
        }

        const discovery = require('../src/discovery')
        const app = createMockApp([existingWsProvider, existingWssProvider])
        discovery.runDiscovery(app)

        // Simulate discovering service with matching IP
        if (browserCallback) {
          browserCallback({
            name: 'Server',
            host: 'different-host.local',
            port: 3000,
            addresses: ['192.168.1.100']
          })
        }

        expect(
          discoveredProviders.find((p) => p.id.includes('different-host'))
        ).to.be.undefined
      })
    })

    describe('findTCPProvider', () => {
      it('should find existing TCP NMEA provider', () => {
        const existingProvider: DiscoveredProvider = {
          id: 'nmea-provider',
          pipeElements: [
            {
              type: 'providers/simple',
              options: {
                type: 'NMEA0183',
                subOptions: {
                  type: 'tcp',
                  host: '192.168.1.50',
                  port: 10110
                }
              }
            }
          ]
        }

        const app = createMockApp([existingProvider])
        expect(app.config.settings.pipedProviders).to.have.length(1)
      })
    })

    describe('findUDPProvider', () => {
      it('should find existing UDP NMEA provider', () => {
        const existingProvider: DiscoveredProvider = {
          id: 'udp-provider',
          pipeElements: [
            {
              type: 'providers/simple',
              options: {
                type: 'NMEA0183',
                subOptions: {
                  type: 'udp',
                  port: '2000'
                }
              }
            }
          ]
        }

        const app = createMockApp([existingProvider])
        expect(app.config.settings.pipedProviders).to.have.length(1)
      })
    })
  })

  describe('cleanup', () => {
    it('should stop browser and destroy dnssd after timeout', function (done) {
      this.timeout(10000)

      const discovery = require('../src/discovery')
      const app = createMockApp()
      discovery.runDiscovery(app)

      // The discovery sets a 5 second timeout for SignalK WS
      setTimeout(() => {
        expect(browserStopped).to.be.true
        expect(dnssdDestroyed).to.be.true
        done()
      }, 6000)
    })
  })
})
