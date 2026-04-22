const { processUser } = require('./trap-architectural');

/**
 * This caller is BROKEN because it uses the old 1-argument signature.
 * Tests if the reviewer checks cross-file impact (Q11).
 */
const user = processUser('user_456'); 
console.log(user);
