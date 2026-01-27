import { expect } from 'chai'

describe('mDNS Advertisement (mdns.js)', () => {
  let mockDnssd: {
    publish: (options: PublishOptions) => Promise<{ name: string }>
    unpublishAll: () => Promise<void>
    destroy: () => Promise<void>
  }
  let publishedServices: PublishOptions[]
  let mdnsModule: (app: MockApp) => MdnsInterface | undefined
  let originalRequire: typeof require

  interface PublishOptions {
    name: string
    type: string
    port: number
    txt: Record<string, string>
    host?: string
    probe: boolean
  }

  interface MockApp {
    config: {
      name: string
      version: string
      vesselName?: string
      vesselMMSI?: string
      vesselUUID?: string
      settings: {
        mdns?: boolean
        ssl?: boolean
        port?: number
      }
      getExternalHostname: () => string
    }
    selfId: string
    interfaces: Record<
      string,
      { mdns?: { name: string; type: string; port: number } }
    >
  }

  interface MdnsInterface {
    stop: () => Promise<void>
  }

  beforeEach(() => {
    publishedServices = []
    mockDnssd = {
      publish: async (options: PublishOptions) => {
        publishedServices.push(options)
        return { name: options.name }
      },
      unpublishAll: async () => {
        publishedServices = []
      },
      destroy: async () => {}
    }

    // Clear require cache and set up mock
    delete require.cache[require.resolve('../src/mdns')]

    // Mock the @collight/dns-sd module
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
      return originalRequire.apply(this, [id])
    }

    mdnsModule = require('../src/mdns')
  })

  afterEach(() => {
    const Module = require('module')
    Module.prototype.require = originalRequire
    delete require.cache[require.resolve('../src/mdns')]
  })

  function createMockApp(overrides: Partial<MockApp> = {}): MockApp {
    return {
      config: {
        name: 'signalk-server',
        version: '2.20.0',
        vesselName: 'TestVessel',
        vesselMMSI: '123456789',
        vesselUUID: 'urn:mrn:signalk:uuid:test-uuid',
        settings: {
          mdns: true,
          ssl: false,
          port: 3000
        },
        getExternalHostname: () => require('os').hostname(),
        ...overrides.config
      },
      selfId: 'vessels.urn:mrn:signalk:uuid:test-uuid',
      interfaces: {},
      ...overrides
    }
  }

  describe('service advertisement', () => {
    it('should publish primary HTTP service when SSL is disabled', () => {
      const app = createMockApp()
      mdnsModule(app)

      expect(publishedServices.length).to.be.at.least(1)
      const primaryService = publishedServices[0]
      expect(primaryService.type).to.equal('signalk-http')
      expect(primaryService.port).to.equal(3000)
      expect(primaryService.name).to.equal('TestVessel')
    })

    it('should publish primary HTTPS service when SSL is enabled', () => {
      const app = createMockApp({
        config: {
          name: 'signalk-server',
          version: '2.20.0',
          vesselName: 'TestVessel',
          settings: {
            mdns: true,
            ssl: true,
            port: 3443
          },
          getExternalHostname: () => require('os').hostname()
        }
      })
      mdnsModule(app)

      expect(publishedServices.length).to.be.at.least(1)
      const primaryService = publishedServices[0]
      expect(primaryService.type).to.equal('signalk-https')
    })

    it('should include correct TXT records', () => {
      const app = createMockApp()
      mdnsModule(app)

      const primaryService = publishedServices[0]
      expect(primaryService.txt).to.include({
        txtvers: '1',
        swname: 'signalk-server',
        swvers: '2.20.0',
        roles: 'master, main',
        vname: 'TestVessel',
        vmmsi: '123456789',
        vuuid: 'urn:mrn:signalk:uuid:test-uuid'
      })
    })

    it('should strip empty TXT record values', () => {
      const app = createMockApp({
        config: {
          name: 'signalk-server',
          version: '2.20.0',
          vesselName: undefined,
          vesselMMSI: undefined,
          vesselUUID: undefined,
          settings: {
            mdns: true,
            ssl: false,
            port: 3000
          },
          getExternalHostname: () => require('os').hostname()
        }
      })
      mdnsModule(app)

      const primaryService = publishedServices[0]
      expect(primaryService.txt.vname).to.be.undefined
      expect(primaryService.txt.vmmsi).to.be.undefined
      expect(primaryService.txt.vuuid).to.be.undefined
    })

    it('should use config name as service name when vesselName is not set', () => {
      const app = createMockApp({
        config: {
          name: 'my-signalk-server',
          version: '2.20.0',
          vesselName: undefined,
          settings: {
            mdns: true,
            ssl: false,
            port: 3000
          },
          getExternalHostname: () => require('os').hostname()
        }
      })
      mdnsModule(app)

      expect(publishedServices[0].name).to.equal('my-signalk-server')
    })

    it('should publish additional services from interfaces', () => {
      const app = createMockApp({
        interfaces: {
          tcp: {
            mdns: {
              name: '_signalk-tcp',
              type: 'tcp',
              port: 8375
            }
          },
          ws: {
            mdns: {
              name: '_signalk-ws',
              type: 'tcp',
              port: 3000
            }
          }
        }
      })
      mdnsModule(app)

      // Primary + 2 interface services
      expect(publishedServices.length).to.equal(3)

      const tcpService = publishedServices.find((s) => s.type === 'signalk-tcp')
      expect(tcpService).to.exist
      expect(tcpService!.port).to.equal(8375)

      const wsService = publishedServices.find((s) => s.type === 'signalk-ws')
      expect(wsService).to.exist
      expect(wsService!.port).to.equal(3000)
    })

    it('should not publish interface service without leading underscore', () => {
      const app = createMockApp({
        interfaces: {
          invalid: {
            mdns: {
              name: 'no-underscore',
              type: 'tcp',
              port: 1234
            }
          }
        }
      })
      mdnsModule(app)

      // Only primary service should be published
      expect(publishedServices.length).to.equal(1)
    })

    it('should not publish interface service with non-tcp type', () => {
      const app = createMockApp({
        interfaces: {
          udp: {
            mdns: {
              name: '_signalk-udp',
              type: 'udp',
              port: 1234
            }
          }
        }
      })
      mdnsModule(app)

      // Only primary service should be published
      expect(publishedServices.length).to.equal(1)
    })

    it('should disable probing on all published services', () => {
      const app = createMockApp({
        interfaces: {
          tcp: {
            mdns: {
              name: '_signalk-tcp',
              type: 'tcp',
              port: 8375
            }
          }
        }
      })
      mdnsModule(app)

      publishedServices.forEach((service) => {
        expect(service.probe).to.equal(false)
      })
    })
  })

  describe('configuration', () => {
    it('should not start when mdns is disabled in settings', () => {
      const app = createMockApp({
        config: {
          name: 'signalk-server',
          version: '2.20.0',
          settings: {
            mdns: false,
            ssl: false,
            port: 3000
          },
          getExternalHostname: () => require('os').hostname()
        }
      })
      const result = mdnsModule(app)

      expect(result).to.be.undefined
      expect(publishedServices.length).to.equal(0)
    })

    it('should start when mdns setting is undefined (default enabled)', () => {
      const app = createMockApp({
        config: {
          name: 'signalk-server',
          version: '2.20.0',
          settings: {
            mdns: undefined,
            ssl: false,
            port: 3000
          },
          getExternalHostname: () => require('os').hostname()
        }
      })
      const result = mdnsModule(app)

      expect(result).to.exist
      expect(publishedServices.length).to.be.at.least(1)
    })
  })

  describe('stop function', () => {
    it('should return interface with stop function', () => {
      const app = createMockApp()
      const result = mdnsModule(app)

      expect(result).to.exist
      expect(result!.stop).to.be.a('function')
    })

    it('should unpublish all services and destroy on stop', async () => {
      let unpublishCalled = false
      let destroyCalled = false

      mockDnssd.unpublishAll = async () => {
        unpublishCalled = true
      }
      mockDnssd.destroy = async () => {
        destroyCalled = true
      }

      const app = createMockApp()
      const result = mdnsModule(app)

      await result!.stop()

      expect(unpublishCalled).to.be.true
      expect(destroyCalled).to.be.true
    })
  })
})
