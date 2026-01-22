module.exports = function (api) {
  api.cache(true);
  
  const plugins = [
    [
      'module-resolver',
      {
        root: ['./src'],
        extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
        alias: {
          '@': './src',
          '@components': './src/components',
          '@screens': './src/screens',
          '@navigation': './src/navigation',
          '@services': './src/services',
          '@hooks': './src/hooks',
          '@utils': './src/utils',
          '@constants': './src/constants',
          '@types': './src/types',
          '@store': './src/store',
          '@theme': './src/theme',
          '@assets': './src/assets',
        },
      },
    ],
  ];

  // Remove console.log, console.info, console.debug in production builds
  // Keep console.error and console.warn for production debugging
  // Check NODE_ENV or BABEL_ENV for production builds
  const isProduction = 
    process.env.NODE_ENV === 'production' || 
    process.env.BABEL_ENV === 'production';
  
  if (isProduction) {
    plugins.push([
      'transform-remove-console',
      {
        exclude: ['error', 'warn'],
      },
    ]);
  }

  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
