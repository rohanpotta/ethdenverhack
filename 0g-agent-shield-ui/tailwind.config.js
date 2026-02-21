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
                    DEFAULT: '#08081A',
                    surface: '#12122A',
                    elevated: '#1A1A3A',
                    card: '#0E0E24',
                },
                primary: {
                    DEFAULT: '#7C3AED',
                    soft: '#A78BFA',
                },
                accent: {
                    gold: '#F5A623',
                    rose: '#EC4899',
                    commit: '#34D399',
                    store: '#818CF8',
                    retrieve: '#FBBF24',
                    danger: '#F43F5E',
                },
                text: {
                    primary: '#E8E4F0',
                    muted: '#6B6B8D',
                },
                border: {
                    DEFAULT: 'rgba(124, 58, 237, 0.15)',
                    strong: 'rgba(124, 58, 237, 0.3)',
                },
            },
            fontFamily: {
                sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
                mono: ['Geist Mono', 'JetBrains Mono', 'monospace'],
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
                    '0%': { boxShadow: '0 0 0 0 rgba(124, 58, 237, 0.4)' },
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
                    '0%': { boxShadow: 'inset 0 0 0 0 rgba(124, 58, 237, 0.3)' },
                    '50%': { boxShadow: 'inset 0 0 40px 10px rgba(124, 58, 237, 0.1)' },
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
