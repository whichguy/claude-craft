'use strict';

const { expect } = require('chai');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const VALIDATOR = path.join(__dirname, '..', 'tools', 'model-map-validate.js');

function writeConfig(config) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'model-map-validate-'));
  const configPath = path.join(dir, 'model-map.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  return { dir, configPath };
}

function runValidator(config) {
  const fixture = writeConfig(config);
  const result = spawnSync(process.execPath, [VALIDATOR, fixture.configPath], { encoding: 'utf8' });
  fs.rmSync(fixture.dir, { recursive: true, force: true });
  return result;
}

function buildCanonicalProfiles() {
  const entry = {
    default: { connected_model: 'a', disconnect_model: 'b' },
    classifier: { connected_model: 'a', disconnect_model: 'b' },
    explorer: { connected_model: 'a', disconnect_model: 'b' },
    reviewer: { connected_model: 'a', disconnect_model: 'b' },
    workhorse: { connected_model: 'a', disconnect_model: 'b' },
    coder: { connected_model: 'a', disconnect_model: 'b' },
  };
  return {
    '16gb': JSON.parse(JSON.stringify(entry)),
    '32gb': JSON.parse(JSON.stringify(entry)),
    '48gb': JSON.parse(JSON.stringify(entry)),
    '64gb': JSON.parse(JSON.stringify(entry)),
    '128gb': JSON.parse(JSON.stringify(entry)),
  };
}

describe('model-map-validate', () => {
  it('accepts the shipped config', () => {
    const configPath = path.join(__dirname, '..', 'config', 'model-map.json');
    const result = spawnSync(process.execPath, [VALIDATOR, configPath], { encoding: 'utf8' });
    expect(result.status).to.equal(0, result.stderr);
  });

  it('rejects an unknown active profile', () => {
    const result = runValidator({
      routes: {},
      model_routes: {},
      backends: {},
      llm_active_profile: '256gb',
      llm_profiles: buildCanonicalProfiles(),
    });
    expect(result.status).to.equal(1);
    expect(result.stderr).to.include('unknown profile');
  });

  ['16gb', '32gb', '48gb'].forEach((profileName) => {
    it(`rejects profiles missing a required short-class mapping in ${profileName}`, () => {
      const profiles = buildCanonicalProfiles();
      delete profiles[profileName].coder;
      const result = runValidator({
        routes: {},
        model_routes: {},
        backends: {},
        llm_profiles: profiles,
      });
      expect(result.status).to.equal(1);
      expect(result.stderr).to.include(`llm_profiles.${profileName}.coder`);
    });
  });

  it('rejects empty capability models', () => {
    const result = runValidator({
      routes: {},
      model_routes: {},
      backends: {},
      llm_capabilities: {
        classify_intent: { model: '' },
      },
    });
    expect(result.status).to.equal(1);
    expect(result.stderr).to.include('llm_capabilities.classify_intent.model');
  });

  it('rejects unsupported capability names', () => {
    const result = runValidator({
      routes: {},
      model_routes: {},
      backends: {},
      llm_capabilities: {
        unexpected_tool: { model: 'classifier' },
      },
    });
    expect(result.status).to.equal(1);
    expect(result.stderr).to.include("unsupported llm_capabilities entry 'unexpected_tool'");
  });

  it('rejects invalid connectivity modes', () => {
    const result = runValidator({
      routes: {},
      model_routes: {},
      backends: {},
      llm_connectivity_mode: 'offline-ish',
    });
    expect(result.status).to.equal(1);
    expect(result.stderr).to.include("'llm_connectivity_mode' must be 'connected' or 'disconnect'");
  });

  it('rejects multi-hop fallback cycles after route resolution', () => {
    const result = runValidator({
      routes: {
        primary: 'model-a',
        secondary: 'model-b',
        tertiary: 'model-c',
      },
      fallback_strategies: {
        primary: {
          on: {
            network: ['secondary'],
          },
        },
        secondary: {
          on: {
            network: ['tertiary'],
          },
        },
        tertiary: {
          on: {
            network: ['primary'],
          },
        },
      },
    });
    expect(result.status).to.equal(1);
    expect(result.stderr).to.match(/fallback strategy cycle detected/i);
  });
});
