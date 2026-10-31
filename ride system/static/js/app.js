/**
 * Real-Time Ride Sharing System - Client Logic
 * Coordinates Authentication, Real-time Dashboard Modules, Table Rendering,
 * Particle Canvas Animation, and Modal Controls.
 */

// Global State
let currentData = [];
let activeModule = 'rides';

document.addEventListener('DOMContentLoaded', () => {
    // 0. Initialize Dynamic Theme Manager
    initThemeManager();

    // 1. Initialize Login Handler (if on login page)
    initLoginForm();

    // 2. Initialize Golden Particle Engine (if canvas exists)
    initParticleCanvas();

    // 3. Initialize Dashboard Data (if table exists)
    if (document.getElementById('dataTable')) {
        loadModule('rides');
    }

    // 4. Initialize Destination options dynamically excluding selected pickup
    if (document.getElementById('bookingStation') && document.getElementById('bookingDestination')) {
        updateDestinationOptions();
    }
});

/* ==========================================================================
   AUTHENTICATION LOGIC
   ========================================================================== */
window.switchLoginRole = function (role) {
    const tabAdmin = document.getElementById('tabAdmin');
    const tabCustomer = document.getElementById('tabCustomer');
    const roleContextBanner = document.getElementById('roleContextBanner');
    const roleBannerIcon = document.getElementById('roleBannerIcon');
    const roleBannerTitle = document.getElementById('roleBannerTitle');
    const roleBannerDesc = document.getElementById('roleBannerDesc');
    const loginRole = document.getElementById('loginRole');
    const userId = document.getElementById('userId');
    const userIdHint = document.getElementById('userIdHint');
    const userIconPrefix = document.getElementById('userIconPrefix');
    const password = document.getElementById('password');
    const passwordLabel = document.getElementById('passwordLabel');
    const btnSubmitIcon = document.getElementById('btnSubmitIcon');
    const btnSubmitText = document.getElementById('btnSubmitText');
    const errorMsg = document.getElementById('errorMsg');

    if (errorMsg) errorMsg.style.display = 'none';

    if (role === 'admin') {
        if (loginRole) loginRole.value = 'admin';
        if (tabAdmin) tabAdmin.classList.add('active');
        if (tabCustomer) tabCustomer.classList.remove('active');
        if (roleContextBanner) {
            roleContextBanner.className = 'role-context-banner role-admin';
            if (roleBannerIcon) roleBannerIcon.innerText = '👑';
            if (roleBannerTitle) roleBannerTitle.innerText = 'Executive Administrator Gateway';
            if (roleBannerDesc) roleBannerDesc.innerHTML = 'Access Master System Telemetry, All Platform Data, and Real-Time Profit & Loss Analytics.';
        }
        if (userIdHint) userIdHint.innerText = 'e.g. admin or USR01';
        if (userId) {
            userId.value = 'admin';
            userId.placeholder = 'e.g. admin or USR01';
        }
        if (userIconPrefix) userIconPrefix.innerText = '👑';
        if (password) {
            password.value = '';
        }
        if (passwordLabel) passwordLabel.innerText = 'Admin Password';
        if (btnSubmitIcon) btnSubmitIcon.innerText = '👑';
        if (btnSubmitText) btnSubmitText.innerText = 'AUTHENTICATE AS ADMINISTRATOR';
    } else {
        if (loginRole) loginRole.value = 'customer';
        if (tabCustomer) tabCustomer.classList.add('active');
        if (tabAdmin) tabAdmin.classList.remove('active');
        if (roleContextBanner) {
            roleContextBanner.className = 'role-context-banner';
            if (roleBannerIcon) roleBannerIcon.innerText = '🚘';
            if (roleBannerTitle) roleBannerTitle.innerText = 'Passenger Transit Portal';
            if (roleBannerDesc) roleBannerDesc.innerHTML = 'Book Instant Rides, Track Chauffeurs & Order In-Vehicle Food Across Kerala.';
        }
        if (userIdHint) userIdHint.innerText = 'e.g. USR02 or USR03';
        if (userId) {
            userId.value = 'USR02';
            userId.placeholder = 'e.g. USR02 or USR03';
        }
        if (userIconPrefix) userIconPrefix.innerText = '👤';
        if (password) {
            password.value = '';
        }
        if (passwordLabel) passwordLabel.innerText = 'Passenger Password';
        if (btnSubmitIcon) btnSubmitIcon.innerText = '🚘';
        if (btnSubmitText) btnSubmitText.innerText = 'SIGN IN AS PASSENGER';
    }
};

window.quickFillCredentials = function (username, pwd, role) {
    window.switchLoginRole(role);
    const userId = document.getElementById('userId');
    const password = document.getElementById('password');
    if (userId) userId.value = username;
    if (password) password.value = pwd;
};

window.togglePasswordVisibility = function () {
    const password = document.getElementById('password');
    const btn = document.querySelector('.btn-toggle-pwd');
    if (!password) return;
    if (password.type === 'password') {
        password.type = 'text';
        if (btn) btn.innerText = '🔒 Hide';
    } else {
        password.type = 'password';
        if (btn) btn.innerText = '👁️ Show';
    }
};

function initLoginForm() {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userIdInput = document.getElementById('userId');
        const passwordInput = document.getElementById('password');
        const loginRoleInput = document.getElementById('loginRole');
        const errorMsg = document.getElementById('errorMsg') || document.getElementById('errorMessage');
        const submitBtn = loginForm.querySelector('button[type="submit"]');

        const user_id = userIdInput ? userIdInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value : '';
        const role = loginRoleInput ? loginRoleInput.value : 'admin';

        if (errorMsg) errorMsg.style.display = 'none';
        const originalBtnText = submitBtn ? submitBtn.innerText : 'AUTHENTICATE';
        if (submitBtn) {
            submitBtn.innerText = 'AUTHENTICATING...';
            submitBtn.disabled = true;
        }

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id, password, role })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                window.location.href = data.redirect || '/dashboard';
            } else {
                if (errorMsg) {
                    errorMsg.innerText = data.message || 'Invalid User Identifier or Password';
                    errorMsg.style.display = 'block';
                }
            }
        } catch (err) {
            console.error('Login error:', err);
            if (errorMsg) {
                errorMsg.innerText = 'Server communication error. Please ensure backend is running.';
                errorMsg.style.display = 'block';
            }
        } finally {
            if (submitBtn) {
                submitBtn.innerText = originalBtnText;
                submitBtn.disabled = false;
            }
        }
    });
}

/* ==========================================================================
   DASHBOARD MODULE LOADER & TABLE RENDERER
   ========================================================================== */
window.loadModule = async function (module, element) {
    // Access control: Protect admin-only modules
    if (['profit-loss', 'master-data', 'users'].includes(module) && !window.IS_ADMIN) {
        alert('Access Denied: Administrator privileges are required to access this executive console.');
        return;
    }

    activeModule = module;

    if (element) {
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        element.classList.add('active');
    } else {
        // If element is not passed, find corresponding nav-item by onclick attribute
        document.querySelectorAll('.nav-menu .nav-item').forEach(el => {
            const onclickAttr = el.getAttribute('onclick') || '';
            if (onclickAttr.includes(`'${module}'`)) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });
    }

    const titleMap = {
        'rides': 'Ride & Booking Module',
        'map': 'Real-Time Fleet Radar & Passenger Tracking',
        'drivers': 'Drivers & Vehicle Fleet',
        'long-distance': 'Long-Distance & Rest Stops',
        'food': 'In-Vehicle Dining & Food Service',
        'payments': 'Payment & Transaction Management',
        'profit-loss': '👑 Executive Profit & Loss Analytics & Performance Ledger',
        'master-data': '👑 Enterprise Master System Data Directory',
        'users': '👑 Registered System Users & Access Administration'
    };

    const titleElement = document.getElementById('moduleTitle');
    if (titleElement && titleMap[module]) {
        titleElement.innerText = titleMap[module];
    }

    // Toggle View Containers
    const mapContainer = document.getElementById('mapViewContainer');
    const pnlContainer = document.getElementById('pnlViewContainer');
    const masterContainer = document.getElementById('masterDataContainer');
    const usersContainer = document.getElementById('usersContainer');
    const tableCard = document.querySelector('.table-card');
    const actionBar = document.querySelector('.action-bar');
    const foodContainer = document.getElementById('foodMenuContainer');

    // Hide all modules first
    if (mapContainer) mapContainer.style.display = 'none';
    if (pnlContainer) pnlContainer.style.display = 'none';
    if (masterContainer) masterContainer.style.display = 'none';
    if (usersContainer) usersContainer.style.display = 'none';
    if (tableCard) tableCard.style.display = 'none';
    if (actionBar) actionBar.style.display = 'none';
    if (foodContainer) foodContainer.style.display = 'none';

    if (module === 'map') {
        if (mapContainer) mapContainer.style.display = 'block';
        initRealTimeMap();
        return;
    } else if (module === 'profit-loss') {
        if (pnlContainer) pnlContainer.style.display = 'block';
        loadProfitLossDashboard();
        return;
    } else if (module === 'master-data') {
        if (masterContainer) masterContainer.style.display = 'block';
        loadMasterDataExplorer();
        return;
    } else if (module === 'users') {
        if (usersContainer) usersContainer.style.display = 'block';
        loadUsersManagement();
        return;
    } else {
        if (tableCard) tableCard.style.display = 'block';
        if (actionBar) actionBar.style.display = 'flex';
    }

    // Reset search & filter facility
    const searchInput = document.getElementById('searchInput');
    const catFilter = document.getElementById('tableCategoryFilter');
    if (searchInput) searchInput.value = '';
    if (catFilter) catFilter.value = 'ALL';
    if (typeof window.toggleClearSearchBtn === 'function') window.toggleClearSearchBtn();

    // Update Action Bar button depending on module
    const actionBtn = document.getElementById('actionBtn');
    if (actionBtn) {
        if (module === 'rides') {
            actionBtn.innerText = '+ Request Booking';
            actionBtn.style.display = 'block';
        } else if (module === 'payments') {
            actionBtn.innerText = '💳 Process Ride Payment';
            actionBtn.style.display = 'block';
        } else if (module === 'food') {
            actionBtn.innerText = '+ Order In-Vehicle Food';
            actionBtn.style.display = 'block';
        } else {
            actionBtn.innerText = '+ Request Booking';
            actionBtn.style.display = 'block';
        }
    }

    // Remove or show food menu container
    if (module === 'food') {
        let fContainer = document.getElementById('foodMenuContainer');
        if (!fContainer) {
            fContainer = document.createElement('div');
            fContainer.id = 'foodMenuContainer';
            const tc = document.querySelector('.table-card');
            if (tc && tc.parentNode) {
                tc.parentNode.insertBefore(fContainer, tc);
            }
        }
        fContainer.style.display = 'block';
        loadFoodMenuGrid();
    }

    const body = document.getElementById('tableBody');
    if (body) {
        body.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--gold-light); padding: 30px;">Loading records from PostgreSQL database...</td></tr>`;
    }

    try {
        const endpoint = module === 'food' ? '/api/food-orders' : `/api/${module}`;
        const response = await fetch(endpoint);
        if (!response.ok) {
            throw new Error(`Failed to load module data: ${response.status}`);
        }
        currentData = await response.json();
        renderTable(currentData);
    } catch (err) {
        console.error(`Error loading module ${module}:`, err);
        if (body) {
            body.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #e74c3c; padding: 25px;">Failed to retrieve records from server.</td></tr>`;
        }
    }
};

