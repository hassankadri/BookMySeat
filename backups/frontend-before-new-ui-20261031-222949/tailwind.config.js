
/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			display: ['"Bricolage Grotesque"', 'Outfit', 'system-ui', 'sans-serif'],
  			body: ['"Instrument Sans"', 'Manrope', 'system-ui', 'sans-serif']
  		},
  		transitionTimingFunction: {
  			cine: 'cubic-bezier(.2,.7,.1,1)',
  			roll: 'cubic-bezier(.7,0,.2,1)'
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',

  			// Original 'How booking works' / FAQ palette (restored unchanged).
			hall: '#0b0b0d',
			panel: '#19191d',
			velvet: '#34343a',
			beam: '#f5f5f5',
			aisle: '#ededee',
			glow: '#bfbfc5',

			// BookMySeat homepage: strict monochrome
  			ink: {
  				DEFAULT: '#000000',
  				'1': '#0A0A0A',
  				'2': '#111111',
  				'3': '#1A1A1A'
  			},
  			line: {
  				DEFAULT: '#262626',
  				strong: '#3A3A3A'
  			},
  			mute: '#8A8A8A',
  			soft: '#BDBDBD',
  			paper: '#FFFFFF',

			// Cinema pages. Additive: keeps homepage and booking colors unchanged.
			void: '#080809',
			char: '#19191D',
			bone: '#F5F5F5',
			crimson: {
				DEFAULT: '#D71935',
				hot: '#EC2A47',
				deep: '#A8122A'
			},

  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		keyframes: {
  			'seat-hold': {
  				'0%, 100%': { opacity: '1' },
  				'50%': { opacity: '.55' }
  			},
			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'seat-hold': 'seat-hold 2.4s ease-in-out infinite',
			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
