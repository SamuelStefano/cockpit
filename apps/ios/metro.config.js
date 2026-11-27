// Metro config of the Deck iOS shell: the Expo default. The shell is outside the root
// workspaces (own lockfile), so Metro watches only this folder.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
