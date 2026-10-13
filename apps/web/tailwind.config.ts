import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        salespilot: {
          navy: '#0F172A',
          blue: '#1E64FF',
          green: '#10B981'
        }
      }
    }
  },
  plugins: []
};

export default config;
