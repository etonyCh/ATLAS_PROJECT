import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
          container: "var(--ds-primary-container)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
          container: "var(--ds-secondary-container)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
          container: "var(--ds-tertiary-container)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        success: {
          DEFAULT: "var(--success)",
          foreground: "var(--success-foreground)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          foreground: "var(--warning-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        outline: {
          DEFAULT: "var(--ds-outline)",
          variant: "var(--ds-outline-variant)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar-background)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
        /* Stitch Design System - Surface Colors */
        surface: {
          DEFAULT: "var(--ds-surface)",
          dim: "var(--ds-surface-dim)",
          container: "var(--ds-surface-container)",
          "container-high": "var(--ds-surface-container-high)",
          "container-highest": "var(--ds-surface-container-highest)",
        },
        /* Legacy Atlas variables - maintained for compatibility */
        "atlas-blue-dark": "var(--atlas-blue-dark)",
        "atlas-blue-mid": "var(--atlas-blue-mid)",
        "atlas-blue-light": "var(--atlas-blue-light)",
        "atlas-blue-pale": "var(--atlas-blue-pale)",
        "atlas-gray-dark": "var(--ds-on-surface)",
        "atlas-gray-900": "var(--atlas-gray-900)",
        "atlas-gray-800": "var(--atlas-gray-800)",
        "atlas-success": "var(--success)",
        "atlas-warning": "var(--warning)",
        "atlas-danger": "var(--destructive)",
      },
      fontFamily: {
        sans: ["Inter", "Google Sans Text", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        arabic: ["Noto Naskh Arabic", "IBM Plex Sans Arabic", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "Roboto Mono", "monospace"],
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        sm: "0.5rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.5rem",
        "2xl": "1.5rem",
        full: "9999px",
        /* Material Design 3 shape tokens */
        "ds-none": "0rem",
        "ds-xs": "0.25rem",
        "ds-sm": "0.5rem",
        "ds-md": "0.75rem",
        "ds-lg": "1rem",
        "ds-xl": "1.5rem",
        "ds-full": "9999px",
      },
    },
  },
};

export default config;
