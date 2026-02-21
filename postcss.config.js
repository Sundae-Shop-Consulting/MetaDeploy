'use strict';

const autoprefixer = require('autoprefixer');

// Map SLDS brand-base blue scale to NPPatch teal scale.
// These are applied as literal string replacements in the compiled CSS
// so every hardcoded Salesforce blue becomes the corresponding teal.
const brandColorMap = {
  '#0176d3': '#05878a', // brand-base-50 (primary)
  '#1b96ff': '#1aa3a6', // brand-base-60
  '#014486': '#035052', // brand-base-30
  '#0b5cab': '#046b6d', // brand-base-40
  '#032d60': '#023638', // brand-base-20
  '#03234d': '#012a2b', // brand-base-15
  '#001639': '#001d1e', // brand-base-10
  '#57a3fd': '#4dbcbe', // brand-base-65
  '#78b0fd': '#6fcbcd', // brand-base-70
  '#aacbff': '#a0dfe0', // brand-base-80
  '#d8e6fe': '#d1f0f0', // brand-base-90
  '#eef4ff': '#e8f7f7', // brand-base-95
  '#418fde': '#05878a', // misc brand blue variant
};

/**
 * PostCSS plugin that replaces hardcoded SLDS blue hex values with teal.
 */
function recolorBrand() {
  // Build a single regex matching all source colors (case-insensitive)
  const pattern = new RegExp(
    Object.keys(brandColorMap).map((c) => c.replace('#', '#')).join('|'),
    'gi',
  );
  return {
    postcssPlugin: 'postcss-recolor-brand',
    Once(root) {
      root.walk((node) => {
        if (node.value) {
          node.value = node.value.replace(pattern, (match) => {
            return brandColorMap[match.toLowerCase()] || match;
          });
        }
        if (node.type === 'decl' && node.prop && node.prop.startsWith('--')) {
          // Also handle custom property declarations where the value
          // might contain hardcoded colors
          node.value = node.value.replace(pattern, (match) => {
            return brandColorMap[match.toLowerCase()] || match;
          });
        }
      });
    },
  };
}
recolorBrand.postcss = true;

module.exports = {
  plugins: [recolorBrand, autoprefixer({ cascade: false })],
};
