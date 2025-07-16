// Cloudflare Worker for Heena's Square Booking API
// This handles all Square API calls securely without exposing credentials

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

// Your Square credentials (store these in Cloudflare environment variables for production)
const SQUARE_ACCESS_TOKEN = 'EAAAl5v1dJMv0JXR15J_2LRYtKEYy2XV49QpRW4wZSBgraaU1QsvPler5LZ56Dbl';
const SQUARE_API_BASE = 'https://connect.squareup.com/v2';

// CORS headers to allow your website to access this worker
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Replace * with your domain in production
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

async function handleRequest(request) {
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(request.url);
  const path = url.pathname;

  try {
    // Route: Get locations
    if (path === '/api/locations') {
      const response = await fetch(`${SQUARE_API_BASE}/locations`, {
        headers: {
          'Square-Version': '2024-01-17',
          'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      return new Response(JSON.stringify(data), { headers: corsHeaders });
    }

    // Route: Search services
    if (path === '/api/services') {
      const response = await fetch(`${SQUARE_API_BASE}/catalog/list?types=ITEM`, {
        method: 'GET',
        headers: {
          'Square-Version': '2024-01-17',
          'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      return new Response(JSON.stringify(data), { headers: corsHeaders });
    }

    // Route: Get team members
    if (path === '/api/team-members') {
      const locationId = url.searchParams.get('location_id');
      const teamUrl = new URL(`${SQUARE_API_BASE}/bookings/team-member-booking-profiles`);
      if (locationId) {
        teamUrl.searchParams.append('location_id', locationId);
      }
      
      const response = await fetch(teamUrl.toString(), {
        headers: {
          'Square-Version': '2024-01-17',
          'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      return new Response(JSON.stringify(data), { headers: corsHeaders });
    }

    // Route: Search availability
    if (path === '/api/availability') {
      const body = await request.json();
      const response = await fetch(`${SQUARE_API_BASE}/bookings/availability/search`, {
        method: 'POST',
        headers: {
          'Square-Version': '2024-01-17',
          'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      return new Response(JSON.stringify(data), { headers: corsHeaders });
    }

    // Route: Create/search customers
    if (path === '/api/customers/search') {
      const body = await request.json();
      const response = await fetch(`${SQUARE_API_BASE}/customers/search`, {
        method: 'POST',
        headers: {
          'Square-Version': '2024-01-17',
          'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      return new Response(JSON.stringify(data), { headers: corsHeaders });
    }

    if (path === '/api/customers') {
      const body = await request.json();
      const response = await fetch(`${SQUARE_API_BASE}/customers`, {
        method: 'POST',
        headers: {
          'Square-Version': '2024-01-17',
          'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      return new Response(JSON.stringify(data), { headers: corsHeaders });
    }

    // Route: Create booking
    if (path === '/api/bookings') {
      const body = await request.json();
      
      // Extract idempotency_key from the request body if present
      const bookingData = {
        booking: body.booking
      };
      
      if (body.idempotency_key) {
        bookingData.idempotency_key = body.idempotency_key;
      }
      
      const response = await fetch(`${SQUARE_API_BASE}/bookings`, {
        method: 'POST',
        headers: {
          'Square-Version': '2024-01-17',
          'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bookingData)
      });
      const data = await response.json();
      return new Response(JSON.stringify(data), { headers: corsHeaders });
    }

    // Route: Get catalog items (with category and location filtering)
    if (path === '/api/catalog/list') {
      const types = url.searchParams.get('types');
      const locationId = url.searchParams.get('location_id');
      
      let catalogUrl = `${SQUARE_API_BASE}/catalog/list`;
      const params = new URLSearchParams();
      
      if (types) {
        params.append('types', types);
      }
      
      if (params.toString()) {
        catalogUrl += '?' + params.toString();
      }
      
      const response = await fetch(catalogUrl, {
        headers: {
          'Square-Version': '2024-01-17',
          'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      // Log detailed information about items
      if (data.objects) {
        const items = data.objects.filter(o => o.type === 'ITEM');
        console.log('Catalog API response:', {
          total_objects: data.objects.length,
          categories: data.objects.filter(o => o.type === 'CATEGORY').length,
          items: items.length,
          appointment_services: items.filter(item => item.item_data?.product_type === 'APPOINTMENTS_SERVICE').length,
          location_id: locationId
        });
        
        // Log first few items to see their structure
        items.slice(0, 3).forEach(item => {
          console.log('Item:', {
            name: item.item_data?.name,
            product_type: item.item_data?.product_type,
            category_ids: item.item_data?.category_ids,
            variations: item.item_data?.variations?.length || 0
          });
        });
      }
      
      // If location_id is specified, filter results
      if (locationId && data.objects) {
        console.log(`Filtering ${data.objects.length} objects for location ${locationId}`);
        
        data.objects = data.objects.filter(obj => {
          // Categories don't have location info, so include all
          if (obj.type === 'CATEGORY') return true;
          
          // For items, check if they're available at the location
          if (obj.type === 'ITEM') {
            // If present_at_all_locations is true, check if it's NOT in absent_at_location_ids
            if (obj.present_at_all_locations === true) {
              return !obj.absent_at_location_ids || !obj.absent_at_location_ids.includes(locationId);
            }
            
            // If present_at_all_locations is false, check if it IS in present_at_location_ids
            if (obj.present_at_all_locations === false) {
              return obj.present_at_location_ids && obj.present_at_location_ids.includes(locationId);
            }
            
            // Default to true if location data is not set
            return true;
          }
          
          return true;
        });
        
        console.log(`After filtering: ${data.objects.length} objects remain`);
      }
      
      return new Response(JSON.stringify(data), { headers: corsHeaders });
    }

    // Route: Get location booking profiles
    if (path === '/api/booking-profiles/locations') {
      const response = await fetch(`${SQUARE_API_BASE}/bookings/location-booking-profiles`, {
        headers: {
          'Square-Version': '2024-01-17',
          'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      return new Response(JSON.stringify(data), { headers: corsHeaders });
    }

    // Route: Get business booking profile
    if (path === '/api/booking-profiles/business') {
      const response = await fetch(`${SQUARE_API_BASE}/bookings/business-booking-profile`, {
        headers: {
          'Square-Version': '2024-01-17',
          'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      return new Response(JSON.stringify(data), { headers: corsHeaders });
    }

    // 404 for unknown routes
    return new Response(JSON.stringify({ error: 'Not found' }), { 
      status: 404, 
      headers: corsHeaders 
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
} 