async function loadFoodMenuGrid(selectedZone) {
    const foodContainer = document.getElementById('foodMenuContainer');
    if (!foodContainer) return;

    try {
        const res = await fetch('/api/food-menu');
        const allMenu = await res.json();
        window.cachedFullMenu = allMenu;

        const currentFilter = selectedZone || window.currentFoodZoneFilter || 'ALL';
        window.currentFoodZoneFilter = currentFilter;

        const filteredMenu = currentFilter === 'ALL'
            ? allMenu
            : allMenu.filter(item => item.zone === currentFilter);

        let html = `
            <div style="margin-bottom: 25px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:14px; margin-bottom:16px;">
                    <div>
                        <h3 style="color: var(--gold-primary); font-family: 'Cinzel', serif; margin-bottom: 6px; font-size: 1.25rem;">Authentic Kerala In-Ride Delicacies</h3>
                        <p style="color: var(--text-muted); font-size: 0.85rem; margin: 0;">Hot, fresh culinary meals served directly inside your vehicle from adjacent partner restaurants along your destination corridor.</p>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:0.8rem; font-weight:700; color:var(--primary-light);">📍 Destination Corridor:</span>
                        <select id="foodZoneSelector" class="filter-facility-select" onchange="filterFoodMenuByZone(this.value)" style="height:38px; padding:6px 12px; font-size:0.8rem;">
                            <option value="ALL" ${currentFilter === 'ALL' ? 'selected' : ''}>All Destination Areas (${allMenu.length})</option>
                            <option value="kozhikode" ${currentFilter === 'kozhikode' ? 'selected' : ''}>Kozhikode Beach & Malabar</option>
                            <option value="munnar" ${currentFilter === 'munnar' ? 'selected' : ''}>Munnar Tea Hills & Idukki</option>
                            <option value="kochi" ${currentFilter === 'kochi' ? 'selected' : ''}>Kochi Marine Drive & CIAL</option>
                            <option value="alappuzha" ${currentFilter === 'alappuzha' ? 'selected' : ''}>Alappuzha Jetty & Kumarakom</option>
                            <option value="trivandrum" ${currentFilter === 'trivandrum' ? 'selected' : ''}>Thiruvananthapuram & Kovalam</option>
                            <option value="thrissur" ${currentFilter === 'thrissur' ? 'selected' : ''}>Thrissur Round & Athirappilly</option>
                            <option value="wayanad" ${currentFilter === 'wayanad' ? 'selected' : ''}>Wayanad Vythiri Hill Pass</option>
                            <option value="kannur" ${currentFilter === 'kannur' ? 'selected' : ''}>Kannur Coast & Bekal Fort</option>
                            <option value="palakkad" ${currentFilter === 'palakkad' ? 'selected' : ''}>Palakkad Fort Junction</option>
                            <option value="kollam" ${currentFilter === 'kollam' ? 'selected' : ''}>Kollam Lake & Jatayu Park</option>
                        </select>
                    </div>
                </div>

                <div class="food-grid">
        `;

        filteredMenu.forEach(item => {
            html += `
                <div class="food-card">
                    <div>
                        <div class="food-card-header">
                            <span class="food-icon">${item.icon}</span>
                            <div>
                                <div class="food-title">${item.name}</div>
                                <div class="food-category">${item.category}</div>
                            </div>
                        </div>
                        <div style="font-size:0.75rem; color:#38bdf8; font-weight:700; margin: 8px 0 6px 0; display:flex; align-items:center; gap:5px; background:rgba(56,189,248,0.1); padding:4px 8px; border-radius:6px; border:1px solid rgba(56,189,248,0.2);">
                            <span>🏪</span> <span>${item.restaurant || 'Adjacent Partner Kitchen'}</span>
                        </div>
                        <div style="font-size:0.72rem; color:var(--text-muted); margin-bottom:8px;">
                            📍 Corridor: <strong style="color:#e2e8f0;">${item.area || 'Destination Area'}</strong>
                        </div>
                        <p class="food-desc">${item.desc}</p>
                    </div>
                    <div class="food-footer">
                        <div class="food-price">₹${parseFloat(item.price).toFixed(2)}</div>
                        <button class="btn-food-order" onclick="openFoodModalWithItem('${item.name}', ${item.price})">+ Order In Vehicle</button>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
                <h4 style="color: var(--gold-light); font-family: 'Cinzel', serif; margin: 30px 0 12px 0;">Active In-Vehicle Food Orders</h4>
            </div>
        `;

        foodContainer.innerHTML = html;
    } catch (err) {
        console.error('Error loading food menu:', err);
    }
}

window.filterFoodMenuByZone = function (zone) {
    loadFoodMenuGrid(zone);
};

window.renderTable = function (data) {
    const head = document.getElementById('tableHead');
    const body = document.getElementById('tableBody');
    if (!head || !body) return;

    head.innerHTML = '';
    body.innerHTML = '';

    if (!data || data.length === 0) {
        body.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 30px; color: var(--text-muted);">No records found.</td></tr>';
        return;
    }

    // Create table headers
    Object.keys(data[0]).forEach(key => {
        const formattedKey = key.replace(/_/g, ' ').toUpperCase();
        head.innerHTML += `<th>${formattedKey}</th>`;
    });

    if (activeModule === 'rides' || activeModule === 'food' || activeModule === 'payments') {
        head.innerHTML += `<th>ACTION</th>`;
    }

    // Create table rows
    data.forEach(row => {
        let trTag = '<tr>';
        if (activeModule === 'rides' && row.ride_code) {
            trTag = `<tr class="clickable-ride-row" onclick="onRideRowClicked('${row.ride_code}', '${row.status || ''}')" title="Click to view payment / ride options">`;
        } else if (activeModule === 'payments' && row.ride_code) {
            trTag = `<tr class="clickable-ride-row" onclick="viewPaymentReceipt('${row.ride_code}')" title="Click to view payment receipt">`;
        }

        let tr = trTag;
        Object.entries(row).forEach(([key, val]) => {
            if (val === true) {
                tr += `<td><span class="badge badge-success">Available</span></td>`;
            } else if (val === false) {
                tr += `<td><span class="badge" style="background:rgba(231,76,60,0.2); color:#e74c3c;">None</span></td>`;
            } else if (val === 'Tesla') {
                tr += `<td><span class="badge badge-tesla">⚡ Tesla EV</span></td>`;
            } else if (val === 'Rolls-Royce') {
                tr += `<td><span class="badge badge-rolls">👑 Rolls-Royce</span></td>`;
            } else if (val === 'Porsche') {
                tr += `<td><span class="badge badge-porsche">🏎️ Porsche EV</span></td>`;
            } else if (val === 'Audi') {
                tr += `<td><span class="badge badge-audi">🚘 Audi e-tron</span></td>`;
            } else if (val === 'Range Rover') {
                tr += `<td><span class="badge badge-rover">🚙 Range Rover</span></td>`;
            } else if (val === 'Harley') {
                tr += `<td><span class="badge badge-harley">🏍️ Harley-Davidson</span></td>`;
            } else if (val === 'Ather') {
                tr += `<td><span class="badge badge-ather">🛵 Ather EV</span></td>`;
            } else if (val === 'Volvo') {
                tr += `<td><span class="badge badge-volvo">🚌 Volvo Coach</span></td>`;
            } else if (val === 'Benz' || val === 'BMW' || val === 'Luxury') {
                tr += `<td><span class="badge badge-luxury">🏎️ ${val}</span></td>`;
            } else if (val === 'Innova' || val === 'SUV') {
                tr += `<td><span class="badge" style="background:rgba(52, 152, 219, 0.2); color:#5dade2; border:1px solid rgba(52,152,219,0.4);">🚐 ${val}</span></td>`;
            } else if (val === 'Alto' || val === 'Sedan') {
                tr += `<td><span class="badge" style="background:rgba(155, 89, 182, 0.2); color:#bb8fce; border:1px solid rgba(155,89,182,0.4);">🚗 ${val}</span></td>`;
            } else if (val === 'Autorickshaw' || val === 'Auto') {
                tr += `<td><span class="badge" style="background:rgba(243, 156, 18, 0.2); color:#f39c12; border:1px solid rgba(243,156,18,0.4);">🛺 ${val}</span></td>`;
            } else if (val === 'Bike') {
                tr += `<td><span class="badge" style="background:rgba(46, 204, 113, 0.2); color:#2ecc71; border:1px solid rgba(46,204,113,0.4);">🏍️ ${val}</span></td>`;
            } else if (val === 'Booked & Payment Successful' || val === 'Payment Successful') {
                tr += `<td><span class="badge badge-payment-success">✓ Booked & Payment Successful</span></td>`;
            } else if (val === 'Completed' || val === 'Success' || val === 'Served In-Vehicle') {
                tr += `<td><span class="badge badge-info">${val}</span></td>`;
            } else if (val === 'Booked' || val === 'Pending' || val === 'Active' || val === 'Preparing in Vehicle') {
                tr += `<td><span class="badge" style="background:rgba(212,175,55,0.2); color:var(--gold-light); border:1px solid rgba(212,175,55,0.4);">${val}</span></td>`;
            } else if (key === 'ride_date') {
                tr += `<td><span style="color:var(--primary-light); font-weight:700;">📅 ${val || 'Today'}</span></td>`;
            } else if (key === 'fare_amount' || key === 'amount' || key === 'total_amount') {
                tr += `<td><strong style="color: var(--gold-light);">₹${parseFloat(val).toFixed(2)}</strong></td>`;
            } else {
                tr += `<td>${val !== null && val !== undefined ? val : 'N/A'}</td>`;
            }
        });

        if (activeModule === 'rides' && row.ride_code) {
            const isPaid = row.status === 'Booked & Payment Successful' || (row.status && row.status.toLowerCase().includes('success'));
            const payBtn = isPaid
                ? `<button onclick="event.stopPropagation(); viewPaymentReceipt('${row.ride_code}')" class="btn-action-paid" title="View Electronic Receipt">✓ Paid</button>`
                : `<button onclick="event.stopPropagation(); openPaymentModal('${row.ride_code}')" class="btn-action-pay" title="Pay for this Ride">💳 Pay</button>`;

            tr += `<td>
                <div style="display: flex; gap: 6px; align-items: center;">
                    <button onclick="event.stopPropagation(); trackRideOnMap('${row.ride_code}')" class="btn-action-track" title="Track Live GPS on Map">🗺️ Track</button>
                    ${payBtn}
                    <button onclick="event.stopPropagation(); openFoodModalForRide('${row.ride_code}')" style="background:rgba(56,189,248,0.18); border:1px solid var(--border-gold); color:var(--primary-light); padding:6px 10px; border-radius:6px; cursor:pointer; font-size:0.75rem; font-weight:600; transition:0.2s;" title="Order Food to Vehicle">🍱 Food</button>
                    <button onclick="event.stopPropagation(); cancelRide('${row.ride_code}')" style="background:rgba(231,76,60,0.15); border:1px solid rgba(231,76,60,0.4); color:#e74c3c; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:0.75rem; font-weight:600; transition:0.2s;" title="Cancel Ride & Refund Payment">🚫 Cancel</button>
                </div>
            </td>`;
        } else if (activeModule === 'payments' && row.payment_id) {
            tr += `<td>
                <div style="display: flex; gap: 6px; align-items: center;">
                    <button onclick="event.stopPropagation(); viewPaymentReceipt('${row.ride_code}')" class="btn-action-paid" title="View Electronic Receipt">Receipt</button>
                    <button onclick="event.stopPropagation(); deletePayment('${row.payment_id}')" style="background:rgba(231,76,60,0.15); border:1px solid rgba(231,76,60,0.4); color:#e74c3c; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:0.75rem; font-weight:600; transition:0.2s;">Delete</button>
                </div>
            </td>`;
        } else if (activeModule === 'food' && row.order_id) {
            tr += `<td>
                <button onclick="event.stopPropagation(); deleteFoodOrder('${row.order_id}')" style="background:rgba(231,76,60,0.15); border:1px solid rgba(231,76,60,0.4); color:#e74c3c; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.75rem; font-weight:600; transition:0.2s;">Cancel Order</button>
            </td>`;
        }

        tr += '</tr>';
        body.innerHTML += tr;
    });

    // Update live record counter badge in Search & Quick Filter Facility
    const countBadge = document.getElementById('searchResultCount');
    if (countBadge) {
        if (!currentData || data.length === currentData.length) {
            countBadge.innerText = `${data.length} records`;
        } else {
            countBadge.innerText = `${data.length} of ${currentData.length} records`;
        }
    }
};

/* ==========================================================================
   SMART SEARCH & QUICK FILTER FACILITY
   ========================================================================== */
window.toggleClearSearchBtn = function () {
    const input = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    if (clearBtn) {
        clearBtn.style.display = (input && input.value.trim().length > 0) ? 'flex' : 'none';
    }
};

window.clearSearchFilter = function () {
    const input = document.getElementById('searchInput');
    const catFilter = document.getElementById('tableCategoryFilter');
    if (input) input.value = '';
    if (catFilter) catFilter.value = 'ALL';
    window.toggleClearSearchBtn();
    window.filterTable();
};

window.toggleSearchFacility = function () {
    const container = document.getElementById('searchFacilityContainer');
    const toggleText = document.getElementById('toggleSearchText');
    const toggleIcon = document.getElementById('toggleSearchIcon');
    if (!container) return;

    if (container.style.display === 'none') {
        container.style.display = 'flex';
        if (toggleText) toggleText.innerText = 'Hide Filter';
        if (toggleIcon) toggleIcon.innerText = '✕';
    } else {
        container.style.display = 'none';
        if (toggleText) toggleText.innerText = 'Search Facility';
        if (toggleIcon) toggleIcon.innerText = '🔍';
    }
};

window.filterTable = function () {
    const searchInput = document.getElementById('searchInput');
    const catFilter = document.getElementById('tableCategoryFilter');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const selectedCat = catFilter ? catFilter.value : 'ALL';

    window.toggleClearSearchBtn();

    if (!currentData || !Array.isArray(currentData)) return;

    let filtered = currentData;

    // Apply category / status filter
    if (selectedCat !== 'ALL') {
        filtered = filtered.filter(row => {
            const statusStr = String(row.status || '').toLowerCase();
            const typeStr = String(row.vehicle_type || '').toLowerCase();
            const groupStr = String(row.ride_group || '').toLowerCase();

            if (selectedCat === 'BOOKED') {
                return statusStr.includes('booked') || statusStr.includes('ready') || statusStr.includes('pending');
            } else if (selectedCat === 'PAID') {
                return statusStr.includes('success') || statusStr.includes('paid');
            } else if (selectedCat === 'COMPLETED') {
                return statusStr.includes('completed');
            } else if (selectedCat === 'EV') {
                return typeStr.includes('tesla') || typeStr.includes('taycan') || typeStr.includes('porsche') || typeStr.includes('audi') || typeStr.includes('ather') || groupStr.includes('electric');
            } else if (selectedCat === 'LUXURY') {
                return typeStr.includes('rolls') || typeStr.includes('benz') || typeStr.includes('bmw') || typeStr.includes('porsche') || groupStr.includes('royal');
            }
            return true;
        });
    }

    // Apply text search query
    if (query) {
        filtered = filtered.filter(row =>
            Object.values(row).some(val =>
                String(val).toLowerCase().includes(query)
            )
        );
    }

    renderTable(filtered);
};

/* ==========================================================================
   DYNAMIC DESTINATION FILTER (EXCLUDES SELECTED PICKUP OPTION)
   ========================================================================== */
window.updateDestinationOptions = function () {
    const stationElem = document.getElementById('bookingStation');
    const destElem = document.getElementById('bookingDestination');
    const badge = document.getElementById('validDestBadge');
    if (!stationElem || !destElem) return;

    const selectedPickupId = stationElem.value;
    const previouslySelected = destElem.value;

    // Master list of Kerala Transit Stations
    const KERALA_STATIONS = [
        { id: 'ST01', name: 'Kochi Marine Drive Hub (Ernakulam)' },
        { id: 'ST02', name: 'Thiruvananthapuram Central (Trivandrum)' },
        { id: 'ST03', name: 'Kozhikode Beach Square (Calicut)' },
        { id: 'ST04', name: 'Munnar Tea Hills Station (Idukki)' },
        { id: 'ST05', name: 'Alappuzha Backwater Jetty (Alleppey)' },
        { id: 'ST06', name: 'Thrissur Swaraj Round (Cultural Capital)' },
        { id: 'ST07', name: 'Cochin International Airport (CIAL)' },
        { id: 'ST08', name: 'Kovalam Beach Promenade (Trivandrum)' },
        { id: 'ST09', name: 'Wayanad Vythiri Hill Pass (Wayanad)' },
        { id: 'ST10', name: 'Kannur Payyambalam Coast (Kannur)' },
        { id: 'ST11', name: 'Kollam Ashtamudi Lake Hub (Kollam)' },
        { id: 'ST12', name: 'Kottayam Kumarakom Gateway (Kottayam)' },
        { id: 'ST13', name: 'Palakkad Fort Junction (Palakkad)' },
        { id: 'ST14', name: 'Malappuram Kottakkal Gateway (Malappuram)' },
        { id: 'ST15', name: 'Pathanamthitta Sabarimala Junction' },
        { id: 'ST16', name: 'Kasaragod Bekal Fort Station (Kasaragod)' }
    ];

    // Popular Kerala Tourist & Landmark Destinations (not in pickup stations list)
    const SCENIC_DESTINATIONS = [
        'Thekkady Periyar Wildlife Sanctuary (Idukki)',
        'Varkala Cliff Beach & Papanasam (Trivandrum)',
        'Athirappilly Waterfalls Scenic Point (Thrissur)',
        'Vagamon Pine Hills & Meadows (Idukki)',
        'Jatayu Earth\'s Center Nature Park (Kollam)',
        'Marari Beach Promenade (Alappuzha)'
    ];

    destElem.innerHTML = '';

    // 1. Group for Transit Stations (excluding currently selected pickup station)
    const transitGroup = document.createElement('optgroup');
    transitGroup.label = `Transit Stations (${selectedPickupId} Excluded)`;

    let validStationCount = 0;
    let matchedSelected = false;

    KERALA_STATIONS.forEach(st => {
        // Exclude the station that is the selected pickup option
        if (st.id === selectedPickupId) return;

        const opt = document.createElement('option');
        opt.value = st.name;
        opt.textContent = `${st.id} - ${st.name}`;
        opt.setAttribute('data-station-id', st.id);

        if (st.name === previouslySelected || opt.textContent === previouslySelected) {
            opt.selected = true;
            matchedSelected = true;
        }

        transitGroup.appendChild(opt);
        validStationCount++;
    });
    destElem.appendChild(transitGroup);

    // 2. Group for Other Popular Destinations (places not in pickup options)
    const scenicGroup = document.createElement('optgroup');
    scenicGroup.label = 'Popular Scenic Destinations (Non-Station Drops)';

    SCENIC_DESTINATIONS.forEach(place => {
        const opt = document.createElement('option');
        opt.value = place;
        opt.textContent = place;

        if (place === previouslySelected) {
            opt.selected = true;
            matchedSelected = true;
        }

        scenicGroup.appendChild(opt);
    });
    destElem.appendChild(scenicGroup);

    // If previous selection became invalid (because it was the pickup station), default to first available
    if (!matchedSelected && destElem.options.length > 0) {
        destElem.selectedIndex = 0;
    }

    const totalValid = validStationCount + SCENIC_DESTINATIONS.length;
    if (badge) {
        badge.innerText = `● ${totalValid} Valid Destinations (${selectedPickupId} Excluded)`;
    }

    // Automatically update available in-vehicle food to only match adjacent restaurants near destination
    if (typeof window.updateFoodOptionsForDestination === 'function') {
        window.updateFoodOptionsForDestination();
    }
};

/* ==========================================================================
   DESTINATION-ADJACENT RESTAURANT & LOCAL DELICACIES CATALOG
   Ensures that only authentic regional foods from adjacent partner restaurants 
   near the visitor's destination corridor are available for order.
   ========================================================================== */
window.DESTINATION_FOOD_CATALOG = {
    // 1. Kozhikode & Malabar
    'kozhikode': {
        zoneName: 'Kozhikode & Malabar Corridor',
        adjacentRestaurants: 'Hotel Paragon & Salkara (0.4 km) • Zains Heritage Kitchen (0.7 km)',
        items: [
            { name: 'Thalassery Dum Biryani', restaurant: 'Hotel Paragon (0.4 km)', price: 180.00, icon: '🍲' },
            { name: 'Kozhikodan Halwa & Banana Chips', restaurant: 'Calicut Halwa Bazaar (0.3 km)', price: 90.00, icon: '🍌' },
            { name: 'Malabar Chicken Roast & Parotta', restaurant: 'Salkara Malabar Diner (0.5 km)', price: 160.00, icon: '🍗' },
            { name: 'Sulaimani Lemon Tea & Unnakaya', restaurant: 'Zains Kitchen (0.7 km)', price: 60.00, icon: '☕' }
        ]
    },
    // 2. Munnar & Idukki
    'munnar': {
        zoneName: 'Munnar & High-Range Idukki Corridor',
        adjacentRestaurants: 'Highland Tea Garden Diner (0.3 km) • Rapsy Hillside Restaurant (0.6 km)',
        items: [
            { name: 'Munnar Cardamom Tea & Pazham Pori', restaurant: 'Highland Tea Garden Diner (0.3 km)', price: 60.00, icon: '☕' },
            { name: 'Appam with Vegetable Stew', restaurant: 'Rapsy Hillside Restaurant (0.6 km)', price: 120.00, icon: '🥞' },
            { name: 'Highland Wild Mushroom Pepper Roast', restaurant: 'Highland Diner (0.3 km)', price: 140.00, icon: '🍄' },
            { name: 'Thekkady Fire-Roasted Spiced Corn', restaurant: 'Periyar Spice Kitchen (0.5 km)', price: 75.00, icon: '🌽' }
        ]
    },
    // 3. Kochi & CIAL Airport
    'kochi': {
        zoneName: 'Greater Kochi & CIAL Airport Corridor',
        adjacentRestaurants: 'Grand Pavilion (0.5 km) • Fort Kochi Seafood Bistro (0.8 km)',
        items: [
            { name: 'Kochi Karimeen Pollichathu', restaurant: 'Grand Pavilion (0.5 km)', price: 220.00, icon: '🐟' },
            { name: 'Kerala Parotta & Chicken Roast', restaurant: 'Casino Heritage Diner (0.6 km)', price: 160.00, icon: '🍗' },
            { name: 'Chilled Marine Drive Tender Coconut Shake', restaurant: 'Marine Promenade Shakes (0.2 km)', price: 70.00, icon: '🥥' },
            { name: 'Fort Cochin Garlic Butter Prawns', restaurant: 'Fort Kochi Seafood Bistro (0.8 km)', price: 190.00, icon: '🍤' }
        ]
    },
    // 4. Alappuzha & Backwaters
    'alappuzha': {
        zoneName: 'Alappuzha & Vembanad Backwater Corridor',
        adjacentRestaurants: 'Vembanad Lakeside Heritage Diner (0.4 km) • Halais Backwater Restaurant (0.6 km)',
        items: [
            { name: 'Kuttanad Duck Roast with Steamed Appam', restaurant: 'Vembanad Lakeside (0.4 km)', price: 210.00, icon: '🍗' },
            { name: 'Backwater Karimeen Fry', restaurant: 'Halais Backwater (0.6 km)', price: 190.00, icon: '🐟' },
            { name: 'Tapioca (Kappa) with Fiery Fish Curry', restaurant: 'Kuttanad Toddy Parlour (0.5 km)', price: 130.00, icon: '🥘' },
            { name: 'Fresh Pure Tender Coconut Elaneer', restaurant: 'Lakeside Palm Groves (0.1 km)', price: 50.00, icon: '🥥' }
        ]
    },
    // 5. Trivandrum & Kovalam / Varkala
    'trivandrum': {
        zoneName: 'Thiruvananthapuram & South Coast Corridor',
        adjacentRestaurants: 'Mothers Veg Plaza (0.5 km) • Cliff Top Ocean Grill Varkala (0.3 km)',
        items: [
            { name: 'Travancore Royal Boli & Palpayasam', restaurant: 'Mothers Veg Plaza (0.5 km)', price: 95.00, icon: '🥞' },
            { name: 'Kovalam Golden Butter Garlic Prawns', restaurant: 'Ocean Lighthouse Bistro (0.4 km)', price: 210.00, icon: '🍤' },
            { name: 'Trivandrum Chicken Fry & Layered Parotta', restaurant: 'Zam Zam Restaurant (0.6 km)', price: 160.00, icon: '🍗' },
            { name: 'Varkala Cliff Avocado Honey Smoothie', restaurant: 'Cliff Top Ocean Grill (0.3 km)', price: 85.00, icon: '🥑' }
        ]
    },
    // 6. Thrissur & Athirappilly
    'thrissur': {
        zoneName: 'Thrissur Swaraj Round & Athirappilly Corridor',
        adjacentRestaurants: 'Hotel Bharat (0.3 km) • Rainforest Waterfall Café (0.4 km)',
        items: [
            { name: 'Thrissur Ghee Roast Dosa with Sambar', restaurant: 'Hotel Bharat (0.3 km)', price: 110.00, icon: '🥞' },
            { name: 'Athirappilly River Fish Fry', restaurant: 'Rainforest Waterfall Café (0.4 km)', price: 175.00, icon: '🐟' },
            { name: 'Kerala Parotta & Spiced Roast', restaurant: 'Hotel Bharat (0.3 km)', price: 160.00, icon: '🍗' },
            { name: 'Chilled Tender Coconut Shake', restaurant: 'Waterfall Breeze Stall (0.2 km)', price: 70.00, icon: '🥥' }
        ]
    },
    // 7. Wayanad
    'wayanad': {
        zoneName: 'Wayanad Vythiri & Chembra Hill Corridor',
        adjacentRestaurants: "1980's A Nostalgic Restaurant (0.5 km) • Wayanad Coffee Bean Kitchen (0.7 km)",
        items: [
            { name: 'Wayanad Bamboo Chicken & Rice Pathiri', restaurant: "1980's Restaurant (0.5 km)", price: 190.00, icon: '🎋' },
            { name: 'Estate Arabica Filter Coffee & Unniyappam', restaurant: 'Wayanad Coffee Bean (0.7 km)', price: 70.00, icon: '☕' },
            { name: 'Soft Appam with Country Chicken Curry', restaurant: 'Vythiri Hill View (0.4 km)', price: 150.00, icon: '🥞' },
            { name: 'Highland Wild Honey Mint Cooler', restaurant: 'Chembra Peak Rest (0.3 km)', price: 65.00, icon: '🍯' }
        ]
    },
    // 8. Kannur & Bekal Fort
    'kannur': {
        zoneName: 'Kannur Coast & Bekal Fort Heritage Corridor',
        adjacentRestaurants: 'MRA Bakery & Heritage Diner (0.4 km) • Bekal Coastal Castle Bistro (0.5 km)',
        items: [
            { name: 'Kannur Thalassery Mutton Dum Biryani', restaurant: 'MRA Heritage Diner (0.4 km)', price: 240.00, icon: '🍲' },
            { name: 'Kallummakkaya (Mussels) Nirachathu', restaurant: 'Payyambalam Beach Mess (0.3 km)', price: 150.00, icon: '🦪' },
            { name: 'Bekal Cashew Halwa Treat Box', restaurant: 'Bekal Castle Bistro (0.5 km)', price: 85.00, icon: '🥜' },
            { name: 'Kannur Layered Cocktail Fruit Shake', restaurant: 'MRA Bakery (0.4 km)', price: 95.00, icon: '🍹' }
        ]
    },
    // 9. Palakkad
    'palakkad': {
        zoneName: 'Palakkad Fort & Gap Corridor',
        adjacentRestaurants: 'Noorjehan Open Grill (0.4 km) • Ramaswamy Heritage Veg Mess (0.6 km)',
        items: [
            { name: 'Palakkadan Matta Rice Deluxe Thali', restaurant: 'Ramaswamy Veg Mess (0.6 km)', price: 120.00, icon: '🍛' },
            { name: 'Palakkad Kothu Parotta with Gravy', restaurant: 'Noorjehan Open Grill (0.4 km)', price: 140.00, icon: '🥘' },
            { name: 'Filter Kaapi & Crunchy Murukku', restaurant: 'Ramaswamy Mess (0.6 km)', price: 55.00, icon: '☕' }
        ]
    },
    // 10. Kollam & Pathanamthitta
    'kollam': {
        zoneName: 'Kollam Ashtamudi & Jatayu Corridor',
        adjacentRestaurants: 'Ramees Restaurant (0.5 km) • Jatayu Cliff View Dining (0.6 km)',
        items: [
            { name: 'Ashtamudi Lake Crab Roast', restaurant: 'Ramees Lakefront (0.5 km)', price: 220.00, icon: '🦀' },
            { name: 'Kollam Roasted Cashew Treat Box', restaurant: 'Cashew Capital Hub (0.3 km)', price: 110.00, icon: '🥜' },
            { name: 'Appam with Vegetable Stew', restaurant: 'Jatayu Cliff View (0.6 km)', price: 120.00, icon: '🥞' },
            { name: 'Chilled Tender Coconut Shake', restaurant: 'Ashtamudi Jetty Shakes (0.2 km)', price: 70.00, icon: '🥥' }
        ]
    }
};

window.resolveDestinationZone = function (destString) {
    if (!destString) return 'munnar';
    const s = destString.toLowerCase();
    if (s.includes('kozhikode') || s.includes('calicut') || s.includes('malappuram') || s.includes('st03') || s.includes('st14')) return 'kozhikode';
    if (s.includes('munnar') || s.includes('idukki') || s.includes('thekkady') || s.includes('vagamon') || s.includes('st04')) return 'munnar';
    if (s.includes('kochi') || s.includes('ernakulam') || s.includes('cochin') || s.includes('cial') || s.includes('airport') || s.includes('st01') || s.includes('st07')) return 'kochi';
    if (s.includes('alappuzha') || s.includes('alleppey') || s.includes('kumarakom') || s.includes('marari') || s.includes('st05') || s.includes('st12')) return 'alappuzha';
    if (s.includes('thiruvananthapuram') || s.includes('trivandrum') || s.includes('kovalam') || s.includes('varkala') || s.includes('st02') || s.includes('st08')) return 'trivandrum';
    if (s.includes('thrissur') || s.includes('athirappilly') || s.includes('st06')) return 'thrissur';
    if (s.includes('wayanad') || s.includes('vythiri') || s.includes('chembra') || s.includes('st09')) return 'wayanad';
    if (s.includes('kannur') || s.includes('bekal') || s.includes('kasaragod') || s.includes('st10') || s.includes('st16')) return 'kannur';
    if (s.includes('palakkad') || s.includes('silent valley') || s.includes('st13')) return 'palakkad';
    if (s.includes('kollam') || s.includes('pathanamthitta') || s.includes('sabarimala') || s.includes('jatayu') || s.includes('st11') || s.includes('st15')) return 'kollam';
    return 'munnar';
};

window.updateFoodOptionsForDestination = function () {
    const destElem = document.getElementById('bookingDestination');
    const foodElem = document.getElementById('bookingFood');
    const badgeText = document.getElementById('adjacentRestaurantNames');
    if (!destElem || !foodElem) return;

    const destValue = destElem.value || 'Munnar Tea Hills Station';
    const zoneKey = window.resolveDestinationZone(destValue);
    const zoneData = window.DESTINATION_FOOD_CATALOG[zoneKey] || window.DESTINATION_FOOD_CATALOG['munnar'];

    if (badgeText) {
        badgeText.innerText = `${zoneData.adjacentRestaurants} (${zoneData.zoneName})`;
    }

    const prevFood = foodElem.value;
    foodElem.innerHTML = '';

    const noFoodOpt = document.createElement('option');
    noFoodOpt.value = 'None';
    noFoodOpt.text = 'No Food (Ride Only)';
    foodElem.appendChild(noFoodOpt);

    let foundMatch = false;
    zoneData.items.forEach(dish => {
        const opt = document.createElement('option');
        opt.value = dish.name;
        opt.setAttribute('data-price', dish.price);
        opt.text = `[${dish.restaurant}] ${dish.name} (+₹${dish.price})`;
        if (dish.name === prevFood) {
            opt.selected = true;
            foundMatch = true;
        }
        foodElem.appendChild(opt);
    });

    if (!foundMatch && prevFood && prevFood !== 'None') {
        noFoodOpt.selected = true;
    }
};

/* ==========================================================================
   BOOKING MODAL CONTROLS & API DISPATCH
   ========================================================================== */
window.openModal = function () {
    const modal = document.getElementById('bookingModal');
    if (modal) modal.style.display = 'flex';

    // Set scheduled ride date to today if empty
    const dateInput = document.getElementById('bookingDate');
    if (dateInput) {
        const todayStr = new Date().toISOString().split('T')[0];
        dateInput.min = todayStr;
        if (!dateInput.value) {
            dateInput.value = todayStr;
        }
    }

    if (typeof window.updateDestinationOptions === 'function') {
        window.updateDestinationOptions();
    }
    if (typeof window.updateFoodOptionsForDestination === 'function') {
        window.updateFoodOptionsForDestination();
    }
};

window.closeModal = function () {
    const modal = document.getElementById('bookingModal');
    if (modal) modal.style.display = 'none';
};

window.dispatchBooking = async function () {
    const stationElem = document.getElementById('bookingStation');
    const destElem = document.getElementById('bookingDestination');
    const dateElem = document.getElementById('bookingDate');
    const vehicleElem = document.getElementById('bookingVehicle');
    const rideTypeElem = document.getElementById('bookingRideType');
    const foodElem = document.getElementById('bookingFood');

    const station_id = stationElem ? stationElem.value : 'ST01';
    const destination = destElem ? destElem.value : 'Munnar Tea Hills Station';
    const ride_date = (dateElem && dateElem.value) ? dateElem.value : new Date().toISOString().split('T')[0];
    const vehicle_type = vehicleElem ? vehicleElem.value : 'Tesla';
    const ride_type = rideTypeElem ? rideTypeElem.value : 'Local';
    const food_item = foodElem ? foodElem.value : 'None';

    const dispatchBtn = document.querySelector('#bookingModal .btn-gold');
    const origText = dispatchBtn ? dispatchBtn.innerText : 'Dispatch';
    if (dispatchBtn) {
        dispatchBtn.innerText = 'Dispatching...';
        dispatchBtn.disabled = true;
    }

    try {
        const response = await fetch('/api/book-ride', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                station_id: station_id,
                destination: destination,
                ride_date: ride_date,
                vehicle_type: vehicle_type,
                ride_type: ride_type,
                food_item: food_item
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            closeModal();
            // Automatically reload the rides module so the new booking immediately appears on the front page!
            loadModule('rides');
        } else {
            alert(data.message || 'Failed to dispatch booking.');
        }
    } catch (err) {
        console.error('Booking error:', err);
        alert('Server communication error while dispatching booking.');
    } finally {
        if (dispatchBtn) {
            dispatchBtn.innerText = origText;
            dispatchBtn.disabled = false;
        }
    }
};

window.cancelRide = async function (rideCode) {
    // Look up cached ride details from currentData
    const ride = (currentData && Array.isArray(currentData))
        ? currentData.find(r => r.ride_code === rideCode)
        : null;
    const isPaid = ride && (ride.status === 'Booked & Payment Successful' || (ride.status && ride.status.toLowerCase().includes('success')));
    const fare = ride ? parseFloat(ride.fare_amount || 0) : 350.00;

    const confirmMsg = isPaid
        ? `Cancel ride ${rideCode}? Your payment of ₹${fare.toFixed(2)} will be refunded immediately.`
        : `Are you sure you want to cancel ride ${rideCode}?`;

    if (!confirm(confirmMsg)) return;

    try {
        const response = await fetch(`/api/rides/${rideCode}`, {
            method: 'DELETE'
        });

        const data = await response.json();
        if (response.ok && data.success) {
            // Automatically reload the rides module so the list updates immediately
            loadModule('rides');

            // Format refund info from server or cached ride
            const refundInfo = data.refund || {
                refunded: true,
                refund_id: `REF-${rideCode}-${Math.floor(1000 + Math.random() * 9000)}`,
                amount: fare,
                payment_mode: isPaid ? 'UPI' : 'UPI / Card',
                ride_code: rideCode,
                pickup: ride ? (ride.pickup_station || 'Origin') : 'Pickup Bay',
                destination: ride ? (ride.destination || 'Destination') : 'Destination',
                timestamp: new Date().toLocaleString()
            };

            // Display the Payment Refunded Successfully popup modal
            showRefundModal(refundInfo);

            if (typeof showFloatingNotification === 'function') {
                showFloatingNotification(`💸 Ride ${rideCode} cancelled: ₹${parseFloat(refundInfo.amount).toFixed(2)} refunded!`);
            }
        } else {
            alert(data.message || 'Failed to cancel ride.');
        }
    } catch (err) {
        console.error('Cancel ride error:', err);
        alert('Server communication error while cancelling ride.');
    }
};

window.deleteRide = window.cancelRide;

window.showRefundModal = function (info) {
    const modal = document.getElementById('refundModal');
    if (!modal) {
        alert(`Payment of ₹${parseFloat(info.amount || 0).toFixed(2)} for ride ${info.ride_code} refunded successfully!`);
        return;
    }

    const amtEl = document.getElementById('refundAmountDisplay');
    const modeEl = document.getElementById('refundModeDisplay');
    const txnEl = document.getElementById('refundTxnId');
    const codeEl = document.getElementById('refundRideCode');
    const routeEl = document.getElementById('refundRoute');
    const timeEl = document.getElementById('refundTimestamp');
    const subTitleEl = document.getElementById('refundSubtitleText');

    const amtFormatted = `₹${parseFloat(info.amount || 0).toFixed(2)}`;
    if (amtEl) amtEl.innerText = amtFormatted;
    if (modeEl) modeEl.innerText = `Refunded via ${info.payment_mode || 'UPI / Card'} • 100% Full Refund`;
    if (txnEl) txnEl.innerText = info.refund_id || `REF-${info.ride_code || 'RD'}`;
    if (codeEl) codeEl.innerText = info.ride_code || 'RD01';
    if (routeEl) routeEl.innerText = `${info.pickup || 'Pickup Bay'} ➔ ${info.destination || 'Destination'}`;
    if (timeEl) timeEl.innerText = info.timestamp || new Date().toLocaleString();
    if (subTitleEl) {
        subTitleEl.innerText = `Your ride reservation ${info.ride_code || ''} has been cancelled and ${amtFormatted} has been refunded successfully to your ${info.payment_mode || 'original payment method'}.`;
    }

    modal.style.display = 'flex';
};

window.closeRefundModal = function () {
    const modal = document.getElementById('refundModal');
    if (modal) modal.style.display = 'none';
};

window.cancelRideFromReceipt = function () {
    const codeEl = document.getElementById('viewRideCode');
    const rideCode = codeEl ? codeEl.innerText.trim() : null;
    if (rideCode) {
        window.closePaymentModal();
        window.cancelRide(rideCode);
    }
};

window.legacyDeleteRide = async function (rideCode) {
    if (!confirm(`Are you sure you want to remove ride ${rideCode}?`)) return;

    try {
        const response = await fetch(`/api/rides/${rideCode}`, {
            method: 'DELETE'
        });

        const data = await response.json();
        if (response.ok && data.success) {
            loadModule('rides');
        } else {
            alert(data.message || 'Failed to remove record.');
        }
    } catch (err) {
        console.error('Delete error:', err);
        alert('Server communication error while deleting ride.');
    }
};

/* ==========================================================================
   IN-VEHICLE FOOD ORDERING CONTROLS (DESTINATION-AWARE)
   ========================================================================== */
window.openFoodModalForRide = async function (rideCode) {
    await populateRideSelect(rideCode);
    const modal = document.getElementById('foodOrderModal');
    if (modal) modal.style.display = 'flex';
};

window.openFoodModalWithItem = async function (foodName, price) {
    await populateRideSelect();
    const modal = document.getElementById('foodOrderModal');
    if (modal) modal.style.display = 'flex';

    // Match item in dynamic select if present
    const itemSelect = document.getElementById('foodItemSelect');
    if (itemSelect) {
        for (let opt of itemSelect.options) {
            if (opt.value === foodName || opt.text.includes(foodName)) {
                opt.selected = true;
                break;
            }
        }
    }
};

window.onFoodRideSelectionChanged = async function () {
    const rideSelect = document.getElementById('foodRideSelect');
    const itemSelect = document.getElementById('foodItemSelect');
    const destText = document.getElementById('foodOrderDestText');
    const restText = document.getElementById('foodOrderRestaurantText');
    if (!rideSelect || !itemSelect) return;

    const selectedCode = rideSelect.value;
    let destName = 'Munnar Tea Hills Station';

    const cached = (window.activeRidesCache || []).find(r => r.ride_code === selectedCode);
    if (cached && cached.destination) {
        destName = cached.destination;
    } else {
        try {
            const res = await fetch('/api/rides');
            const rides = await res.json();
            window.activeRidesCache = rides;
            const r = rides.find(x => x.ride_code === selectedCode);
            if (r && r.destination) destName = r.destination;
        } catch (e) { }
    }

    const zoneKey = window.resolveDestinationZone(destName);
    const zoneData = window.DESTINATION_FOOD_CATALOG[zoneKey] || window.DESTINATION_FOOD_CATALOG['munnar'];

    if (destText) destText.innerText = destName;
    if (restText) restText.innerText = `${zoneData.adjacentRestaurants} (${zoneData.zoneName})`;

    itemSelect.innerHTML = '';
    zoneData.items.forEach(dish => {
        const opt = document.createElement('option');
        opt.value = dish.name;
        opt.setAttribute('data-price', dish.price);
        opt.text = `[${dish.restaurant}] ${dish.name} - ₹${dish.price}`;
        itemSelect.appendChild(opt);
    });
};

async function populateRideSelect(selectedCode) {
    const rideSelect = document.getElementById('foodRideSelect');
    if (!rideSelect) return;
    rideSelect.innerHTML = '';

    try {
        const res = await fetch('/api/rides');
        const rides = await res.json();
        window.activeRidesCache = rides;

        if (rides && rides.length > 0) {
            rides.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.ride_code;
                opt.text = `${r.ride_code} - ${r.vehicle_type} (${r.pickup_station || 'Origin'} ➔ ${r.destination || 'Destination'})`;
                if (selectedCode && r.ride_code === selectedCode) {
                    opt.selected = true;
                }
                rideSelect.appendChild(opt);
            });
        } else {
            const opt = document.createElement('option');
            opt.value = 'RD01';
            opt.text = 'RD01 - Current Ride (➔ Munnar Tea Hills)';
            rideSelect.appendChild(opt);
        }
    } catch (e) {
        const opt = document.createElement('option');
        opt.value = 'RD01';
        opt.text = 'RD01 - Active Cab';
        rideSelect.appendChild(opt);
    }

    // Populate delicacies available for the selected ride's destination
    await window.onFoodRideSelectionChanged();
}

