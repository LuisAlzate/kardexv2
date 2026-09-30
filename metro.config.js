const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for .wasm files
config.resolver.sourceExts.push('wasm');
config.resolver.assetExts.push('wasm');

module.exports = config;
