/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./**/*.{ts,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                ensi: {
                    blue:        '#003A70',
                    'blue-mid':  '#005FA3',
                    'blue-light':'#E8F1F9',
                    gray:        '#4A5568',
                    'gray-light':'#F7F9FC',
                    white:       '#FFFFFF',
                    accent:      '#F5A623',
                    red:         '#C62828',
                    green:       '#2E7D52',
                },
            },
        },
    },
    plugins: [],
}