window.closeFoodModal = function () {
    const modal = document.getElementById('foodOrderModal');
    if (modal) modal.style.display = 'none';
};

window.submitFoodOrder = async function () {
    const rideSelect = document.getElementById('foodRideSelect');
    const itemSelect = document.getElementById('foodItemSelect');
    const qtyInput = document.getElementById('foodQty');

    const ride_code = rideSelect ? rideSelect.value : 'RD01';
    const food_name = itemSelect ? itemSelect.value : 'Thalassery Dum Biryani';
    const quantity = qtyInput ? parseInt(qtyInput.value) || 1 : 1;
    const selectedOpt = itemSelect ? itemSelect.options[itemSelect.selectedIndex] : null;
    const price = selectedOpt ? parseFloat(selectedOpt.getAttribute('data-price')) || 180 : 180;

    try {
        const res = await fetch('/api/order-food', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ride_code: ride_code,
                food_name: food_name,
                quantity: quantity,
                price: price
            })
        });

        const data = await res.json();
        if (res.ok && data.success) {
            closeFoodModal();
            loadModule('food');
        } else {
            alert(data.message || 'Failed to place food order.');
        }
    } catch (err) {
        console.error('Food order error:', err);
        alert('Server communication error while placing food order.');
    }
};

window.deleteFoodOrder = async function (orderId) {
    if (!confirm(`Cancel in-vehicle food order ${orderId}?`)) return;

    try {
        const res = await fetch(`/api/food-orders/${orderId}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (res.ok && data.success) {
            loadModule('food');
        } else {
            alert(data.message || 'Failed to cancel order.');
        }
    } catch (err) {
        console.error('Delete food error:', err);
    }
};

// Close modal if user clicks outside modal card
window.addEventListener('click', (e) => {
    const bookingModal = document.getElementById('bookingModal');
    if (e.target === bookingModal) {
        closeModal();
    }
    const foodModal = document.getElementById('foodOrderModal');
    if (e.target === foodModal) {
        closeFoodModal();
    }
    const payModal = document.getElementById('paymentModal');
    const refundModal = document.getElementById('refundModal');
    if (e.target === refundModal) {
        closeRefundModal();
    }
    if (e.target === payModal) {
        closePaymentModal();
    }
});

/* ==========================================================================
   INTERACTIVE PAYMENT & CHECKOUT MODULE CONTROLS
   ========================================================================== */
window.selectedPaymentMode = 'UPI';
window.allRidesCache = [];

window.handleActionBtnClick = function () {
    if (activeModule === 'rides') {
        openModal();
    } else if (activeModule === 'payments') {
        openPaymentModal();
    } else if (activeModule === 'food') {
        openFoodModalWithItem();
    } else {
        openModal();
    }
};

window.onRideRowClicked = function (rideCode, status) {
    if (status === 'Booked & Payment Successful' || (status && status.toLowerCase().includes('success'))) {
        viewPaymentReceipt(rideCode);
    } else {
        openPaymentModal(rideCode);
    }
};

window.openPaymentModal = async function (preselectedRideCode) {
    const modal = document.getElementById('paymentModal');
    const formView = document.getElementById('paymentFormView');
    const successView = document.getElementById('paymentSuccessView');
    const receiptView = document.getElementById('paymentReceiptView');

    if (formView) formView.style.display = 'block';
    if (successView) successView.style.display = 'none';
    if (receiptView) receiptView.style.display = 'none';

    // Fetch up-to-date rides
    try {
        const res = await fetch('/api/rides');
        window.allRidesCache = await res.json();
    } catch (e) {
        console.error('Failed to fetch rides for payment modal:', e);
    }

    const select = document.getElementById('payRideSelect');
    if (select) {
        select.innerHTML = '';
        if (window.allRidesCache && window.allRidesCache.length > 0) {
            window.allRidesCache.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.ride_code;
                const isPaid = r.status === 'Booked & Payment Successful' || (r.status && r.status.toLowerCase().includes('success'));
                opt.text = `${r.ride_code} - ${r.vehicle_type} (${r.pickup_station || 'Origin'} ➔ ${r.destination || 'Destination'}) - ₹${parseFloat(r.fare_amount).toFixed(2)} [${isPaid ? 'Paid' : 'Unpaid'}]`;
                select.appendChild(opt);
            });

            // Set selection
            if (preselectedRideCode) {
                select.value = preselectedRideCode;
            } else {
                // Find first unpaid ride, or default to first
                const firstUnpaid = window.allRidesCache.find(r => r.status !== 'Booked & Payment Successful');
                if (firstUnpaid) {
                    select.value = firstUnpaid.ride_code;
                } else {
                    select.selectedIndex = 0;
                }
            }
        } else {
            const opt = document.createElement('option');
            opt.value = '';
            opt.text = 'No active rides found';
            select.appendChild(opt);
        }
    }

    updatePaymentSummaryFromSelect();
    selectPaymentMode('UPI');

    if (modal) modal.style.display = 'flex';
};

window.onPaymentRideSelectChange = function () {
    updatePaymentSummaryFromSelect();
};

function updatePaymentSummaryFromSelect() {
    const select = document.getElementById('payRideSelect');
    if (!select || !select.value) return;

    const ride = window.allRidesCache.find(r => r.ride_code === select.value);
    if (!ride) return;

    const routeDisplay = document.getElementById('payRouteDisplay');
    const driverDisplay = document.getElementById('payDriverDisplay');
    const typeDisplay = document.getElementById('payTypeDisplay');
    const fareDisplay = document.getElementById('payFareDisplay');
    const btnText = document.getElementById('btnPayText');

    const formattedFare = `₹${parseFloat(ride.fare_amount).toFixed(2)}`;

    if (routeDisplay) routeDisplay.innerText = `${ride.pickup_station || 'Origin'} ➔ ${ride.destination || 'Destination'}`;
    if (driverDisplay) driverDisplay.innerText = `${ride.vehicle_type || 'Fleet'} • ${ride.driver_name || 'Assigned Chauffeur'}`;
    if (typeDisplay) typeDisplay.innerText = `${ride.ride_type || 'Standard'} Travel (${ride.ride_group || 'Luxury'})`;
    if (fareDisplay) fareDisplay.innerText = formattedFare;
    if (btnText) btnText.innerText = formattedFare;
}

window.selectPaymentMode = function (mode) {
    window.selectedPaymentMode = mode;

    // Toggle active card
    document.querySelectorAll('.pay-mode-card').forEach(c => c.classList.remove('active'));
    const targetCard = document.getElementById(`modeCard${mode.replace(/\s+/g, '')}`);
    if (targetCard) targetCard.classList.add('active');

    // Toggle detail containers
    const upiBox = document.getElementById('upiDetailsView');
    const cardBox = document.getElementById('cardDetailsView');
    const netBox = document.getElementById('netBankingDetailsView');
    const cashBox = document.getElementById('cashDetailsView');

    if (upiBox) upiBox.style.display = mode === 'UPI' ? 'block' : 'none';
    if (cardBox) cardBox.style.display = mode === 'Card' ? 'block' : 'none';
    if (netBox) netBox.style.display = mode === 'Net Banking' ? 'block' : 'none';
    if (cashBox) cashBox.style.display = mode === 'Cash' ? 'block' : 'none';
};

window.setUpiApp = function (appName) {
    document.querySelectorAll('.upi-app-badge').forEach(b => {
        b.classList.remove('active');
        if (b.innerText.toLowerCase().includes(appName.toLowerCase())) {
            b.classList.add('active');
        }
    });

    const upiInput = document.getElementById('upiIdInput');
    if (upiInput) {
        if (appName === 'Google Pay') upiInput.value = 'druvidh@okaxis';
        else if (appName === 'PhonePe') upiInput.value = '9847012345@ybl';
        else if (appName === 'Paytm') upiInput.value = '9847012345@paytm';
        else if (appName === 'BHIM UPI') upiInput.value = 'druvidh@upi';
    }
};

window.submitPayment = async function () {
    const select = document.getElementById('payRideSelect');
    const ride_code = select ? select.value : null;

    if (!ride_code) {
        alert('Please select a ride to proceed with payment.');
        return;
    }

    const payBtn = document.getElementById('btnPayConfirm');
    const origHtml = payBtn ? payBtn.innerHTML : 'Pay';
    if (payBtn) {
        payBtn.innerHTML = 'Processing Payment...';
        payBtn.disabled = true;
    }

    try {
        const response = await fetch('/api/pay-ride', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ride_code: ride_code,
                payment_mode: window.selectedPaymentMode || 'UPI'
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Populate Success View
            const txnId = document.getElementById('successTxnId');
            const rCode = document.getElementById('successRideCode');
            const amt = document.getElementById('successAmount');
            const mode = document.getElementById('successMode');
            const time = document.getElementById('successTime');

            if (txnId) txnId.innerText = data.payment_id;
            if (rCode) rCode.innerText = data.ride_code;
            if (amt) amt.innerText = `₹${parseFloat(data.amount).toFixed(2)}`;
            if (mode) mode.innerText = data.payment_mode;
            if (time) time.innerText = data.transaction_time || new Date().toLocaleString();

            // Switch to success view
            const formView = document.getElementById('paymentFormView');
            const successView = document.getElementById('paymentSuccessView');
            if (formView) formView.style.display = 'none';
            if (successView) successView.style.display = 'block';

            // Refresh module data behind the scenes
            if (activeModule === 'rides' || activeModule === 'payments') {
                const endpoint = activeModule === 'payments' ? '/api/payments' : '/api/rides';
                const refreshRes = await fetch(endpoint);
                currentData = await refreshRes.json();
                renderTable(currentData);
            }
        } else {
            alert(data.message || 'Payment processing failed. Please try again.');
        }
    } catch (err) {
        console.error('Payment error:', err);
        alert('Server communication error during payment processing.');
    } finally {
        if (payBtn) {
            payBtn.innerHTML = origHtml;
            payBtn.disabled = false;
        }
    }
};

window.closePaymentModal = function () {
    const modal = document.getElementById('paymentModal');
    if (modal) modal.style.display = 'none';
};

window.closePaymentSuccessModal = function () {
    closePaymentModal();
    // Reload the current module to guarantee live sync!
    loadModule(activeModule);
};

window.viewPaymentReceipt = async function (rideCode) {
    try {
        const res = await fetch(`/api/payment-receipt/${rideCode}`);
        const data = await res.json();

        if (res.ok && data.success && data.receipt) {
            const r = data.receipt;
            const txnId = document.getElementById('viewTxnId');
            const rCode = document.getElementById('viewRideCode');
            const uName = document.getElementById('viewUserName');
            const route = document.getElementById('viewRoute');
            const chauf = document.getElementById('viewChauffeur');
            const amt = document.getElementById('viewAmount');
            const mode = document.getElementById('viewMode');
            const time = document.getElementById('viewTime');

            if (txnId) txnId.innerText = r.payment_id;
            if (rCode) rCode.innerText = r.ride_code;
            if (uName) uName.innerText = r.user_name || 'Passenger';
            if (route) route.innerText = `${r.pickup_station || 'Origin'} ➔ ${r.destination || 'Destination'}`;
            if (chauf) chauf.innerText = `${r.vehicle_type || 'Fleet'} • ${r.driver_name || 'Driver'}`;
            if (amt) amt.innerText = `₹${parseFloat(r.amount).toFixed(2)}`;
            if (mode) mode.innerText = r.payment_mode;
            if (time) time.innerText = r.transaction_time || 'Confirmed';

            const formView = document.getElementById('paymentFormView');
            const successView = document.getElementById('paymentSuccessView');
            const receiptView = document.getElementById('paymentReceiptView');

            if (formView) formView.style.display = 'none';
            if (successView) successView.style.display = 'none';
            if (receiptView) receiptView.style.display = 'block';

            const modal = document.getElementById('paymentModal');
            if (modal) modal.style.display = 'flex';
        } else {
            // Not paid yet
            if (confirm(`Ride ${rideCode} has not been paid yet. Would you like to proceed with payment now?`)) {
                openPaymentModal(rideCode);
            }
        }
    } catch (e) {
        console.error('Error viewing receipt:', e);
        openPaymentModal(rideCode);
    }
};

window.deletePayment = async function (paymentId) {
    if (!confirm(`Are you sure you want to delete payment record ${paymentId}? This will revert the ride to unpaid status.`)) return;

    try {
        const res = await fetch(`/api/payments/${paymentId}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (res.ok && data.success) {
            loadModule('payments');
        } else {
            alert(data.message || 'Failed to remove payment.');
        }
    } catch (err) {
        console.error('Delete payment error:', err);
    }
};

/* ==========================================================================
   DYNAMIC THEME MANAGEMENT SYSTEM
   Supports Cyber Lumina, Emerald Matrix, Amethyst Nebula, and Royal Concierge
   ========================================================================== */
let particleStyle = {
    fillRgb: '0, 242, 254',
    shadow: '#38bdf8'
};

window.switchTheme = function (themeName) {
    if (!themeName) return;
    document.documentElement.setAttribute('data-theme', themeName);
    try {
        localStorage.setItem('ride_system_theme', themeName);
    } catch (e) {
        console.warn('localStorage access failed:', e);
    }

    // Sync all theme dropdowns on page
    document.querySelectorAll('.theme-select').forEach(sel => {
        sel.value = themeName;
    });

    // Update particle colors
    updateParticleColors(themeName);
};

function initThemeManager() {
    let savedTheme = 'cyber-lumina';
    try {
        savedTheme = localStorage.getItem('ride_system_theme') || 'cyber-lumina';
    } catch (e) {
        savedTheme = 'cyber-lumina';
    }
    window.switchTheme(savedTheme);
}

function updateParticleColors(theme) {
    if (theme === 'emerald-matrix') {
        particleStyle = { fillRgb: '52, 211, 153', shadow: '#10b981' };
    } else if (theme === 'amethyst-nebula') {
        particleStyle = { fillRgb: '192, 132, 252', shadow: '#c084fc' };
    } else if (theme === 'royal-concierge') {
        particleStyle = { fillRgb: '212, 175, 55', shadow: '#fbe8a6' };
    } else {
        // Default: Cyber Lumina
        particleStyle = { fillRgb: '0, 242, 254', shadow: '#38bdf8' };
    }
}

/* ==========================================================================
   AMBIENT THEME PARTICLES ENGINE (CANVAS)
   ========================================================================== */
function initParticleCanvas() {
    const canvas = document.getElementById('particles-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let particles = [];

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    class Particle {
        constructor() {
            this.reset();
        }
        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2 + 0.5;
            this.speedY = -(Math.random() * 0.45 + 0.1);
            this.speedX = Math.random() * 0.4 - 0.2;
            this.opacity = Math.random() * 0.7 + 0.2;
        }
        update() {
            this.y += this.speedY;
            this.x += this.speedX;
            if (this.y < 0 || this.x < 0 || this.x > canvas.width) {
                this.reset();
                this.y = canvas.height;
            }
        }
        draw() {
            ctx.fillStyle = `rgba(${particleStyle.fillRgb}, ${this.opacity})`;
            ctx.shadowBlur = 10;
            ctx.shadowColor = particleStyle.shadow;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    const count = Math.min(75, Math.floor(window.innerWidth / 18));
    for (let i = 0; i < count; i++) {
        particles.push(new Particle());
    }

    function animateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        requestAnimationFrame(animateParticles);
    }
    animateParticles();
}

/* ==========================================================================
   REAL-TIME MAP & PASSENGER TELEMETRY ENGINE (GOOGLE MAPS & LEAFLET RADAR)
   Dual-Engine Architecture: Google Maps Platform (with API Key) & Free Radar Fallback
   ========================================================================== */

// Google Maps Dark Luxury / Cyber Lumina Custom Styler
const GOOGLE_DARK_STYLES = [
    { elementType: "geometry", stylers: [{ color: "#080d1a" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#080d1a" }, { weight: 3 }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
    {
        featureType: "administrative.locality",
        elementType: "labels.text.fill",
        stylers: [{ color: "#38bdf8" }]
    },
    {
        featureType: "poi",
        elementType: "labels.text.fill",
        stylers: [{ color: "#64748b" }]
    },
    {
        featureType: "poi.park",
        elementType: "geometry",
        stylers: [{ color: "#0a1f1b" }]
    },
    {
        featureType: "poi.park",
        elementType: "labels.text.fill",
        stylers: [{ color: "#10b981" }]
    },
    {
        featureType: "road",
        elementType: "geometry",
        stylers: [{ color: "#172338" }]
    },
    {
        featureType: "road",
        elementType: "geometry.stroke",
        stylers: [{ color: "#0c1424" }]
    },
    {
        featureType: "road",
        elementType: "labels.text.fill",
        stylers: [{ color: "#cbd5e1" }]
    },
    {
        featureType: "road.highway",
        elementType: "geometry",
        stylers: [{ color: "#223554" }]
    },
    {
        featureType: "road.highway",
        elementType: "geometry.stroke",
        stylers: [{ color: "#141e30" }]
    },
    {
        featureType: "road.highway",
        elementType: "labels.text.fill",
        stylers: [{ color: "#00f2fe" }]
    },
    {
        featureType: "transit",
        elementType: "geometry",
        stylers: [{ color: "#0369a1" }]
    },
    {
        featureType: "transit.station",
        elementType: "labels.text.fill",
        stylers: [{ color: "#38bdf8" }]
    },
    {
        featureType: "water",
        elementType: "geometry",
        stylers: [{ color: "#040916" }]
    },
    {
        featureType: "water",
        elementType: "labels.text.fill",
        stylers: [{ color: "#00f2fe" }]
    },
    {
        featureType: "water",
        elementType: "labels.text.stroke",
        stylers: [{ color: "#040916" }]
    }
];

// Scenic & Tourist Destinations across Kerala
const SCENIC_LANDMARKS = [
    { name: 'Thekkady Periyar Wildlife Sanctuary', district: 'Idukki', lat: 9.6031, lng: 77.1615, icon: '🐅', desc: 'Periyar Tiger Reserve, Boating & Spice Plantations' },
    { name: 'Varkala Cliff Beach & Papanasam', district: 'Trivandrum', lat: 8.7379, lng: 76.7163, icon: '🏖️', desc: 'Dramatic Red Cliffs, Natural Springs & Ocean Promenade' },
    { name: 'Athirappilly Waterfalls Scenic Point', district: 'Thrissur', lat: 10.2851, lng: 76.5698, icon: '🌊', desc: 'The Niagara of South India, Forest Riverbed' },
    { name: 'Vagamon Pine Hills & Meadows', district: 'Idukki', lat: 9.6891, lng: 76.9056, icon: '🌲', desc: 'Mist-Covered Valleys, Pine Forest & Tea Gardens' },
    { name: 'Jatayu Earth\'s Center Nature Park', district: 'Kollam', lat: 8.8687, lng: 76.8672, icon: '🦅', desc: 'World\'s Largest Bird Sculpture, Cable Car & Adventure Park' },
    { name: 'Marari Beach Promenade', district: 'Alleppey', lat: 9.6015, lng: 76.2995, icon: '🌴', desc: 'Golden Sand Coastline, Coconut Groves & Serene Resorts' }
];

// Master Directory of All 16 Kerala Transit Stations (Coordinates, Bays & Amenities)
const KERALA_STATION_DIRECTORY = [
    { station_id: 'ST01', station_name: 'Kochi Marine Drive Hub (Ernakulam)', station_no: 'BAY-01', lat: 9.9816, lng: 76.2753, district: 'Ernakulam', food_available: true, rest_stop_info: 'Marine Promenade, Fine Dining, Fast EV Charging & Metro Connect' },
    { station_id: 'ST02', station_name: 'Thiruvananthapuram Central (Trivandrum)', station_no: 'BAY-02', lat: 8.4875, lng: 76.9525, district: 'Trivandrum', food_available: true, rest_stop_info: 'Executive Lounge, Metro Connect & 24/7 Dining' },
    { station_id: 'ST03', station_name: 'Kozhikode Beach Square (Calicut)', station_no: 'BAY-03', lat: 11.2588, lng: 75.7804, district: 'Calicut', food_available: true, rest_stop_info: 'Malabar Food Court, Calicut Halwa Bazaar & Sea View Lounge' },
    { station_id: 'ST04', station_name: 'Munnar Tea Hills Station (Idukki)', station_no: 'BAY-04', lat: 10.0889, lng: 77.0595, district: 'Idukki', food_available: true, rest_stop_info: 'Highland Tea Lounge, Panoramic Mountain View & Warm Suites' },
    { station_id: 'ST05', station_name: 'Alappuzha Backwater Jetty (Alleppey)', station_no: 'BAY-05', lat: 9.4981, lng: 76.3388, district: 'Alleppey', food_available: true, rest_stop_info: 'Houseboat Terminal, Backwater Refreshments & Café' },
    { station_id: 'ST06', station_name: 'Thrissur Swaraj Round (Cultural Capital)', station_no: 'BAY-06', lat: 10.5276, lng: 76.2144, district: 'Thrissur', food_available: true, rest_stop_info: 'Cultural Heritage Hub, 24/7 Filter Coffee & EV Station' },
    { station_id: 'ST07', station_name: 'Cochin International Airport (CIAL)', station_no: 'BAY-07', lat: 10.1518, lng: 76.3930, district: 'Ernakulam', food_available: true, rest_stop_info: 'Airport VIP Terminal, 24/7 Duty-Free Dining & Cab Plaza' },
    { station_id: 'ST08', station_name: 'Kovalam Beach Promenade (Trivandrum)', station_no: 'BAY-08', lat: 8.4004, lng: 76.9787, district: 'Trivandrum', food_available: true, rest_stop_info: 'Coastal Lighthouse View, Seafood Lounge & Rest Zone' },
    { station_id: 'ST09', station_name: 'Wayanad Vythiri Hill Pass (Wayanad)', station_no: 'BAY-09', lat: 11.5544, lng: 76.0416, district: 'Wayanad', food_available: true, rest_stop_info: 'Misty Mountain Pass, Coffee Estate Café & Rest Suites' },
    { station_id: 'ST10', station_name: 'Kannur Payyambalam Coast (Kannur)', station_no: 'BAY-10', lat: 11.8745, lng: 75.3704, district: 'Kannur', food_available: true, rest_stop_info: 'Theyyam Heritage Station, Thalassery Biryani Hub' },
    { station_id: 'ST11', station_name: 'Kollam Ashtamudi Lake Hub (Kollam)', station_no: 'BAY-11', lat: 8.8932, lng: 76.6141, district: 'Kollam', food_available: true, rest_stop_info: 'Ashtamudi Backwater Boat Jetty, Lakeside Bistro & Parking' },
    { station_id: 'ST12', station_name: 'Kottayam Kumarakom Gateway (Kottayam)', station_no: 'BAY-12', lat: 9.6175, lng: 76.4301, district: 'Kottayam', food_available: true, rest_stop_info: 'Vembanad Lake Sanctuary Gateway & Spice Garden Lounge' },
    { station_id: 'ST13', station_name: 'Palakkad Fort Junction (Palakkad)', station_no: 'BAY-13', lat: 10.7663, lng: 76.6546, district: 'Palakkad', food_available: true, rest_stop_info: 'Historic Fort Rest Stop, Palakkad Matta Meals & Shaded Bays' },
    { station_id: 'ST14', station_name: 'Malappuram Kottakkal Gateway (Malappuram)', station_no: 'BAY-14', lat: 10.9984, lng: 75.9987, district: 'Malappuram', food_available: true, rest_stop_info: 'Ayurveda Heritage Hub, Herbal Tea Bar & Rest Suites' },
    { station_id: 'ST15', station_name: 'Pathanamthitta Sabarimala Junction', station_no: 'BAY-15', lat: 9.2648, lng: 76.7870, district: 'Pathanamthitta', food_available: true, rest_stop_info: 'Pilgrim Rest Center, Pure Veg Cuisine & Facilities' },
    { station_id: 'ST16', station_name: 'Kasaragod Bekal Fort Station (Kasaragod)', station_no: 'BAY-16', lat: 12.3927, lng: 75.0345, district: 'Kasaragod', food_available: true, rest_stop_info: 'Historic Bekal Fort Point, Coastal Rest Stop & Refreshments' }
];

// High-Performance Tile Providers for Leaflet (No API key needed!)
const LEAFLET_TILE_STYLES = [
    {
        name: 'Cyber Lumina Dark',
        buttonLabel: '🌙 Dark Mode',
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        subdomains: 'abcd'
    },
    {
        name: 'High-Resolution Satellite Imagery',
        buttonLabel: '🛰️ Satellite',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        subdomains: 'abcd'
    },
    {
        name: 'Kerala Street Road Map',
        buttonLabel: '🗺️ Road Map',
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        subdomains: 'abc'
    },
    {
        name: 'Topographic Terrain & Voyager',
        buttonLabel: '⛰️ Topo / Terrain',
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        subdomains: 'abcd'
    }
];

// Dual-Engine Global State
let activeMapEngine = 'leaflet'; // 'google' | 'leaflet'
let leafletMap = null;
let currentLeafletTileLayer = null;
let currentLeafletStyleIndex = 0;
let googleMap = null;
let googleTrafficLayer = null;
let trafficLayerActive = false;
let googleMapStyleMode = 'dark'; // 'dark' | 'satellite' | 'roadmap' | 'terrain'

// Marker & Layer Stores
let mapStations = [...KERALA_STATION_DIRECTORY];
let mapRides = [];
let activeTrackedRide = null;
let currentSelectedStationId = 'ST01';
let currentSelectedStationName = 'Kochi Marine Drive Hub (Ernakulam)';
let currentHudTab = 'ride'; // 'ride' | 'station'
let quickRouteMapInstance = null;
let telemetryInterval = null;
let stationPinsVisible = true;
let scenicPinsVisible = true;

// Leaflet Layer Stores
let mapStationMarkers = {};
let mapScenicMarkers = {};
let mapVehicleMarkers = {};
let mapDestinationMarkers = {};
let mapRouteLines = {};

// Google Maps Marker Stores
let googleStationMarkers = {};
let googleScenicMarkers = {};
let googleVehicleMarkers = {};
let googleDestinationMarkers = {};
let googleRoutePolylines = {};
let activeGoogleInfoWindow = null;

// API Key State
let currentGoogleApiKey = window.INITIAL_GOOGLE_MAPS_API_KEY || localStorage.getItem('google_maps_api_key') || '';
let googleMapsAuthFailed = false;

/* --- Distance & Travel Time Math --- */
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 45.0;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const straight = R * c;
    return Math.max(8.0, Number((straight * 1.35).toFixed(1)));
}

function formatRequiredTravelTime(km, vehicleType) {
    let avgSpeed = 48; // km/h
    const t = (vehicleType || '').toLowerCase();
    if (t.includes('bike') || t.includes('ather')) avgSpeed = 42;
    else if (t.includes('auto')) avgSpeed = 32;
    else if (t.includes('volvo')) avgSpeed = 40;
    else if (t.includes('tesla') || t.includes('porsche') || t.includes('benz') || t.includes('bmw')) avgSpeed = 55;

    const hoursDecimal = km / avgSpeed;
    const hours = Math.floor(hoursDecimal);
    const mins = Math.max(8, Math.round((hoursDecimal - hours) * 60));
    if (hours === 0) return `${mins} mins`;
    return `${hours}h ${mins}m`;
}

function getVehicleIcon(type) {
    if (!type) return '🚘';
    const t = type.toLowerCase();
    if (t.includes('tesla')) return '⚡';
    if (t.includes('rolls') || t.includes('ghost')) return '👑';
    if (t.includes('porsche') || t.includes('taycan')) return '🏎️';
    if (t.includes('audi') || t.includes('etron')) return '🚘';
    if (t.includes('range') || t.includes('rover')) return '🚙';
    if (t.includes('volvo') || t.includes('coach') || t.includes('bus')) return '🚌';
    if (t.includes('harley')) return '🏍️';
    if (t.includes('ather')) return '🛵';
    if (t.includes('benz') || t.includes('luxury')) return '🏎️';
    if (t.includes('bmw')) return '🏎️';
    if (t.includes('innova') || t.includes('suv')) return '🚐';
    if (t.includes('alto') || t.includes('sedan')) return '🚗';
    if (t.includes('auto')) return '🛺';
    if (t.includes('bike')) return '🏍️';
    return '🚘';
}

/* ==========================================================================
   GOOGLE MAPS DYNAMIC SCRIPT LOADER & AUTH HANDLING
   ========================================================================== */
window.gm_authFailure = function () {
    console.warn('Google Maps authentication failed. Operating with autonomous radar engine.');
    googleMapsAuthFailed = true;
    updateMapEngineBadge('warning', 'API Key Notice (Check Console)');

    const kpiGpsStatus = document.getElementById('kpiGpsStatus');
    const kpiApiKeyStatusLbl = document.getElementById('kpiApiKeyStatusLbl');
    if (kpiGpsStatus) {
        kpiGpsStatus.innerText = 'Key Auth Notice';
        kpiGpsStatus.style.color = '#fbbf24';
    }
    if (kpiApiKeyStatusLbl) {
        kpiApiKeyStatusLbl.innerText = 'Verify Key Restrictions';
    }
};

function loadGoogleMapsScript(apiKey) {
    return new Promise((resolve, reject) => {
        if (!apiKey || apiKey.trim() === '') {
            return reject(new Error('No API key provided.'));
        }

        if (window.google && window.google.maps) {
            return resolve(window.google.maps);
        }

        const existingScript = document.getElementById('googleMapsScriptTag');
        if (existingScript) {
            existingScript.remove();
        }

        window.onGoogleMapsApiLoaded = () => {
            googleMapsAuthFailed = false;
            resolve(window.google.maps);
        };

        const script = document.createElement('script');
        script.id = 'googleMapsScriptTag';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey.trim())}&libraries=geometry,places&callback=onGoogleMapsApiLoaded`;
        script.async = true;
        script.defer = true;
        script.onerror = (err) => {
            reject(err);
        };
        document.head.appendChild(script);
    });
}

/* ==========================================================================
   GOOGLE MAPS EMBED & FLEET RADAR VIEW CONTROLLERS
   ========================================================================== */
const KERALA_GOOGLE_MAP_DEFAULT_URL = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d251479.2361235366!2d76.1373051354481!3d9.986838225803274!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3b080d514abec6bf%3A0xbd582caa5844192!2sKochi%2C%20Keralam!5e0!3m2!1sen!2sin!4v1793432266396!5m2!1sen!2sin";

window.resetKeralaGoogleMap = function () {
    const iframe = document.getElementById('keralaGoogleMapIframe');
    if (iframe) {
        iframe.src = KERALA_GOOGLE_MAP_DEFAULT_URL;
    }
    document.querySelectorAll('.station-filter-pill').forEach(b => b.classList.remove('active'));
    const allBtn = document.querySelector('.station-filter-pill');
    if (allBtn) allBtn.classList.add('active');
};

window.setMapDisplayMode = function (mode) {
    const embedContainer = document.getElementById('googleMapEmbedContainer');
    const radarContainer = document.getElementById('liveTrackingMap');
    const radarToolbar = document.getElementById('radarFloatingToolbar');
    const btnEmbed = document.getElementById('btnModeGoogleEmbed');
    const btnRadar = document.getElementById('btnModeTelemetryRadar');
    const mapStatusText = document.getElementById('mapStatusText');
    const kpiGpsStatus = document.getElementById('kpiGpsStatus');
    const kpiApiKeyStatusLbl = document.getElementById('kpiApiKeyStatusLbl');

    if (mode === 'google-embed') {
        if (embedContainer) embedContainer.style.display = 'block';
        if (radarContainer) radarContainer.style.display = 'none';
        if (radarToolbar) radarToolbar.style.display = 'none';
        if (btnEmbed) btnEmbed.classList.add('active');
        if (btnRadar) btnRadar.classList.remove('active');
        if (mapStatusText) mapStatusText.innerText = 'KERALA LIVE MAP • GOOGLE MAPS PLATFORM';
        if (kpiGpsStatus) {
            kpiGpsStatus.innerText = 'Google Maps';
            kpiGpsStatus.style.color = '#38bdf8';
        }
        if (kpiApiKeyStatusLbl) kpiApiKeyStatusLbl.innerText = 'Kerala Live Map Active';

        // Synchronize active route trace into the Google Maps Embed iframe
        if (window.activeRouteTraceData) {
            const iframe = document.getElementById('keralaGoogleMapIframe');
            if (iframe) {
                const pQuery = encodeURIComponent(window.activeRouteTraceData.pickup_name + ', Kerala');
                const dQuery = encodeURIComponent(window.activeRouteTraceData.destination_name + ', Kerala');
                iframe.src = `https://maps.google.com/maps?saddr=${pQuery}&daddr=${dQuery}&output=embed`;
            }
        }
    } else {
        if (embedContainer) embedContainer.style.display = 'none';
        if (radarContainer) radarContainer.style.display = 'block';
        if (radarToolbar) radarToolbar.style.display = 'flex';
        if (btnRadar) btnRadar.classList.add('active');
        if (btnEmbed) btnEmbed.classList.remove('active');
        if (mapStatusText) mapStatusText.innerText = 'KERALA TRANSIT RADAR • FLEET TELEMETRY';
        if (window.leafletMap) {
            setTimeout(() => {
                window.leafletMap.invalidateSize();
                if (typeof window.fitActiveRouteTrace === 'function') {
                    window.fitActiveRouteTrace();
                }
            }, 100);
        }
    }
};

window.openQuickMapModal = function () {
    const modal = document.getElementById('quickMapModal');
    if (modal) modal.style.display = 'flex';
    setTimeout(() => {
        if (typeof window.renderQuickRoutePreview === 'function') {
            window.renderQuickRoutePreview();
        }
    }, 150);
};

window.closeQuickMapModal = function () {
    const modal = document.getElementById('quickMapModal');
    if (modal) modal.style.display = 'none';
};

/* ==========================================================================
   PRIMARY MAP INITIALIZER
   ========================================================================== */
window.initRealTimeMap = async function () {
    const mapElem = document.getElementById('liveTrackingMap');
    if (!mapElem) return;

    // Default to Google Maps Embed mode showing Kochi Kerala live map
    window.setMapDisplayMode('google-embed');

    // Check for API key (meta tag, localStorage, or backend config)
    if (!currentGoogleApiKey) {
        const metaKey = document.getElementById('googleMapsApiKeyMeta');
        if (metaKey && metaKey.content) {
            currentGoogleApiKey = metaKey.content.trim();
        }
    }

    if (!currentGoogleApiKey) {
        try {
            const cfgRes = await fetch('/api/config/maps');
            const cfg = await cfgRes.json();
            if (cfg && cfg.hasKey && cfg.apiKey) {
                currentGoogleApiKey = cfg.apiKey;
                localStorage.setItem('google_maps_api_key', currentGoogleApiKey);
            }
        } catch (e) {
            console.warn('Could not query /api/config/maps', e);
        }
    }

    // Initialize telemetry / radar engine for radar mode
    if (currentGoogleApiKey) {
        try {
            await loadGoogleMapsScript(currentGoogleApiKey);
            initGoogleMapsEngine();
            activeMapEngine = 'google';
            updateMapEngineBadge('active', '🟢 Google Maps Platform');
        } catch (err) {
            console.warn('Google Maps load failed, using Leaflet radar fallback:', err);
            initLeafletEngine();
            activeMapEngine = 'leaflet';
            updateMapEngineBadge('warning', '🟡 Radar Telemetry Mode');
        }
    } else {
        initLeafletEngine();
        activeMapEngine = 'leaflet';
        updateMapEngineBadge('active', '🟢 Kerala Live Radar');
    }

    // Load data and render markers in radar
    await loadMapData();
};

/* --- Google Maps Engine --- */
function initGoogleMapsEngine() {
    const mapElem = document.getElementById('liveTrackingMap');
    if (!mapElem || typeof google === 'undefined' || !google.maps) return;

    mapElem.classList.add('google-map-active');

    // Destroy Leaflet map instance if it was running inside the container
    if (leafletMap) {
        try {
            leafletMap.remove();
        } catch (e) { }
        leafletMap = null;
    }
    mapElem.innerHTML = '';

    googleMap = new google.maps.Map(mapElem, {
        center: { lat: 10.25, lng: 76.45 },
        zoom: 8,
        styles: GOOGLE_DARK_STYLES,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        backgroundColor: '#080d1a'
    });

    googleTrafficLayer = new google.maps.TrafficLayer();
    activeGoogleInfoWindow = new google.maps.InfoWindow();

    // Re-render when tiles are loaded
    google.maps.event.addListenerOnce(googleMap, 'idle', () => {
        renderAllOnActiveMap();
    });
}

/* --- Leaflet Fallback Engine --- */
function initLeafletEngine() {
    const mapElem = document.getElementById('liveTrackingMap');
    if (!mapElem || typeof L === 'undefined') return;

    mapElem.classList.remove('google-map-active');

    if (googleMap) {
        googleMap = null;
        mapElem.innerHTML = '';
    }

    if (!leafletMap) {
        mapElem.innerHTML = '';
        leafletMap = L.map('liveTrackingMap', {
            center: [10.25, 76.45],
            zoom: 8,
            zoomControl: true,
            attributionControl: false
        });

        const activeStyle = LEAFLET_TILE_STYLES[currentLeafletStyleIndex] || LEAFLET_TILE_STYLES[0];
        currentLeafletTileLayer = L.tileLayer(activeStyle.url, {
            subdomains: activeStyle.subdomains || 'abcd',
            maxZoom: 19
        }).addTo(leafletMap);
    }

    setTimeout(() => {
        if (leafletMap) leafletMap.invalidateSize();
    }, 200);
}

/* ==========================================================================
   DATA LOADING & MULTI-ENGINE RENDERING
   ========================================================================== */
async function loadMapData() {
    try {
        const res = await fetch('/api/map-data');
        const data = await res.json();
        if (data && data.success) {
            if (data.stations && data.stations.length > 0) {
                mapStations = data.stations;
            }
            mapRides = data.rides || [];
        }

        // KPI Updates
        const kpiStations = document.getElementById('kpiStationsOnline');
        if (kpiStations) kpiStations.innerText = `${mapStations.length} Hubs`;

        const kpiCabs = document.getElementById('kpiActiveCabs');
        if (kpiCabs) kpiCabs.innerText = `${mapRides.length} Active Cabs`;

        const kpiLiveSpeed = document.getElementById('kpiLiveSpeed');
        if (kpiLiveSpeed) kpiLiveSpeed.innerText = `0 km/h (At Station)`;

        // Populate Ride Selector & HUD
        populateRideSelector(mapRides);

        // Render markers for active engine
        renderAllOnActiveMap();

        // Select initial ride
        if (mapRides.length > 0) {
            const rideToSelect = activeTrackedRide ? activeTrackedRide.ride_code : mapRides[0].ride_code;
            window.onMapRideSelect(rideToSelect);
        }

        startLiveTelemetryLoop();

    } catch (e) {
        console.error('Error loading map data:', e);
    }
}

function renderAllOnActiveMap() {
    if (activeMapEngine === 'google' && googleMap) {
        renderGoogleMapStations(mapStations);
        renderGoogleScenicLandmarks();
        renderGoogleActiveRides(mapRides);
    } else if (leafletMap) {
        renderLeafletStations(mapStations);
        renderLeafletScenicLandmarks();
        renderLeafletActiveRides(mapRides);
    }
}

/* ==========================================================================
   GOOGLE MAPS MARKERS & SVG GENERATION
   ========================================================================== */
function createStationSvgIcon(stationName) {
    const cleanName = (stationName || 'Hub').split(' ')[0];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="90" height="52" viewBox="0 0 90 52">
        <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#00f2fe" flood-opacity="0.6"/>
            </filter>
        </defs>
        <rect x="5" y="24" width="80" height="24" rx="6" fill="#0b172a" stroke="#00f2fe" stroke-width="1.5" />
        <text x="45" y="40" fill="#38bdf8" font-family="'Plus Jakarta Sans', sans-serif" font-size="11" font-weight="700" text-anchor="middle">${cleanName}</text>
        <circle cx="45" cy="14" r="12" fill="#0284c7" stroke="#ffffff" stroke-width="2" filter="url(#glow)"/>
        <text x="45" y="18" fill="#ffffff" font-size="12" text-anchor="middle">📍</text>
    </svg>`;
    return {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
        scaledSize: new google.maps.Size(90, 52),
        anchor: new google.maps.Point(45, 52)
    };
}

function createScenicSvgIcon(name, iconChar) {
    const cleanName = (name || 'Landmark').split(' ')[0];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="54" viewBox="0 0 96 54">
        <defs>
            <filter id="emeraldGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#10b981" flood-opacity="0.6"/>
            </filter>
        </defs>
        <rect x="5" y="26" width="86" height="24" rx="6" fill="#061a14" stroke="#10b981" stroke-width="1.5" />
        <text x="48" y="42" fill="#34d399" font-family="'Plus Jakarta Sans', sans-serif" font-size="11" font-weight="700" text-anchor="middle">${cleanName}</text>
        <circle cx="48" cy="14" r="12" fill="#059669" stroke="#ffffff" stroke-width="2" filter="url(#emeraldGlow)"/>
        <text x="48" y="19" font-size="13" text-anchor="middle">${iconChar || '🌴'}</text>
    </svg>`;
    return {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
        scaledSize: new google.maps.Size(96, 54),
        anchor: new google.maps.Point(48, 54)
    };
}

function createVehicleSvgIcon(rideCode, vehicleType) {
    const iconChar = getVehicleIcon(vehicleType);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="110" height="66" viewBox="0 0 110 66">
        <defs>
            <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#00f2fe" flood-opacity="0.8"/>
            </filter>
        </defs>
        <rect x="5" y="38" width="100" height="22" rx="6" fill="#082f49" stroke="#0284c7" stroke-width="1.5" />
        <text x="55" y="53" fill="#38bdf8" font-family="'Plus Jakarta Sans', sans-serif" font-size="10" font-weight="800" text-anchor="middle">${rideCode} • Parked</text>
        <circle cx="55" cy="18" r="17" fill="#0f172a" stroke="#00f2fe" stroke-width="2.5" filter="url(#cyanGlow)"/>
        <text x="55" y="24" font-size="17" text-anchor="middle">${iconChar}</text>
    </svg>`;
    return {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
        scaledSize: new google.maps.Size(110, 66),
        anchor: new google.maps.Point(55, 66)
    };
}

function createDestinationSvgIcon(name, totalKm) {
    const cleanName = (name || 'Dest').split(' ')[0];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="110" height="54" viewBox="0 0 110 54">
        <defs>
            <filter id="destGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#ef4444" flood-opacity="0.7"/>
            </filter>
        </defs>
        <rect x="5" y="26" width="100" height="24" rx="6" fill="#1c1917" stroke="#ef4444" stroke-width="1.5" />
        <text x="55" y="42" fill="#fca5a5" font-family="'Plus Jakarta Sans', sans-serif" font-size="11" font-weight="800" text-anchor="middle">${cleanName} (${totalKm}km)</text>
        <circle cx="55" cy="14" r="12" fill="#dc2626" stroke="#ffffff" stroke-width="2" filter="url(#destGlow)"/>
        <text x="55" y="19" font-size="12" text-anchor="middle">🏁</text>
    </svg>`;
    return {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
        scaledSize: new google.maps.Size(110, 54),
        anchor: new google.maps.Point(55, 54)
    };
}

function renderGoogleMapStations(stations) {
    if (!googleMap || typeof google === 'undefined') return;

    Object.values(googleStationMarkers).forEach(m => m.setMap(null));
    googleStationMarkers = {};

    stations.forEach(s => {
        const marker = new google.maps.Marker({
            position: { lat: s.lat, lng: s.lng },
            map: stationPinsVisible ? googleMap : null,
            title: s.station_name,
            icon: createStationSvgIcon(s.station_name)
        });

        const popupContent = `
            <div style="min-width: 240px; font-family:'Plus Jakarta Sans',sans-serif;">
                <div style="font-size:0.95rem; font-weight:800; color:#38bdf8; margin-bottom:4px;">
                    ${s.station_name}
                </div>
                <div style="font-size:0.75rem; color:#94a3b8; margin-bottom:8px;">
                    Bay: <strong style="color:#fff;">${s.station_no}</strong> • ${s.district}
                </div>
                <div style="background:rgba(255,255,255,0.06); padding:8px 10px; border-radius:8px; font-size:0.78rem; color:#f0f4f8; margin-bottom:10px; line-height:1.4;">
                    ${s.rest_stop_info}
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <span class="badge ${s.food_available ? 'badge-success' : 'badge-info'}">
                        ${s.food_available ? '🍱 Hot Kerala Food' : '☕ Executive Bay'}
                    </span>
                    <span style="font-size:0.72rem; color:#34d399; font-weight:700;">● Active Bay</span>
                </div>
                <button onclick="quickBookFromStation('${s.station_id}')" class="map-popup-btn map-popup-btn-pickup">
                    🚖 Select as Pickup & Book
                </button>
                <button onclick="quickBookToDestination('${s.station_name.replace(/'/g, "\\'")}')" class="map-popup-btn map-popup-btn-dest">
                    🏁 Select as Destination
                </button>
                <button onclick="focusStationInHud('${s.station_id}')" class="map-popup-btn map-popup-btn-info">
                    📊 View Bay Details in HUD
                </button>
            </div>
        `;

        marker.addListener('click', () => {
            if (activeGoogleInfoWindow) {
                activeGoogleInfoWindow.setContent(popupContent);
                activeGoogleInfoWindow.open(googleMap, marker);
            }
            if (typeof window.focusStationInHud === 'function') {
                window.focusStationInHud(s.station_id);
            }
        });

        googleStationMarkers[s.station_id] = marker;
    });
}

function renderGoogleScenicLandmarks() {
    if (!googleMap || typeof google === 'undefined') return;

    Object.values(googleScenicMarkers).forEach(m => m.setMap(null));
    googleScenicMarkers = {};

    SCENIC_LANDMARKS.forEach(loc => {
        const marker = new google.maps.Marker({
            position: { lat: loc.lat, lng: loc.lng },
            map: scenicPinsVisible ? googleMap : null,
            title: loc.name,
            icon: createScenicSvgIcon(loc.name, loc.icon)
        });

        const infoContent = `
            <div style="min-width: 230px; font-family:'Plus Jakarta Sans',sans-serif;">
                <div style="font-size:0.95rem; font-weight:800; color:#34d399; margin-bottom:4px;">
                    ${loc.icon} ${loc.name}
                </div>
                <div style="font-size:0.75rem; color:#94a3b8; margin-bottom:6px;">
                    District: <strong style="color:#fff;">${loc.district}</strong> • Scenic Landmark
                </div>
                <div style="background:rgba(255,255,255,0.06); padding:8px 10px; border-radius:8px; font-size:0.76rem; color:#f0f4f8; margin-bottom:10px; line-height:1.4;">
                    ${loc.desc}
                </div>
                <button onclick="quickBookToDestination('${loc.name.replace(/'/g, "\\'")}')" class="map-popup-btn map-popup-btn-dest">
                    🏁 Select as Drop-off Destination & Book
                </button>
                <button onclick="focusScenicInHud('${loc.name.replace(/'/g, "\\'")}')" class="map-popup-btn map-popup-btn-info">
                    📊 View Landmark in HUD
                </button>
            </div>
        `;

        marker.addListener('click', () => {
            if (activeGoogleInfoWindow) {
                activeGoogleInfoWindow.setContent(infoContent);
                activeGoogleInfoWindow.open(googleMap, marker);
            }
            if (typeof window.focusScenicInHud === 'function') {
                window.focusScenicInHud(loc.name);
            }
        });

        googleScenicMarkers[loc.name] = marker;
    });
}

function renderGoogleActiveRides(rides) {
    if (!googleMap || typeof google === 'undefined') return;

    Object.values(googleVehicleMarkers).forEach(m => m.setMap(null));
    Object.values(googleDestinationMarkers).forEach(m => m.setMap(null));
    Object.values(googleRoutePolylines).forEach(l => l.setMap(null));
    googleVehicleMarkers = {};
    googleDestinationMarkers = {};
    googleRoutePolylines = {};

    rides.forEach((ride, index) => {
        const pLat = ride.pickup_lat;
        const pLng = ride.pickup_lng;
        const dLat = ride.dest_lat;
        const dLng = ride.dest_lng;

        const totalKm = calculateDistanceKm(pLat, pLng, dLat, dLng);
        const reqTime = formatRequiredTravelTime(totalKm, ride.vehicle_type);
        ride.totalDistanceKm = totalKm;
        ride.requiredTravelTime = reqTime;

        // Vehicle stationary at pickup bay
        ride.progress = 0;
        ride.currentLat = pLat;
        ride.currentLng = pLng;
        ride.speed = 0;

        // Route Polyline
        const polyline = new google.maps.Polyline({
            path: [{ lat: pLat, lng: pLng }, { lat: dLat, lng: dLng }],
            geodesic: true,
            strokeColor: index % 2 === 0 ? '#00f2fe' : '#ffd700',
            strokeOpacity: 0.85,
            strokeWeight: 4,
            map: googleMap
        });
        googleRoutePolylines[ride.ride_code] = polyline;

        // Vehicle Marker at Pickup Bay
        const vMarker = new google.maps.Marker({
            position: { lat: pLat, lng: pLng },
            map: googleMap,
            title: `${ride.ride_code} • ${ride.vehicle_type}`,
            icon: createVehicleSvgIcon(ride.ride_code, ride.vehicle_type)
        });

        const vInfoHtml = `
            <div style="min-width: 240px; font-family:'Plus Jakarta Sans',sans-serif;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <span style="font-size:0.95rem; font-weight:800; color:#38bdf8;">${ride.ride_code} • ${ride.vehicle_type}</span>
                    <span class="badge badge-info" style="font-size:0.68rem;">Ready at Bay</span>
                </div>
                <div style="color:#38bdf8; font-size:0.75rem; font-weight:700; margin-bottom:8px;">
                    🅿️ Stationary at Pickup Station (Ride Not Started)
                </div>
                <div style="font-size:0.78rem; color:#94a3b8; margin-bottom:4px;">Chauffeur: <strong style="color:#fff;">${ride.driver_name}</strong> (⭐ ${ride.rating})</div>
                <div style="font-size:0.78rem; color:#94a3b8; margin-bottom:4px;">Plate: <strong style="color:#fff;">${ride.vehicle_number}</strong></div>
                <div style="font-size:0.78rem; color:#94a3b8; margin-bottom:4px;">Pickup Bay: <strong style="color:#fff;">${ride.pickup_name}</strong></div>
                <div style="font-size:0.78rem; color:#94a3b8; margin-bottom:10px;">Target Destination: <strong style="color:#ffd700;">${ride.destination_name}</strong></div>
                
                <div style="background:rgba(255,255,255,0.06); padding:8px 10px; border-radius:8px; font-size:0.76rem; margin-bottom:12px; line-height:1.5;">
                    📍 Total Route Distance: <strong style="color:#38bdf8;">${totalKm} km</strong><br>
                    ⏱️ Required Travel Time: <strong style="color:#ffd700;">${reqTime}</strong><br>
                    ⚡ Current Vehicle Speed: <strong>0 km/h (Stationary)</strong>
                </div>

                <button onclick="window.onMapRideSelect('${ride.ride_code}')" class="btn-gold" style="width:100%; padding:7px; font-size:0.78rem;">
                    🎯 View Route HUD Details
                </button>
            </div>
        `;

        vMarker.addListener('click', () => {
            window.onMapRideSelect(ride.ride_code);
            if (activeGoogleInfoWindow) {
                activeGoogleInfoWindow.setContent(vInfoHtml);
                activeGoogleInfoWindow.open(googleMap, vMarker);
            }
        });
        googleVehicleMarkers[ride.ride_code] = vMarker;

        // Destination Flag Marker
        const destMarker = new google.maps.Marker({
            position: { lat: dLat, lng: dLng },
            map: googleMap,
            title: ride.destination_name,
            icon: createDestinationSvgIcon(ride.destination_name, totalKm)
        });

        const dInfoHtml = `
            <div style="min-width: 220px; font-family:'Plus Jakarta Sans',sans-serif;">
                <div style="font-size:0.95rem; font-weight:800; color:#fca5a5; margin-bottom:4px;">
                    🏁 Target Destination
                </div>
                <div style="font-size:0.85rem; font-weight:700; color:#fff; margin-bottom:8px;">
                    ${ride.destination_name}
                </div>
                <div style="font-size:0.78rem; color:#94a3b8; margin-bottom:4px;">
                    Pickup Origin: <strong>${ride.pickup_name}</strong>
                </div>
                <div style="font-size:0.78rem; color:#94a3b8; margin-bottom:4px;">
                    Distance: <strong style="color:#38bdf8;">${totalKm} km</strong>
                </div>
                <div style="font-size:0.78rem; color:#94a3b8; margin-bottom:10px;">
                    Required Travel Time: <strong style="color:#ffd700;">${reqTime}</strong>
                </div>
                <div style="font-size:0.74rem; color:#38bdf8; font-weight:600;">
                    Vehicle waiting at pickup station for trip launch.
                </div>
            </div>
        `;

        destMarker.addListener('click', () => {
            window.onMapRideSelect(ride.ride_code);
            if (activeGoogleInfoWindow) {
                activeGoogleInfoWindow.setContent(dInfoHtml);
                activeGoogleInfoWindow.open(googleMap, destMarker);
            }
        });
        googleDestinationMarkers[ride.ride_code] = destMarker;
    });
}

/* ==========================================================================
   LEAFLET RENDERERS (FALLBACK RADAR)
   ========================================================================== */
function renderLeafletStations(stations) {
    if (!leafletMap || typeof L === 'undefined') return;

    Object.values(mapStationMarkers).forEach(m => leafletMap.removeLayer(m));
    mapStationMarkers = {};

    stations.forEach(s => {
        const icon = L.divIcon({
            className: 'station-pin-custom',
            html: `
                <div class="station-pin-marker">
                    <div class="station-pin-dot">📍</div>
                    <div class="station-pin-title">${s.city || s.station_name.split(' ')[0]}</div>
                </div>
            `,
            iconSize: [80, 44],
            iconAnchor: [40, 36]
        });

        const marker = L.marker([s.lat, s.lng], { icon: icon }).addTo(leafletMap);

        const popupContent = `
            <div style="min-width: 240px; font-family:'Plus Jakarta Sans',sans-serif;">
                <div style="font-size:0.95rem; font-weight:800; color:var(--primary-light); margin-bottom:4px;">
                    ${s.station_name}
                </div>
                <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:8px;">
                    Bay: <strong style="color:#fff;">${s.station_no}</strong> • ${s.district}
                </div>
                <div style="background:rgba(255,255,255,0.06); padding:8px 10px; border-radius:8px; font-size:0.78rem; color:#f0f4f8; margin-bottom:10px; line-height:1.4;">
                    ${s.rest_stop_info}
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <span class="badge ${s.food_available ? 'badge-success' : 'badge-info'}">
                        ${s.food_available ? '🍱 Hot Kerala Food' : '☕ Executive Bay'}
                    </span>
                    <span style="font-size:0.72rem; color:var(--success); font-weight:700;">● Active Pickup Bay</span>
                </div>
                <button onclick="quickBookFromStation('${s.station_id}')" class="map-popup-btn map-popup-btn-pickup">
                    🚖 Select as Pickup & Book
                </button>
                <button onclick="quickBookToDestination('${s.station_name.replace(/'/g, "\\'")}')" class="map-popup-btn map-popup-btn-dest">
                    🏁 Select as Destination
                </button>
                <button onclick="focusStationInHud('${s.station_id}')" class="map-popup-btn map-popup-btn-info">
                    📊 View Bay Details in HUD
                </button>
            </div>
        `;

        marker.bindPopup(popupContent);
        marker.on('click', () => {
            if (typeof window.focusStationInHud === 'function') {
                window.focusStationInHud(s.station_id);
            }
        });
        mapStationMarkers[s.station_id] = marker;
    });
}

function renderLeafletScenicLandmarks() {
    if (!leafletMap || typeof L === 'undefined') return;

    Object.values(mapScenicMarkers).forEach(m => leafletMap.removeLayer(m));
    mapScenicMarkers = {};

    SCENIC_LANDMARKS.forEach(loc => {
        const icon = L.divIcon({
            className: 'scenic-pin-custom',
            html: `
                <div class="scenic-pin-marker">
                    <div class="scenic-pin-dot">${loc.icon}</div>
                    <div class="scenic-pin-title">${loc.name.split(' ')[0]}</div>
                </div>
            `,
            iconSize: [90, 48],
            iconAnchor: [45, 40]
        });

        const marker = L.marker([loc.lat, loc.lng], { icon: icon }).addTo(leafletMap);
        marker.bindPopup(`
            <div style="min-width: 230px; font-family:'Plus Jakarta Sans',sans-serif;">
                <div style="font-size:0.95rem; font-weight:800; color:#34d399; margin-bottom:4px;">
                    ${loc.icon} ${loc.name}
                </div>
                <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:6px;">
                    District: <strong style="color:#fff;">${loc.district}</strong> • Scenic Landmark
                </div>
                <div style="background:rgba(255,255,255,0.06); padding:8px 10px; border-radius:8px; font-size:0.76rem; color:#f0f4f8; margin-bottom:10px; line-height:1.4;">
                    ${loc.desc}
                </div>
                <button onclick="quickBookToDestination('${loc.name.replace(/'/g, "\\'")}')" class="map-popup-btn map-popup-btn-dest">
                    🏁 Select as Drop-off Destination & Book
                </button>
                <button onclick="focusScenicInHud('${loc.name.replace(/'/g, "\\'")}')" class="map-popup-btn map-popup-btn-info">
                    📊 View Landmark in HUD
                </button>
            </div>
        `);
        marker.on('click', () => {
            if (typeof window.focusScenicInHud === 'function') {
                window.focusScenicInHud(loc.name);
            }
        });
        mapScenicMarkers[loc.name] = marker;
    });
}

function renderLeafletActiveRides(rides) {
    if (!leafletMap || typeof L === 'undefined') return;

    Object.values(mapVehicleMarkers).forEach(v => leafletMap.removeLayer(v));
    Object.values(mapDestinationMarkers).forEach(d => leafletMap.removeLayer(d));
    Object.values(mapRouteLines).forEach(l => leafletMap.removeLayer(l));
    mapVehicleMarkers = {};
    mapDestinationMarkers = {};
    mapRouteLines = {};

    rides.forEach((ride, index) => {
        const pLat = ride.pickup_lat;
        const pLng = ride.pickup_lng;
        const dLat = ride.dest_lat;
        const dLng = ride.dest_lng;

        const totalKm = calculateDistanceKm(pLat, pLng, dLat, dLng);
        const reqTime = formatRequiredTravelTime(totalKm, ride.vehicle_type);
        ride.totalDistanceKm = totalKm;
        ride.requiredTravelTime = reqTime;

        ride.progress = 0;
        ride.currentLat = pLat;
        ride.currentLng = pLng;
        ride.speed = 0;

        const polyline = L.polyline([[pLat, pLng], [dLat, dLng]], {
            color: index % 2 === 0 ? '#00f2fe' : '#ffd700',
            weight: 4,
            opacity: 0.8,
            dashArray: '8, 8'
        }).addTo(leafletMap);

        polyline.bindTooltip(`
            <div style="font-size:0.75rem; font-weight:700;">
                🛣️ ${ride.pickup_name.split(' ')[0]} ➔ ${ride.destination_name.split(' ')[0]}<br>
                📏 <strong>${totalKm} km</strong> • ⏱️ <strong>${reqTime} required</strong>
            </div>
        `, { sticky: true });
        mapRouteLines[ride.ride_code] = polyline;

        const vIcon = L.divIcon({
            className: 'vehicle-marker-custom',
            html: `
                <div class="vehicle-marker-wrapper" onclick="window.onMapRideSelect('${ride.ride_code}')">
                    <div class="vehicle-pulse-circle" style="border: 2px solid #00f2fe;">${getVehicleIcon(ride.vehicle_type)}</div>
                    <div class="vehicle-marker-badge">${ride.ride_code} • ${ride.vehicle_type}</div>
                    <div class="vehicle-parked-badge">🅿️ Parked at Bay</div>
                </div>
            `,
            iconSize: [110, 68],
            iconAnchor: [55, 34]
        });

        const vMarker = L.marker([pLat, pLng], { icon: vIcon }).addTo(leafletMap);
        vMarker.bindPopup(`
            <div style="min-width: 240px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <span style="font-size:0.95rem; font-weight:800; color:var(--primary-light);">${ride.ride_code} • ${ride.vehicle_type}</span>
                    <span class="badge badge-info" style="font-size:0.68rem;">Ready at Bay</span>
                </div>
                <div style="color:#38bdf8; font-size:0.75rem; font-weight:700; margin-bottom:8px;">
                    🅿️ Stationary at Pickup Station (Ride Not Started)
                </div>
                <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:4px;">Chauffeur: <strong style="color:#fff;">${ride.driver_name}</strong> (⭐ ${ride.rating})</div>
                <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:4px;">Plate: <strong style="color:#fff;">${ride.vehicle_number}</strong></div>
                <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:4px;">Pickup Bay: <strong style="color:#fff;">${ride.pickup_name}</strong></div>
                <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:10px;">Target Destination: <strong style="color:#ffd700;">${ride.destination_name}</strong></div>
                
                <div style="background:rgba(255,255,255,0.06); padding:8px 10px; border-radius:8px; font-size:0.76rem; margin-bottom:12px; line-height:1.5;">
                    📍 Total Route Distance: <strong style="color:var(--primary-light);">${totalKm} km</strong><br>
                    ⏱️ Required Travel Time: <strong style="color:#ffd700;">${reqTime}</strong><br>
                    ⚡ Current Vehicle Speed: <strong>0 km/h (Stationary)</strong>
                </div>

                <button onclick="window.onMapRideSelect('${ride.ride_code}')" class="btn-gold" style="width:100%; padding:7px; font-size:0.78rem;">
                    🎯 View Route HUD Details
                </button>
            </div>
        `);
        mapVehicleMarkers[ride.ride_code] = vMarker;

        const destIcon = L.divIcon({
            className: 'destination-pin-custom',
            html: `
                <div class="destination-pin-marker" onclick="window.onMapRideSelect('${ride.ride_code}')">
                    <div class="destination-pin-dot">🏁</div>
                    <div class="destination-pin-title">${ride.destination_name.split(' ')[0]} (${totalKm} km)</div>
                </div>
            `,
            iconSize: [100, 48],
            iconAnchor: [50, 40]
        });

        const destMarker = L.marker([dLat, dLng], { icon: destIcon }).addTo(leafletMap);
        destMarker.bindPopup(`
            <div style="min-width: 220px;">
                <div style="font-size:0.95rem; font-weight:800; color:#fca5a5; margin-bottom:4px;">
                    🏁 Target Destination
                </div>
                <div style="font-size:0.85rem; font-weight:700; color:#fff; margin-bottom:8px;">
                    ${ride.destination_name}
                </div>
                <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:4px;">
                    Pickup Origin: <strong>${ride.pickup_name}</strong>
                </div>
                <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:4px;">
                    Distance: <strong style="color:var(--primary-light);">${totalKm} km</strong>
                </div>
                <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:10px;">
                    Required Travel Time: <strong style="color:#ffd700;">${reqTime}</strong>
                </div>
                <div style="font-size:0.74rem; color:#38bdf8; font-weight:600;">
                    Vehicle waiting at pickup station for trip launch.
                </div>
            </div>
        `);
        mapDestinationMarkers[ride.ride_code] = destMarker;
    });
}

/* ==========================================================================
   NAVIGATION, SELECTION & HUD TELEMETRY
   ========================================================================== */
function populateRideSelector(rides) {
    const sel = document.getElementById('mapRideSelector');
    if (!sel) return;

    sel.innerHTML = '';
    if (rides.length === 0) {
        sel.innerHTML = '<option value="">No Active Rides</option>';
        return;
    }

    rides.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.ride_code;
        opt.innerText = `${r.ride_code} — ${r.driver_name} (${r.vehicle_type}) ➔ ${r.destination_name.split(' ')[0]}`;
        sel.appendChild(opt);
    });
}

