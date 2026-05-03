'use strict';

const express = require('express');
const app = express();

app.use(express.json());

// Routes are mounted here as plans implement them.
// Each plan adds a require() block below.

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`my-node-server listening on port ${PORT}`);
  });
}

module.exports = app;
