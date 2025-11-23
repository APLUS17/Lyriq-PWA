/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                brand: ['Inter', 'sans-serif'],
                mono: ['Roboto Mono', 'monospace'],
            },
        },
    },
    plugins: [],
}