window.onMapRideSelect = function (rideCode) {
    const ride = mapRides.find(r => r.ride_code === rideCode);
    if (!ride) return;

    activeTrackedRide = ride;
    const sel = document.getElementById('mapRideSelector');
    if (sel) sel.value = rideCode;

    const totalKm = ride.totalDistanceKm || calculateDistanceKm(ride.pickup_lat, ride.pickup_lng, ride.dest_lat, ride.dest_lng);
    const reqTime = ride.requiredTravelTime || formatRequiredTravelTime(totalKm, ride.vehicle_type);

    // Update HUD Fields
    const elCode = document.getElementById('hudRideCode');
    const elPass = document.getElementById('hudPassenger');
    const elChauf = document.getElementById('hudChauffeur');
    const elVeh = document.getElementById('hudVehicle');
    const elRoute = document.getElementById('hudRouteText');
    const elProgPct = document.getElementById('hudProgressPercent');
    const elProgFill = document.getElementById('hudProgressFill');
    const elSpeed = document.getElementById('hudSpeed');
    const elEta = document.getElementById('hudEta');
    const elRem = document.getElementById('hudRemaining');
    const elGps = document.getElementById('hudGpsCoord');

    if (elCode) elCode.innerText = ride.ride_code;
    if (elPass) elPass.innerText = ride.user_name || 'Passenger';
    if (elChauf) elChauf.innerText = `${ride.driver_name} (⭐ ${ride.rating})`;
    if (elVeh) elVeh.innerText = `${ride.vehicle_type} • ${ride.vehicle_number}`;
    if (elRoute) elRoute.innerText = `${ride.pickup_name.split(' ')[0]} ➔ ${ride.destination_name.split(' ')[0]}`;

    if (elProgPct) elProgPct.innerText = `At Pickup Bay • Ride Not Started`;
    if (elProgFill) elProgFill.style.width = `0%`;
    if (elSpeed) elSpeed.innerHTML = `0 <small>km/h (Stationary)</small>`;
    if (elEta) elEta.innerHTML = `${reqTime} <small>required</small>`;
    if (elRem) elRem.innerHTML = `${totalKm} <small>km route</small>`;
    if (elGps) elGps.innerText = `${ride.pickup_lat.toFixed(4)}° N, ${ride.pickup_lng.toFixed(4)}° E (Pickup Bay)`;

    // Render high-contrast route trace, pickup station beacon, destination station beacon, and distance badge on map
    window.displayRouteTraceOnMap(ride);
};

