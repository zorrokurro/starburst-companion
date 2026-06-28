import { 
  getSingleTypeMultiplier, 
  calculateDefenseMultiplier, 
  calculateTypeMultiplier,
  calculateSTAB
} from './typeCalculator.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`PASS: ${message}`);
}

console.log('=== Type Calculator Unit Tests ===\n');

console.log('--- Single Type Multiplier ---');
assert(getSingleTypeMultiplier('水', '火') === 2, '水 attacks 火 = 2x');
assert(getSingleTypeMultiplier('水', '水') === 1, '水 attacks 水 = 1x');
assert(getSingleTypeMultiplier('水', '草') === 0.5, '水 attacks 草 = 0.5x');
assert(getSingleTypeMultiplier('電', '地面') === 0, '電 attacks 地面 = 0x (immune)');
assert(getSingleTypeMultiplier('普通', '普通') === 1, '普通 attacks 普通 = 1x');
assert(getSingleTypeMultiplier('普通', '龍') === 1, '普通 attacks 龍 = 1x');

console.log('\n--- Dual-Type Defense ---');
assert(calculateDefenseMultiplier('水', ['水', '火']) === 1.5, '水 attacks 水火 = 1.5x');
assert(calculateDefenseMultiplier('電', ['地面', '飛行']) === 0.5, '電 attacks 地面飛行 = 0.5x');
assert(calculateDefenseMultiplier('草', ['水', '火']) === 1.25, '草 attacks 水火 = 1.25x');

console.log('\n--- Full Type Multiplier ---');
assert(calculateTypeMultiplier(['水'], ['火']) === 2, '水 attacks 火 = 2x');
assert(calculateTypeMultiplier(['水', '火'], ['草']) >= 1, '水火 attacks 草 = avg of multipliers');
assert(calculateTypeMultiplier(['電'], ['地面', '飛行']) === 0.5, '電 attacks 地面飛行 = 0.5x');

console.log('\n--- STAB ---');
assert(calculateSTAB(['水'], '水') === 1.5, 'Water sprite using Water skill = 1.5x STAB');
assert(calculateSTAB(['水'], '火') === 1, 'Water sprite using Fire skill = 1x');
assert(calculateSTAB(['水', '火'], '水') === 1.5, 'Water/Fire sprite using Water = 1.5x STAB');
assert(calculateSTAB(['水', '火'], '火') === 1.5, 'Water/Fire sprite using Fire = 1.5x STAB');
assert(calculateSTAB(['水', '火'], '草') === 1, 'Water/Fire sprite using Grass = 1x');
assert(calculateSTAB([], '水') === 1, 'No type sprite = 1x');

console.log('\n=== All tests passed! ===');
