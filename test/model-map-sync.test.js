'use strict';

const { expect } = require('chai');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  mergeConfigLayers,
  computeOverrideDiff,
  syncLayeredConfig,
} = require('../tools/model-map-layered.js');

describe('model-map layered sync', () => {
  it('merges repo defaults with user overrides', () => {
    const merged = mergeConfigLayers(
      {
        routes: { default: 'general-default', background: 'workhorse' },
        llm_active_profile: 'auto',
      },
      {
        routes: { background: 'coder' },
        llm_active_profile: '64gb',
      },
    );

    expect(merged).to.deep.equal({
      routes: { default: 'general-default', background: 'coder' },
      llm_active_profile: '64gb',
    });
  });

  it('prunes overrides that match repo defaults', () => {
    const diff = computeOverrideDiff(
      {
        routes: { default: 'general-default', background: 'workhorse' },
        llm_active_profile: 'auto',
      },
      {
        routes: { default: 'general-default', background: 'workhorse' },
        llm_active_profile: '64gb',
      },
    );

    expect(diff).to.deep.equal({
      llm_active_profile: '64gb',
    });
  });

  it('bootstraps an override file from an existing effective config', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'model-map-sync-'));
    const defaultsPath = path.join(dir, 'defaults.json');
    const overridesPath = path.join(dir, 'model-map.overrides.json');
    const effectivePath = path.join(dir, 'model-map.json');

    fs.writeFileSync(defaultsPath, JSON.stringify({
      routes: {
        default: 'general-default',
        background: 'workhorse',
      },
      llm_active_profile: 'auto',
    }, null, 2));

    fs.writeFileSync(effectivePath, JSON.stringify({
      routes: {
        default: 'general-default',
        background: 'coder',
      },
      llm_active_profile: '64gb',
    }, null, 2));

    const result = syncLayeredConfig(defaultsPath, overridesPath, effectivePath, effectivePath);
    const overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
    const effective = JSON.parse(fs.readFileSync(effectivePath, 'utf8'));
    fs.rmSync(dir, { recursive: true, force: true });

    expect(result.overrides).to.deep.equal({
      routes: { background: 'coder' },
      llm_active_profile: '64gb',
    });
    expect(overrides).to.deep.equal({
      routes: { background: 'coder' },
      llm_active_profile: '64gb',
    });
    expect(effective).to.deep.equal({
      routes: {
        default: 'general-default',
        background: 'coder',
      },
      llm_active_profile: '64gb',
    });
  });
});