window.activeRouteTraceLayerGroup = null;
window.activeRouteTraceData = null;

window.displayRouteTraceOnMap = function (ride) {
    if (!ride) return;

    const pLat = Number(ride.pickup_lat);
    const pLng = Number(ride.pickup_lng);
    const dLat = Number(ride.dest_lat);
    const dLng = Number(ride.dest_lng);

    if (isNaN(pLat) || isNaN(pLng) || isNaN(dLat) || isNaN(dLng)) return;

    const totalKm = ride.totalDistanceKm || calculateDistanceKm(pLat, pLng, dLat, dLng);
    const reqTime = ride.requiredTravelTime || formatRequiredTravelTime(totalKm, ride.vehicle_type);

    window.activeRouteTraceData = {
        ride_code: ride.ride_code,
        pickup_name: ride.pickup_name,
        destination_name: ride.destination_name,
        pickup_lat: pLat,
        pickup_lng: pLng,
        dest_lat: dLat,
        dest_lng: dLng,
        totalKm,
        reqTime
    };

    // 1. Update Top Floating Route Trace Information Bar
    const barEl = document.getElementById('mapActiveRouteTraceBar');
    const pNameEl = document.getElementById('tracePickupStationName');
    const dNameEl = document.getElementById('traceDestStationName');
    const distEl = document.getElementById('traceDistanceValue');
    const timeEl = document.getElementById('traceTimeValue');

    if (barEl) barEl.style.display = 'flex';
    if (pNameEl) pNameEl.innerText = ride.pickup_name;
    if (dNameEl) dNameEl.innerText = ride.destination_name;
    if (distEl) distEl.innerText = `${totalKm} km`;
    if (timeEl) timeEl.innerText = reqTime;

    // 2. Synchronize Google Maps Live Embed Iframe (The map provided by user)
    const iframe = document.getElementById('keralaGoogleMapIframe');
    if (iframe) {
        const pQuery = encodeURIComponent(ride.pickup_name.includes('Kerala') ? ride.pickup_name : `${ride.pickup_name}, Kerala`);
        const dQuery = encodeURIComponent(ride.destination_name.includes('Kerala') ? ride.destination_name : `${ride.destination_name}, Kerala`);
        iframe.src = `https://maps.google.com/maps?saddr=${pQuery}&daddr=${dQuery}&output=embed`;
    }

    // Update the external "Open Google Maps" link in header for full driving directions
    const gmapsExtLink = document.querySelector('.map-quick-links .map-external-link');
    if (gmapsExtLink) {
        gmapsExtLink.href = `https://www.google.com/maps/dir/?api=1&origin=${pLat},${pLng}&destination=${dLat},${dLng}&travelmode=driving`;
        gmapsExtLink.title = `Turn-by-turn navigation: ${ride.pickup_name} to ${ride.destination_name}`;
    }

    // 3. Render High-Contrast Route Trace on Leaflet Interactive Radar Canvas
    if (leafletMap && typeof L !== 'undefined') {
        if (!window.activeRouteTraceLayerGroup) {
            window.activeRouteTraceLayerGroup = L.featureGroup().addTo(leafletMap);
        }
        window.activeRouteTraceLayerGroup.clearLayers();

        // Natural Kerala Highway Curvature Waypoint
        const midLat = (pLat + dLat) / 2 + (dLng - pLng) * 0.12;
        const midLng = (pLng + dLng) / 2 - (dLat - pLat) * 0.12;
        const traceCoords = [
            [pLat, pLng],
            [midLat, midLng],
            [dLat, dLng]
        ];

        // Cyan Glowing Route Aura
        L.polyline(traceCoords, {
            color: '#00f2fe',
            weight: 10,
            opacity: 0.45,
            lineCap: 'round',
            lineJoin: 'round'
        }).addTo(window.activeRouteTraceLayerGroup);

        // Core Golden Highway Trace with animated dashes
        L.polyline(traceCoords, {
            color: '#ffd700',
            weight: 4.5,
            opacity: 0.95,
            dashArray: '10, 8'
        }).addTo(window.activeRouteTraceLayerGroup);

        // Prominent PICKUP STATION Beacon Marker
        const pickupIcon = L.divIcon({
            className: 'trace-beacon-pickup-container',
            html: `
                <div class="map-trace-beacon pickup">
                    <div class="map-trace-beacon-badge">📍 PICKUP: ${ride.pickup_name.split(' ')[0]}</div>
                    <div class="map-trace-beacon-pin">🚖</div>
                </div>
            `,
            iconSize: [120, 64],
            iconAnchor: [60, 60]
        });
        const pickupMarker = L.marker([pLat, pLng], { icon: pickupIcon, zIndexOffset: 1000 }).addTo(window.activeRouteTraceLayerGroup);
        pickupMarker.bindPopup(`
            <div style="min-width: 210px; font-family: 'Outfit', sans-serif;">
                <div style="font-size: 0.72rem; color: #10b981; font-weight: 800; text-transform: uppercase;">● Origin Pickup Station</div>
                <strong style="color: #fff; font-size: 0.95rem;">${ride.pickup_name}</strong>
                <div style="color: #cbd5e1; font-size: 0.76rem; margin-top: 4px;">
                    Coordinates: <code>${pLat.toFixed(4)}° N, ${pLng.toFixed(4)}° E</code>
                </div>
                <div style="color: #38bdf8; font-size: 0.76rem; margin-top: 3px;">
                    Vehicle: ${ride.vehicle_type} (${ride.vehicle_number})
                </div>
            </div>
        `);

        // Prominent DESTINATION STATION Beacon Marker
        const destIcon = L.divIcon({
            className: 'trace-beacon-dest-container',
            html: `
                <div class="map-trace-beacon dest">
                    <div class="map-trace-beacon-badge">🏁 DESTINATION: ${ride.destination_name.split(' ')[0]}</div>
                    <div class="map-trace-beacon-pin">🏁</div>
                </div>
            `,
            iconSize: [140, 64],
            iconAnchor: [70, 60]
        });
        const destMarker = L.marker([dLat, dLng], { icon: destIcon, zIndexOffset: 1000 }).addTo(window.activeRouteTraceLayerGroup);
        destMarker.bindPopup(`
            <div style="min-width: 210px; font-family: 'Outfit', sans-serif;">
                <div style="font-size: 0.72rem; color: #f59e0b; font-weight: 800; text-transform: uppercase;">● Target Destination Station</div>
                <strong style="color: #fff; font-size: 0.95rem;">${ride.destination_name}</strong>
                <div style="color: #cbd5e1; font-size: 0.76rem; margin-top: 4px;">
                    Distance to Travel: <strong style="color: #ffd700;">${totalKm} km</strong>
                </div>
                <div style="color: #38bdf8; font-size: 0.76rem; margin-top: 3px;">
                    Required Travel Time: <strong>${reqTime}</strong>
                </div>
            </div>
        `);

        // Midpoint Distance Trace Chip
        const midIcon = L.divIcon({
            className: 'trace-midpoint-container',
            html: `
                <div class="map-trace-midpoint-chip">
                    📏 ${totalKm} km Route Trace • ⏱️ ${reqTime}
                </div>
            `,
            iconSize: [200, 32],
            iconAnchor: [100, 16]
        });
        L.marker([midLat, midLng], { icon: midIcon, interactive: false, zIndexOffset: 500 }).addTo(window.activeRouteTraceLayerGroup);

        // Fit map bounds to show both stations and the full trace line clearly
        const bounds = L.latLngBounds([[pLat, pLng], [dLat, dLng]]);
        leafletMap.fitBounds(bounds, { padding: [85, 85], maxZoom: 13, duration: 1.0 });
    }

    // 4. Highlight for Google Maps JS API Engine if active
    if (activeMapEngine === 'google' && googleMap && typeof google !== 'undefined') {
        Object.entries(googleRoutePolylines).forEach(([code, line]) => {
            if (code === ride.ride_code) {
                line.setOptions({ strokeColor: '#ffd700', strokeWeight: 6, strokeOpacity: 1 });
            } else {
                line.setOptions({ strokeColor: '#4b5563', strokeWeight: 2, strokeOpacity: 0.25 });
            }
        });
        const bounds = new google.maps.LatLngBounds();
        bounds.extend({ lat: pLat, lng: pLng });
        bounds.extend({ lat: dLat, lng: dLng });
        googleMap.fitBounds(bounds, 90);
    }
};

