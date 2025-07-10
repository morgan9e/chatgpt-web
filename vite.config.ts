import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import dsv from '@rollup/plugin-dsv'

import purgecss from '@fullhuman/postcss-purgecss'
// import { visualizer } from 'rollup-plugin-visualizer';

const plugins = [
  svelte(),
  dsv()
  // visualizer({
  //   open: true,
  //   gzipSize: true,
  //   brotliSize: true,
  // }),
]

// https://vitejs.dev/config/
export default defineConfig(({ command, mode, ssrBuild }) => {
  // Only run PurgeCSS in production builds
  if (command === 'builds') {
    return {
      plugins,
      css: {
        postcss: {
          plugins: [
            purgecss({
              content: ['./**/*.html', './**/*.svelte'],
              safelist: ['pre', 'code']
            })
          ]
        }
      },
      base: './public'
    }
  } else {
    return {
      plugins
    }
  }
})
