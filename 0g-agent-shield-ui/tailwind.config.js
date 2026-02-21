/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                base: {
                    DEFAULT: '#090B10',
                    surface: '#11141C',
                    elevated: '#171B25',
                    card: '#0F131C',
                },
                primary: {
                    DEFAULT: '#4F8CFF',
                    soft: '#9ABEFF',
                },
                accent: {
                    gold: '#6EA8FF',
                    rose: '#8BB7FF',
                    commit: '#3E7BFA',
                    store: '#78ADFF',
                    retrieve: '#5F99FF',
                    danger: '#4D7FE0',
                    warn: '#6B9EFF',
                    agent: '#7BAEFF',
                },
                text: {
                    primary: '#E6EBF5',
                    muted: '#98A3B8',
                },
                border: {
                    DEFAULT: 'rgba(138, 162, 198, 0.22)',
                    strong: 'rgba(161, 185, 224, 0.34)',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['Inter', 'system-ui', 'sans-serif'],
            },
            borderRadius: {
                'sm': '3px',
                'DEFAULT': '6px',
                'md': '8px',
                'lg': '12px',
            },
            animation: {
                'pulse-ring': 'pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'fade-up': 'fade-up 0.5s ease-out forwards',
                'fade-in': 'fade-in 0.3s ease-out forwards',
                'scan-line': 'scan-line 2s linear infinite',
                'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
                'gradient-shift': 'gradient-shift 6s ease-in-out infinite',
                'heat-pulse': 'heat-pulse 0.8s ease-out',
                'slide-up': 'slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                'float': 'float-particle 8s ease-in-out infinite',
            },
            keyframes: {
                'pulse-ring': {
                    '0%': { boxShadow: '0 0 0 0 rgba(0, 102, 255, 0.4)' },
                    '70%': { boxShadow: '0 0 0 10px transparent' },
                    '100%': { boxShadow: '0 0 0 0 transparent' },
                },
                'fade-up': {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'fade-in': {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                'scan-line': {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(100%)' },
                },
                'glow-pulse': {
                    '0%, 100%': { opacity: '0.4' },
                    '50%': { opacity: '1' },
                },
                'gradient-shift': {
                    '0%, 100%': { backgroundPosition: '0% 50%' },
                    '50%': { backgroundPosition: '100% 50%' },
                },
                'heat-pulse': {
                    '0%': { boxShadow: 'inset 0 0 0 0 rgba(0, 102, 255, 0.3)' },
                    '50%': { boxShadow: 'inset 0 0 40px 10px rgba(0, 102, 255, 0.1)' },
                    '100%': { boxShadow: 'inset 0 0 0 0 transparent' },
                },
                'slide-up': {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'float-particle': {
                    '0%, 100%': { transform: 'translateY(0)', opacity: '0.3' },
                    '50%': { transform: 'translateY(-20px)', opacity: '0.6' },
                },
            },
        },
    },
    plugins: [],
}
