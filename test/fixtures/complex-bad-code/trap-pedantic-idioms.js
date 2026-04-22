/**
 * TRAP: Pedantic Idioms & Dead Code.
 * 
 * Q23 Trap: Commented out code and console logs left in.
 * Q37 Trap: Using 'var' and string concatenation.
 * Q26 Trap: Magic number for milliseconds in a day.
 */

// var usage (Legacy)
var DEFAULT_TIMEOUT = 1000;

function processItems(items) {
  // Commented out code block (Dead Code)
  /*
  items.forEach(item => {
    console.log("Checking item: " + item.id);
  });
  */

  for (var i = 0; i < items.length; i++) {
    // String concatenation instead of template literals
    console.log("Processing item number: " + i);
    
    // Magic number: 86400000 (ms in a day)
    var expiration = Date.now() + 86400000;
    
    items[i].expiry = expiration;
  }
  
  return items;
}

module.exports = { processItems };
