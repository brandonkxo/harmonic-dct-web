# Harmonic Drive DCT Tooth Calculator

A modern web application for calculating Double-Circular-Arc Common-Tangent (DCT) Flexspline tooth profiles for Harmonic Drive reducers.

Based on the research paper:
> Liu et al., "A Novel Rapid Design Framework for Tooth Profile of Double-Circular-Arc Common-Tangent Flexspline in Harmonic Reducers", Machines 2025, 13, 535.

## Features

- **Flexspline Tooth Profile**: Visualize the three-segment tooth profile (convex arc AB, tangent line BC, concave arc CD)
- **Conjugate Profile Solver**: Compute the conjugate circular spline tooth profile using the envelope condition
- **Full Gear Visualization**: Pattern teeth around the complete gear with fillets
- **Deformation Analysis**: View the flexspline under wave generator deformation
- **Radial Modification**: Apply radial modification to reduce interference
- **Longitudinal Modification**: Configure axial tooth profile variation
- **Export Capabilities**: Export curves to SLDCRV (SolidWorks) and DXF (AutoCAD) formats
- **Configuration Management**: Save and load parameter configurations

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone or navigate to the project directory
cd harmonic-dct-web

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
npm run build
npm start
```

## Project Structure

```
harmonic-dct-web/
├── src/
│   ├── app/                    # Next.js app router pages
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Main calculator page
│   │   └── globals.css         # Global styles
│   ├── components/
│   │   ├── ui/                 # Reusable UI components
│   │   ├── layout/             # Header, Footer components
│   │   ├── calculator/         # Calculator-specific components
│   │   └── tabs/               # Tab content components
│   ├── lib/
│   │   ├── equations/          # Ported mathematical equations
│   │   │   ├── core-profile.ts # Equations 1-13
│   │   │   ├── deformation.ts  # Equations 14-20
│   │   │   ├── kinematics.ts   # Equations 21-27
│   │   │   ├── transforms.ts   # Equations 28-30
│   │   │   ├── conjugate-solver.ts
│   │   │   ├── gear-builder.ts
│   │   │   └── smoothing.ts
│   │   ├── constants.ts        # Default values and configuration
│   │   └── utils.ts            # Helper functions
│   ├── store/
│   │   └── calculator-store.ts # Zustand state management
│   └── types/
│       └── index.ts            # TypeScript interfaces
├── public/                     # Static assets
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## Parameters

### Basic Geometry
- **m** (Module): Tooth size scaling factor in mm
- **z_f** (Flexspline Teeth): Number of flexspline teeth (typically 100)
- **z_c** (Circular Spline Teeth): Number of circular spline teeth (z_f + 2)
- **w0** (Max Deformation): Maximum radial deformation of wave generator in mm

### Convex Arc (AB)
- **r1**: Radius of convex arc
- **c1**: X-offset of arc center O1
- **e1**: Y-offset of arc center O1

### Concave Arc (CD)
- **r2**: Radius of concave arc
- **c2**: X-offset of arc center O2
- **e2**: Y-offset of arc center O2

### Tooth Heights
- **ha**: Addendum height (tooth tip above pitch circle)
- **hf**: Dedendum height (tooth root below pitch circle)

### Wall Coefficients
- **mu_s**: Ring wall coefficient (s = mu_s * m * z_f)
- **mu_t**: Cup wall coefficient (t = mu_t * s)

## Keyboard Shortcuts

- **Ctrl+Z**: Undo
- **Ctrl+Y** / **Ctrl+Shift+Z**: Redo
- **Ctrl+1-6**: Switch between tabs

## Technologies

- [Next.js 14](https://nextjs.org/) - React framework
- [React](https://reactjs.org/) - UI library
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Zustand](https://github.com/pmndrs/zustand) - State management
- [Plotly.js](https://plotly.com/javascript/) - Interactive plotting
- [Lucide React](https://lucide.dev/) - Icons

## License

MIT

## Acknowledgments

- Original Python implementation using DearPyGui
- Research paper authors for the mathematical framework
