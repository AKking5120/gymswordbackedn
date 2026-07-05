const os = require('os');
const path = require('path');
const fs = require('fs');

const TEMP_DIR = path.join(os.tmpdir(), 'gymsword-temp');

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

module.exports = { TEMP_DIR };
