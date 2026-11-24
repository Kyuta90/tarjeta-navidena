/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./public/**/*.{html,js}",
    "./server.js"
  ],
  theme: {
    extend: {
      fontFamily: {
        christmas: ['"Mountains of Christmas"', 'cursive'],
        'serif-festive': ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Outfit', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
