module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-worklets/plugin must remain the LAST plugin in the list.
    // It powers Reanimated 4 worklet extraction for the physics-based spring
    // animations used across ChipApp (swipe-to-reply, reaction popups, etc).
    plugins: ['react-native-worklets/plugin'],
  };
};