window.fitActiveRouteTrace = function () {
    if (!window.activeRouteTraceData) return;
    const { pickup_lat, pickup_lng, dest_lat, dest_lng } = window.activeRouteTraceData;
    if (activeMapEngine === 'google' && googleMap && typeof google !== 'undefined') {
        const bounds = new google.maps.LatLngBounds();
        bounds.extend({ lat: pickup_lat, lng: pickup_lng });
        bounds.extend({ lat: dest_lat, lng: dest_lng });
        googleMap.fitBounds(bounds, 90);
    } else if (leafletMap) {
        const bounds = L.latLngBounds([[pickup_lat, pickup_lng], [dest_lat, dest_lng]]);
        leafletMap.fitBounds(bounds, { padding: [85, 85], maxZoom: 13, duration: 1.0 });
    }
};

window.toggleTraceMapEngine = function () {
    const embedContainer = document.getElementById('googleMapEmbedContainer');
    const isGoogleActive = embedContainer && embedContainer.style.display !== 'none';
    if (isGoogleActive) {
        window.setMapDisplayMode('telemetry-radar');
    } else {
        window.setMapDisplayMode('google-embed');
    }
};

window.trackRideOnMap = function (rideCode) {
    activeTrackedRide = mapRides.find(r => r.ride_code === rideCode) || { ride_code: rideCode };
    loadModule('map');
    setTimeout(() => {
        window.onMapRideSelect(rideCode);
    }, 400);
};

window.centerOnActiveRide = function () {
    if (!activeTrackedRide) return;
    const lat = activeTrackedRide.pickup_lat;
    const lng = activeTrackedRide.pickup_lng;
    if (!lat || !lng) return;

    if (activeMapEngine === 'google' && googleMap) {
        googleMap.panTo({ lat, lng });
        googleMap.setZoom(14);
    } else if (leafletMap) {
        leafletMap.flyTo([lat, lng], 13, { duration: 1.0 });
    }
};

window.zoomToKerala = function (btnElem) {
    window.resetKeralaGoogleMap();

    // Reset pill buttons
    document.querySelectorAll('.station-filter-pill').forEach(b => b.classList.remove('active'));
    if (btnElem) btnElem.classList.add('active');

    if (activeMapEngine === 'google' && googleMap) {
        googleMap.panTo({ lat: 10.25, lng: 76.45 });
        googleMap.setZoom(8);
    } else if (leafletMap) {
        leafletMap.flyTo([10.25, 76.45], 8, { duration: 1.0 });
    }
    showFloatingNotification('🗺️ Viewing All Kerala Network (16 Hubs)');
};

window.currentHudStation = null;

window.zoomToStation = function (stationId, btnElem) {
    const station = (mapStations && mapStations.find(s => s.station_id === stationId)) ||
        (window.KERALA_STATION_DIRECTORY && window.KERALA_STATION_DIRECTORY.find(s => s.station_id === stationId));
    if (!station) return;

    document.querySelectorAll('.station-filter-pill').forEach(b => b.classList.remove('active'));
    if (btnElem) {
        btnElem.classList.add('active');
    } else {
        const foundBtn = document.querySelector(`.station-filter-pill[onclick*="'${stationId}'"]`);
        if (foundBtn) foundBtn.classList.add('active');
    }

    // Focus station details in the HUD panel
    window.focusStationInHud(stationId);

    // Determine current pickup origin station
    const currentOrigin = (activeTrackedRide && activeTrackedRide.pickup_lat && activeTrackedRide.station_id !== stationId)
        ? { name: activeTrackedRide.pickup_name, lat: activeTrackedRide.pickup_lat, lng: activeTrackedRide.pickup_lng }
        : { name: 'Kochi Marine Drive Hub (Ernakulam)', lat: 9.9816, lng: 76.2753 };

    // Update active route trace between pickup origin and this station
    window.displayRouteTraceOnMap({
        ride_code: activeTrackedRide ? activeTrackedRide.ride_code : 'TRANSIT',
        pickup_name: currentOrigin.name,
        destination_name: station.station_name,
        pickup_lat: currentOrigin.lat,
        pickup_lng: currentOrigin.lng,
        dest_lat: station.lat,
        dest_lng: station.lng,
        vehicle_type: activeTrackedRide ? activeTrackedRide.vehicle_type : 'Mercedes-Benz Luxury EV',
        driver_name: activeTrackedRide ? activeTrackedRide.driver_name : 'Fleet Transit Driver'
    });
};

window.zoomToScenic = function (landmarkName, btnElem) {
    const landmark = window.KERALA_SCENIC_LANDMARKS ? window.KERALA_SCENIC_LANDMARKS.find(l => l.name === landmarkName) : null;
    if (!landmark) return;

    document.querySelectorAll('.station-filter-pill').forEach(b => b.classList.remove('active'));
    if (btnElem) {
        btnElem.classList.add('active');
    } else {
        const foundBtn = document.querySelector(`.station-filter-pill[onclick*="${landmarkName.substring(0, 10)}"]`);
        if (foundBtn) foundBtn.classList.add('active');
    }

    // Focus scenic spot in HUD
    window.focusScenicInHud(landmarkName);

    // Determine current pickup origin station
    const currentOrigin = (activeTrackedRide && activeTrackedRide.pickup_lat)
        ? { name: activeTrackedRide.pickup_name, lat: activeTrackedRide.pickup_lat, lng: activeTrackedRide.pickup_lng }
        : { name: 'Kochi Marine Drive Hub (Ernakulam)', lat: 9.9816, lng: 76.2753 };

    // Update active route trace between origin and this scenic spot
    window.displayRouteTraceOnMap({
        ride_code: activeTrackedRide ? activeTrackedRide.ride_code : 'SCENIC-TOUR',
        pickup_name: currentOrigin.name,
        destination_name: landmark.name,
        pickup_lat: currentOrigin.lat,
        pickup_lng: currentOrigin.lng,
        dest_lat: landmark.lat,
        dest_lng: landmark.lng,
        vehicle_type: activeTrackedRide ? activeTrackedRide.vehicle_type : 'Executive Tourism Cab',
        driver_name: activeTrackedRide ? activeTrackedRide.driver_name : 'Kerala Tourism Chauffeur'
    });
};

window.filterStationsByRegion = function (region, chipElem) {
    document.querySelectorAll('.region-filter-chip').forEach(c => c.classList.remove('active'));
    if (chipElem) chipElem.classList.add('active');

    const pills = document.querySelectorAll('#stationFilterScroll .station-filter-pill');
    pills.forEach(pill => {
        const pRegion = pill.getAttribute('data-region') || '';
        if (region === 'all') {
            pill.style.display = '';
        } else if (pRegion.includes(region)) {
            pill.style.display = '';
        } else {
            pill.style.display = 'none';
        }
    });

    // Fly camera to regional center
    const regionCenters = {
        'all': { lat: 10.25, lng: 76.45, zoom: 8 },
        'central': { lat: 10.10, lng: 76.35, zoom: 10 },
        'south': { lat: 8.75, lng: 76.85, zoom: 9 },
        'north': { lat: 11.85, lng: 75.45, zoom: 9 },
        'hills': { lat: 10.05, lng: 77.05, zoom: 9 },
        'scenic': { lat: 9.60, lng: 76.60, zoom: 8 }
    };
    const target = regionCenters[region] || regionCenters['all'];

    if (activeMapEngine === 'google' && googleMap) {
        googleMap.panTo({ lat: target.lat, lng: target.lng });
        googleMap.setZoom(target.zoom);
    } else if (leafletMap) {
        leafletMap.flyTo([target.lat, target.lng], target.zoom, { duration: 1.0 });
    }
    showFloatingNotification(`📍 Region: ${region.toUpperCase()} Filtered`);
};

window.switchHudTab = function (tab) {
    const rideView = document.getElementById('hudRideViewContainer');
    const stationView = document.getElementById('hudStationViewContainer');
    const btnRide = document.getElementById('btnHudTabRide');
    const btnStation = document.getElementById('btnHudTabStation');
    const badge = document.getElementById('hudBadgeLiveStatus');

    if (tab === 'ride') {
        if (rideView) rideView.style.display = 'block';
        if (stationView) stationView.style.display = 'none';
        if (btnRide) btnRide.classList.add('active');
        if (btnStation) btnStation.classList.remove('active');
        if (badge) badge.innerText = 'LIVE RADAR';
    } else if (tab === 'station') {
        if (rideView) rideView.style.display = 'none';
        if (stationView) stationView.style.display = 'block';
        if (btnRide) btnRide.classList.remove('active');
        if (btnStation) btnStation.classList.add('active');
        if (badge) badge.innerText = 'STATION BAY';
    }
};

window.focusStationInHud = function (stationId) {
    const station = (mapStations && mapStations.find(s => s.station_id === stationId)) ||
        (window.KERALA_STATION_DIRECTORY && window.KERALA_STATION_DIRECTORY.find(s => s.station_id === stationId));
    if (!station) return;

    window.currentHudStation = station;
    window.switchHudTab('station');

    const nameEl = document.getElementById('hudStationName');
    const bayEl = document.getElementById('hudStationBay');
    const distEl = document.getElementById('hudStationDistrict');
    const amenEl = document.getElementById('hudStationAmenities');
    const foodEl = document.getElementById('hudStationFoodZone');
    const gpsEl = document.getElementById('hudStationGps');
    const badgeFood = document.getElementById('hudStationFoodBadge');
    const cabsEl = document.getElementById('hudStationCabsCount');

    if (nameEl) nameEl.innerText = `${station.station_id} - ${station.station_name}`;
    if (bayEl) bayEl.innerText = station.bay || 'BAY-01';
    if (distEl) distEl.innerText = station.district || 'Kerala Transit Hub';
    if (amenEl) amenEl.innerText = station.amenities || 'Waiting lounge, taxi dispatch, EV charging & refreshments';
    if (foodEl) foodEl.innerText = station.food_zone || 'Kerala Central Food Hub';
    if (gpsEl) gpsEl.innerText = `${Number(station.lat).toFixed(4)}° N, ${Number(station.lng).toFixed(4)}° E`;
    if (badgeFood) badgeFood.style.display = station.food_zone ? 'inline-block' : 'none';
    if (cabsEl) cabsEl.innerText = `● Active Fleet Station (3 Cabs Standby)`;
};

window.focusScenicInHud = function (landmarkName) {
    const spot = window.KERALA_SCENIC_LANDMARKS ? window.KERALA_SCENIC_LANDMARKS.find(l => l.name === landmarkName) : null;
    if (!spot) return;

    window.currentHudStation = {
        station_id: 'SCENIC',
        station_name: spot.name,
        district: spot.district,
        lat: spot.lat,
        lng: spot.lng,
        bay: 'Scenic Spot',
        amenities: spot.desc,
        food_zone: 'Kerala Scenic Gastronomy'
    };
    window.switchHudTab('station');

    const nameEl = document.getElementById('hudStationName');
    const bayEl = document.getElementById('hudStationBay');
    const distEl = document.getElementById('hudStationDistrict');
    const amenEl = document.getElementById('hudStationAmenities');
    const foodEl = document.getElementById('hudStationFoodZone');
    const gpsEl = document.getElementById('hudStationGps');
    const badgeFood = document.getElementById('hudStationFoodBadge');
    const cabsEl = document.getElementById('hudStationCabsCount');

    if (nameEl) nameEl.innerText = spot.name;
    if (bayEl) bayEl.innerText = 'Scenic Viewpoint';
    if (distEl) distEl.innerText = spot.district;
    if (amenEl) amenEl.innerText = spot.desc;
    if (foodEl) foodEl.innerText = 'Regional Kerala Delicacies';
    if (gpsEl) gpsEl.innerText = `${Number(spot.lat).toFixed(4)}° N, ${Number(spot.lng).toFixed(4)}° E`;
    if (badgeFood) badgeFood.style.display = 'inline-block';
    if (cabsEl) cabsEl.innerText = `● Tourist Destination Spot`;
};

window.toggleStationPins = function () {
    stationPinsVisible = !stationPinsVisible;

    if (activeMapEngine === 'google' && googleMap) {
        Object.values(googleStationMarkers).forEach(m => m.setMap(stationPinsVisible ? googleMap : null));
    }
    if (leafletMap) {
        Object.values(mapStationMarkers).forEach(m => {
            if (stationPinsVisible) leafletMap.addLayer(m);
            else leafletMap.removeLayer(m);
        });
    }
    showFloatingNotification(stationPinsVisible ? '📍 Station Markers (16) Visible' : '📍 Station Markers Hidden');
};

window.toggleScenicPins = function () {
    scenicPinsVisible = !scenicPinsVisible;

    if (activeMapEngine === 'google' && googleMap) {
        Object.values(googleScenicMarkers).forEach(m => m.setMap(scenicPinsVisible ? googleMap : null));
    }
    if (leafletMap) {
        Object.values(mapScenicMarkers).forEach(m => {
            if (scenicPinsVisible) leafletMap.addLayer(m);
            else leafletMap.removeLayer(m);
        });
    }
    showFloatingNotification(scenicPinsVisible ? '🌴 Scenic Markers (6) Visible' : '🌴 Scenic Markers Hidden');
};

/* ==========================================================================
   GOOGLE REAL-TIME TRAFFIC & MAP STYLE SWITCHER
   ========================================================================== */
window.toggleGoogleTraffic = function () {
    if (activeMapEngine !== 'google' || !googleMap) {
        showFloatingNotification('🚦 Real-Time Google Traffic requires active Google Maps engine');
        return;
    }

    trafficLayerActive = !trafficLayerActive;
    if (trafficLayerActive) {
        if (!googleTrafficLayer) {
            googleTrafficLayer = new google.maps.TrafficLayer();
        }
        googleTrafficLayer.setMap(googleMap);
        const btn = document.getElementById('btnToggleTraffic');
        if (btn) btn.classList.add('btn-traffic-active');
        showFloatingNotification('🚦 Google Real-Time Traffic Layer Enabled');
    } else {
        if (googleTrafficLayer) {
            googleTrafficLayer.setMap(null);
        }
        const btn = document.getElementById('btnToggleTraffic');
        if (btn) btn.classList.remove('btn-traffic-active');
        showFloatingNotification('🚦 Real-Time Traffic Layer Disabled');
    }
};

window.cycleMapStyle = function () {
    const btn = document.getElementById('btnMapStyleSwitch');

    if (activeMapEngine === 'google' && googleMap) {
        if (googleMapStyleMode === 'dark') {
            googleMapStyleMode = 'satellite';
            googleMap.setMapTypeId(google.maps.MapTypeId.HYBRID);
            googleMap.setOptions({ styles: [] });
            if (btn) btn.innerText = '🛰️ Satellite';
            showFloatingNotification('🛰️ Switched to High-Resolution Satellite Hybrid');
        } else if (googleMapStyleMode === 'satellite') {
            googleMapStyleMode = 'terrain';
            googleMap.setMapTypeId(google.maps.MapTypeId.TERRAIN);
            googleMap.setOptions({ styles: [] });
            if (btn) btn.innerText = '⛰️ Terrain';
            showFloatingNotification('⛰️ Switched to Kerala Topographic Terrain');
        } else if (googleMapStyleMode === 'terrain') {
            googleMapStyleMode = 'roadmap';
            googleMap.setMapTypeId(google.maps.MapTypeId.ROADMAP);
            googleMap.setOptions({ styles: [] });
            if (btn) btn.innerText = '🗺️ Road Map';
            showFloatingNotification('🗺️ Switched to Standard Road Map');
        } else {
            googleMapStyleMode = 'dark';
            googleMap.setMapTypeId(google.maps.MapTypeId.ROADMAP);
            googleMap.setOptions({ styles: GOOGLE_DARK_STYLES });
            if (btn) btn.innerText = '🌙 Dark Mode';
            showFloatingNotification('🌙 Switched to Cyber Lumina Dark Style');
        }
        return;
    }

    // Leaflet tile layer cycling (No API Key Required)
    if (leafletMap && window.LEAFLET_TILE_STYLES && window.LEAFLET_TILE_STYLES.length > 0) {
        leafletTileIndex = (leafletTileIndex + 1) % window.LEAFLET_TILE_STYLES.length;
        const style = window.LEAFLET_TILE_STYLES[leafletTileIndex];

        if (leafletTileLayer) {
            leafletMap.removeLayer(leafletTileLayer);
        }
        leafletTileLayer = L.tileLayer(style.url, {
            maxZoom: style.maxZoom,
            attribution: style.attribution,
            subdomains: style.subdomains || 'abc'
        }).addTo(leafletMap);

        if (btn) btn.innerText = `${style.icon} ${style.name}`;
        showFloatingNotification(`${style.icon} Switched Map to ${style.name}`);
    }
};

function showFloatingNotification(msg) {
    let n = document.getElementById('floatingMapNotice');
    if (!n) {
        n = document.createElement('div');
        n.id = 'floatingMapNotice';
        n.style.position = 'fixed';
        n.style.bottom = '28px';
        n.style.right = '28px';
        n.style.background = 'rgba(10, 18, 36, 0.94)';
        n.style.border = '1px solid #00f2fe';
        n.style.boxShadow = '0 8px 24px rgba(0,0,0,0.6), 0 0 16px rgba(0,242,254,0.3)';
        n.style.padding = '11px 18px';
        n.style.borderRadius = '12px';
        n.style.color = '#fff';
        n.style.fontWeight = '700';
        n.style.fontSize = '0.84rem';
        n.style.zIndex = '99999';
        n.style.backdropFilter = 'blur(12px)';
        n.style.transition = 'all 0.3s ease';
        document.body.appendChild(n);
    }
    n.innerText = msg;
    n.style.display = 'block';
    n.style.opacity = '1';
    setTimeout(() => {
        n.style.opacity = '0';
        setTimeout(() => { n.style.display = 'none'; }, 300);
    }, 2500);
}

/* ==========================================================================
   API KEY MODAL & SETTINGS MANAGEMENT
   ========================================================================== */
function updateMapEngineBadge(status, label) {
    const badge = document.getElementById('mapEngineBadge');
    const badgeText = document.getElementById('mapEngineBadgeText');
    const badgeDot = document.getElementById('mapBadgeDot');

    if (badgeText) badgeText.innerText = label;

    if (badgeDot) {
        if (status === 'active') {
            badgeDot.style.background = '#34d399';
            badgeDot.style.boxShadow = '0 0 8px #34d399';
        } else if (status === 'warning') {
            badgeDot.style.background = '#fbbf24';
            badgeDot.style.boxShadow = '0 0 8px #fbbf24';
        } else {
            badgeDot.style.background = '#38bdf8';
            badgeDot.style.boxShadow = '0 0 8px #38bdf8';
        }
    }
}

window.openApiKeyModal = async function () {
    const modal = document.getElementById('apiKeyModal');
    if (!modal) return;

    modal.style.display = 'flex';

    const input = document.getElementById('googleApiKeyInput');
    const statusBanner = document.getElementById('apiKeyStatusBanner');
    const statusText = document.getElementById('apiKeyStatusText');
    const modalStatusDot = document.getElementById('modalStatusDot');
    const feedback = document.getElementById('apiKeyModalFeedback');

    if (feedback) feedback.style.display = 'none';

    // Populate with existing key
    if (input) {
        input.value = currentGoogleApiKey || '';
    }

    try {
        const res = await fetch('/api/config/maps');
        const data = await res.json();

        if (data.hasKey) {
            statusBanner.className = 'api-key-status-banner status-active';
            statusText.innerText = `Active Google Maps Key Configured (${data.source === 'environment' ? 'ENV Variable' : 'Saved in App'})`;
            if (modalStatusDot) modalStatusDot.style.background = '#34d399';
            if (input && !input.value) {
                input.value = data.apiKey || '';
            }
        } else if (currentGoogleApiKey) {
            statusBanner.className = 'api-key-status-banner status-active';
            statusText.innerText = 'Active Key Stored in Browser Session';
            if (modalStatusDot) modalStatusDot.style.background = '#34d399';
        } else {
            statusBanner.className = 'api-key-status-banner status-warning';
            statusText.innerText = 'No API Key Set • Operating in Autonomous Radar Mode';
            if (modalStatusDot) modalStatusDot.style.background = '#fbbf24';
        }
    } catch (e) {
        statusBanner.className = 'api-key-status-banner';
        statusText.innerText = 'Ready to accept Google Maps API Key';
    }
};

window.closeApiKeyModal = function () {
    const modal = document.getElementById('apiKeyModal');
    if (modal) modal.style.display = 'none';
};

window.toggleApiKeyVisibility = function () {
    const input = document.getElementById('googleApiKeyInput');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
};

window.saveApiKeyFromModal = async function () {
    const input = document.getElementById('googleApiKeyInput');
    const feedback = document.getElementById('apiKeyModalFeedback');
    const key = (input ? input.value : '').trim();

    if (!key) {
        if (feedback) {
            feedback.style.display = 'block';
            feedback.style.background = 'rgba(244, 63, 94, 0.15)';
            feedback.style.border = '1px solid rgba(244, 63, 94, 0.4)';
            feedback.style.color = '#fb7185';
            feedback.innerText = 'Please paste or enter a valid Google Maps API Key.';
        }
        return;
    }

    if (feedback) {
        feedback.style.display = 'block';
        feedback.style.background = 'rgba(56, 189, 248, 0.15)';
        feedback.style.border = '1px solid rgba(56, 189, 248, 0.4)';
        feedback.style.color = '#38bdf8';
        feedback.innerText = 'Testing & initializing Google Maps with provided key...';
    }

    try {
        // Attempt loading Google Maps script with key
        await loadGoogleMapsScript(key);

        // Save to backend configuration
        try {
            await fetch('/api/config/maps', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: key })
            });
        } catch (postErr) {
            console.warn('Backend save notice:', postErr);
        }

        // Save to client localStorage
        localStorage.setItem('google_maps_api_key', key);
        currentGoogleApiKey = key;

        // Initialize Google Maps Engine
        initGoogleMapsEngine();
        activeMapEngine = 'google';
        updateMapEngineBadge('active', '🟢 Google Maps Platform');

        const kpiGpsStatus = document.getElementById('kpiGpsStatus');
        const kpiApiKeyStatusLbl = document.getElementById('kpiApiKeyStatusLbl');
        if (kpiGpsStatus) {
            kpiGpsStatus.innerText = 'Google Maps';
            kpiGpsStatus.style.color = '#38bdf8';
        }
        if (kpiApiKeyStatusLbl) {
            kpiApiKeyStatusLbl.innerText = 'API Key Active (Live Traffic)';
        }

        if (feedback) {
            feedback.style.background = 'rgba(16, 185, 129, 0.2)';
            feedback.style.border = '1px solid rgba(16, 185, 129, 0.5)';
            feedback.style.color = '#34d399';
            feedback.innerText = '✓ Key Verified! Google Maps Platform Activated Successfully!';
        }

        setTimeout(() => {
            window.closeApiKeyModal();
            showFloatingNotification('🎉 Google Maps Platform Activated with Real-Time Telemetry!');
        }, 1200);

    } catch (err) {
        if (feedback) {
            feedback.style.display = 'block';
            feedback.style.background = 'rgba(244, 63, 94, 0.15)';
            feedback.style.border = '1px solid rgba(244, 63, 94, 0.4)';
            feedback.style.color = '#fb7185';
            feedback.innerText = `Error: Unable to load Google Maps with this key (${err.message || 'Check network / key restrictions'}).`;
        }
    }
};

window.removeApiKey = async function () {
    if (!confirm('Are you sure you want to remove the Google Maps API Key? The website will switch to the autonomous radar engine.')) {
        return;
    }

    try {
        await fetch('/api/config/maps', { method: 'DELETE' });
    } catch (e) { }

    localStorage.removeItem('google_maps_api_key');
    currentGoogleApiKey = '';

    const input = document.getElementById('googleApiKeyInput');
    if (input) input.value = '';

    const feedback = document.getElementById('apiKeyModalFeedback');
    if (feedback) {
        feedback.style.display = 'block';
        feedback.style.background = 'rgba(245, 158, 11, 0.15)';
        feedback.style.border = '1px solid rgba(245, 158, 11, 0.4)';
        feedback.style.color = '#fbbf24';
        feedback.innerText = 'API Key removed. Switched to Autonomous Radar Engine.';
    }

    // Switch back to Leaflet engine
    activeMapEngine = 'leaflet';
    initLeafletEngine();
    updateMapEngineBadge('none', '🔑 Configure Google Maps Key');

    const kpiGpsStatus = document.getElementById('kpiGpsStatus');
    const kpiApiKeyStatusLbl = document.getElementById('kpiApiKeyStatusLbl');
    if (kpiGpsStatus) {
        kpiGpsStatus.innerText = 'Autonomous Radar';
        kpiGpsStatus.style.color = '#34d399';
    }
    if (kpiApiKeyStatusLbl) {
        kpiApiKeyStatusLbl.innerText = 'Click to Add Google API Key';
    }

    renderAllOnActiveMap();

    setTimeout(() => {
        window.closeApiKeyModal();
    }, 1200);
};

/* ==========================================================================
   QUICK BOOKING & CONCIERGE INTEGRATION
   ========================================================================== */
