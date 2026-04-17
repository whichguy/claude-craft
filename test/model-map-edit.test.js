'use strict';

const { expect } = require('chai');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const EDITOR = path.join(__dirname, '..', 'tools', 'model-map-edit.js');

function canonicalProfiles() {
  const profile = {
    default: { connected_model: 'a', disconnect_model: 'b' },
    classifier: { connected_model: 'a', disconnect_model: 'b' },
    explorer: { connected_model: 'a', disconnect_model: 'b' },
    reviewer: { connected_model: 'a', disconnect_model: 'b' },
    workhorse: { connected_model: 'a', disconnect_model: 'b' },
    coder: { connected_model: 'a', disconnect_model: 'b' },
  };
  return {
    '16gb': JSON.parse(JSON.stringify(profile)),
    '32gb': JSON.parse(JSON.stringify(profile)),
    '48gb': JSON.parse(JSON.stringify(profile)),
    '64gb': JSON.parse(JSON.stringify(profile)),
    '128gb': JSON.parse(JSON.stringify(profile)),
  };
}

function writeFixture(defaults, overrides = null) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'model-map-edit-'));
  const defaultsPath = path.join(dir, 'defaults.json');
  const overridesPath = path.join(dir, 'model-map.overrides.json');
  const effectivePath = path.join(dir, 'model-map.json');
  fs.writeFileSync(defaultsPath, JSON.stringify(defaults, null, 2));
  if (overrides != null) {
    fs.writeFileSync(overridesPath, JSON.stringify(overrides, null, 2));
  }
  return { dir, defaultsPath, overridesPath, effectivePath };
}

function runEditor(defaults, overrides, spec) {
  const fixture = writeFixture(defaults, overrides);
  const result = spawnSync(process.execPath, [
    EDITOR,
    fixture.defaultsPath,
    fixture.overridesPath,
    fixture.effectivePath,
    JSON.stringify(spec),
  ], { encoding: 'utf8' });
  const persistedOverrides = fs.existsSync(fixture.overridesPath)
    ? JSON.parse(fs.readFileSync(fixture.overridesPath, 'utf8'))
    : null;
  const persistedEffective = fs.existsSync(fixture.effectivePath)
    ? JSON.parse(fs.readFileSync(fixture.effectivePath, 'utf8'))
    : null;
  fs.rmSync(fixture.dir, { recursive: true, force: true });
  return { result, persistedOverrides, persistedEffective };
}

describe('model-map-edit', () => {
  const defaults = {
    routes: {
      default: 'general-default',
      'medium-model': 'workhorse',
    },
    llm_active_profile: 'auto',
    llm_profiles: canonicalProfiles(),
  };

  it('writes only the minimal override delta while regenerating the effective config', () => {
    const { result, persistedOverrides, persistedEffective } = runEditor(defaults, {}, {
      routes: {
        workhorse: 'glm-5.1:cloud',
      },
      default_model: 'workhorse',
      active_profile: '64gb',
    });

    expect(result.status).to.equal(0, result.stderr);
    expect(persistedOverrides).to.deep.equal({
      routes: {
        workhorse: 'glm-5.1:cloud',
        default: 'workhorse',
      },
      llm_active_profile: '64gb',
    });
    expect(persistedEffective.routes.workhorse).to.equal('glm-5.1:cloud');
    expect(persistedEffective.routes.default).to.equal('workhorse');
    expect(persistedEffective.llm_active_profile).to.equal('64gb');
  });

  it('drops override entries that match the defaults exactly', () => {
    const { result, persistedOverrides, persistedEffective } = runEditor(defaults, {
      routes: {
        default: 'general-default',
      },
    }, {
      default_model: 'general-default',
    });

    expect(result.status).to.equal(0, result.stderr);
    expect(persistedOverrides).to.deep.equal({});
    expect(persistedEffective.routes.default).to.equal('general-default');
  });

  it('updates fallback strategies when the final graph resolves cleanly', () => {
    const { result, persistedOverrides, persistedEffective } = runEditor({
      routes: {
        primary: 'glm-5.1:cloud',
        backup: 'qwen3.6:35b-a3b-q4_K_M',
      },
    }, {}, {
      fallback_strategies: {
        primary: {
          on: {
            network: ['backup'],
          },
        },
      },
    });

    expect(result.status).to.equal(0, result.stderr);
    expect(persistedOverrides.fallback_strategies.primary.on.network).to.deep.equal(['backup']);
    expect(persistedEffective.fallback_strategies.primary.on.network).to.deep.equal(['backup']);
  });

  it('refuses to write when route and fallback edits would create a cycle', () => {
    const { result, persistedOverrides, persistedEffective } = runEditor({
      routes: {
        default: 'primary',
        primary: 'glm-5.1:cloud',
        backup: 'qwen3.6:35b-a3b-q4_K_M',
      },
      fallback_strategies: {
        primary: {
          on: {
            network: ['backup'],
          },
        },
      },
    }, {}, {
      routes: {
        backup: 'primary',
      },
      fallback_strategies: {
        backup: {
          on: {
            network: ['primary'],
          },
        },
      },
    });

    expect(result.status).to.equal(1);
    expect(result.stderr).to.match(/cycle/i);
    expect(persistedOverrides).to.deep.equal({});
    expect(persistedEffective).to.equal(null);
  });

  it('refuses to write an explicit active profile that does not exist', () => {
    const { result, persistedOverrides, persistedEffective } = runEditor(defaults, {}, {
      active_profile: '256gb',
    });

    expect(result.status).to.equal(1);
    expect(result.stderr).to.include('unknown profile');
    expect(persistedOverrides).to.deep.equal({});
    expect(persistedEffective).to.equal(null);
  });
});
