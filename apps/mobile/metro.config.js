// Standard Expo Metro config. The mobile app is a standalone project (not part
// of the pnpm workspace), so no monorepo resolver tweaks are needed.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