window.resolveLocationCoordinates = function (nameOrId) {
    if (!nameOrId) return { lat: 10.0889, lng: 77.0595 };
    const clean = String(nameOrId).toLowerCase().trim();
    if (window.KERALA_STATION_DIRECTORY) {
        const foundSt = window.KERALA_STATION_DIRECTORY.find(s =>
            s.station_id.toLowerCase() === clean ||
            s.station_name.toLowerCase().includes(clean) ||
            clean.includes(s.station_name.toLowerCase()) ||
            clean.includes(s.district.toLowerCase())
        );
        if (foundSt) return { lat: foundSt.lat, lng: foundSt.lng };
    }
    if (window.KERALA_SCENIC_LANDMARKS) {
        const foundSc = window.KERALA_SCENIC_LANDMARKS.find(l =>
            l.name.toLowerCase().includes(clean) ||
            clean.includes(l.name.toLowerCase())
        );
        if (foundSc) return { lat: foundSc.lat, lng: foundSc.lng };
    }
    return { lat: 10.0889, lng: 77.0595 };
};

window.quickBookFromStation = function (stationId) {
    const sel = document.getElementById('bookingStation');
    if (sel) {
        sel.value = stationId;
    }
    if (typeof window.updateDestinationOptions === 'function') {
        window.updateDestinationOptions();
    }

    const destSel = document.getElementById('bookingDestination');
    const destVal = destSel ? destSel.value : 'Munnar Tea Hills Station (Idukki)';
    const originStation = (window.KERALA_STATION_DIRECTORY && window.KERALA_STATION_DIRECTORY.find(s => s.station_id === stationId)) || { station_id: stationId, station_name: stationId, lat: 9.9816, lng: 76.2753 };
    const destCoords = window.resolveLocationCoordinates(destVal);

    window.displayRouteTraceOnMap({
        ride_code: 'NEW-BOOKING',
        pickup_name: originStation.station_name,
        destination_name: destVal,
        pickup_lat: originStation.lat,
        pickup_lng: originStation.lng,
        dest_lat: destCoords.lat,
        dest_lng: destCoords.lng
    });

    openModal();
    showFloatingNotification(`🚖 Pickup Set: ${originStation.station_name}`);
};

window.quickBookToDestination = function (destName) {
    openModal();
    if (typeof window.updateDestinationOptions === 'function') {
        window.updateDestinationOptions();
    }
    const sel = document.getElementById('bookingDestination');
    if (sel && destName) {
        const cleanTarget = destName.toLowerCase().trim();
        let matched = false;
        for (let i = 0; i < sel.options.length; i++) {
            const optVal = sel.options[i].value.toLowerCase();
            const optTxt = sel.options[i].text.toLowerCase();
            if (optVal === cleanTarget || optTxt.includes(cleanTarget) || cleanTarget.includes(optVal)) {
                sel.selectedIndex = i;
                matched = true;
                break;
            }
        }
        if (!matched) {
            // Partial word search
            const words = cleanTarget.split(' ').filter(w => w.length > 3);
            for (let i = 0; i < sel.options.length; i++) {
                const optTxt = sel.options[i].text.toLowerCase();
                if (words.some(w => optTxt.includes(w))) {
                    sel.selectedIndex = i;
                    matched = true;
                    break;
                }
            }
        }
        if (typeof window.updateFoodOptionsForDestination === 'function') {
            window.updateFoodOptionsForDestination();
        }
    }

    const originSel = document.getElementById('bookingStation');
    const originId = originSel ? originSel.value : 'ST01';
    const originStation = (window.KERALA_STATION_DIRECTORY && window.KERALA_STATION_DIRECTORY.find(s => s.station_id === originId)) || { station_id: originId, station_name: 'Kochi Marine Drive Hub (Ernakulam)', lat: 9.9816, lng: 76.2753 };
    const destCoords = window.resolveLocationCoordinates(destName);

    window.displayRouteTraceOnMap({
        ride_code: 'NEW-BOOKING',
        pickup_name: originStation.station_name,
        destination_name: destName,
        pickup_lat: originStation.lat,
        pickup_lng: originStation.lng,
        dest_lat: destCoords.lat,
        dest_lng: destCoords.lng
    });

    showFloatingNotification(`🏁 Destination Set: ${destName}`);
};

window.quickBookFromCurrentHudStation = function () {
    if (window.currentHudStation && window.currentHudStation.station_id && window.currentHudStation.station_id !== 'SCENIC') {
        window.quickBookFromStation(window.currentHudStation.station_id);
    } else if (window.currentHudStation) {
        window.quickBookFromStation('ST01');
    } else {
        openModal();
    }
};

window.quickBookToCurrentHudStation = function () {
    if (window.currentHudStation && window.currentHudStation.station_name) {
        window.quickBookToDestination(window.currentHudStation.station_name);
    } else {
        openModal();
    }
};

window.zoomToCurrentHudStation = function () {
    if (!window.currentHudStation) return;
    const { lat, lng } = window.currentHudStation;
    if (activeMapEngine === 'google' && googleMap) {
        googleMap.panTo({ lat, lng });
        googleMap.setZoom(14);
    } else if (leafletMap) {
        leafletMap.flyTo([lat, lng], 14, { duration: 1.0 });
    }
};

window.setPreviewAsPickup = function (stationId) {
    const sel = document.getElementById('bookingStation');
    if (sel) {
        sel.value = stationId;
        if (typeof window.updateDestinationOptions === 'function') {
            window.updateDestinationOptions();
        }
        window.renderQuickRoutePreview();
        showFloatingNotification(`📍 Route Origin updated to ${stationId}`);
    }
};

window.setPreviewAsDest = function (destName) {
    const sel = document.getElementById('bookingDestination');
    if (sel) {
        const cleanTarget = destName.toLowerCase().trim();
        for (let i = 0; i < sel.options.length; i++) {
            if (sel.options[i].value.toLowerCase().includes(cleanTarget) || cleanTarget.includes(sel.options[i].value.toLowerCase())) {
                sel.selectedIndex = i;
                break;
            }
        }
        if (typeof window.updateFoodOptionsForDestination === 'function') {
            window.updateFoodOptionsForDestination();
        }
        window.renderQuickRoutePreview();
        showFloatingNotification(`🏁 Route Destination updated to ${destName}`);
    }
};

/* Interactive Route Preview Leaflet Engine inside Quick Map Modal */
window.quickRouteLeafletMap = null;
window.quickRouteMarkersGroup = null;
window.quickRoutePolyline = null;
window.quickRouteGlow = null;

function helperHaversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

window.renderQuickRoutePreview = function () {
    const container = document.getElementById('quickRouteMap');
    if (!container) return;

    const originSel = document.getElementById('bookingStation');
    const destSel = document.getElementById('bookingDestination');

    const originId = originSel ? originSel.value : 'ST01';
    const destVal = destSel ? destSel.value : 'Munnar Tea Hills Station (Idukki)';

    // Find Origin coordinates
    const originStation = (window.KERALA_STATION_DIRECTORY && window.KERALA_STATION_DIRECTORY.find(s => s.station_id === originId)) || {
        station_id: 'ST01',
        station_name: 'Kochi Marine Drive Hub (Ernakulam)',
        lat: 9.9816,
        lng: 76.2753,
        bay: 'BAY-01'
    };

    // Find Destination coordinates
    let destLat = 10.0889;
    let destLng = 77.0595;
    let destDisplayName = destVal;

    const destClean = destVal.toLowerCase();
    const matchedStation = window.KERALA_STATION_DIRECTORY ? window.KERALA_STATION_DIRECTORY.find(s =>
        destClean.includes(s.station_name.toLowerCase()) || s.station_name.toLowerCase().includes(destClean) || destClean.includes(s.district.toLowerCase())
    ) : null;

    const matchedScenic = window.KERALA_SCENIC_LANDMARKS ? window.KERALA_SCENIC_LANDMARKS.find(l =>
        destClean.includes(l.name.toLowerCase()) || l.name.toLowerCase().includes(destClean)
    ) : null;

    if (matchedStation) {
        destLat = matchedStation.lat;
        destLng = matchedStation.lng;
        destDisplayName = `${matchedStation.station_id} - ${matchedStation.station_name}`;
    } else if (matchedScenic) {
        destLat = matchedScenic.lat;
        destLng = matchedScenic.lng;
        destDisplayName = matchedScenic.name;
    }

    // Road winding distance & travel time estimation
    const straightDist = helperHaversineKm(originStation.lat, originStation.lng, destLat, destLng);
    const roadDist = Math.max(12, Math.round(straightDist * 1.28));
    const travelHours = Math.floor(roadDist / 48);
    const travelMinutes = Math.round(((roadDist / 48) - travelHours) * 60);

    // Update banner UI elements
    const originTextEl = document.getElementById('quickRouteOriginText');
    const destTextEl = document.getElementById('quickRouteDestText');
    const distTextEl = document.getElementById('quickRouteDistText');
    const timeTextEl = document.getElementById('quickRouteTimeText');
    const gmapsNavBtn = document.getElementById('btnExternalGoogleMapsNav');

    if (originTextEl) originTextEl.innerText = `${originStation.station_id} ${originStation.station_name}`;
    if (destTextEl) destTextEl.innerText = destDisplayName;
    if (distTextEl) distTextEl.innerText = `${roadDist} km`;
    if (timeTextEl) timeTextEl.innerText = `${travelHours}h ${travelMinutes}m`;

    if (gmapsNavBtn) {
        gmapsNavBtn.href = `https://www.google.com/maps/dir/?api=1&origin=${originStation.lat},${originStation.lng}&destination=${destLat},${destLng}&travelmode=driving`;
    }

    // Initialize or refresh Leaflet map in modal
    if (!window.quickRouteLeafletMap) {
        window.quickRouteLeafletMap = L.map('quickRouteMap', {
            zoomControl: true,
            attributionControl: false
        }).setView([10.25, 76.45], 8);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            subdomains: 'abcd'
        }).addTo(window.quickRouteLeafletMap);

        window.quickRouteMarkersGroup = L.featureGroup().addTo(window.quickRouteLeafletMap);
    }

    window.quickRouteMarkersGroup.clearLayers();
    if (window.quickRoutePolyline) {
        window.quickRouteLeafletMap.removeLayer(window.quickRoutePolyline);
    }
    if (window.quickRouteGlow) {
        window.quickRouteLeafletMap.removeLayer(window.quickRouteGlow);
    }

    // Route coordinates: origin -> intermediate waypoint curve -> destination
    const midLat = (originStation.lat + destLat) / 2 + (destLng - originStation.lng) * 0.12;
    const midLng = (originStation.lng + destLng) / 2 - (destLat - originStation.lat) * 0.12;
    const routeCoords = [
        [originStation.lat, originStation.lng],
        [midLat, midLng],
        [destLat, destLng]
    ];

    // Glowing route line
    window.quickRouteGlow = L.polyline(routeCoords, {
        color: '#00f2fe',
        weight: 8,
        opacity: 0.35,
        lineCap: 'round'
    }).addTo(window.quickRouteLeafletMap);

    window.quickRoutePolyline = L.polyline(routeCoords, {
        color: '#38bdf8',
        weight: 3.5,
        opacity: 0.95,
        dashArray: '6, 6'
    }).addTo(window.quickRouteLeafletMap);

    // Origin Marker (🚖)
    const originIcon = L.divIcon({
        className: 'preview-origin-marker',
        html: `<div style="background: rgba(16, 185, 129, 0.95); width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.15rem; border: 2px solid #fff; box-shadow: 0 0 16px rgba(16, 185, 129, 0.8);">🚖</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
    });
    const originMarker = L.marker([originStation.lat, originStation.lng], { icon: originIcon });
    originMarker.bindPopup(`
        <div style="font-family: 'Outfit', sans-serif; min-width: 170px;">
            <div style="font-size: 0.72rem; color: #10b981; font-weight: 700; text-transform: uppercase;">● Selected Origin</div>
            <strong style="color: #fff; font-size: 0.92rem;">${originStation.station_name}</strong>
            <div style="color: #cbd5e1; font-size: 0.75rem; margin-top: 3px;">Bay: ${originStation.bay || 'BAY-01'}</div>
        </div>
    `);
    window.quickRouteMarkersGroup.addLayer(originMarker);

    // Destination Marker (🏁)
    const destIcon = L.divIcon({
        className: 'preview-dest-marker',
        html: `<div style="background: rgba(245, 158, 11, 0.95); width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.15rem; border: 2px solid #fff; box-shadow: 0 0 16px rgba(245, 158, 11, 0.8);">🏁</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
    });
    const destMarker = L.marker([destLat, destLng], { icon: destIcon });
    destMarker.bindPopup(`
        <div style="font-family: 'Outfit', sans-serif; min-width: 170px;">
            <div style="font-size: 0.72rem; color: #f59e0b; font-weight: 700; text-transform: uppercase;">● Destination Drop-off</div>
            <strong style="color: #fff; font-size: 0.92rem;">${destDisplayName}</strong>
            <div style="color: #cbd5e1; font-size: 0.75rem; margin-top: 3px;">Estimated Distance: <strong>${roadDist} km</strong></div>
        </div>
    `);
    window.quickRouteMarkersGroup.addLayer(destMarker);

    // Plot all other 16 stations as clickable transit pins on the route map
    if (window.KERALA_STATION_DIRECTORY) {
        window.KERALA_STATION_DIRECTORY.forEach(st => {
            if (st.station_id === originStation.station_id) return;
            const stIcon = L.divIcon({
                className: 'preview-station-pin',
                html: `<div style="background: rgba(10, 18, 36, 0.88); border: 1px solid #38bdf8; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; color: #38bdf8; font-weight: 800;">📍</div>`,
                iconSize: [22, 22],
                iconAnchor: [11, 11]
            });
            const stMarker = L.marker([st.lat, st.lng], { icon: stIcon });
            stMarker.bindPopup(`
                <div style="font-family: 'Outfit', sans-serif; min-width: 180px;">
                    <div style="font-size: 0.72rem; color: #38bdf8; font-weight: 700;">${st.station_id} • ${st.district}</div>
                    <strong style="color: #fff; font-size: 0.88rem; display: block; margin-bottom: 6px;">${st.station_name}</strong>
                    <div style="display: flex; gap: 6px;">
                        <button class="map-popup-btn map-popup-btn-pickup" style="padding: 5px 8px; font-size: 0.72rem;" onclick="setPreviewAsPickup('${st.station_id}')">Set Pickup</button>
                        <button class="map-popup-btn map-popup-btn-dest" style="padding: 5px 8px; font-size: 0.72rem;" onclick="setPreviewAsDest('${st.station_name}')">Set Dest</button>
                    </div>
                </div>
            `);
            window.quickRouteMarkersGroup.addLayer(stMarker);
        });
    }

    // Fit map bounds to encompass origin and destination
    const bounds = L.latLngBounds([
        [originStation.lat, originStation.lng],
        [destLat, destLng]
    ]);
    window.quickRouteLeafletMap.fitBounds(bounds, { padding: [60, 60] });

    setTimeout(() => {
        if (window.quickRouteLeafletMap) {
            window.quickRouteLeafletMap.invalidateSize();
        }
    }, 150);
};

window.orderFoodForCurrentTrackedRide = function () {
    if (activeTrackedRide) {
        openFoodModalForRide(activeTrackedRide.ride_code);
    } else {
        alert('Please select an active ride first.');
    }
};

window.payForCurrentTrackedRide = function () {
    if (activeTrackedRide) {
        openPaymentModal(activeTrackedRide.ride_code);
    } else {
        alert('Please select an active ride first.');
    }
};

function startLiveTelemetryLoop() {
    if (telemetryInterval) clearInterval(telemetryInterval);

    telemetryInterval = setInterval(() => {
        if (activeModule !== 'map' || mapRides.length === 0) return;

        mapRides.forEach(ride => {
            ride.progress = 0;
            ride.speed = 0;
            ride.currentLat = ride.pickup_lat;
            ride.currentLng = ride.pickup_lng;
        });

        const kpiLiveSpeed = document.getElementById('kpiLiveSpeed');
        if (kpiLiveSpeed) kpiLiveSpeed.innerText = `0 km/h (At Bay)`;
    }, 2000);
}

/* ==========================================================================
   ADMINISTRATOR CONSOLE: PROFIT & LOSS ANALYTICS & INTERACTIVE GRAPHS
   ========================================================================== */
window.pnlMonthlyChartInstance = null;
window.pnlStreamsChartInstance = null;
window.pnlExpenseChartInstance = null;
window.cachedPnlData = null;
window.activePnlTimeframe = 'all';

window.loadProfitLossDashboard = async function (timeframe = 'all') {
    window.activePnlTimeframe = timeframe;

    try {
        const response = await fetch('/api/admin/profit-loss');
        if (!response.ok) {
            throw new Error(`Failed to retrieve Profit & Loss analytics: ${response.status}`);
        }
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || 'P&L data error');
        }
        window.cachedPnlData = data;

        // 1. Render Top KPI Metrics
        renderPnlKpis(data.kpis);

        // 2. Render Primary Multi-Bar + Line Chart (Monthly P&L Performance)
        renderPnlMonthlyChart(data.monthly_trend, timeframe);

        // 3. Render Revenue Streams Donut Chart
        renderPnlStreamsChart(data.revenue_streams);

        // 4. Render Expense Breakdown Chart
        renderPnlExpenseChart(data.expense_breakdown);

        // 5. Render Corporate Income Statement Table
        renderPnlStatementTable(data.pnl_statement);

        // 6. Render Vehicle Model Profitability Leaderboard Table
        renderPnlVehicleTable(data.vehicle_profitability);

    } catch (err) {
        console.error('Error loading Profit & Loss dashboard:', err);
        const pnlGross = document.getElementById('pnlGrossRevenue');
        if (pnlGross) pnlGross.innerText = 'Error Loading';
    }
};

function renderPnlKpis(kpis) {
    if (!kpis) return;
    const formatInr = num => '₹' + Number(num || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const grossEl = document.getElementById('pnlGrossRevenue');
    const expEl = document.getElementById('pnlTotalExpenses');
    const profitEl = document.getElementById('pnlNetProfit');
    const marginPctEl = document.getElementById('pnlMarginPct');
    const evSavingsEl = document.getElementById('pnlEvSavings');
    const foodEl = document.getElementById('pnlFoodRevenue');
    const foodCountEl = document.getElementById('pnlFoodOrdersCount');
    const ridesEl = document.getElementById('pnlTotalRides');
    const avgFareEl = document.getElementById('pnlAvgFare');

    if (grossEl) grossEl.innerText = formatInr(kpis.gross_revenue);
    if (expEl) expEl.innerText = formatInr(kpis.total_expenses);
    if (profitEl) profitEl.innerText = '+' + formatInr(kpis.net_profit);
    if (marginPctEl) marginPctEl.innerText = `▲ ${kpis.profit_margin_pct}% Net Margin`;
    if (evSavingsEl) evSavingsEl.innerText = `${kpis.ev_savings_pct}% Cost Reduction`;
    if (foodEl) foodEl.innerText = formatInr(kpis.gross_revenue - (kpis.avg_booking_fare * kpis.total_rides));
    if (foodCountEl) foodCountEl.innerText = `${kpis.total_food_orders} Dining Orders • 40% Margin`;
    if (ridesEl) ridesEl.innerText = `${kpis.total_rides} Bookings`;
    if (avgFareEl) avgFareEl.innerHTML = `<span>Avg ${formatInr(kpis.avg_booking_fare)} / trip</span>`;
}

function renderPnlMonthlyChart(monthlyTrend, timeframe) {
    const canvas = document.getElementById('pnlMonthlyChart');
    if (!canvas || typeof Chart === 'undefined') return;

    let filtered = monthlyTrend || [];
    if (timeframe === '30d') {
        filtered = filtered.slice(-2);
    } else if (timeframe === 'q3') {
        filtered = filtered.slice(2, 5);
    }

    const labels = filtered.map(item => item.month_label);
    const grossRevs = filtered.map(item => item.gross_revenue);
    const expenses = filtered.map(item => item.operating_expenses);
    const netProfits = filtered.map(item => item.net_profit);

    if (window.pnlMonthlyChartInstance) {
        window.pnlMonthlyChartInstance.destroy();
    }

    const ctx = canvas.getContext('2d');
    window.pnlMonthlyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'bar',
                    label: 'Gross Platform Revenue',
                    data: grossRevs,
                    backgroundColor: 'rgba(0, 242, 254, 0.72)',
                    hoverBackgroundColor: 'rgba(0, 242, 254, 0.95)',
                    borderColor: '#00f2fe',
                    borderWidth: 1.5,
                    borderRadius: 6,
                    order: 2
                },
                {
                    type: 'bar',
                    label: 'Operating Expenditures',
                    data: expenses,
                    backgroundColor: 'rgba(244, 63, 94, 0.72)',
                    hoverBackgroundColor: 'rgba(244, 63, 94, 0.95)',
                    borderColor: '#f43f5e',
                    borderWidth: 1.5,
                    borderRadius: 6,
                    order: 3
                },
                {
                    type: 'line',
                    label: 'Net Operating Profit',
                    data: netProfits,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    borderWidth: 3,
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    tension: 0.35,
                    fill: false,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(7, 10, 19, 0.94)',
                    borderColor: 'rgba(56, 189, 248, 0.35)',
                    borderWidth: 1,
                    padding: 12,
                    titleFont: { size: 13, weight: 'bold', family: 'Plus Jakarta Sans' },
                    bodyFont: { size: 12, family: 'Plus Jakarta Sans' },
                    callbacks: {
                        label: function (context) {
                            const val = context.parsed.y || 0;
                            return ` ${context.dataset.label}: ₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', font: { size: 12, family: 'Plus Jakarta Sans' } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.06)' },
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 12, family: 'Plus Jakarta Sans' },
                        callback: function (value) {
                            return '₹' + value.toLocaleString('en-IN');
                        }
                    }
                }
            }
        }
    });
}

function renderPnlStreamsChart(streams) {
    const canvas = document.getElementById('pnlStreamsChart');
    if (!canvas || typeof Chart === 'undefined' || !streams) return;

    const labels = streams.map(s => s.category);
    const values = streams.map(s => s.revenue);

    if (window.pnlStreamsChartInstance) {
        window.pnlStreamsChartInstance.destroy();
    }

    const ctx = canvas.getContext('2d');
    window.pnlStreamsChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: [
                    'rgba(99, 102, 241, 0.85)',
                    'rgba(0, 242, 254, 0.85)',
                    'rgba(245, 158, 11, 0.85)',
                    'rgba(59, 130, 246, 0.85)',
                    'rgba(16, 185, 129, 0.85)'
                ],
                borderColor: '#070a13',
                borderWidth: 3,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#94a3b8', padding: 10, font: { size: 11, family: 'Plus Jakarta Sans' } }
                },
                tooltip: {
                    callbacks: {
                        label: function (ctx) {
                            const val = ctx.parsed || 0;
                            return ` ${ctx.label}: ₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
                        }
                    }
                }
            },
            cutout: '66%'
        }
    });

    // Populate mini breakdown list
    const detailsContainer = document.getElementById('pnlStreamsDetails');
    if (detailsContainer) {
        let html = '';
        streams.forEach(s => {
            html += `
                <div class="pnl-breakdown-row">
                    <span class="pnl-breakdown-label">● ${s.category}</span>
                    <span class="pnl-breakdown-val">₹${Number(s.revenue).toLocaleString('en-IN', { minimumFractionDigits: 2 })} <small style="color:var(--text-dim);">(${s.pct}%)</small></span>
                </div>
            `;
        });
        detailsContainer.innerHTML = html;
    }
}

