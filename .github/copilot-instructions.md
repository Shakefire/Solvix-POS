# Solvix POS System - Copilot Instructions

This workspace contains a Point of Sales (POS) system built with Next.js and Electron. The application provides a complete desktop POS solution with product catalog, shopping cart, and invoice management.

## Project Overview

**Solvix POS System** is a desktop Point of Sales application that combines:
- Next.js for the UI framework
- React for component management  
- Electron for cross-platform desktop deployment
- Tailwind CSS for styling
- TypeScript for type-safe development

## Key Features

✅ Product Catalog with category filtering  
✅ Shopping Cart management  
✅ Multiple payment methods (Cash, Card, Check)  
✅ Automatic tax calculation (8%)  
✅ Receipt generation and printing  
✅ Dark theme optimized UI  
✅ Real-time cart updates  

## Project Structure

```
kbpos/
├── app/
│   ├── page.tsx              # Main POS interface & state management
│   ├── layout.tsx            # Root layout wrapper
│   └── globals.css           # Global styles
├── components/
│   ├── ProductCatalog.tsx    # Product display & filtering
│   ├── Cart.tsx              # Shopping cart component
│   └── Checkout.tsx          # Payment & receipt
├── main.js                   # Electron main process
├── preload.js                # Electron preload script
├── next.config.js            # Next.js config for static export
├── tsconfig.json             # TypeScript configuration
├── tailwind.config.ts        # Tailwind CSS configuration
├── postcss.config.js         # PostCSS configuration
└── package.json              # Dependencies & scripts
```

## Available Scripts

```bash
npm run dev         # Start Next.js development server
npm start           # Launch Electron application
npm run build       # Build Next.js for production
npm run pack        # Build and package as .exe installer
```

## Development Workflow

### 1. Development Mode

Terminal 1 - Start Next.js dev server:
```bash
npm run dev
```

Terminal 2 - Start Electron:
```bash
npm start
```

The app will open at `http://localhost:3000` with hot reload enabled.

### 2. Build for Production

```bash
npm run pack
```

This creates a Windows installer at `dist/Solvix POS Setup 0.1.0.exe`

## Core Components

### ProductCatalog
- Displays products in a 2-column grid
- Category filtering (All, Electronics, Groceries, Clothing)
- 15 sample products included
- Quick "Add" button for each product

### Cart  
- Shows all items in shopping cart
- Quantity controls (+/- buttons)
- Remove item functionality
- Real-time subtotal calculation
- Item count display

### Checkout
- Payment method selection (Cash, Card, Check)
- Cash amount input with change calculation
- Tax calculation (8% standard rate)
- Receipt preview and printing
- Transaction completion

## Configuration

All configuration is in place:
- **tsconfig.json**: TypeScript strict mode enabled
- **tailwind.config.ts**: Dark theme optimized
- **next.config.js**: Static export enabled for Electron
- **main.js**: Electron app configuration (1200x800 window)

## Dependencies

Main packages:
- `next`: 13.5.6
- `react`: 18.2.0
- `electron`: 26.0.0
- `electron-builder`: 24.6.4
- `tailwindcss`: 3.4.1
- `typescript`: 5.3.3

## Common Tasks

### Add a new product
Edit `components/ProductCatalog.tsx` - add to the `PRODUCTS` array

### Change tax rate
Edit `components/Checkout.tsx` - modify `TAX_RATE` constant

### Customize styling
Edit `app/globals.css` or component Tailwind classes

### Modify Electron window
Edit `main.js` - adjust BrowserWindow constructor properties

## Development Notes

- Uses TypeScript for type safety
- React hooks for state management
- Client-side only (no backend API needed)
- Static export compatible with Electron
- Development mode opens Chrome DevTools automatically

## Building & Deployment

### Windows Installer

```bash
npm run pack
```

Creates: `dist/Solvix POS Setup 0.1.0.exe`

The installer can be distributed and installed like any Windows application.

## Troubleshooting

**npm install fails**: Use `npm install --force` on Windows
**Port 3000 in use**: Change in `next.config.js` or use different port
**Electron won't start**: Ensure Next.js build completes first with `npm run build`
**Styling not loading**: Clear `.next` folder and rebuild

## Next Steps

- Customize product inventory
- Integrate with a backend database
- Add user authentication
- Implement sales reporting
- Add barcode scanning
- Multi-language support
