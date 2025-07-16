# Heena's Beauty Salon Booking System

Square API-powered booking system for Heena's Beauty Salon.

## Files

- `square-heenas.html` - Main HTML file to embed in Webflow
- `heenas.css` - Styling 
- `heenasscript.js` - Main booking logic
- `square-cloudflare-worker.js` - Cloudflare Worker proxy for Square API

## Usage

### Option 1: Using jsDelivr CDN (Recommended)

```html
<!-- In your Webflow site -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/YOUR_GITHUB_USERNAME/heenas-booking@main/heenas.css">
<script src="https://cdn.jsdelivr.net/gh/YOUR_GITHUB_USERNAME/heenas-booking@main/heenasscript.js"></script>
```

### Option 2: Direct embedding

Copy the contents of the files directly into your Webflow custom code sections.

## Setup

1. Deploy the Cloudflare Worker from `square-cloudflare-worker.js`
2. Update the `apiUrl` in `heenasscript.js` if needed
3. Add the HTML structure from `square-heenas.html` to your Webflow page
4. Include the CSS and JS files

## Features

- Location selection
- Service categories with intelligent variation handling
- Staff filtering by service capability
- Real-time availability checking
- Mobile responsive design 