function renderPnlExpenseChart(expenses) {
    const canvas = document.getElementById('pnlExpenseChart');
    if (!canvas || typeof Chart === 'undefined' || !expenses) return;

    const labels = expenses.map(e => e.category.split('(')[0].trim());
    const values = expenses.map(e => e.amount);

    if (window.pnlExpenseChartInstance) {
        window.pnlExpenseChartInstance.destroy();
    }

    const ctx = canvas.getContext('2d');
    window.pnlExpenseChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Allocated Cost',
                data: values,
                backgroundColor: [
                    'rgba(244, 63, 94, 0.85)',
                    'rgba(245, 158, 11, 0.85)',
                    'rgba(16, 185, 129, 0.85)',
                    'rgba(56, 189, 248, 0.85)',
                    'rgba(139, 92, 246, 0.85)',
                    'rgba(99, 102, 241, 0.85)'
                ],
                borderRadius: 6
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (ctx) {
                            return ` Cost: ₹${ctx.parsed.x.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 11 },
                        callback: function (v) { return '₹' + v.toLocaleString('en-IN'); }
                    }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#cbd5e1', font: { size: 11, family: 'Plus Jakarta Sans' } }
                }
            }
        }
    });

    // Populate mini breakdown list
    const detailsContainer = document.getElementById('pnlExpenseDetails');
    if (detailsContainer) {
        let html = '';
        expenses.forEach(e => {
            html += `
                <div class="pnl-breakdown-row">
                    <span class="pnl-breakdown-label">● ${e.category}</span>
                    <span class="pnl-breakdown-val">₹${Number(e.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })} <small style="color:var(--text-dim);">(${e.pct}%)</small></span>
                </div>
            `;
        });
        detailsContainer.innerHTML = html;
    }
}

function renderPnlStatementTable(stmt) {
    const tbody = document.getElementById('pnlStatementBody');
    if (!tbody || !stmt) return;

    const formatInr = num => '₹' + Number(num || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    let html = '';

    // 1. Operating Revenue Header
    html += `<tr class="pnl-line-header"><td colspan="3">1.0 OPERATING PLATFORM REVENUE</td></tr>`;
    stmt.revenue_lines.forEach(line => {
        const isSub = line.is_subtotal;
        html += `
            <tr class="${isSub ? 'pnl-subtotal-row' : ''}">
                <td style="padding-left: ${isSub ? '14px' : '28px'}; font-weight: ${isSub ? '700' : '400'};">${line.title}</td>
                <td style="text-align: right; color: var(--text-muted);">${isSub ? '100.0%' : '-'}</td>
                <td style="text-align: right; font-weight: ${isSub ? '700' : '500'}; font-family: monospace;">${formatInr(line.amount)}</td>
            </tr>
        `;
    });

    // 2. Direct Cost of Operations Header
    html += `<tr class="pnl-line-header"><td colspan="3">2.0 DIRECT COST OF OPERATIONS</td></tr>`;
    stmt.direct_costs.forEach(line => {
        const isSub = line.is_subtotal;
        html += `
            <tr class="${isSub ? 'pnl-subtotal-row' : ''}">
                <td style="padding-left: ${isSub ? '14px' : '28px'}; font-weight: ${isSub ? '700' : '400'}; color: ${isSub ? 'var(--primary-light)' : '#f87171'};">${line.title}</td>
                <td style="text-align: right; color: var(--text-muted);">${isSub ? '-' : '-'}</td>
                <td style="text-align: right; font-weight: ${isSub ? '700' : '500'}; color: ${isSub ? 'var(--primary-light)' : '#f87171'}; font-family: monospace;">${formatInr(line.amount)}</td>
            </tr>
        `;
    });

    // Gross Operational Margin Subtotal
    html += `
        <tr class="pnl-subtotal-row" style="background: rgba(0, 242, 254, 0.05);">
            <td style="padding-left: 14px; font-weight: 800; color: #fff;">GROSS OPERATIONAL PROFIT</td>
            <td style="text-align: right; color: #34d399; font-weight: 700;">-</td>
            <td style="text-align: right; font-weight: 800; color: var(--primary-light); font-size: 0.95rem; font-family: monospace;">${formatInr(stmt.gross_margin)}</td>
        </tr>
    `;

    // 3. Platform Operating Overhead
    html += `<tr class="pnl-line-header"><td colspan="3">3.0 PLATFORM & LOGISTIC OVERHEAD</td></tr>`;
    stmt.overheads.forEach(line => {
        const isSub = line.is_subtotal;
        html += `
            <tr class="${isSub ? 'pnl-subtotal-row' : ''}">
                <td style="padding-left: ${isSub ? '14px' : '28px'}; font-weight: ${isSub ? '700' : '400'}; color: ${isSub ? 'var(--primary-light)' : '#fca5a5'};">${line.title}</td>
                <td style="text-align: right; color: var(--text-muted);">${isSub ? '-' : '-'}</td>
                <td style="text-align: right; font-weight: ${isSub ? '700' : '500'}; color: ${isSub ? 'var(--primary-light)' : '#fca5a5'}; font-family: monospace;">${formatInr(line.amount)}</td>
            </tr>
        `;
    });

    // 4. NET OPERATING PROFIT
    html += `
        <tr class="pnl-net-profit-row">
            <td style="padding-left: 14px; font-size: 1rem; font-weight: 800; letter-spacing: 0.5px;">4.0 NET OPERATING PROFIT</td>
            <td style="text-align: right; font-size: 0.95rem; font-weight: 800; color: #34d399;">▲ ${stmt.margin_pct}% Margin</td>
            <td style="text-align: right; font-size: 1.15rem; font-weight: 800; font-family: 'JetBrains Mono', monospace;">${formatInr(stmt.net_profit)}</td>
        </tr>
    `;

    tbody.innerHTML = html;
}

function renderPnlVehicleTable(vehicles) {
    const tbody = document.getElementById('pnlVehicleTableBody');
    if (!tbody || !vehicles) return;

    const formatInr = num => '₹' + Number(num || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    let html = '';

    vehicles.forEach(v => {
        const badgeColor = v.is_ev ? 'background: rgba(0, 242, 254, 0.15); border: 1px solid var(--border-gold); color: var(--primary-light);' : 'background: rgba(255, 255, 255, 0.08); border: 1px solid var(--border-glass); color: #fff;';
        html += `
            <tr>
                <td>
                    <div style="font-weight: 700; color: #fff;">${v.model}</div>
                    <div style="font-size: 0.72rem; color: var(--text-dim);">${v.is_ev ? '⚡ Next-Gen Electric EV' : '🚗 Luxury ICE / Executive Fleet'}</div>
                </td>
                <td style="text-align: center; font-weight: 600;">${v.trips}</td>
                <td style="text-align: right; font-weight: 700; color: #fff; font-family: monospace;">${formatInr(v.gross_revenue)}</td>
                <td style="text-align: right; color: #f87171; font-family: monospace;">${formatInr(v.operating_expenses)}</td>
                <td style="text-align: right; font-weight: 700; color: #34d399; font-family: monospace;">+${formatInr(v.net_profit)}</td>
                <td style="text-align: center; font-weight: 700; color: #38bdf8;">${v.margin_pct}%</td>
                <td style="text-align: center;">
                    <span style="font-size: 0.74rem; padding: 3px 8px; border-radius: 6px; ${badgeColor}">${v.badge}</span>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

window.setPnlTimeframe = function (timeframe, btn) {
    if (btn) {
        document.querySelectorAll('.pnl-filter-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    if (window.cachedPnlData) {
        renderPnlMonthlyChart(window.cachedPnlData.monthly_trend, timeframe);
    }
};

window.exportPnlReport = function () {
    if (!window.cachedPnlData) {
        alert('P&L data not available yet.');
        return;
    }
    const kpis = window.cachedPnlData.kpis;
    const monthly = window.cachedPnlData.monthly_trend;

    let csv = 'KERALA ROYAL TRANSIT - PROFIT & LOSS FINANCIAL STATEMENT\n';
    csv += `Generated On,${new Date().toISOString()}\n`;
    csv += `Gross Platform Revenue,INR ${kpis.gross_revenue}\n`;
    csv += `Total Operating Expenses,INR ${kpis.total_expenses}\n`;
    csv += `Net Operating Profit,INR ${kpis.net_profit}\n`;
    csv += `Net Profit Margin,${kpis.profit_margin_pct}%\n`;
    csv += `Total Bookings,${kpis.total_rides}\n\n`;

    csv += 'MONTHLY FINANCIAL TREND\n';
    csv += 'Month,Rides Count,Ride Revenue (INR),Food Revenue (INR),Gross Revenue (INR),Operating Expenses (INR),Net Profit (INR),Margin %\n';
    monthly.forEach(m => {
        csv += `${m.month_label},${m.rides_count},${m.ride_revenue},${m.food_revenue},${m.gross_revenue},${m.operating_expenses},${m.net_profit},${m.margin_pct}%\n`;
    });

    csv += '\nVEHICLE MODEL PROFITABILITY\n';
    csv += 'Model,Trips,Gross Revenue (INR),Operating Expenses (INR),Net Profit (INR),Margin %\n';
    window.cachedPnlData.vehicle_profitability.forEach(v => {
        csv += `"${v.model}",${v.trips},${v.gross_revenue},${v.operating_expenses},${v.net_profit},${v.margin_pct}%\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Profit_and_Loss_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};

/* ==========================================================================
   ADMINISTRATOR CONSOLE: MASTER SYSTEM DATA EXPLORER (SHOWS EVERYTHING)
   ========================================================================== */
window.cachedMasterData = null;
window.activeMasterTab = 'all';

window.loadMasterDataExplorer = async function () {
    try {
        const response = await fetch('/api/admin/master-data');
        if (!response.ok) {
            throw new Error(`Master data error: ${response.status}`);
        }
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || 'Failed to retrieve master dataset');
        }
        window.cachedMasterData = data;

        // Populate summary counters
        const s = data.summary;
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
        setVal('mstAllCount', (s.total_rides + s.total_payments + s.total_food_orders + s.total_drivers + s.total_stations + s.total_users));
        setVal('mstRidesCount', s.total_rides);
        setVal('mstPaymentsCount', s.total_payments);
        setVal('mstFoodCount', s.total_food_orders);
        setVal('mstDriversCount', s.total_drivers);
        setVal('mstStationsCount', s.total_stations);
        setVal('mstUsersCount', s.total_users);

        // Render current active tab
        renderMasterTable(window.activeMasterTab);
    } catch (err) {
        console.error('Error loading master data:', err);
    }
};

window.switchMasterTab = function (tab, element) {
    window.activeMasterTab = tab;
    if (element) {
        document.querySelectorAll('.master-stat-chip').forEach(c => c.classList.remove('active'));
        element.classList.add('active');
    }
    const input = document.getElementById('masterSearchInput');
    if (input) input.value = '';
    renderMasterTable(tab);
};

function renderMasterTable(tab) {
    if (!window.cachedMasterData) return;
    const thead = document.getElementById('masterTableHead');
    const tbody = document.getElementById('masterTableBody');
    const titleText = document.getElementById('masterTabTitleText');
    const badge = document.getElementById('masterRecordCountBadge');
    if (!thead || !tbody) return;

    const data = window.cachedMasterData;
    const formatInr = num => '₹' + Number(num || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

    let headHtml = '';
    let rowsHtml = '';

    if (tab === 'rides') {
        if (titleText) titleText.innerText = `All System Rides & Bookings (${data.rides.length})`;
        if (badge) badge.innerText = `${data.rides.length} rides recorded`;
        headHtml = `
            <th>Ride Code</th>
            <th>Date</th>
            <th>Pickup Station</th>
            <th>Destination</th>
            <th>Passenger</th>
            <th>Chauffeur & Fleet</th>
            <th>Fare</th>
            <th>Status</th>
        `;
        data.rides.forEach(r => {
            rowsHtml += `
                <tr>
                    <td><strong style="color:var(--primary-light); font-family:monospace;">${r.ride_code}</strong></td>
                    <td>${r.ride_date || '-'}</td>
                    <td>${r.pickup_station || '-'}</td>
                    <td>${r.destination || '-'}</td>
                    <td>${r.user_name || r.user_id || '-'}</td>
                    <td>${r.driver_name || '-'} (${r.vehicle_type || '-'})</td>
                    <td style="font-weight:700; color:#fff;">${formatInr(r.fare_amount)}</td>
                    <td><span class="status-badge ${r.status.includes('Successful') ? 'status-paid' : (r.status.includes('Completed') ? 'status-completed' : 'status-booked')}">${r.status}</span></td>
                </tr>
            `;
        });
    } else if (tab === 'payments') {
        if (titleText) titleText.innerText = `All Payment & Settlement Records (${data.payments.length})`;
        if (badge) badge.innerText = `${data.payments.length} transactions settled`;
        headHtml = `
            <th>Payment ID</th>
            <th>Ride Reference</th>
            <th>Amount Paid</th>
            <th>Payment Method</th>
            <th>Status</th>
            <th>Settled Timestamp</th>
        `;
        data.payments.forEach(p => {
            rowsHtml += `
                <tr>
                    <td><strong style="color:var(--primary-light); font-family:monospace;">${p.payment_id}</strong></td>
                    <td><strong style="color:#fff;">${p.ride_code}</strong></td>
                    <td style="font-weight:700; color:#34d399;">${formatInr(p.amount)}</td>
                    <td><span style="background:rgba(255,255,255,0.08); padding:3px 8px; border-radius:6px;">${p.payment_mode}</span></td>
                    <td><span class="status-badge status-paid">${p.payment_status}</span></td>
                    <td style="font-size:0.8rem; color:var(--text-muted);">${p.transaction_time}</td>
                </tr>
            `;
        });
    } else if (tab === 'food') {
        if (titleText) titleText.innerText = `All In-Vehicle Food & Dining Pre-Orders (${data.food_orders.length})`;
        if (badge) badge.innerText = `${data.food_orders.length} culinary deliveries`;
        headHtml = `
            <th>Order ID</th>
            <th>Ride Code</th>
            <th>Passenger</th>
            <th>Delicacy / Food Items</th>
            <th>Amount</th>
            <th>Delivery Status</th>
            <th>Ordered Time</th>
        `;
        data.food_orders.forEach(f => {
            rowsHtml += `
                <tr>
                    <td><strong style="color:var(--primary-light); font-family:monospace;">${f.order_id}</strong></td>
                    <td><strong>${f.ride_code}</strong></td>
                    <td>${f.user_name || '-'}</td>
                    <td>🍱 ${f.food_items}</td>
                    <td style="font-weight:700; color:#fff;">${formatInr(f.total_amount)}</td>
                    <td><span style="font-size:0.75rem; background:rgba(16,185,129,0.15); color:#6ee7b7; padding:3px 8px; border-radius:6px; border:1px solid rgba(16,185,129,0.3);">${f.delivery_status}</span></td>
                    <td style="font-size:0.8rem; color:var(--text-muted);">${f.order_time}</td>
                </tr>
            `;
        });
    } else if (tab === 'drivers') {
        if (titleText) titleText.innerText = `All Verified Drivers & Fleet Models (${data.drivers.length})`;
        if (badge) badge.innerText = `${data.drivers.length} chauffeurs on radar`;
        headHtml = `
            <th>Driver ID</th>
            <th>Chauffeur Name</th>
            <th>Vehicle Model</th>
            <th>Vehicle Plate Number</th>
            <th>Rating</th>
            <th>Operating Base</th>
        `;
        data.drivers.forEach(d => {
            rowsHtml += `
                <tr>
                    <td><strong style="color:var(--primary-light); font-family:monospace;">${d.driver_id}</strong></td>
                    <td><strong>${d.driver_name}</strong></td>
                    <td>${d.vehicle_type}</td>
                    <td><span style="font-family:monospace; background:rgba(255,255,255,0.06); padding:3px 7px; border-radius:4px;">${d.vehicle_number}</span></td>
                    <td style="color:#f59e0b; font-weight:700;">⭐ ${d.rating}</td>
                    <td>Kerala Royal Transit</td>
                </tr>
            `;
        });
    } else if (tab === 'stations') {
        if (titleText) titleText.innerText = `All Kerala Transit Hubs & Rest Stops (${data.stations.length})`;
        if (badge) badge.innerText = `${data.stations.length} hubs active`;
        headHtml = `
            <th>Station ID</th>
            <th>Hub Name</th>
            <th>Bay Number</th>
            <th>In-Vehicle Dining Partner</th>
            <th>Station Rest Amenities & EV Fast Charging</th>
        `;
        data.stations.forEach(s => {
            rowsHtml += `
                <tr>
                    <td><strong style="color:var(--primary-light); font-family:monospace;">${s.station_id}</strong></td>
                    <td><strong>${s.station_name}</strong></td>
                    <td><span style="background:rgba(56,189,248,0.15); color:#7dd3fc; padding:2px 8px; border-radius:4px; font-family:monospace;">${s.station_no}</span></td>
                    <td>${s.food_available ? '✅ Partner Kitchens Online' : '❌ Dining Unavailable'}</td>
                    <td style="font-size:0.82rem; color:var(--text-muted);">${s.rest_stop_info}</td>
                </tr>
            `;
        });
    } else if (tab === 'users') {
        if (titleText) titleText.innerText = `All System Users & Commuters (${data.users.length})`;
        if (badge) badge.innerText = `${data.users.length} accounts verified`;
        headHtml = `
            <th>User ID</th>
            <th>Full Name</th>
            <th>System Role</th>
            <th>Contact</th>
            <th>Gender</th>
            <th>Total Trips</th>
            <th>Total Spent</th>
        `;
        data.users.forEach(u => {
            const isAdmin = u.user_type === 'Admin';
            rowsHtml += `
                <tr>
                    <td><strong style="color:var(--primary-light); font-family:monospace;">${u.user_id}</strong></td>
                    <td><strong>${u.user_name}</strong></td>
                    <td><span style="padding:3px 10px; border-radius:12px; font-size:0.72rem; font-weight:700; ${isAdmin ? 'background:rgba(0,242,254,0.18); border:1px solid var(--border-gold); color:var(--primary-light);' : 'background:rgba(16,185,129,0.18); border:1px solid rgba(16,185,129,0.3); color:#34d399;'}">${isAdmin ? '👑 Administrator' : '👤 Passenger'}</span></td>
                    <td>${u.user_no}</td>
                    <td>${u.gender}</td>
                    <td style="font-weight:700;">${u.total_trips || 0}</td>
                    <td style="font-weight:700; color:#34d399;">${formatInr(u.total_spent)}</td>
                </tr>
            `;
        });
    } else {
        // 'all' Overview: Consolidated summary table showing sample entries across all datasets
        if (titleText) titleText.innerText = `Consolidated System Overview (All Master Tables Combined)`;
        if (badge) badge.innerText = `Complete platform telemetry synchronized`;
        headHtml = `
            <th>Entity Type</th>
            <th>Identifier</th>
            <th>Title / Name</th>
            <th>Details / Fleet / Station</th>
            <th>Financial Value</th>
            <th>Operating Status</th>
        `;
        data.rides.slice(0, 5).forEach(r => {
            rowsHtml += `
                <tr>
                    <td><span style="background:rgba(56,189,248,0.15); color:#7dd3fc; padding:2px 8px; border-radius:4px; font-size:0.75rem;">🚘 Ride</span></td>
                    <td><strong style="font-family:monospace;">${r.ride_code}</strong></td>
                    <td>${r.pickup_station} ➔ ${r.destination}</td>
                    <td>${r.vehicle_type} (${r.driver_name})</td>
                    <td style="font-weight:700;">${formatInr(r.fare_amount)}</td>
                    <td><span class="status-badge ${r.status.includes('Paid') ? 'status-paid' : 'status-completed'}">${r.status}</span></td>
                </tr>
            `;
        });
        data.payments.slice(0, 4).forEach(p => {
            rowsHtml += `
                <tr>
                    <td><span style="background:rgba(16,185,129,0.15); color:#6ee7b7; padding:2px 8px; border-radius:4px; font-size:0.75rem;">💳 Payment</span></td>
                    <td><strong style="font-family:monospace;">${p.payment_id}</strong></td>
                    <td>Ride ${p.ride_code} Settlement</td>
                    <td>Mode: ${p.payment_mode} • ${p.transaction_time}</td>
                    <td style="font-weight:700; color:#34d399;">${formatInr(p.amount)}</td>
                    <td><span class="status-badge status-paid">${p.payment_status}</span></td>
                </tr>
            `;
        });
        data.food_orders.slice(0, 3).forEach(f => {
            rowsHtml += `
                <tr>
                    <td><span style="background:rgba(245,158,11,0.15); color:#fbbf24; padding:2px 8px; border-radius:4px; font-size:0.75rem;">🍱 Dining</span></td>
                    <td><strong style="font-family:monospace;">${f.order_id}</strong></td>
                    <td>${f.food_items}</td>
                    <td>Ride ${f.ride_code} (${f.user_name || 'Passenger'})</td>
                    <td style="font-weight:700;">${formatInr(f.total_amount)}</td>
                    <td><span style="font-size:0.75rem; color:#34d399;">${f.delivery_status}</span></td>
                </tr>
            `;
        });
        data.drivers.slice(0, 3).forEach(d => {
            rowsHtml += `
                <tr>
                    <td><span style="background:rgba(139,92,246,0.15); color:#c084fc; padding:2px 8px; border-radius:4px; font-size:0.75rem;">🏎️ Fleet</span></td>
                    <td><strong style="font-family:monospace;">${d.driver_id}</strong></td>
                    <td>${d.driver_name}</td>
                    <td>${d.vehicle_type} (${d.vehicle_number})</td>
                    <td style="color:#f59e0b;">⭐ ${d.rating}</td>
                    <td><span style="color:#38bdf8;">Active</span></td>
                </tr>
            `;
        });
    }

    thead.innerHTML = `<tr>${headHtml}</tr>`;
    tbody.innerHTML = rowsHtml;
}

window.filterMasterData = function () {
    const input = document.getElementById('masterSearchInput');
    const clearBtn = document.getElementById('masterClearBtn');
    const badge = document.getElementById('masterResultsBadge');
    if (!input) return;

    const query = input.value.trim().toLowerCase();
    if (clearBtn) clearBtn.style.display = query ? 'block' : 'none';

    const rows = document.querySelectorAll('#masterTableBody tr');
    let visibleCount = 0;

    rows.forEach(r => {
        const text = r.innerText.toLowerCase();
        if (!query || text.includes(query)) {
            r.style.display = '';
            visibleCount++;
        } else {
            r.style.display = 'none';
        }
    });

    if (badge) {
        badge.innerText = query ? `Found ${visibleCount} matches` : `Showing all master records`;
    }
};

window.clearMasterSearch = function () {
    const input = document.getElementById('masterSearchInput');
    if (input) input.value = '';
    window.filterMasterData();
};

window.exportMasterData = function (format = 'csv') {
    if (!window.cachedMasterData) {
        alert('Master dataset is not loaded yet.');
        return;
    }

    if (format === 'json') {
        const jsonStr = JSON.stringify(window.cachedMasterData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Master_System_Dataset_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } else {
        const d = window.cachedMasterData;
        let csv = 'KERALA ROYAL TRANSIT - MASTER ENTERPRISE DATASET\n\n';

        csv += 'ALL RIDES\nRide Code,Date,Pickup,Destination,Passenger,Driver,Fleet,Fare (INR),Status\n';
        d.rides.forEach(r => {
            csv += `"${r.ride_code}","${r.ride_date}","${r.pickup_station}","${r.destination}","${r.user_name}","${r.driver_name}","${r.vehicle_type}",${r.fare_amount},"${r.status}"\n`;
        });

        csv += '\nALL PAYMENTS\nPayment ID,Ride Reference,Amount (INR),Payment Mode,Status,Timestamp\n';
        d.payments.forEach(p => {
            csv += `"${p.payment_id}","${p.ride_code}",${p.amount},"${p.payment_mode}","${p.payment_status}","${p.transaction_time}"\n`;
        });

        csv += '\nALL IN-VEHICLE FOOD ORDERS\nOrder ID,Ride Code,Passenger,Food Items,Amount (INR),Status,Order Time\n';
        d.food_orders.forEach(f => {
            csv += `"${f.order_id}","${f.ride_code}","${f.user_name}","${f.food_items}",${f.total_amount},"${f.delivery_status}","${f.order_time}"\n`;
        });

        csv += '\nALL FLEET DRIVERS\nDriver ID,Name,Vehicle,Plate,Rating\n';
        d.drivers.forEach(dr => {
            csv += `"${dr.driver_id}","${dr.driver_name}","${dr.vehicle_type}","${dr.vehicle_number}",${dr.rating}\n`;
        });

        csv += '\nALL STATIONS\nStation ID,Name,Bay,Food Available,Amenities\n';
        d.stations.forEach(s => {
            csv += `"${s.station_id}","${s.station_name}","${s.station_no}",${s.food_available},"${s.rest_stop_info}"\n`;
        });

        csv += '\nALL USERS\nUser ID,Name,Role,Phone,Gender,Trips,Total Spent (INR)\n';
        d.users.forEach(u => {
            csv += `"${u.user_id}","${u.user_name}","${u.user_type}","${u.user_no}","${u.gender}",${u.total_trips || 0},${u.total_spent || 0}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Master_System_Dataset_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
};

/* ==========================================================================
   ADMINISTRATOR CONSOLE: USER DIRECTORY & ACCESS CONTROL MANAGEMENT
   ========================================================================== */
window.loadUsersManagement = async function () {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--gold-light);">Loading system users...</td></tr>`;

    try {
        const response = await fetch('/api/admin/users');
        if (!response.ok) {
            throw new Error(`Failed to load users: ${response.status}`);
        }
        const users = await response.json();
        const formatInr = num => '₹' + Number(num || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

        let html = '';
        users.forEach(u => {
            const isAdmin = u.user_type === 'Admin';
            html += `
                <tr>
                    <td><strong style="color:var(--primary-light); font-family:monospace;">${u.user_id}</strong></td>
                    <td><strong>${u.user_name}</strong></td>
                    <td>
                        <span style="padding: 4px 10px; border-radius: 12px; font-size: 0.72rem; font-weight: 700; ${isAdmin ? 'background: rgba(0,242,254,0.18); border: 1px solid var(--border-gold); color: var(--primary-light);' : 'background: rgba(16,185,129,0.18); border: 1px solid rgba(16,185,129,0.3); color: #34d399;'}">
                            ${isAdmin ? '👑 Administrator' : '👤 Passenger'}
                        </span>
                    </td>
                    <td>${u.user_no}</td>
                    <td>${u.gender}</td>
                    <td style="text-align: center; font-weight: 700;">${u.total_trips || 0}</td>
                    <td style="text-align: right; font-weight: 700; color: #34d399; font-family: monospace;">${formatInr(u.total_spent)}</td>
                    <td style="text-align: center;">
                        <span style="font-size: 0.75rem; color: #38bdf8; background: rgba(56,189,248,0.12); padding: 3px 8px; border-radius: 6px;">Active Verified</span>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    } catch (err) {
        console.error('Error loading users:', err);
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#f43f5e; padding:25px;">Failed to load user records.</td></tr>`;
    }
};

window.openNewUserModal = function () {
    const modal = document.getElementById('newUserModal');
    if (modal) modal.style.display = 'flex';
};

window.closeNewUserModal = function () {
    const modal = document.getElementById('newUserModal');
    if (modal) modal.style.display = 'none';
};

window.submitNewUser = async function () {
    const uid = document.getElementById('newUserId').value.trim();
    const uname = document.getElementById('newUserName').value.trim();
    const urole = document.getElementById('newUserRole').value;
    const uphone = document.getElementById('newUserPhone').value.trim();
    const ugender = document.getElementById('newUserGender').value;
    const upwd = document.getElementById('newUserPassword').value.trim();

    if (!uid || !uname) {
        alert('Please specify User Identifier and Full Name.');
        return;
    }

    try {
        const res = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: uid,
                user_name: uname,
                user_type: urole,
                user_no: uphone || '9847000000',
                gender: ugender,
                password: upwd || 'user123'
            })
        });

        const data = await res.json();
        if (res.ok && data.success) {
            alert(data.message || 'User provisioned successfully!');
            window.closeNewUserModal();
            window.loadUsersManagement();
        } else {
            alert(data.message || 'Failed to create user account.');
        }
    } catch (err) {
        console.error('Error creating user:', err);
        alert('Server error creating user account.');
    }
};