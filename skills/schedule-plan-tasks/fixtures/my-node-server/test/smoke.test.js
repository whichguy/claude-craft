'use strict';

const request = require('supertest');
const { expect } = require('chai');
const app = require('../src/index');

describe('smoke', () => {
  it('app module loads without throwing', () => {
    expect(app).to.be.a('function');
  });
});
