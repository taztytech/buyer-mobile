const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

module.exports = mergeConfig(defaultConfig, {
  resolver: {
    ...defaultConfig.resolver,
    // Pin Metro empty module to RN's runtime package.
    // This avoids stale/legacy references to external Metro wrappers.
    emptyModulePath: require.resolve('metro-runtime/src/modules/empty-module.js'),
  },
});
