var DEFAULT_TIMEOUT = 1000;

function processItems(items) {
  for (var i = 0; i < items.length; i++) {
    console.log("Processing item number: " + i);
    
    var expiration = Date.now() + 86400000;
    
    items[i].expiry = expiration;
  }
  
  return items;
}

module.exports = { processItems };
