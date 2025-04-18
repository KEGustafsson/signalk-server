const { expect } = require('chai');
const { filterUpdates } = require('../dist/baseDeltaFilter.js');

describe('filterUpdates', () => {
  const pathToRemove = [
    { path: "", value: { name: "GenericVessel" } },
    { path: "", value: { mmsi: "123456789" } },
    { path: "communication", value: { callsignVhf: "GEN123" } },
    { path: "design.aisShipType", value: { name: "GenericType" } },
    { path: "design.aisShipType", value: { id: 42 } },
    { path: "design.draft", value: { maximum: 1.5 } },
    { path: "design.length", value: { overall: 15 } },
    { path: "design.beam", value: 5 },
    { path: "sensors.gps.fromBow", value: 7 },
    { path: "sensors.gps.fromCenter", value: 1 },
    { path: "design.airHeight", value: 5 }
  ];

  describe('basic filtering', () => {
    it('should remove exact matches at root path', () => {
      const update = {
        values: [
          { path: "", value: { mmsi: "123456789" } },
          { path: "", value: { name: "genericvessel" } } // case insensitive
        ]
      };

      const result = filterUpdates(update, pathToRemove);
      expect(result.values).to.have.length(0);
    });

    it('should remove nested matches in root path', () => {
      const update = {
        values: [
          { path: "", value: { communication: { callsignVhf: "GEN123" } } }
        ]
      };

      const result = filterUpdates(update, pathToRemove);
      expect(result.values).to.have.length(0);
    });

    it('should remove specific path matches', () => {
      const update = {
        values: [
          { path: "design.length", value: { overall: 15 } },
          { path: "design.beam", value: 5 }
        ]
      };

      const result = filterUpdates(update, pathToRemove);
      expect(result.values).to.have.length(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty update', () => {
      const update = { values: [] };
      const result = filterUpdates(update, pathToRemove);
      expect(result.values).to.have.length(0);
    });

    it('should preserve non-matching values', () => {
      const update = {
        values: [
          { path: "navigation.position", value: { latitude: 60.1, longitude: 22.3 } },
          { path: "sensors.ais.fromBow", value: 5 }
        ]
      };

      const result = filterUpdates(update, pathToRemove);
      expect(result.values).to.have.length(2);
    });

    it('should handle array input', () => {
      const updates = [
        { values: [{ path: "", value: { mmsi: "123456789" } }] },
        { values: [{ path: "design.length", value: { overall: 15 } }] }
      ];

      const results = filterUpdates(updates, pathToRemove);
      expect(results).to.have.length(2);
      expect(results[0].values).to.have.length(0);
      expect(results[1].values).to.have.length(0);
    });

    it('should handle case variations in string values', () => {
      const update = {
        values: [
          { path: "", value: { name: "genericvessel" } }, // lowercase
          { path: "design.aisShipType", value: { name: "GENERICTYPE" } } // uppercase
        ]
      };

      const result = filterUpdates(update, pathToRemove);
      expect(result.values).to.have.length(0);
    });
  });

  describe('real-world scenarios', () => {
    it('should filter complex update with mixed matches', () => {
      const update = {
        values: [
          { path: "", value: { mmsi: "123456789", name: "GenericVessel" } },
          { path: "design.length", value: { overall: 15 } },
          { path: "sensors.ais.fromBow", value: 5 }, // Should keep
          { path: "", value: { communication: { callsignVhf: "GEN123" } } },
          { path: "design.aisShipType", value: { id: 42, name: "GenericType" } },
          { path: "navigation.speed", value: 10 } // Should keep
        ]
      };

      const result = filterUpdates(update, pathToRemove);
      expect(result.values).to.have.length(2);
      expect(result.values.find(v => v.path === "sensors.ais.fromBow")).to.exist;
      expect(result.values.find(v => v.path === "navigation.speed")).to.exist;
    });
  });
});