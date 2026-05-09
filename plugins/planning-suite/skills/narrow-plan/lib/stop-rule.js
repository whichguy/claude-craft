'use strict';

const fs = require('fs');

const SLOTS = ['A', 'B', 'C', 'D', 'E'];

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function topTwo(distribution) {
  const ranked = SLOTS
    .map((slot) => ({ slot, p: distribution[slot] }))
    .sort((a, b) => b.p - a.p);
  return { top: ranked[0], second: ranked[1] };
}

function priorTopTwoSlots(priorDistribution) {
  const ranked = SLOTS
    .map((slot) => ({ slot, p: priorDistribution[slot] }))
    .sort((a, b) => b.p - a.p);
  return new Set([ranked[0].slot, ranked[1].slot]);
}

function check({ distPath, refinementsPath, priorDistPath }) {
  const distribution = readJson(distPath);
  const refinements = readJson(refinementsPath);
  const carryForward = Array.isArray(refinements.carry_forward) ? refinements.carry_forward : [];

  const { top, second } = topTwo(distribution);
  const margin = top.p - second.p;

  let topWasCarriedForward = false;
  if (priorDistPath && carryForward.length > 0) {
    const priorDist = readJson(priorDistPath);
    const priorTopTwo = priorTopTwoSlots(priorDist);
    const cfEntry = carryForward.find((cf) => cf.this_slot === top.slot);
    if (cfEntry && priorTopTwo.has(cfEntry.prior_slot)) {
      topWasCarriedForward = true;
    }
  }

  const passes = top.p >= 0.70 && margin >= 0.30 && topWasCarriedForward;

  return {
    p_top: top.p,
    p_second: second.p,
    margin,
    top_was_carried_forward: topWasCarriedForward,
    winning_slot: top.slot,
    passes
  };
}

module.exports = { check };
