const SQUARE_CONFIG = {
    apiUrl: 'https://heenas-booking.kevin-cdc.workers.dev',
    locationId: 'LTP465QT6TYG1',
    locations: {
        'L9JENF1S82C06': 'Heenas Astoria (Main) - 30-58 Steinway St',
        'LVZ80KHZCGP9P': 'Kips Bay - 425 2nd Avenue',
        'LTP465QT6TYG1': 'Midtown East - 1059 2nd Ave',
        'LWRPFMGVJDPAP': 'Astoria - 30-58 Steinway Street'
    }
};
let appState = {
    currentStep: 1,
    selectedLocation: null,
    selectedCategory: null,
    selectedService: null,
    selectedStaff: null,
    selectedDate: null,
    selectedTime: null,
    customerInfo: {},
    availableCategories: [],
    categories: [], // Store categories from processServiceData
    allServices: [],
    availableServices: [],
    availableStaff: [],
    availableSlots: {},
    selectedVariation: null,
    locationProfiles: {}
};
async function init() {
    await loadLocationProfiles();
    renderLocationSelection();
}
async function loadLocationProfiles() {
    try {
        const response = await fetch(`${SQUARE_CONFIG.apiUrl}/api/booking-profiles/locations`);
        if (response.ok) {
            const data = await response.json();
            if (data.location_booking_profiles) {
                data.location_booking_profiles.forEach(profile => {
                    appState.locationProfiles[profile.location_id] = profile;
                });
            }
        }
    } catch (error) {
        console.error('Error loading location profiles:', error);
    }
}
function updateSteps() {
    document.querySelectorAll('.step').forEach((step, index) => {
        const stepNum = index + 1;
        step.classList.remove('active', 'completed');
        if (stepNum === appState.currentStep) {
            step.classList.add('active');
        } else if (stepNum < appState.currentStep) {
            step.classList.add('completed');
        }
    });
}
function renderLocationSelection() {
    const container = document.getElementById('content-container');
    const bookableLocations = Object.entries(SQUARE_CONFIG.locations).filter(([id, name]) => {
        const profile = appState.locationProfiles[id];
        return !profile || profile.online_booking_enabled !== false;
    });
    if (bookableLocations.length === 0) {
        container.innerHTML = `
            <h2>No Online Booking Available</h2>
            <p>Online booking is not currently available. Please call the salon to book an appointment.</p>
        `;
        return;
    }
    container.innerHTML = `
        <h2>Select Location</h2>
        <div class="services-grid">
            ${bookableLocations.map(([id, name]) => {
                const isEnabled = !appState.locationProfiles[id] || appState.locationProfiles[id].online_booking_enabled;
                return `
                    <div class="service-card ${appState.selectedLocation === id ? 'selected' : ''} ${!isEnabled ? 'disabled' : ''}" 
                         onclick="${isEnabled ? `selectLocation('${id}')` : ''}">
                        <div class="service-name">${name.split(' - ')[0]}</div>
                        <div class="service-description">${name.split(' - ')[1]}</div>
                        ${!isEnabled ? '<div class="service-description" style="color: var(--error);">Online booking not available</div>' : ''}
                    </div>
                `;
            }).join('')}
        </div>
        <div class="buttons-container">
            <button class="btn btn-primary" onclick="proceedFromLocation()">
                Continue
            </button>
        </div>
    `;
}
function selectLocation(locationId) {
    appState.selectedLocation = locationId;
    SQUARE_CONFIG.locationId = locationId;
    renderLocationSelection();
}
function proceedFromLocation() {
    loadCategories();
}
async function loadCategories() {
    showLoading();
    
    try {
        const response = await fetch(`${SQUARE_CONFIG.apiUrl}/api/catalog/list?types=CATEGORY,ITEM&location_id=${appState.selectedLocation}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to load catalog: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Use the intelligent processing function
        const { services, categories } = processServiceData(data);
        
        // Store the processed services
        appState.allServices = services;
        appState.categories = categories; // Store categories for use in selectCategory
        
        // Render categories
        const container = document.getElementById('content-container');
        let html = '<h2>Select a Category</h2><div class="services-grid">';
        
        categories.forEach(category => {
            // Count services in this category
            const serviceCount = services.filter(s => s.categoryId === category.id).length;
            
            html += `
                <div class="service-card" 
                     data-category-id="${category.id}"
                     data-category-name="${category.name.replace(/"/g, '&quot;')}">
                    <div class="service-name">${category.name}</div>
                    <div class="service-description">${serviceCount} services available</div>
                </div>
            `;
        });
        
        html += '</div>';
        
        // Add back button if multiple locations are available
        if (appState.locations && appState.locations.length > 1) {
            html += `
                <div class="buttons-container">
                    <button class="btn btn-secondary" onclick="previousStep()">Back to Location</button>
                </div>
            `;
        }
        
        container.innerHTML = html;
        
        // Add click handlers to category cards
        const categoryCards = container.querySelectorAll('.service-card[data-category-id]');
        categoryCards.forEach(card => {
            card.addEventListener('click', function() {
                const categoryId = this.getAttribute('data-category-id');
                const categoryName = this.getAttribute('data-category-name');
                selectCategory(categoryId, categoryName);
            });
        });
        
    } catch (error) {
        console.error('Error loading categories:', error);
        showError('Failed to load categories. Please try again.');
    } finally {
        hideLoading();
    }
}
function getCategoryIcon(categoryName) {
    return '';
}
function getFallbackCategories() {
    return [
        { id: 'all-services', name: 'All Services', icon: '' },
        { id: 'threading', name: 'Threading', icon: '' },
        { id: 'waxing', name: 'Waxing', icon: '' },
        { id: 'facials', name: 'Facials', icon: '' },
        { id: 'body-treatments', name: 'Body Treatments', icon: '' },
        { id: 'beauty-services', name: 'Beauty Services', icon: '' }
    ];
}
function renderCategories() {
    const container = document.getElementById('content-container');
    container.innerHTML = `
        <h2>Select Service Category</h2>
        <div class="services-grid">
            ${appState.availableCategories.map(category => {
                return `
                    <div class="service-card ${appState.selectedCategory?.id === category.id ? 'selected' : ''}" 
                         data-category-id="${category.id}"
                         data-category-name="${category.name.replace(/"/g, '&quot;')}">
                        <div class="service-name">${category.name}</div>
                    </div>
                `;
            }).join('')}
        </div>
        <div class="buttons-container">
            <button class="btn btn-secondary" onclick="goBackToLocation()">Back</button>
            <button class="btn btn-primary" onclick="proceedFromCategory()" 
                    ${!appState.selectedCategory ? 'disabled' : ''}>
                Continue
            </button>
        </div>
    `;
    
    // Add click handlers to category cards
    const categoryCards = container.querySelectorAll('.service-card[data-category-id]');
    categoryCards.forEach(card => {
        card.addEventListener('click', function() {
            const categoryId = this.getAttribute('data-category-id');
            const categoryName = this.getAttribute('data-category-name');
            selectCategory(categoryId, categoryName);
        });
    });
}
function selectCategory(categoryId, categoryName) {
    appState.selectedCategory = categoryId;
    appState.currentStep = 2;
    updateSteps();
    
    // Filter services by category ID (not name, since names might be duplicated)
    const categoryServices = appState.allServices.filter(service => 
        service.categoryId === categoryId || (categoryId === 'other-services' && !service.categoryId)
    );
    
    // Find the category object to get the original name
    const category = appState.categories.find(c => c.id === categoryId);
    const displayName = category ? category.originalName || category.name : categoryName;
    
    renderCategoryServices(displayName, categoryServices);
}

function renderCategoryServices(categoryName, services) {
    const container = document.getElementById('content-container');
    
    let html = `
        <h2>${categoryName}</h2>
        <div class="services-grid">
    `;
    
    services.forEach(service => {
        const price = (service.price / 100).toFixed(2);
        const duration = Math.floor(service.duration / 60000);
        
        html += `
            <div class="service-card" onclick="selectService('${service.id}')">
                <div class="service-name">${service.name}</div>
                <div class="service-duration">${duration} minutes</div>
                <div class="service-price">$${price}</div>
                ${service.description ? `<div class="service-description">${service.description}</div>` : ''}
            </div>
        `;
    });
    
    html += '</div>';
    html += '<div class="buttons-container"><button class="btn btn-secondary" onclick="loadCategories()">Back</button></div>';
    
    container.innerHTML = html;
}
function goBackToLocation() {
    renderLocationSelection();
}
function proceedFromCategory() {
    appState.currentStep = 2;
    updateSteps();
    loadServices();
}
function getServiceCategory(serviceName) {
    const name = serviceName.toLowerCase();
    if (name.includes('eyebrow') || name.includes('chin') || name.includes('lip') || 
        name.includes('forehead') || name.includes('sides') || name.includes('threading')) {
        return 'Threading';
    }
    if (name.includes('wax') || name.includes('bikini') || name.includes('brazilian') || 
        name.includes('underarm') || name.includes('leg') || name.includes('arm') || 
        name.includes('chest') || name.includes('back') || name.includes('stomach') || 
        name.includes('shoulder')) {
        return 'Women\'s Waxing';
    }
    if (name.includes('facial') || name.includes('microdermabrasion') || name.includes('acne') || 
        name.includes('collagen') || name.includes('diamond') || name.includes('gold') || 
        name.includes('seaweed') || name.includes('european')) {
        return 'Facials';
    }
    if (name.includes('abhyanga') || name.includes('shiro') || name.includes('basti') || 
        name.includes('ayurvedic') || name.includes('panchakarma') || name.includes('pada')) {
        return 'Ayurvedic Treatments';
    }
    if (name.includes('body wrap') || name.includes('scalp massage') || name.includes('ear candling')) {
        return 'Body Care';
    }
    if (name.includes('henna')) {
        return 'Henna';
    }
    if (name.includes('eyelash') || name.includes('eyebrow tint')) {
        return 'Eyelash Extensions';
    }
    return null;
}
async function loadServices() {
    showLoading(true);
    console.log('Filtering services for category:', appState.selectedCategory);
    try {
        if (appState.allServices && appState.allServices.length > 0) {
            console.log('Using cached services from category load');
            console.log(`Total services available: ${appState.allServices.length}`);
            let filteredServices = appState.allServices;
            if (appState.selectedCategory.id === 'all-services') {
                console.log('Showing all services (no category filter)');
                filteredServices = appState.allServices;
            } else {
                console.log(`Filtering for category: ${appState.selectedCategory.name}`);
                filteredServices = appState.allServices.filter(service => {
                    const serviceName = service.item_data?.name || '';
                    const mappedCategory = getServiceCategory(serviceName);
                    const belongsToCategory = mappedCategory === appState.selectedCategory.name;
                    if (belongsToCategory) {
                        console.log(`Service "${serviceName}" belongs to category ${mappedCategory}`);
                    }
                    return belongsToCategory;
                });
                console.log(`Found ${filteredServices.length} services in this category`);
            }
            appState.availableServices = processServices(filteredServices);
            console.log(`Processed ${appState.availableServices.length} bookable services in category`);
            if (appState.availableServices.length === 0) {
                console.warn('No services found in this category');
                appState.availableServices = [];
            }
            renderServices();
        } else {
            console.log('Fetching fresh catalog data...');
            const response = await fetch(`${SQUARE_CONFIG.apiUrl}/api/catalog/list?types=ITEM&location_id=${appState.selectedLocation}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            console.log('Response status:', response.status);
            if (!response.ok) {
                const errorData = await response.json();
                console.error('Square API Error:', errorData);
                throw new Error(errorData.errors?.[0]?.detail || 'API request failed');
            }
            const data = await response.json();
            console.log('Square API Response:', data);
            if (data.objects && data.objects.length > 0) {
                console.log(`Found ${data.objects.length} items from Square`);
                const appointmentServices = data.objects.filter(obj => 
                    obj.type === 'ITEM' && 
                    obj.item_data && 
                    obj.item_data.product_type === 'APPOINTMENTS_SERVICE'
                );
                console.log(`Found ${appointmentServices.length} appointment service items`);
                if (appointmentServices.length > 0) {
                    appState.availableServices = processServices(appointmentServices);
                    console.log(`Processed ${appState.availableServices.length} bookable services`);
                    if (appState.availableServices.length === 0) {
                        console.warn('Services found but none are bookable online');
                        console.log('To fix: In Square Dashboard, edit each service and enable "Bookable by Customers Online"');
                        appState.availableServices = [];
                    }
                } else {
                    console.warn('No appointment services found');
                    console.log('Items found:', data.objects.map(o => ({ name: o.item_data?.name, type: o.item_data?.product_type })));
                    appState.availableServices = [];
                }
                renderServices();
            } else {
                console.warn('No items returned from Square API');
                if (data.errors) {
                    console.error('Square API errors:', data.errors);
                }
                console.log('Response:', data);
                console.log('To fix this:');
                console.log('1. Go to Square Dashboard > Items');
                console.log('2. Create new items');
                console.log('3. Set Product Type to "Appointments Service"');
                console.log('4. Enable "Bookable by Customers Online"');
                appState.availableServices = [];
                renderServices();
            }
        }
            } catch (error) {
            console.error('Error loading services:', error);
            appState.availableServices = [];
            renderServices();
        } finally {
        showLoading(false);
    }
}
function processServices(objects) {
    const services = [];
    objects.forEach(obj => {
        if (obj.type === 'ITEM' && obj.item_data) {
            const item = obj.item_data;
            if (item.variations && item.variations.length > 0) {
                item.variations.forEach(variation => {
                    if (variation.item_variation_data) {
                        const isBookable = variation.item_variation_data.available_for_booking === true ||
                                         item.product_type === 'APPOINTMENTS_SERVICE';
                        if (isBookable) {
                            const variationName = variation.item_variation_data.name || '';
                            const itemName = item.name || '';
                            let displayName = variationName || itemName;
                            
                            const genericVariationNames = ['regular', 'standard', 'basic', 'normal'];
                            const isGenericVariation = genericVariationNames.includes(variationName.toLowerCase());
                            
                            const hasDescriptiveVariation = variationName && 
                                !isGenericVariation && 
                                !variationName.toLowerCase().includes(itemName.toLowerCase()) &&
                                !itemName.toLowerCase().includes(variationName.toLowerCase());
                            
                            if (item.variations.length > 1) {
                                if (isGenericVariation || !variationName) {
                                    displayName = itemName;
                                } else if (hasDescriptiveVariation) {
                                    displayName = `${itemName} - ${variationName}`;
                                } else {
                                    displayName = variationName;
                                }
                            }
                            
                            services.push({
                                id: variation.id,
                                name: displayName,
                                description: item.description || '',
                                price: variation.item_variation_data.price_money 
                                    ? variation.item_variation_data.price_money.amount / 100 
                                    : 0,
                                duration: variation.item_variation_data.service_duration 
                                    ? variation.item_variation_data.service_duration / 60000 
                                    : 60,
                                version: variation.version,
                                itemId: obj.id,
                                categoryIds: item.category_ids || [],
                                parentName: itemName,
                                variationName: variationName
                            });
                        }
                    }
                });
            } else if (item.product_type === 'APPOINTMENTS_SERVICE') {
                services.push({
                    id: obj.id,
                    name: item.name,
                    description: item.description || '',
                    price: 0,
                    duration: 60,
                    version: obj.version,
                    itemId: obj.id,
                    categoryIds: item.category_ids || []
                });
            }
        }
    });
    
    const nameCount = {};
    services.forEach(service => {
        nameCount[service.name] = (nameCount[service.name] || 0) + 1;
    });
    
    const duplicateNames = Object.keys(nameCount).filter(name => nameCount[name] > 1);
    
    services.forEach(service => {
        if (duplicateNames.includes(service.name)) {
            const hasDifferentPrices = services.filter(s => s.name === service.name)
                .some(s => s.price !== service.price);
            
            if (hasDifferentPrices) {
                service.displayName = `${service.name} ($${service.price})`;
            } else if (service.duration) {
                service.displayName = `${service.name} (${service.duration} min)`;
            } else {
                service.displayName = service.name;
            }
        } else {
            service.displayName = service.name;
        }
    });
    
    console.log(`Processed ${services.length} bookable services from ${objects.length} items`);
    return services;
}

