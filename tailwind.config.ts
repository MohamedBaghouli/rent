import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-out": {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        "slide-in-left": {
          "0%": {
            opacity: "0",
            transform: "translateX(-24px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateX(0)",
          },
        },
        "slide-in-right": {
          "0%": {
            opacity: "0",
            transform: "translateX(24px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateX(0)",
          },
        },
        "slide-in-up": {
          "0%": {
            opacity: "0",
            transform: "translateY(16px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        "slide-out-down": {
          "0%": {
            opacity: "1",
            transform: "translateY(0)",
          },
          "100%": {
            opacity: "0",
            transform: "translateY(16px)",
          },
        },
        "slide-out-right": {
          "0%": {
            opacity: "1",
            transform: "translateX(0)",
          },
          "100%": {
            opacity: "0",
            transform: "translateX(24px)",
          },
        },
        "scale-in-center": {
          "0%": {
            opacity: "0",
            transform: "scale(0.95)",
          },
          "100%": {
            opacity: "1",
            transform: "scale(1)",
          },
        },
        "scale-out-center": {
          "0%": {
            opacity: "1",
            transform: "scale(1)",
          },
          "100%": {
            opacity: "0",
            transform: "scale(0.95)",
          },
        },
        "bounce-soft": {
          "0%, 100%": {
            transform: "translateY(0)",
          },
          "50%": {
            transform: "translateY(-4px)",
          },
        },
        "pulse-glow": {
          "0%, 100%": {
            opacity: "1",
            boxShadow: "0 0 0 0 rgba(59, 130, 246, 0.7)",
          },
          "50%": {
            boxShadow: "0 0 0 10px rgba(59, 130, 246, 0)",
          },
        },
        "shimmer": {
          "0%": {
            backgroundPosition: "-1000px 0",
          },
          "100%": {
            backgroundPosition: "1000px 0",
          },
        },
        "shake": {
          "0%, 100%": {
            transform: "translateX(0)",
          },
          "10%, 30%, 50%, 70%, 90%": {
            transform: "translateX(-2px)",
          },
          "20%, 40%, 60%, 80%": {
            transform: "translateX(2px)",
          },
        },
      },
      animation: {
        "fade-in": "fade-in 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards",
        "fade-in-500": "fade-in 500ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards",
        "fade-out": "fade-out 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards",
        "slide-in-left": "slide-in-left 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards",
        "slide-in-right": "slide-in-right 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards",
        "slide-in-up": "slide-in-up 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards",
        "slide-out-down": "slide-out-down 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards",
        "slide-out-right": "slide-out-right 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards",
        "scale-in-center": "scale-in-center 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards",
        "scale-out-center": "scale-out-center 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards",
        "bounce-soft": "bounce-soft 600ms cubic-bezier(0.34, 1.56, 0.64, 1) infinite",
        "pulse-glow": "pulse-glow 2000ms cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "shimmer": "shimmer 2000ms linear infinite",
        "shake": "shake 400ms cubic-bezier(0.36, 0, 0.66, 1) forwards",
      },
      transitionDuration: {
        "250": "250ms",
        "350": "350ms",
        "400": "400ms",
        "500": "500ms",
      },
    },
  },
  plugins: [],
} satisfies Config;
