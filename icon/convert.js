/* eslint-env node */

const sharp = require('sharp');
const toIco = require('to-ico');
const fs = require('fs');

const converter = sharp('icon.svg');

Promise.all([
  converter.resize({ width:  16 }).toFile('icon016.png'),  // ico
  converter.resize({ width:  32 }).toFile('icon032.png'),  // ico
  converter.resize({ width:  48 }).toFile('icon048.png'),  // mobile
  converter.resize({ width:  96 }).toFile('icon096.png'),  // mobile
  converter.resize({ width: 144 }).toFile('icon144.png'),  // mobile
  converter.resize({ width: 192 }).toFile('icon192.png'),  // mobile
  converter.resize({ width: 256 }).toFile('icon256.png'),  // mobile
  converter.resize({ width: 384 }).toFile('icon384.png'),  // mobile
  converter.resize({ width: 512 }).toFile('icon512.png')   // mobile
]).then(() => {
  toIco([
    fs.readFileSync('icon016.png'),
    fs.readFileSync('icon032.png')
  ]).then(buffer => {
    fs.writeFileSync('../favicon.ico', buffer);
    fs.unlinkSync('icon016.png');
    fs.unlinkSync('icon032.png');
  });
});