function processServiceData(catalogData) {
    const services = [];
    const categoriesMap = new Map();
    
    if (!catalogData.objects) return { services: [], categories: [] };
    
    // First, build a map of categories from Square
    catalogData.objects.forEach(obj => {
        if (obj.type === 'CATEGORY' && obj.category_data) {
            // Handle duplicate category names by using ID as key
            categoriesMap.set(obj.id, {
                id: obj.id,
                name: obj.category_data.name
            });
        }
    });
    
    console.log('Categories from Square:', Array.from(categoriesMap.values()));
    
    // Process items and their variations
    catalogData.objects.forEach(obj => {
        if (obj.type === 'ITEM' && obj.item_data) {
            const item = obj.item_data;
            
            // Skip items that aren't appointment services
            if (item.product_type !== 'APPOINTMENTS_SERVICE') return;
            
            // Get the category from reporting_category
            let categoryId = null;
            let categoryName = 'Other Services';
            
            if (item.reporting_category && item.reporting_category.id) {
                categoryId = item.reporting_category.id;
                const category = categoriesMap.get(categoryId);
                if (category) {
                    categoryName = category.name;
                }
            }
            
            if (item.variations && item.variations.length > 0) {
                item.variations.forEach(variation => {
                    const varData = variation.item_variation_data;
                    
                    // Skip if not available for booking
                    if (!varData.available_for_booking) return;
                    
                    // Smart naming logic based on actual data patterns
                    let displayName = item.name;
                    const varName = varData.name.toLowerCase();
                    const itemNameLower = item.name.toLowerCase();
                    
                    // Rules for display name:
                    // 1. If variation name is "Regular", just use the item name
                    if (varName === 'regular') {
                        displayName = item.name;
                    }
                    // 2. If variation name already contains the item name, use variation name only
                    else if (varName.includes(itemNameLower) || itemNameLower.includes(varName)) {
                        displayName = varData.name;
                    }
                    // 3. For waxing variations (Regular, Hard wax, Sugaring), show as "Item Name (Method)"
                    else if (['regular', 'hard wax', 'sugaring', 'european wax ( hard wax)', 'sensitive wax'].includes(varName)) {
                        displayName = varName === 'regular' ? item.name : `${item.name} (${varData.name})`;
                    }
                    // 4. For body part variations (Full/Half), show as variation name
                    else if (['full arms', 'half arm', 'full legs', 'lower legs', 'upper legs'].includes(varName)) {
                        displayName = varData.name;
                    }
                    // 5. Otherwise, combine them intelligently
                    else {
                        displayName = `${item.name} - ${varData.name}`;
                    }
                    
                    const service = {
                        id: variation.id,
                        itemId: obj.id,
                        name: displayName,
                        originalItemName: item.name,
                        originalVariationName: varData.name,
                        description: item.description || '',
                        price: varData.price_money ? varData.price_money.amount : 0,
                        currency: varData.price_money ? varData.price_money.currency : 'USD',
                        duration: varData.service_duration || 0,
                        teamMemberIds: varData.team_member_ids || [],
                        presentAtAllLocations: obj.present_at_all_locations || false,
                        presentAtLocationIds: obj.present_at_location_ids || [],
                        absentAtLocationIds: obj.absent_at_location_ids || [],
                        category: categoryName,
                        categoryId: categoryId
                    };
                    
                    services.push(service);
                });
            }
        }
    });
    
    // Check for duplicate names and add differentiators
    const nameGroups = {};
    services.forEach(service => {
        if (!nameGroups[service.name]) {
            nameGroups[service.name] = [];
        }
        nameGroups[service.name].push(service);
    });
    
    // For duplicates, add category, price or duration to differentiate
    Object.entries(nameGroups).forEach(([name, group]) => {
        if (group.length > 1) {
            // Check if they're in different categories
            const uniqueCategories = [...new Set(group.map(s => s.category))];
            
            if (uniqueCategories.length > 1) {
                // Different categories - add category to name
                group.forEach(service => {
                    service.displayName = service.name;
                    service.name = `${service.name} (${service.category})`;
                });
            } else {
                // Same category - check if different prices or durations
                const uniquePrices = [...new Set(group.map(s => s.price))];
                const uniqueDurations = [...new Set(group.map(s => s.duration))];
                
                if (uniquePrices.length > 1 || uniqueDurations.length > 1) {
                    group.forEach(service => {
                        service.displayName = service.name;
                        const price = (service.price / 100).toFixed(0);
                        const duration = service.duration / 60000;
                        service.name = `${service.name} ($${price}, ${duration}min)`;
                    });
                }
            }
        }
    });
    
    // Sort services by category and then by name
    services.sort((a, b) => {
        if (a.category !== b.category) {
            return a.category.localeCompare(b.category);
        }
        return a.name.localeCompare(b.name);
    });
    
    // Get unique categories that actually have services
    const usedCategoryIds = new Set(services.map(s => s.categoryId).filter(id => id !== null));
    const uniqueCategories = [];
    const seenCategoryNames = new Set();
    
    Array.from(categoriesMap.values()).forEach(cat => {
        if (usedCategoryIds.has(cat.id)) {
            // If we've seen this category name before, add the ID to make it unique
            let uniqueName = cat.name;
            if (seenCategoryNames.has(cat.name)) {
                // Count services in this specific category
                const count = services.filter(s => s.categoryId === cat.id).length;
                uniqueName = `${cat.name} (${count} items)`;
            }
            seenCategoryNames.add(cat.name);
            
            uniqueCategories.push({
                id: cat.id,
                name: uniqueName,
                originalName: cat.name
            });
        }
    });
    
    // Add "Other Services" if there are uncategorized services
    if (services.some(s => s.categoryId === null)) {
        uniqueCategories.push({
            id: 'other-services',
            name: 'Other Services',
            originalName: 'Other Services'
        });
    }
    
    console.log('Processed services by category:', 
        uniqueCategories.map(cat => ({
            name: cat.name,
            count: services.filter(s => s.categoryId === cat.id || (s.categoryId === null && cat.id === 'other-services')).length
        }))
    );
    
    return { services, categories: uniqueCategories };
}
function renderServices() {
    const container = document.getElementById('content-container');
    if (appState.availableServices.length === 0) {
        container.innerHTML = `
            <h2>${appState.selectedCategory?.name} Services</h2>
            <div style="text-align: center; padding: 3rem; color: var(--gray);">
                <p style="font-size: 18px; margin-bottom: 1rem;">No services found in this category.</p>
                <p>Please select a different category or contact the salon directly.</p>
            </div>
            <div class="buttons-container">
                <button class="btn btn-secondary" onclick="previousStep()">Back to Categories</button>
            </div>
        `;
        return;
    }
    container.innerHTML = `
        <h2>${appState.selectedCategory?.name} Services</h2>
        <div class="services-grid">
            ${appState.availableServices.map(service => `
                <div class="service-card ${appState.selectedService?.id === service.id ? 'selected' : ''}" 
                     onclick="selectService('${service.id}')">
                    <div class="service-name">${service.displayName || service.name}</div>
                    <div class="service-duration">${service.duration} minutes</div>
                    <div class="service-price">$${service.price}</div>
                    ${service.description ? `<div class="service-description">${service.description}</div>` : ''}
                </div>
            `).join('')}
        </div>
        <div class="buttons-container">
            <button class="btn btn-secondary" onclick="previousStep()">Back</button>
            <button class="btn btn-primary" onclick="nextStep()" 
                    ${!appState.selectedService ? 'disabled' : ''}>
                Continue
            </button>
        </div>
    `;
}
function selectService(serviceId) {
    // Find the service from our processed services
    const service = appState.allServices.find(s => s.id === serviceId);
    
    if (!service) {
        showError('Service not found');
        return;
    }
    
    appState.selectedService = service;
    appState.currentStep = 3;
    updateSteps();
    loadStaff();
}
async function loadStaff() {
    showLoading(true);
    console.log('=== Loading Staff ===');
    console.log('Selected service:', appState.selectedService);
    console.log('Service team member IDs:', appState.selectedService?.teamMemberIds);
    
    try {
        const response = await fetch(`${SQUARE_CONFIG.apiUrl}/api/team-members?location_id=${appState.selectedLocation || SQUARE_CONFIG.locationId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Team response status:', response.status);
        const data = await response.json();
        console.log('All team members:', data.team_member_booking_profiles?.map(p => ({
            id: p.team_member_id,
            name: p.display_name,
            bookable: p.is_bookable
        })));
        
        if (data.team_member_booking_profiles && data.team_member_booking_profiles.length > 0) {
            // Filter team members who can perform this service
            let bookableStaff = data.team_member_booking_profiles.filter(profile => profile.is_bookable);
            console.log(`Found ${bookableStaff.length} bookable team members`);
            
            // Square's Catalog API doesn't return which team members can perform which services
            // The availability API will handle this filtering when we search for available times
            
            if (bookableStaff.length > 0) {
                appState.availableStaff = bookableStaff.map(profile => ({
                    id: profile.team_member_id,
                    name: profile.display_name || 'Team Member',
                    title: 'Beauty Specialist',
                    description: profile.description || ''
                }));
                
                // Add "Any Available" option if there's more than one staff member
                if (appState.availableStaff.length > 1) {
                    appState.availableStaff.unshift({
                        id: 'any',
                        name: 'Any Available',
                        title: 'First available specialist',
                        description: 'We\'ll assign the first available specialist'
                    });
                }
            } else {
                console.warn('No team members can perform this service at this location');
                appState.availableStaff = [];
            }
            
            renderStaff();
        } else {
            console.warn('No team members found.');
            appState.availableStaff = [];
            renderStaff();
        }
    } catch (error) {
        console.error('Error loading staff:', error);
        appState.availableStaff = [];
        renderStaff();
    } finally {
        showLoading(false);
    }
}
function renderStaff() {
    const container = document.getElementById('content-container');
    
    container.innerHTML = `
        <h2>Choose Your Specialist</h2>
        <div class="staff-grid">
            ${appState.availableStaff.map(staff => `
                <div class="staff-card ${appState.selectedStaff?.id === staff.id ? 'selected' : ''}" 
                     onclick="selectStaff('${staff.id}')">
                    <div class="staff-avatar">${staff.name.charAt(0)}</div>
                    <div class="staff-name">${staff.name}</div>
                    <div class="staff-title">${staff.title}</div>
                </div>
            `).join('')}
        </div>
        <div class="buttons-container">
            <button class="btn btn-secondary" onclick="previousStep()">Back</button>
            <button class="btn btn-primary" onclick="nextStep()" 
                    ${!appState.selectedStaff ? 'disabled' : ''}>
                Continue
            </button>
        </div>
    `;
}
function selectStaff(staffId) {
    console.log('=== Selecting Staff ===');
    console.log('Staff ID:', staffId);
    
    appState.selectedStaff = appState.availableStaff.find(s => s.id === staffId);
    console.log('Selected staff:', appState.selectedStaff);
    
    if (!appState.selectedStaff) {
        console.error('Staff not found:', staffId);
        showError('Staff member not found. Please try again.');
        return;
    }
    
    // Update UI to show selection
    const staffCards = document.querySelectorAll('.staff-card');
    staffCards.forEach(card => {
        card.classList.remove('selected');
    });
    
    const selectedCard = document.querySelector(`[onclick="selectStaff('${staffId}')"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
    }
    
    // Small delay to show selection before loading
    setTimeout(() => {
        console.log('Loading availability for staff:', appState.selectedStaff.name);
        appState.currentStep = 4;
        updateSteps();
        loadAvailability();
    }, 300);
}
async function loadAvailability() {
    showLoading(true);
    
    // Create proper date range - start from beginning of today
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    endDate.setHours(23, 59, 59, 999);
    
    try {
        const query = {
            filter: {
                start_at_range: {
                    start_at: startDate.toISOString(),
                    end_at: endDate.toISOString()
                },
                location_id: appState.selectedLocation || SQUARE_CONFIG.locationId,
                segment_filters: [
                    {
                        service_variation_id: appState.selectedService.id
                    }
                ]
            }
        };
        
        // Add team member filter if specific staff selected
        if (appState.selectedStaff && appState.selectedStaff.id !== 'any') {
            query.filter.segment_filters[0].team_member_id_filter = {
                any: [appState.selectedStaff.id]
            };
        }
        
        console.log('Searching availability with query:', JSON.stringify(query, null, 2));
        
        const response = await fetch(`${SQUARE_CONFIG.apiUrl}/api/availability`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query })
        });
        
        const data = await response.json();
        console.log('Availability response status:', response.status);
        console.log('Availability response data:', data);
        
        if (data.errors && data.errors.length > 0) {
            console.error('Square API errors:', data.errors);
            showError('Unable to load availability. Please try again.');
            return;
        }
        
        if (data.availabilities && data.availabilities.length > 0) {
            appState.availableSlots = processAvailability(data.availabilities);
            console.log(`Found ${Object.keys(appState.availableSlots).length} days with availability`);
            console.log('Available slots by date:', appState.availableSlots);
        } else {
            console.warn('No availabilities returned from Square');
            appState.availableSlots = {};
        }
        
        // Always render the date/time picker, even if no availability
        appState.currentStep = 4;
        updateSteps();
        renderDateTime();
    } catch (error) {
        console.error('Error loading availability:', error);
        appState.availableSlots = {};
        showError('Failed to load availability. Please try again.');
    } finally {
        showLoading(false);
    }
}
function processAvailability(availabilities) {
    const slots = {};
    availabilities.forEach(slot => {
        const date = new Date(slot.start_at);
        const dateKey = date.toISOString().split('T')[0];
        const timeKey = date.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });
        if (!slots[dateKey]) {
            slots[dateKey] = [];
        }
        slots[dateKey].push({
            time: timeKey,
            startAt: slot.start_at,
            locationId: slot.location_id,
            appointmentSegments: slot.appointment_segments
        });
    });
    return slots;
}
function renderDateTime() {
    const container = document.getElementById('content-container');
    const today = new Date();
    const currentMonth = appState.selectedDate ? new Date(appState.selectedDate) : today;
    container.innerHTML = `
        <h2>Select Date & Time</h2>
        <div class="calendar-container">
            <div class="date-picker">
                <div class="calendar-header">
                    <button class="calendar-nav" onclick="changeMonth(-1)">‹</button>
                    <h3>${currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
                    <button class="calendar-nav" onclick="changeMonth(1)">›</button>
                </div>
                <div class="calendar-grid">
                    ${generateCalendar(currentMonth)}
                </div>
            </div>
            <div class="time-slots">
                <h3>Available Times</h3>
                ${appState.selectedDate ? `
                    <div class="time-slots-grid">
                        ${generateTimeSlots(appState.selectedDate)}
                    </div>
                ` : '<p>Please select a date first</p>'}
            </div>
        </div>
        <div class="buttons-container">
            <button class="btn btn-secondary" onclick="previousStep()">Back</button>
            <button class="btn btn-primary" onclick="nextStep()" 
                    ${!appState.selectedDate || !appState.selectedTime ? 'disabled' : ''}>
                Continue
            </button>
        </div>
    `;
}
function generateCalendar(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time for accurate comparison
    
    let html = '';
    
    // Day headers
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach(day => {
        html += `<div style="font-weight: 600; font-size: 12px; text-align: center;">${day}</div>`;
    });
    
    // Empty cells for first week
    for (let i = 0; i < firstDay; i++) {
        html += '<div></div>';
    }
    
    // Calendar days
    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month, day);
        currentDate.setHours(0, 0, 0, 0);
        const dateStr = currentDate.toISOString().split('T')[0];
        const isPast = currentDate < today;
        const isToday = currentDate.toDateString() === today.toDateString();
        const hasSlots = appState.availableSlots && appState.availableSlots[dateStr] && appState.availableSlots[dateStr].length > 0;
        const isSelected = appState.selectedDate === dateStr;
        
        let classes = 'calendar-day';
        if (isPast) {
            classes += ' disabled';
        } else if (!hasSlots && Object.keys(appState.availableSlots || {}).length > 0) {
            // Only disable if we've loaded availability and this date has no slots
            classes += ' disabled';
        }
        if (isToday) classes += ' today';
        if (isSelected) classes += ' selected';
        
        const onclick = isPast ? '' : `onclick="selectDate('${dateStr}')"`;
        html += `<div class="${classes}" ${onclick}>${day}</div>`;
    }
    
    return html;
}
function generateTimeSlots(date) {
    const slots = appState.availableSlots[date] || [];
    if (slots.length === 0) {
        return '<p>No available times for this date</p>';
    }
    return slots.map(slot => `
        <div class="time-slot ${appState.selectedTime === slot.startAt ? 'selected' : ''}" 
             onclick="selectTime('${slot.startAt}')">
            ${slot.time}
        </div>
    `).join('');
}
function changeMonth(direction) {
    const currentMonth = appState.selectedDate ? new Date(appState.selectedDate) : new Date();
    currentMonth.setMonth(currentMonth.getMonth() + direction);
    appState.selectedDate = null;
    appState.selectedTime = null;
    renderDateTime();
}
function selectDate(date) {
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate >= today && appState.availableSlots[date] && appState.availableSlots[date].length > 0) {
        appState.selectedDate = date;
        appState.selectedTime = null;
        renderDateTime();
    }
}
function selectTime(time) {
    appState.selectedTime = time;
    renderDateTime();
}
function renderCustomerForm() {
    const container = document.getElementById('content-container');
    container.innerHTML = `
        <h2>Your Information</h2>
        <form class="customer-form" onsubmit="event.preventDefault()">
            <div class="form-group">
                <label class="form-label" for="firstName">First Name *</label>
                <input type="text" id="firstName" class="form-input" required 
                       value="${appState.customerInfo.firstName || ''}">
            </div>
            <div class="form-group">
                <label class="form-label" for="lastName">Last Name *</label>
                <input type="text" id="lastName" class="form-input" required 
                       value="${appState.customerInfo.lastName || ''}">
            </div>
            <div class="form-group">
                <label class="form-label" for="email">Email Address *</label>
                <input type="email" id="email" class="form-input" required 
                       value="${appState.customerInfo.email || ''}">
            </div>
            <div class="form-group">
                <label class="form-label" for="phone">Phone Number *</label>
                <input type="tel" id="phone" class="form-input" required 
                       value="${appState.customerInfo.phone || ''}">
            </div>
            <div class="form-group" style="grid-column: 1 / -1;">
                <label class="form-label" for="notes">Special Requests (Optional)</label>
                <textarea id="notes" class="form-input form-textarea">${appState.customerInfo.notes || ''}</textarea>
            </div>
        </form>
        <div class="buttons-container">
            <button class="btn btn-secondary" onclick="previousStep()">Back</button>
            <button class="btn btn-primary" onclick="saveCustomerInfo()">Continue</button>
        </div>
    `;
}
function saveCustomerInfo() {
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
    const notes = document.getElementById('notes').value;
    if (!firstName || !lastName || !email || !phone) {
        alert('Please fill in all required fields');
        return;
    }
    appState.customerInfo = {
        firstName,
        lastName,
        email,
        phone,
        notes
    };
    nextStep();
}
function renderSummary() {
    const selectedDateTime = new Date(appState.selectedTime);
    const endTime = new Date(selectedDateTime.getTime() + appState.selectedService.duration * 60000);
    const container = document.getElementById('content-container');
    container.innerHTML = `
        <h2>Booking Summary</h2>
        <div class="booking-summary">
            <div class="summary-item">
                <span>Service:</span>
                <span>${appState.selectedService.name}</span>
            </div>
            <div class="summary-item">
                <span>Specialist:</span>
                <span>${appState.selectedStaff.name}</span>
            </div>
            <div class="summary-item">
                <span>Date:</span>
                <span>${selectedDateTime.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                })}</span>
            </div>
            <div class="summary-item">
                <span>Time:</span>
                <span>${selectedDateTime.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                })} - ${endTime.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                })}</span>
            </div>
            <div class="summary-item">
                <span>Duration:</span>
                <span>${appState.selectedService.duration} minutes</span>
            </div>
            <div class="summary-item">
                <span>Customer:</span>
                <span>${appState.customerInfo.firstName} ${appState.customerInfo.lastName}</span>
            </div>
            <div class="summary-item">
                <span>Contact:</span>
                <span>${appState.customerInfo.email}<br>${appState.customerInfo.phone}</span>
            </div>
            ${appState.customerInfo.notes ? `
                <div class="summary-item">
                    <span>Special Requests:</span>
                    <span>${appState.customerInfo.notes}</span>
                </div>
            ` : ''}
            <div class="summary-item">
                <span>Total Price:</span>
                <span>$${appState.selectedService.price}</span>
            </div>
        </div>
        <div class="buttons-container">
            <button class="btn btn-secondary" onclick="previousStep()">Back</button>
            <button class="btn btn-primary" onclick="confirmBooking()">Confirm Booking</button>
        </div>
    `;
}
async function confirmBooking() {
    showLoading(true);
    try {
        const customerId = await createOrGetCustomer();
        const selectedSlot = findSelectedSlot();
        if (!selectedSlot) {
            throw new Error('Selected time slot not found');
        }
        const bookingRequest = {
            idempotency_key: 'booking_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            booking: {
                location_id: appState.selectedLocation || SQUARE_CONFIG.locationId,
                customer_id: customerId,
                start_at: appState.selectedTime,
                appointment_segments: [{
                    duration_minutes: appState.selectedVariation.duration,
                    service_variation_id: appState.selectedVariation.id,
                    team_member_id: appState.selectedStaff.id !== 'any' ? appState.selectedStaff.id : undefined,
                    service_variation_version: appState.selectedVariation.version || 1
                }],
                customer_note: appState.customerInfo.notes || '',
                location_type: 'BUSINESS_LOCATION'
            }
        };
        console.log('Creating booking with request:', bookingRequest);
        const response = await fetch(`${SQUARE_CONFIG.apiUrl}/api/bookings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bookingRequest)
        });
        const data = await response.json();
        console.log('Booking response:', data);
        if (data.booking) {
            appState.bookingId = data.booking.id;
            renderSuccess();
        } else {
            const errorMessage = data.errors ? data.errors.map(e => e.detail || e.code).join(', ') : 'Booking failed';
            throw new Error(errorMessage);
        }
    } catch (error) {
        console.error('Error creating booking:', error);
        const container = document.getElementById('content-container');
        container.innerHTML = `
            <div class="error-message">
                <h3>Booking Failed</h3>
                <p>${error.message}</p>
                <p>Please try again or contact the salon directly.</p>
            </div>
            <div class="buttons-container">
                <button class="btn btn-secondary" onclick="previousStep()">Back</button>
                <button class="btn btn-primary" onclick="confirmBooking()">Try Again</button>
            </div>
        `;
    } finally {
        showLoading(false);
    }
}
function findSelectedSlot() {
    if (!appState.selectedDate || !appState.selectedTime) return null;
    const slots = appState.availableSlots[appState.selectedDate];
    if (!slots) return null;
    return slots.find(slot => slot.startAt === appState.selectedTime);
}
async function createOrGetCustomer() {
    try {
        const searchResponse = await fetch(`${SQUARE_CONFIG.apiUrl}/api/customers/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filter: {
                    email_address: {
                        exact: appState.customerInfo.email
                    }
                }
            })
        });
        const searchData = await searchResponse.json();
        if (searchData.customers && searchData.customers.length > 0) {
            return searchData.customers[0].id;
        }
        const createResponse = await fetch(`${SQUARE_CONFIG.apiUrl}/api/customers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                given_name: appState.customerInfo.firstName,
                family_name: appState.customerInfo.lastName,
                email_address: appState.customerInfo.email,
                phone_number: appState.customerInfo.phone
            })
        });
        const createData = await createResponse.json();
        if (createData.customer) {
            return createData.customer.id;
        }
        throw new Error('Failed to create customer');
    } catch (error) {
        console.error('Error with customer:', error);
        return 'DEMO-CUSTOMER-' + Date.now();
    }
}
function renderSuccess() {
    const selectedDateTime = new Date(appState.selectedTime);
    const container = document.getElementById('content-container');
    container.innerHTML = `
        <div class="success-message">
            <div class="success-icon">Success</div>
            <h2>Booking Confirmed!</h2>
            <p>Your appointment has been successfully booked.</p>
            <p><strong>Booking ID:</strong> ${appState.bookingId}</p>
        </div>
        <div class="booking-summary">
            <h3>Appointment Details</h3>
            <div class="summary-item">
                <span>Service:</span>
                <span>${appState.selectedService.name}</span>
            </div>
            <div class="summary-item">
                <span>Date & Time:</span>
                <span>${selectedDateTime.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                })} at ${selectedDateTime.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                })}</span>
            </div>
            <div class="summary-item">
                <span>Specialist:</span>
                <span>${appState.selectedStaff.name}</span>
            </div>
            <div class="summary-item">
                <span>Location:</span>
                <span>Heena's Beauty Salon<br>123 Main St, Suite 100<br>Your City, State 12345</span>
            </div>
        </div>
        <p style="text-align: center; margin-top: 2rem;">
            A confirmation email has been sent to <strong>${appState.customerInfo.email}</strong>
        </p>
        <div class="buttons-container">
            <button class="btn btn-primary" onclick="startNewBooking()">Book Another Appointment</button>
        </div>
    `;
    document.querySelectorAll('.step').forEach(step => {
        step.classList.remove('active');
        step.classList.add('completed');
    });
}
function startNewBooking() {
    appState = {
        currentStep: 1,
        selectedLocation: appState.selectedLocation,
        selectedCategory: null,
        selectedService: null,
        selectedStaff: null,
        selectedDate: null,
        selectedTime: null,
        customerInfo: appState.customerInfo,
        availableCategories: appState.availableCategories,
        availableServices: appState.availableServices,
        availableStaff: [],
        availableSlots: [],
        bookingId: null,
        allServices: []
    };
    updateSteps();
    renderCategories();
}
function nextStep() {
    if (appState.currentStep < 6) {
        appState.currentStep++;
        updateSteps();
        switch (appState.currentStep) {
            case 3:
                loadStaff();
                break;
            case 4:
                loadAvailability();
                break;
            case 5:
                renderCustomerForm();
                break;
            case 6:
                renderSummary();
                break;
        }
    }
}
function previousStep() {
    if (appState.currentStep > 1) {
        appState.currentStep--;
        updateSteps();
        switch (appState.currentStep) {
            case 1:
                renderCategories();
                break;
            case 2:
                renderServices();
                break;
            case 3:
                renderStaff();
                break;
            case 4:
                renderDateTime();
                break;
            case 5:
                renderCustomerForm();
                break;
        }
    } else if (appState.currentStep === 1 && appState.locations && appState.locations.length > 1) {
        // If we're on categories and have multiple locations, go back to location selection
        renderLocationSelection();
    }
}
function showLoading(show = true) {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.classList.toggle('active', show);
    }
}

function hideLoading() {
    showLoading(false);
}

function showError(message) {
    const container = document.getElementById('content-container');
    if (container) {
        container.innerHTML = `
            <div class="error-message">
                <h3>Error</h3>
                <p>${message}</p>
                <button class="btn btn-primary" onclick="location.reload()">Reload Page</button>
            </div>
        `;
    }
}
document.addEventListener('DOMContentLoaded', init);