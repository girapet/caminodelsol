var sharp = require('sharp');
var converter = sharp('icon.svg');

converter.toFile('icon512.png').then(() => console.log(512));
converter.resize({ width: 384 }).toFile('icon384.png').then(() => console.log(384));
converter.resize({ width: 256 }).toFile('icon256.png').then(() => console.log(256));
converter.resize({ width: 192 }).toFile('icon192.png').then(() => console.log(192));
converter.resize({ width: 144 }).toFile('icon144.png').then(() => console.log(144));
converter.resize({ width: 96 }).toFile('icon096.png').then(() => console.log(96));
converter.resize({ width: 48 }).toFile('icon048.png').then(() => console.log(48));
