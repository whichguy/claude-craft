const { expect } = require('chai');

function parseConfig(input) {
  return JSON.parse(input);
}

function validateAge(age) {
  if (typeof age !== 'number' || age < 0 || age > 150) return null;
  return age;
}

// [TRAP] Proper behavior test — asserts return value and error path
describe('parseConfig', () => {
  it('should parse valid JSON and return object with expected keys', () => {
    const result = parseConfig('{"host":"localhost","port":3000}');
    expect(result).to.deep.equal({ host: 'localhost', port: 3000 });
  });

  it('should throw on invalid JSON', () => {
    expect(() => parseConfig('not json')).to.throw(SyntaxError);
  });
});

// [ISSUE: TEST-1] Test calls function but has zero assertions — only verifies "no throw"
describe('validateAge', () => {
  it('should handle valid ages', () => {
    validateAge(25);
    validateAge(0);
    validateAge(150);
    // No assertions — just verifies the function doesn't throw
  });

  // [ISSUE: TEST-2] Test uses not.throw but never checks the returned value
  it('should not throw for boundary values', () => {
    expect(() => validateAge(-1)).to.not.throw();
    expect(() => validateAge(200)).to.not.throw();
    // Verifies no exception, but -1 and 200 should return null — never checked
  });

  // [ISSUE: TEST-3] Test asserts truthiness on complex object instead of structure
  it('should return valid result for config parsing', () => {
    const result = parseConfig('{"name":"test","enabled":true,"count":42}');
    expect(result).to.be.ok;
    // toBeTruthy/to.be.ok passes for ANY non-null object — doesn't verify shape
    // { name: "wrong", enabled: false } would also pass this test
  });
});
