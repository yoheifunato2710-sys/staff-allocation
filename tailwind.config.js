/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './main.jsx',
    './App.jsx',
    './components/**/*.{js,jsx}',
    './context/**/*.{js,jsx}',
    './screens/**/*.{js,jsx}',
    './constants/**/*.{js,jsx}',
    './utils/**/*.{js,jsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
