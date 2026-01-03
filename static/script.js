let isAdmin = false;
let editingCategoryId = null;
let editingDistributorId = null;
let editingPartyId = null;
let categoriesData = [];
let distributorsData = [];
let partiesData = [];

// Toast notification system
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after duration
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out forwards';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Custom confirmation modal
function showConfirm(message, title = 'Confirm Delete') {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const titleEl = document.getElementById('confirmTitle');
        const messageEl = document.getElementById('confirmMessage');
        const okBtn = document.getElementById('confirmOk');
        const cancelBtn = document.getElementById('confirmCancel');
        
        titleEl.textContent = title;
        messageEl.textContent = message;
        modal.classList.add('active');
        
        const cleanup = () => {
            modal.classList.remove('active');
            okBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
        };
        
        const onConfirm = () => {
            cleanup();
            resolve(true);
        };
        
        const onCancel = () => {
            cleanup();
            resolve(false);
        };
        
        okBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
        
        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) onCancel();
        }, { once: true });
    });
}

// Helper function for logging with proper representation
function repr(str) {
    return `"${str}"`;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Set today's date as default
    document.getElementById('entryDate').valueAsDate = new Date();
    
    // Check admin status and load data
    await checkAdminStatus();
    await loadCategories();
    await loadDistributors();
    await loadParties();
    await loadStats();
    await loadStockEntries();
    await loadSessionEntries();
    if (isAdmin) {
        await loadUsers();
    }
    
    // Event listeners
    document.getElementById('stockForm').addEventListener('submit', handleAddStockEntry);
    document.getElementById('categoryForm').addEventListener('submit', handleAddCategory);
    document.getElementById('distributorForm').addEventListener('submit', handleAddDistributor);
    document.getElementById('partyForm').addEventListener('submit', handleAddParty);
    document.getElementById('adminForm').addEventListener('submit', handleMakeAdmin);
    
    // End number: auto-complete on blur, submit on Enter
    document.getElementById('endNumber').addEventListener('blur', handleEndNumberComplete);
    document.getElementById('endNumber').addEventListener('input', updateQuantityPreview);
    document.getElementById('endNumber').addEventListener('keydown', handleEndNumberKeydown);
    
    // Rate input: update amount preview
    document.getElementById('rateInput').addEventListener('input', updateAmountPreview);
    document.getElementById('rateInput').addEventListener('keydown', handleRateKeydown);
    
    // Start number and category: update quantity preview
    document.getElementById('startNumber').addEventListener('change', updateQuantityPreview);
    document.getElementById('startNumber').addEventListener('input', updateQuantityPreview);
    document.getElementById('categorySelect').addEventListener('change', handleCategoryChange);
    
    // Date change: reload session entries
    document.getElementById('entryDate').addEventListener('change', loadSessionEntries);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Focus first field when Add Stock Entry tab is shown
    setupTabFocus();
});

// Handle category change - auto-populate rate and update quantity preview
function handleCategoryChange() {
    const categoryId = document.getElementById('categorySelect').value;
    
    if (categoryId) {
        const category = categoriesData.find(c => c.id == categoryId);
        if (category && category.purchase_rate) {
            document.getElementById('rateInput').value = category.purchase_rate;
            updateAmountPreview();
        }
    }
    
    updateQuantityPreview();
}

function showTab(tabId) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active from all nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabId).classList.add('active');
    
    // Mark button as active
    event.target.classList.add('active');
    
    // Reload data if viewing stock
    if (tabId === 'view-stock-tab') {
        loadStockEntries();
    }
    
    // Focus first field when switching to stock entry tab
    if (tabId === 'stock-tab') {
        setTimeout(() => {
            document.getElementById('entryDate').focus();
        }, 100);
    }
}

// Keyboard shortcuts handler
function handleKeyboardShortcuts(e) {
    // Only handle shortcuts when on stock entry tab
    const stockTab = document.getElementById('stock-tab');
    if (!stockTab.classList.contains('active')) return;
    
    // Escape key - clear form
    if (e.key === 'Escape') {
        e.preventDefault();
        clearStockForm();
    }
    
    // Tab key - focus trap within the purchase page
    if (e.key === 'Tab') {
        handleFocusTrap(e);
    }
}

// Focus trap - keep Tab navigation within the Purchase page fields
function handleFocusTrap(e) {
    const stockTab = document.getElementById('stock-tab');
    if (!stockTab.classList.contains('active')) return;
    
    // Get all focusable fields in order
    const fields = [
        document.getElementById('entryDate'),
        document.getElementById('distributorSelect'),
        document.getElementById('categorySelect'),
        document.getElementById('ticketCode'),
        document.getElementById('startNumber'),
        document.getElementById('endNumber'),
        document.getElementById('rateInput')
    ].filter(el => el !== null);
    
    const currentIndex = fields.indexOf(document.activeElement);
    
    if (e.shiftKey) {
        // Shift+Tab - go backwards
        if (currentIndex <= 0) {
            e.preventDefault();
            fields[fields.length - 1].focus();
        }
    } else {
        // Tab - go forwards
        if (currentIndex === fields.length - 1) {
            e.preventDefault();
            fields[0].focus();
        }
    }
}

// Setup focus when tab is shown
function setupTabFocus() {
    // Auto-focus date field when stock tab becomes active
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.target.id === 'stock-tab' && mutation.target.classList.contains('active')) {
                setTimeout(() => {
                    document.getElementById('entryDate').focus();
                }, 100);
            }
        });
    });
    
    const stockTab = document.getElementById('stock-tab');
    if (stockTab) {
        observer.observe(stockTab, { attributes: true, attributeFilter: ['class'] });
    }
}

// Clear the stock entry form (only entry fields, not session settings)
function clearStockForm() {
    // Only clear entry fields, keep date and distributor
    document.getElementById('categorySelect').value = '';
    document.getElementById('ticketCode').value = '';
    document.getElementById('startNumber').value = '';
    document.getElementById('endNumber').value = '';
    document.getElementById('quantityDisplay').textContent = '0';
    document.getElementById('rateInput').value = '';
    document.getElementById('amountDisplay').textContent = '0';
    
    // Focus the category field (first entry field)
    document.getElementById('categorySelect').focus();
}

async function checkAdminStatus() {
    try {
        const response = await fetch('/api/user-info');
        const data = await response.json();
        
        isAdmin = data.is_admin;
        
        // Show/hide admin panel based on status
        const adminBtn = document.querySelector('.admin-only');
        if (adminBtn) {
            adminBtn.style.display = isAdmin ? 'block' : 'none';
        }
        
        // Display username
        const userNameEl = document.getElementById('userName');
        if (userNameEl) {
            userNameEl.textContent = `User: ${data.username}${isAdmin ? ' (Admin)' : ''}`;
        }
    } catch (error) {
        console.error('Error checking admin status:', error);
    }
}

async function loadCategories() {
    try {
        const response = await fetch('/api/categories');
        const categories = await response.json();
        
        // Store globally for denomination lookup
        categoriesData = categories;
        
        // Populate select dropdown
        const select = document.getElementById('categorySelect');
        select.innerHTML = '<option value="">Select</option>';
        
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            select.appendChild(option);
        });
        
        // Display categories in admin panel
        displayCategories(categories);
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

async function loadDistributors() {
    try {
        const response = await fetch('/api/distributors');
        const distributors = await response.json();
        
        // Store globally
        distributorsData = distributors;
        
        // Populate select dropdown
        const select = document.getElementById('distributorSelect');
        select.innerHTML = '<option value="">Select</option>';
        
        distributors.forEach(dist => {
            const option = document.createElement('option');
            option.value = dist.id;
            option.textContent = dist.name;
            select.appendChild(option);
        });
        
        // Display distributors in admin panel
        displayDistributors(distributors);
    } catch (error) {
        console.error('Error loading distributors:', error);
    }
}

function displayDistributors(distributors) {
    const container = document.getElementById('distributorsList');
    
    if (!container) return;
    
    if (distributors.length === 0) {
        container.innerHTML = '<p>No distributors yet. Create one using the form above.</p>';
        return;
    }
    
    container.innerHTML = distributors.map(dist => `
        <div class="category-card">
            <div>
                <h4>${dist.name}</h4>
                <div style="display: flex; gap: 8px; margin-top: 10px;">
                    <button class="btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="editDistributor(${dist.id}, '${dist.name.replace(/'/g, "\\'")}')">Edit</button>
                    <button class="btn-danger" style="padding: 6px 12px; font-size: 12px;" onclick="deleteDistributor(${dist.id})">Delete</button>
                </div>
            </div>
        </div>
    `).join('');
}

async function handleAddDistributor(e) {
    e.preventDefault();
    
    const distributorName = document.getElementById('distributorName').value.trim();
    
    try {
        const url = editingDistributorId ? `/api/distributors/${editingDistributorId}` : '/api/distributors';
        const method = editingDistributorId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: distributorName })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(editingDistributorId ? 'Distributor updated!' : 'Distributor created!', 'success');
            
            document.getElementById('distributorName').value = '';
            editingDistributorId = null;
            document.getElementById('distributorSubmitBtn').textContent = 'Add Distributor';
            
            await loadDistributors();
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

async function deleteDistributor(id) {
    const confirmed = await showConfirm('Are you sure you want to delete this distributor?', 'Delete Distributor');
    if (!confirmed) return;
    
    try {
        const response = await fetch(`/api/distributors/${id}`, { method: 'DELETE' });
        const data = await response.json();
        
        if (data.success) {
            await loadDistributors();
            showToast('Distributor deleted successfully', 'success');
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

function editDistributor(id, name) {
    editingDistributorId = id;
    document.getElementById('distributorName').value = name;
    document.getElementById('distributorSubmitBtn').textContent = 'Update Distributor';
    document.getElementById('distributorName').focus();
}

// Party Management Functions
async function loadParties() {
    try {
        const response = await fetch('/api/parties');
        const parties = await response.json();
        
        // Store globally
        partiesData = parties;
        
        // Display parties in admin panel
        displayParties(parties);
    } catch (error) {
        console.error('Error loading parties:', error);
    }
}

function displayParties(parties) {
    const container = document.getElementById('partiesList');
    
    if (!container) return;
    
    if (parties.length === 0) {
        container.innerHTML = '<p>No parties yet. Create one using the form above.</p>';
        return;
    }
    
    container.innerHTML = parties.map(party => `
        <div class="category-card">
            <div>
                <h4>${party.name}</h4>
                <div style="display: flex; gap: 8px; margin-top: 10px;">
                    <button class="btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="editParty(${party.id}, '${party.name.replace(/'/g, "\\'")}')">Edit</button>
                    <button class="btn-danger" style="padding: 6px 12px; font-size: 12px;" onclick="deleteParty(${party.id})">Delete</button>
                </div>
            </div>
        </div>
    `).join('');
}

async function handleAddParty(e) {
    e.preventDefault();
    
    const partyName = document.getElementById('partyName').value.trim();
    
    try {
        const url = editingPartyId ? `/api/parties/${editingPartyId}` : '/api/parties';
        const method = editingPartyId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: partyName })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(editingPartyId ? 'Party updated!' : 'Party created!', 'success');
            
            document.getElementById('partyName').value = '';
            editingPartyId = null;
            document.getElementById('partySubmitBtn').textContent = 'Add Party';
            
            await loadParties();
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

async function deleteParty(id) {
    const confirmed = await showConfirm('Are you sure you want to delete this party?', 'Delete Party');
    if (!confirmed) return;
    
    try {
        const response = await fetch(`/api/parties/${id}`, { method: 'DELETE' });
        const data = await response.json();
        
        if (data.success) {
            await loadParties();
            showToast('Party deleted successfully', 'success');
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

function editParty(id, name) {
    editingPartyId = id;
    document.getElementById('partyName').value = name;
    document.getElementById('partySubmitBtn').textContent = 'Update Party';
    document.getElementById('partyName').focus();
}

function displayCategories(categories) {
    const container = document.getElementById('categoriesList');
    
    if (categories.length === 0) {
        container.innerHTML = '<p>No categories yet. Create one using the form above.</p>';
        return;
    }
    
    container.innerHTML = categories.map(cat => `
        <div class="category-card">
            <div>
                <h4>${cat.name}</h4>
                <p style="font-size: 11px; color: #666;">Series: ${cat.series} | Denom: ${cat.denomination}</p>
                <p style="font-size: 11px; color: #666;">Purchase: ${cat.purchase_rate || 0} | Sale: ${cat.sale_rate || 0}</p>
                <div style="display: flex; gap: 8px; margin-top: 10px;">
                    <button class="btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="editCategory(${cat.id}, '${cat.name}', ${cat.purchase_rate || 0}, ${cat.sale_rate || 0})">Edit</button>
                    <button class="btn-danger" style="padding: 6px 12px; font-size: 12px;" onclick="deleteCategory(${cat.id})">Delete</button>
                </div>
            </div>
        </div>
    `).join('');
}

async function handleAddCategory(e) {
    e.preventDefault();
    
    const categoryName = document.getElementById('categoryName').value.toUpperCase();
    const purchaseRate = parseFloat(document.getElementById('categoryPurchaseRate').value) || 0;
    const saleRate = parseFloat(document.getElementById('categorySaleRate').value) || 0;
    
    // Validate format
    if (!categoryName || categoryName.length < 2) {
        showToast('Invalid format. Use format like M25, D10, E5', 'warning');
        return;
    }
    
    const data = {
        name: categoryName,
        purchase_rate: purchaseRate,
        sale_rate: saleRate
    };
    
    try {
        const url = editingCategoryId ? `/api/categories/${editingCategoryId}` : '/api/categories';
        const method = editingCategoryId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast(editingCategoryId ? 'Category updated successfully!' : 'Category added successfully!', 'success');
            document.getElementById('categoryForm').reset();
            document.getElementById('categorySubmitBtn').textContent = 'Add Category';
            editingCategoryId = null;
            await loadCategories();
        } else {
            showToast(result.message, 'error');
        }
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

async function deleteCategory(categoryId) {
    const confirmed = await showConfirm('Are you sure you want to delete this category?', 'Delete Category');
    if (!confirmed) return;
    
    try {
        const response = await fetch(`/api/categories/${categoryId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        if (result.success) {
            await loadCategories();
            showToast('Category deleted successfully', 'success');
        }
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

function editCategory(categoryId, categoryName, purchaseRate = 0, saleRate = 0) {
    editingCategoryId = categoryId;
    document.getElementById('categoryName').value = categoryName;
    document.getElementById('categoryPurchaseRate').value = purchaseRate;
    document.getElementById('categorySaleRate').value = saleRate;
    document.getElementById('categorySubmitBtn').textContent = 'Update Category';
    document.getElementById('categoryName').focus();
}

function updateQuantity() {
    const startStr = document.getElementById('startNumber').value;
    const endInput = document.getElementById('endNumber').value;
    const categoryId = document.getElementById('categorySelect').value;
    
    if (!startStr || !endInput) {
        document.getElementById('quantityDisplay').textContent = '0';
        return;
    }
    
    // Parse as integers for calculation, preserving leading zeros in original strings
    const start = parseInt(startStr);
    let end;
    let endDisplay = endInput;
    
    // Auto-complete end number based on start number
    if (endInput.length < startStr.length) {
        // Take prefix from start number and append the user input
        const prefix = startStr.substring(0, startStr.length - endInput.length);
        end = parseInt(prefix + endInput);
        endDisplay = prefix + endInput;
        
        // Update the field to show the complete number
        document.getElementById('endNumber').value = endDisplay;
    } else {
        end = parseInt(endInput);
    }
    
    // Calculate base ticket count
    const ticketCount = end - start + 1;
    
    // Get denomination from selected category
    let denomination = 1;
    if (categoryId) {
        const category = categoriesData.find(c => c.id == categoryId);
        if (category) {
            denomination = parseInt(category.denomination) || 1;
        }
    }
    
    const quantity = ticketCount * denomination;
    document.getElementById('quantityDisplay').textContent = Math.max(0, quantity);
}

// Preview quantity while typing (without auto-completing end number)
function updateQuantityPreview() {
    const startStr = document.getElementById('startNumber').value;
    const endInput = document.getElementById('endNumber').value;
    const categoryId = document.getElementById('categorySelect').value;
    
    if (!startStr || !endInput) {
        document.getElementById('quantityDisplay').textContent = '0';
        document.getElementById('amountDisplay').textContent = '0';
        return;
    }
    
    const start = parseInt(startStr);
    let end;
    
    // Calculate what the end number would be (but don't update the field)
    if (endInput.length < startStr.length) {
        const prefix = startStr.substring(0, startStr.length - endInput.length);
        end = parseInt(prefix + endInput);
    } else {
        end = parseInt(endInput);
    }
    
    // Calculate base ticket count
    const ticketCount = end - start + 1;
    
    // Get denomination from selected category
    let denomination = 1;
    if (categoryId) {
        const category = categoriesData.find(c => c.id == categoryId);
        if (category) {
            denomination = parseInt(category.denomination) || 1;
        }
    }
    
    const quantity = ticketCount * denomination;
    document.getElementById('quantityDisplay').textContent = Math.max(0, quantity);
    
    // Update amount as well
    updateAmountPreview();
}

// Auto-complete end number when user leaves the field (Tab/click away)
function handleEndNumberComplete() {
    const startStr = document.getElementById('startNumber').value;
    const endInput = document.getElementById('endNumber').value;
    
    if (!startStr || !endInput) {
        return;
    }
    
    // Auto-complete end number based on start number
    if (endInput.length < startStr.length) {
        const prefix = startStr.substring(0, startStr.length - endInput.length);
        const endDisplay = prefix + endInput;
        document.getElementById('endNumber').value = endDisplay;
    }
    
    // Update quantity with final value
    updateQuantityPreview();
}

// Handle Enter key on End Number field - auto-complete and move to rate
function handleEndNumberKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        
        // First auto-complete the end number
        handleEndNumberComplete();
        
        // Move focus to rate input
        document.getElementById('rateInput').focus();
    }
}

// Handle Enter key on Rate field - submit the form
function handleRateKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        submitStockEntry();
    }
}

// Update amount display based on rate and quantity
function updateAmountPreview() {
    const quantity = parseInt(document.getElementById('quantityDisplay').textContent) || 0;
    const rate = parseFloat(document.getElementById('rateInput').value) || 0;
    const amount = quantity * rate;
    document.getElementById('amountDisplay').textContent = amount.toFixed(2);
}

async function handleAddStockEntry(e) {
    e.preventDefault();
    await submitStockEntry();
}

async function submitStockEntry() {
    const entryDate = document.getElementById('entryDate').value;
    const distributorId = document.getElementById('distributorSelect').value;
    const categoryId = document.getElementById('categorySelect').value;
    const ticketCode = document.getElementById('ticketCode').value.trim().toUpperCase();
    const startNum = document.getElementById('startNumber').value.trim();
    const endNum = document.getElementById('endNumber').value.trim();
    const rate = parseFloat(document.getElementById('rateInput').value) || 0;
    
    // Validate all required fields
    if (!entryDate) {
        showToast('Please select a date', 'warning');
        document.getElementById('entryDate').focus();
        return;
    }
    
    if (!distributorId) {
        showToast('Please select a distributor', 'warning');
        document.getElementById('distributorSelect').focus();
        return;
    }
    
    if (!categoryId) {
        showToast('Please select a category', 'warning');
        document.getElementById('categorySelect').focus();
        return;
    }
    
    if (!startNum) {
        showToast('Please enter start number', 'warning');
        document.getElementById('startNumber').focus();
        return;
    }
    
    if (!endNum) {
        showToast('Please enter end number', 'warning');
        document.getElementById('endNumber').focus();
        return;
    }
    
    if (rate <= 0) {
        showToast('Please enter a valid rate', 'warning');
        document.getElementById('rateInput').focus();
        return;
    }
    
    // Calculate quantity from the display
    const quantityText = document.getElementById('quantityDisplay').textContent;
    const quantity = parseInt(quantityText) || 0;
    
    console.log('[FRONTEND] Stock Entry Submission:');
    console.log(`  Ticket Code: ${ticketCode}`);
    console.log(`  Start Number: ${repr(startNum)} (length: ${startNum.length})`);
    console.log(`  End Number: ${repr(endNum)} (length: ${endNum.length})`);
    console.log(`  Quantity: ${quantity}`);
    console.log(`  Rate: ${rate}`);
    
    const data = {
        category_id: categoryId,
        distributor_id: distributorId || null,
        entry_date: document.getElementById('entryDate').value,
        ticket_code: ticketCode,
        start_number: startNum,
        end_number: endNum,
        quantity: quantity,
        rate: rate,
        notes: ''
    };
    
    console.log('[FRONTEND] JSON Data being sent:', JSON.stringify(data));
    
    try {
        const response = await fetch('/api/stock-entries', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('[FRONTEND] Stock entry created successfully!');
            showToast('Stock entry added successfully!', 'success');
            
            // Only reset entry fields, keep date and distributor
            document.getElementById('categorySelect').value = '';
            document.getElementById('ticketCode').value = '';
            document.getElementById('startNumber').value = '';
            document.getElementById('endNumber').value = '';
            document.getElementById('quantityDisplay').textContent = '0';
            document.getElementById('rateInput').value = '';
            document.getElementById('amountDisplay').textContent = '0';
            
            // Focus back to category for quick next entry
            document.getElementById('categorySelect').focus();
            
            await loadSessionEntries();
            await loadStockEntries();
            await loadStats();
        } else {
            showToast(result.message, 'error');
        }
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

async function loadStockEntries() {
    const dateFilter = document.getElementById('filterDate')?.value;
    
    try {
        const url = '/api/stock-entries' + (dateFilter ? `?date=${dateFilter}` : '');
        const response = await fetch(url);
        const entries = await response.json();
        
        const tbody = document.getElementById('stockBody');
        
        if (entries.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 20px;">No entries found</td></tr>';
            return;
        }
        
        tbody.innerHTML = entries.map(entry => `
            <tr>
                <td>${entry.date}</td>
                <td>${entry.distributor || '-'}</td>
                <td>${entry.category}</td>
                <td>${entry.ticket_code || '-'}</td>
                <td>${entry.start_number}</td>
                <td>${entry.end_number}</td>
                <td>${entry.quantity}</td>
                <td>${entry.rate || 0}</td>
                <td>${(entry.amount || 0).toFixed(2)}</td>
                <td>
                    <button class="btn-secondary btn-sm" onclick="editStockEntry(${entry.id}, '${entry.category_id}', '${entry.ticket_code || ''}', '${entry.start_number}', '${entry.end_number}', ${entry.rate || 0})">✏️</button>
                    <button class="btn-danger btn-sm" onclick="deleteStockEntry(${entry.id})">🗑️</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading stock entries:', error);
    }
}

// Load entries for the selected date on Purchase page
async function loadSessionEntries() {
    const sessionDate = document.getElementById('entryDate')?.value;
    
    // Update the date display header
    const dateDisplay = document.getElementById('sessionDateDisplay');
    if (dateDisplay && sessionDate) {
        const date = new Date(sessionDate);
        const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
        dateDisplay.textContent = date.toLocaleDateString('en-IN', options);
    }
    
    try {
        const url = '/api/stock-entries' + (sessionDate ? `?date=${sessionDate}` : '');
        const response = await fetch(url);
        const entries = await response.json();
        
        const tbody = document.getElementById('sessionEntriesBody');
        const countEl = document.getElementById('sessionEntryCount');
        const totalEl = document.getElementById('sessionTotalQty');
        const amountEl = document.getElementById('sessionTotalAmount');
        
        if (!tbody) return;
        
        if (entries.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 15px; color: #a0aec0;">No entries yet for this date</td></tr>';
            countEl.textContent = '0';
            totalEl.textContent = '0';
            if (amountEl) amountEl.textContent = '0';
            return;
        }
        
        let totalQty = 0;
        let totalAmount = 0;
        tbody.innerHTML = entries.map(entry => {
            totalQty += entry.quantity;
            totalAmount += entry.amount || 0;
            return `
                <tr id="entry-row-${entry.id}" data-entry-id="${entry.id}" data-category-id="${entry.category_id}" data-rate="${entry.rate || 0}">
                    <td class="cell-category">${entry.category}</td>
                    <td class="cell-code">${entry.ticket_code || '-'}</td>
                    <td class="cell-start">${entry.start_number}</td>
                    <td class="cell-end">${entry.end_number}</td>
                    <td class="cell-qty">${entry.quantity}</td>
                    <td class="cell-rate">${entry.rate || 0}</td>
                    <td class="cell-amount">${(entry.amount || 0).toFixed(2)}</td>
                    <td class="cell-actions">
                        <button class="btn-secondary btn-sm" onclick="startInlineEdit(${entry.id}, '${entry.category_id}', '${entry.ticket_code || ''}', '${entry.start_number}', '${entry.end_number}', ${entry.rate || 0})">✏️</button>
                        <button class="btn-danger btn-sm" onclick="deleteSessionEntry(${entry.id})">🗑️</button>
                    </td>
                </tr>
            `;
        }).join('');
        
        countEl.textContent = entries.length;
        totalEl.textContent = totalQty;
        if (amountEl) amountEl.textContent = totalAmount.toFixed(2);
    } catch (error) {
        console.error('Error loading session entries:', error);
    }
}

// Delete entry from session entries list
async function deleteSessionEntry(entryId) {
    const confirmed = await showConfirm('Delete this entry?', 'Delete Entry');
    if (!confirmed) return;
    
    try {
        const response = await fetch(`/api/stock-entries/${entryId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        if (result.success) {
            showToast('Entry deleted successfully', 'success');
            await loadSessionEntries();
            await loadStockEntries();
            await loadStats();
        } else {
            showToast('Error: ' + result.message, 'error');
        }
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

async function deleteStockEntry(entryId) {
    const confirmed = await showConfirm('Are you sure you want to delete this entry?', 'Delete Entry');
    if (!confirmed) return;
    
    try {
        const response = await fetch(`/api/stock-entries/${entryId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        if (result.success) {
            showToast('Entry deleted successfully', 'success');
            await loadStockEntries();
            await loadSessionEntries();
            await loadStats();
        } else {
            showToast('Error: ' + result.message, 'error');
        }
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

// Edit session entry - inline editing (from Purchase page)
function startInlineEdit(entryId, categoryId, ticketCode, startNumber, endNumber, rate = 0) {
    const row = document.getElementById(`entry-row-${entryId}`);
    if (!row) return;
    
    // Build category options
    const categoryOptions = categoriesData.map(cat => 
        `<option value="${cat.id}" ${cat.id == categoryId ? 'selected' : ''}>${cat.name}</option>`
    ).join('');
    
    // Replace cells with input fields
    row.innerHTML = `
        <td>
            <select class="inline-edit-select" id="edit-cat-${entryId}" tabindex="1">
                ${categoryOptions}
            </select>
        </td>
        <td>
            <input type="text" class="inline-edit-input" id="edit-code-${entryId}" value="${ticketCode}" tabindex="2" style="text-transform: uppercase;">
        </td>
        <td>
            <input type="text" class="inline-edit-input" id="edit-start-${entryId}" value="${startNumber}" tabindex="3">
        </td>
        <td>
            <input type="text" class="inline-edit-input" id="edit-end-${entryId}" value="" placeholder="${endNumber.slice(-2)}" tabindex="4">
        </td>
        <td class="cell-qty" id="edit-qty-${entryId}">--</td>
        <td>
            <input type="number" class="inline-edit-input" id="edit-rate-${entryId}" value="${rate}" tabindex="5" min="0" step="0.01">
        </td>
        <td class="cell-amount" id="edit-amount-${entryId}">--</td>
        <td class="cell-actions">
            <button class="btn-success btn-sm" onclick="saveInlineEdit(${entryId})" tabindex="6">✓</button>
            <button class="btn-secondary btn-sm" onclick="cancelInlineEdit()" tabindex="7">✕</button>
        </td>
    `;
    
    // Store original start number for auto-complete
    row.dataset.originalStart = startNumber;
    row.dataset.originalEnd = endNumber;
    
    const catSelect = document.getElementById(`edit-cat-${entryId}`);
    const codeInput = document.getElementById(`edit-code-${entryId}`);
    const startInput = document.getElementById(`edit-start-${entryId}`);
    const endInput = document.getElementById(`edit-end-${entryId}`);
    const qtyDisplay = document.getElementById(`edit-qty-${entryId}`);
    const rateInput = document.getElementById(`edit-rate-${entryId}`);
    const amountDisplay = document.getElementById(`edit-amount-${entryId}`);
    
    // Focus on category
    catSelect.focus();
    
    // Update quantity and amount preview function
    const updateInlineQtyAmount = () => {
        const startStr = startInput.value;
        const endStr = endInput.value;
        const catId = catSelect.value;
        const rateVal = parseFloat(rateInput.value) || 0;
        
        if (!startStr) {
            qtyDisplay.textContent = '--';
            amountDisplay.textContent = '--';
            return;
        }
        
        // Auto-complete end number for preview
        let fullEnd = endStr;
        if (endStr && endStr.length < startStr.length) {
            fullEnd = startStr.substring(0, startStr.length - endStr.length) + endStr;
        }
        
        const start = parseInt(startStr);
        const end = parseInt(fullEnd) || parseInt(startStr);
        const ticketCount = Math.max(0, end - start + 1);
        
        let denomination = 1;
        const category = categoriesData.find(c => c.id == catId);
        if (category) {
            denomination = parseInt(category.denomination) || 1;
        }
        
        const qty = ticketCount * denomination;
        qtyDisplay.textContent = qty;
        amountDisplay.textContent = (qty * rateVal).toFixed(2);
    };
    
    // Auto-complete end number on blur
    const handleEndBlur = () => {
        const startStr = startInput.value;
        const endStr = endInput.value;
        
        if (startStr && endStr && endStr.length < startStr.length) {
            const prefix = startStr.substring(0, startStr.length - endStr.length);
            endInput.value = prefix + endStr;
        }
        updateInlineQtyAmount();
    };
    
    // Event listeners
    catSelect.addEventListener('change', updateInlineQtyAmount);
    startInput.addEventListener('input', updateInlineQtyAmount);
    endInput.addEventListener('input', updateInlineQtyAmount);
    endInput.addEventListener('blur', handleEndBlur);
    rateInput.addEventListener('input', updateInlineQtyAmount);
    
    // Keyboard handlers for all fields
    const handleKeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            // Auto-complete end number first
            handleEndBlur();
            saveInlineEdit(entryId);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelInlineEdit();
        }
    };
    
    catSelect.addEventListener('keydown', handleKeydown);
    codeInput.addEventListener('keydown', handleKeydown);
    startInput.addEventListener('keydown', handleKeydown);
    endInput.addEventListener('keydown', handleKeydown);
    rateInput.addEventListener('keydown', handleKeydown);
    
    // Focus trap for inline edit - Tab cycles only within edit fields
    const editFields = [catSelect, codeInput, startInput, endInput, rateInput];
    
    const handleTabTrap = (e) => {
        if (e.key === 'Tab') {
            e.preventDefault(); // Always prevent default Tab behavior
            
            const currentIndex = editFields.indexOf(document.activeElement);
            let nextIndex;
            
            if (e.shiftKey) {
                // Shift+Tab - go backwards
                nextIndex = currentIndex <= 0 ? editFields.length - 1 : currentIndex - 1;
            } else {
                // Tab - go forwards
                nextIndex = currentIndex >= editFields.length - 1 ? 0 : currentIndex + 1;
            }
            
            editFields[nextIndex].focus();
        }
    };
    
    catSelect.addEventListener('keydown', handleTabTrap);
    codeInput.addEventListener('keydown', handleTabTrap);
    startInput.addEventListener('keydown', handleTabTrap);
    endInput.addEventListener('keydown', handleTabTrap);
    rateInput.addEventListener('keydown', handleTabTrap);
    
    // Initial quantity display
    updateInlineQtyAmount();
}

async function saveInlineEdit(entryId) {
    const categoryId = document.getElementById(`edit-cat-${entryId}`).value;
    const ticketCode = document.getElementById(`edit-code-${entryId}`).value.toUpperCase();
    const startNumber = document.getElementById(`edit-start-${entryId}`).value;
    const endNumber = document.getElementById(`edit-end-${entryId}`).value;
    const rate = parseFloat(document.getElementById(`edit-rate-${entryId}`).value) || 0;
    
    if (!startNumber || !endNumber) {
        showToast('Please fill in all fields', 'warning');
        return;
    }
    
    await updateStockEntry(entryId, categoryId, ticketCode, startNumber, endNumber, rate);
}

function cancelInlineEdit() {
    // Simply reload the entries to restore original state
    loadSessionEntries();
}

// Edit stock entry (from View Stock page) - still uses prompt for now
function editStockEntry(entryId, categoryId, ticketCode, startNumber, endNumber, rate = 0) {
    const newCode = prompt('Edit Ticket Code:', ticketCode || '');
    if (newCode === null) return;
    
    const newStart = prompt('Edit Start Number:', startNumber);
    if (newStart === null) return;
    
    const newEnd = prompt('Edit End Number:', endNumber);
    if (newEnd === null) return;
    
    const newRate = prompt('Edit Rate:', rate);
    if (newRate === null) return;
    
    updateStockEntry(entryId, categoryId, newCode.toUpperCase(), newStart, newEnd, parseFloat(newRate) || 0);
}

// Common update function
async function updateStockEntry(entryId, categoryId, ticketCode, startNumber, endNumber, rate = 0) {
    // Calculate new quantity
    const start = parseInt(startNumber);
    const end = parseInt(endNumber);
    const ticketCount = end - start + 1;
    
    // Get denomination from category
    let denomination = 1;
    const category = categoriesData.find(c => c.id == categoryId);
    if (category) {
        denomination = parseInt(category.denomination) || 1;
    }
    const quantity = ticketCount * denomination;
    
    try {
        const response = await fetch(`/api/stock-entries/${entryId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                category_id: categoryId,
                ticket_code: ticketCode,
                start_number: startNumber,
                end_number: endNumber,
                quantity: quantity,
                rate: rate
            })
        });
        
        const result = await response.json();
        if (result.success) {
            await loadStockEntries();
            await loadSessionEntries();
            await loadStats();
            showToast('Entry updated successfully', 'success');
        } else {
            showToast('Error: ' + result.message, 'error');
        }
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

function clearDateFilter() {
    document.getElementById('filterDate').value = '';
    loadStockEntries();
}

async function exportToCSV() {
    const dateFilter = document.getElementById('exportDate')?.value;
    const url = '/api/export-csv' + (dateFilter ? `?date=${dateFilter}` : '');
    
    try {
        window.location.href = url;
    } catch (error) {
        showToast('Error exporting CSV: ' + error.message, 'error');
    }
}

// ==================== EXPORT & PRINT FUNCTIONS ====================

// Export Purchase entries to CSV
async function exportPurchaseCSV() {
    const dateFilter = document.getElementById('entryDate').value;
    const distributorId = document.getElementById('distributorSelect').value;
    
    if (!dateFilter) {
        showToast('Please select a date', 'error');
        return;
    }
    
    try {
        // Get session entries for the selected date and distributor
        let url = `/api/stock-entries?date=${dateFilter}`;
        if (distributorId) {
            url += `&distributor_id=${distributorId}`;
        }
        
        const response = await fetch(url);
        const entries = await response.json();
        
        if (entries.length === 0) {
            showToast('No entries to export', 'error');
            return;
        }
        
        // Get distributor name
        const distributor = distributorsData.find(d => d.id == distributorId);
        const distributorName = distributor ? distributor.name : 'All';
        
        // Create CSV content
        let csv = 'Date,Distributor,Category,Code,Start Number,End Number,Quantity,Rate,Amount\n';
        entries.forEach(entry => {
            csv += `${entry.date},"${distributorName}","${entry.category}",${entry.ticket_code || ''},${entry.start_number},${entry.end_number},${entry.quantity},${entry.rate || 0},${entry.amount || 0}\n`;
        });
        
        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv' });
        const url2 = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url2;
        a.download = `purchase_${dateFilter}_${distributorName.replace(/\s+/g, '_')}.csv`;
        a.click();
        window.URL.revokeObjectURL(url2);
        
        showToast('Purchase data exported successfully', 'success');
    } catch (error) {
        showToast('Error exporting: ' + error.message, 'error');
    }
}

// Export Sale entries to CSV
async function exportSaleCSV() {
    const dateFilter = document.getElementById('saleEntryDate').value;
    const partyId = document.getElementById('salePartySelect').value;
    
    if (!dateFilter) {
        showToast('Please select a date', 'error');
        return;
    }
    
    try {
        let url = `/api/sale-entries?date=${dateFilter}`;
        if (partyId) {
            url += `&party_id=${partyId}`;
        }
        
        const response = await fetch(url);
        const entries = await response.json();
        
        if (entries.length === 0) {
            showToast('No entries to export', 'error');
            return;
        }
        
        // Get party name
        const party = partiesData.find(p => p.id == partyId);
        const partyName = party ? party.name : 'All';
        
        // Create CSV content
        let csv = 'Date,Party,Category,Code,Start Number,End Number,Quantity,Rate,Amount\n';
        entries.forEach(entry => {
            csv += `${entry.date},"${partyName}","${entry.category}",${entry.ticket_code || ''},${entry.start_number},${entry.end_number},${entry.quantity},${entry.rate || 0},${entry.amount || 0}\n`;
        });
        
        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv' });
        const url2 = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url2;
        a.download = `sale_${dateFilter}_${partyName.replace(/\s+/g, '_')}.csv`;
        a.click();
        window.URL.revokeObjectURL(url2);
        
        showToast('Sale data exported successfully', 'success');
    } catch (error) {
        showToast('Error exporting: ' + error.message, 'error');
    }
}

// Export Stock entries to CSV
async function exportStockCSV() {
    const dateFilter = document.getElementById('filterDate').value;
    
    try {
        let url = '/api/stock-entries';
        if (dateFilter) {
            url += `?date=${dateFilter}`;
        }
        
        const response = await fetch(url);
        const entries = await response.json();
        
        if (entries.length === 0) {
            showToast('No entries to export', 'error');
            return;
        }
        
        // Create CSV content
        let csv = 'Date,Distributor,Category,Code,Start Number,End Number,Quantity,Rate,Amount\n';
        entries.forEach(entry => {
            csv += `${entry.date},"${entry.distributor || ''}","${entry.category}",${entry.ticket_code || ''},${entry.start_number},${entry.end_number},${entry.quantity},${entry.rate || 0},${entry.amount || 0}\n`;
        });
        
        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv' });
        const url2 = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url2;
        a.download = `stock_${dateFilter || 'all'}.csv`;
        a.click();
        window.URL.revokeObjectURL(url2);
        
        showToast('Stock data exported successfully', 'success');
    } catch (error) {
        showToast('Error exporting: ' + error.message, 'error');
    }
}

// Print Purchase Report
async function printPurchaseReport() {
    const dateFilter = document.getElementById('entryDate').value;
    const distributorId = document.getElementById('distributorSelect').value;
    
    if (!dateFilter) {
        showToast('Please select a date', 'error');
        return;
    }
    
    try {
        let url = `/api/stock-entries?date=${dateFilter}`;
        if (distributorId) {
            url += `&distributor_id=${distributorId}`;
        }
        
        const response = await fetch(url);
        const entries = await response.json();
        
        if (entries.length === 0) {
            showToast('No entries to print', 'error');
            return;
        }
        
        const distributor = distributorsData.find(d => d.id == distributorId);
        const distributorName = distributor ? distributor.name : 'All Distributors';
        
        generatePrintReport('Purchase Report', entries, dateFilter, distributorName);
    } catch (error) {
        showToast('Error generating report: ' + error.message, 'error');
    }
}

// Print Sale Report
async function printSaleReport() {
    const dateFilter = document.getElementById('saleEntryDate').value;
    const partyId = document.getElementById('salePartySelect').value;
    
    if (!dateFilter) {
        showToast('Please select a date', 'error');
        return;
    }
    
    try {
        let url = `/api/sale-entries?date=${dateFilter}`;
        if (partyId) {
            url += `&party_id=${partyId}`;
        }
        
        const response = await fetch(url);
        const entries = await response.json();
        
        if (entries.length === 0) {
            showToast('No entries to print', 'error');
            return;
        }
        
        const party = partiesData.find(p => p.id == partyId);
        const partyName = party ? party.name : 'All Parties';
        
        generatePrintReport('Sale Report', entries, dateFilter, partyName);
    } catch (error) {
        showToast('Error generating report: ' + error.message, 'error');
    }
}

// Print Stock Report
async function printStockReport() {
    const dateFilter = document.getElementById('filterDate').value;
    
    try {
        let url = '/api/stock-entries';
        if (dateFilter) {
            url += `?date=${dateFilter}`;
        }
        
        const response = await fetch(url);
        const entries = await response.json();
        
        if (entries.length === 0) {
            showToast('No entries to print', 'error');
            return;
        }
        
        generatePrintReport('Stock Report', entries, dateFilter || 'All Dates', 'All');
    } catch (error) {
        showToast('Error generating report: ' + error.message, 'error');
    }
}

// Common print report generator
function generatePrintReport(reportTitle, entries, dateFilter, filterName) {
    let totalQuantity = 0;
    let totalAmount = 0;
    entries.forEach(e => {
        totalQuantity += e.quantity || 0;
        totalAmount += e.amount || 0;
    });
    
    const today = new Date().toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    let printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${reportTitle}</title>
            <style>
                @page { size: A4; margin: 15mm; }
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; line-height: 1.4; color: #333; }
                .report-container { padding: 10px; }
                .report-header { text-align: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #667eea; }
                .report-header h1 { color: #667eea; font-size: 24px; margin-bottom: 5px; }
                .report-header p { color: #666; font-size: 11px; }
                .filter-info { background: #f0f4ff; padding: 10px; border-radius: 5px; margin-bottom: 15px; }
                .filter-info p { margin: 3px 0; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; font-size: 11px; }
                th { background-color: #667eea; color: white; font-weight: 600; }
                tr:nth-child(even) { background-color: #f8f9fa; }
                .summary { margin-top: 20px; padding: 15px; background-color: #f0f4ff; border-radius: 8px; border-left: 4px solid #667eea; }
                .summary h3 { color: #667eea; margin-bottom: 10px; font-size: 14px; }
                .summary p { margin: 5px 0; font-size: 12px; }
                .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #999; }
                @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
            </style>
        </head>
        <body>
            <div class="report-container">
                <div class="report-header">
                    <h1>🎫 ${reportTitle}</h1>
                    <p>Generated on: ${today}</p>
                </div>
                
                <div class="filter-info">
                    <p><strong>Date:</strong> ${dateFilter}</p>
                    <p><strong>Filter:</strong> ${filterName}</p>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th>Code</th>
                            <th>Start No.</th>
                            <th>End No.</th>
                            <th>Quantity</th>
                            <th>Rate</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    entries.forEach(entry => {
        printContent += `
            <tr>
                <td>${entry.category || ''}</td>
                <td>${entry.ticket_code || ''}</td>
                <td>${entry.start_number}</td>
                <td>${entry.end_number}</td>
                <td>${entry.quantity}</td>
                <td>${entry.rate || 0}</td>
                <td>${(entry.amount || 0).toFixed(2)}</td>
            </tr>
        `;
    });
    
    printContent += `
                    </tbody>
                </table>
                
                <div class="summary">
                    <h3>Summary</h3>
                    <p><strong>Total Entries:</strong> ${entries.length}</p>
                    <p><strong>Total Quantity:</strong> ${totalQuantity}</p>
                    <p><strong>Total Amount:</strong> ₹${totalAmount.toFixed(2)}</p>
                </div>
                
                <div class="footer">
                    <p>Lottery Ticket Stock Management System</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    printWindow.onload = function() {
        printWindow.focus();
        printWindow.print();
    };
}

async function handleMakeAdmin(e) {
    e.preventDefault();
    
    const data = {
        username: document.getElementById('adminUsername').value
    };
    
    try {
        const response = await fetch('/api/admin/make-admin', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast(result.message, 'success');
            document.getElementById('adminForm').reset();
        } else {
            showToast(result.message, 'error');
        }
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

async function loadStats() {
    try {
        const response = await fetch('/api/stock-entries');
        const entries = await response.json();
        
        const catResponse = await fetch('/api/categories');
        const categories = await catResponse.json();
        
        let totalTickets = 0;
        entries.forEach(entry => {
            totalTickets += entry.quantity;
        });
        
        document.getElementById('totalCategories').textContent = categories.length;
        document.getElementById('totalEntries').textContent = entries.length;
        document.getElementById('totalTickets').textContent = totalTickets;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function logout() {
    try {
        const response = await fetch('/logout');
        if (response.ok) {
            window.location.href = '/';
        }
    } catch (error) {
        showToast('Error logging out: ' + error.message, 'error');
    }
}

async function loadUsers() {
    try {
        const response = await fetch('/api/admin/users');
        const users = await response.json();
        
        const tbody = document.getElementById('usersBody');
        
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 20px;">No users found</td></tr>';
            return;
        }
        
        tbody.innerHTML = users.map(user => `
            <tr>
                <td><strong>${user.username}</strong></td>
                <td>${user.is_admin ? '<span style="color: #667eea; font-weight: 600;">Admin</span>' : 'User'}</td>
                <td>${user.created_at}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Print Report Functions
async function loadPrintCategories() {
    try {
        const response = await fetch('/api/categories');
        const categories = await response.json();
        
        const select = document.getElementById('printCategory');
        select.innerHTML = '<option value="">All Categories</option>';
        
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading print categories:', error);
    }
}

async function getFilteredEntries() {
    const dateFilter = document.getElementById('printDate').value;
    const categoryFilter = document.getElementById('printCategory').value;
    
    try {
        const response = await fetch('/api/stock-entries');
        let entries = await response.json();
        
        // Get categories for display
        const catResponse = await fetch('/api/categories');
        const categories = await catResponse.json();
        const categoryMap = {};
        categories.forEach(c => categoryMap[c.id] = c.name);
        
        // Apply date filter
        if (dateFilter) {
            entries = entries.filter(e => e.date === dateFilter);
        }
        
        // Apply category filter
        if (categoryFilter) {
            entries = entries.filter(e => e.category_id == categoryFilter);
        }
        
        // Add category names
        entries = entries.map(e => ({
            ...e,
            categoryName: categoryMap[e.category_id] || 'Unknown'
        }));
        
        return entries;
    } catch (error) {
        console.error('Error fetching entries:', error);
        return [];
    }
}

async function previewReport() {
    const entries = await getFilteredEntries();
    
    // Load print categories on first use
    await loadPrintCategories();
    
    const dateFilter = document.getElementById('printDate').value;
    const categoryFilter = document.getElementById('printCategory').value;
    const categoryText = categoryFilter ? 
        document.getElementById('printCategory').options[document.getElementById('printCategory').selectedIndex].text : 
        'All Categories';
    
    let totalQuantity = 0;
    entries.forEach(e => totalQuantity += e.quantity);
    
    const today = new Date().toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    let html = `
        <div class="report-header">
            <h2>🎫 Lottery Stock Report</h2>
            <p>Generated on: ${today}</p>
            ${dateFilter ? `<p>Date Filter: ${dateFilter}</p>` : ''}
            <p>Category: ${categoryText}</p>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Start Number</th>
                    <th>End Number</th>
                    <th>Ticket Count</th>
                    <th>Quantity</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    if (entries.length === 0) {
        html += '<tr><td colspan="7" style="text-align:center; padding: 20px;">No entries found for the selected filters</td></tr>';
    } else {
        entries.forEach((entry, index) => {
            const ticketCount = parseInt(entry.end_number) - parseInt(entry.start_number) + 1;
            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${entry.date}</td>
                    <td>${entry.categoryName}</td>
                    <td>${entry.start_number}</td>
                    <td>${entry.end_number}</td>
                    <td>${ticketCount}</td>
                    <td>${entry.quantity}</td>
                </tr>
            `;
        });
    }
    
    html += `
            </tbody>
        </table>
        
        <div class="report-summary">
            <strong>Summary:</strong><br>
            Total Entries: ${entries.length}<br>
            Total Quantity: ${totalQuantity}
        </div>
    `;
    
    document.getElementById('previewContent').innerHTML = html;
    document.getElementById('printPreview').style.display = 'block';
}

async function printReport() {
    const entries = await getFilteredEntries();
    const paperSize = document.getElementById('paperSize').value;
    const orientation = document.getElementById('printOrientation').value;
    
    const dateFilter = document.getElementById('printDate').value;
    const categoryFilter = document.getElementById('printCategory').value;
    
    // Load categories for filter display
    await loadPrintCategories();
    const categoryText = categoryFilter ? 
        document.getElementById('printCategory').options[document.getElementById('printCategory').selectedIndex].text : 
        'All Categories';
    
    let totalQuantity = 0;
    entries.forEach(e => totalQuantity += e.quantity);
    
    const today = new Date().toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // Create print content
    let printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Lottery Stock Report</title>
            <style>
                @page {
                    size: ${paperSize} ${orientation};
                    margin: 15mm;
                }
                
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: 'Segoe UI', Arial, sans-serif;
                    font-size: ${paperSize === 'a5' ? '10px' : '12px'};
                    line-height: 1.4;
                    color: #333;
                }
                
                .report-container {
                    padding: 10px;
                }
                
                .report-header {
                    text-align: center;
                    margin-bottom: 20px;
                    padding-bottom: 10px;
                    border-bottom: 2px solid #667eea;
                }
                
                .report-header h1 {
                    color: #667eea;
                    font-size: ${paperSize === 'a5' ? '18px' : '24px'};
                    margin-bottom: 5px;
                }
                
                .report-header p {
                    color: #666;
                    font-size: ${paperSize === 'a5' ? '9px' : '11px'};
                }
                
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                }
                
                th, td {
                    border: 1px solid #ddd;
                    padding: ${paperSize === 'a5' ? '4px 6px' : '8px 10px'};
                    text-align: left;
                    font-size: ${paperSize === 'a5' ? '9px' : '11px'};
                }
                
                th {
                    background-color: #667eea;
                    color: white;
                    font-weight: 600;
                }
                
                tr:nth-child(even) {
                    background-color: #f8f9fa;
                }
                
                .summary {
                    margin-top: 20px;
                    padding: 15px;
                    background-color: #f0f4ff;
                    border-radius: 8px;
                    border-left: 4px solid #667eea;
                }
                
                .summary h3 {
                    color: #667eea;
                    margin-bottom: 10px;
                    font-size: ${paperSize === 'a5' ? '12px' : '14px'};
                }
                
                .summary p {
                    margin: 5px 0;
                    font-size: ${paperSize === 'a5' ? '10px' : '12px'};
                }
                
                .footer {
                    margin-top: 30px;
                    text-align: center;
                    font-size: ${paperSize === 'a5' ? '8px' : '10px'};
                    color: #999;
                }
            </style>
        </head>
        <body>
            <div class="report-container">
                <div class="report-header">
                    <h1>🎫 Lottery Stock Report</h1>
                    <p>Generated on: ${today}</p>
                    ${dateFilter ? `<p>Date Filter: ${dateFilter}</p>` : ''}
                    <p>Category: ${categoryText}</p>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Date</th>
                            <th>Category</th>
                            <th>Start No.</th>
                            <th>End No.</th>
                            <th>Tickets</th>
                            <th>Quantity</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    if (entries.length === 0) {
        printContent += '<tr><td colspan="7" style="text-align:center; padding: 20px;">No entries found</td></tr>';
    } else {
        entries.forEach((entry, index) => {
            const ticketCount = parseInt(entry.end_number) - parseInt(entry.start_number) + 1;
            printContent += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${entry.date}</td>
                    <td>${entry.categoryName}</td>
                    <td>${entry.start_number}</td>
                    <td>${entry.end_number}</td>
                    <td>${ticketCount}</td>
                    <td>${entry.quantity}</td>
                </tr>
            `;
        });
    }
    
    printContent += `
                    </tbody>
                </table>
                
                <div class="summary">
                    <h3>Summary</h3>
                    <p><strong>Total Entries:</strong> ${entries.length}</p>
                    <p><strong>Total Quantity:</strong> ${totalQuantity}</p>
                </div>
                
                <div class="footer">
                    <p>Lottery Ticket Stock Management System</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    // Open print window
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Wait for content to load then print
    printWindow.onload = function() {
        printWindow.focus();
        printWindow.print();
    };
}

// Load print categories when print tab is shown
const originalShowTab = showTab;
showTab = function(tabId) {
    originalShowTab.call(this, tabId);
    if (tabId === 'print-tab') {
        loadPrintCategories();
    }
    if (tabId === 'sale-tab') {
        initializeSaleTab();
    }
};

// ==================== SALE TAB FUNCTIONALITY ====================

// Initialize Sale tab
function initializeSaleTab() {
    // Set today's date if not already set
    const saleDateInput = document.getElementById('saleEntryDate');
    if (!saleDateInput.value) {
        saleDateInput.valueAsDate = new Date();
    }
    
    // Populate categories for sale
    loadSaleCategories();
    
    // Populate parties for sale and auto-select first one
    loadSaleParties(true);
    
    // Load session entries for selected party
    loadSaleSessionEntries();
    
    // Focus date field
    setTimeout(() => {
        saleDateInput.focus();
    }, 100);
}

// Load categories for sale dropdown
function loadSaleCategories() {
    const select = document.getElementById('saleCategorySelect');
    select.innerHTML = '<option value="">Select</option>';
    categoriesData.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        option.dataset.saleRate = cat.sale_rate || 0;
        option.dataset.denomination = cat.denomination || 1;
        select.appendChild(option);
    });
}

// Load parties for sale dropdown
function loadSaleParties(autoSelectFirst = false) {
    const select = document.getElementById('salePartySelect');
    select.innerHTML = '<option value="">Select Party</option>';
    partiesData.forEach((party, index) => {
        const option = document.createElement('option');
        option.value = party.id;
        option.textContent = party.name;
        select.appendChild(option);
    });
    
    // Auto-select first party if requested and parties exist
    if (autoSelectFirst && partiesData.length > 0) {
        select.value = partiesData[0].id;
    }
}

// Handle sale category change - auto-populate sale rate
function handleSaleCategoryChange() {
    const categoryId = document.getElementById('saleCategorySelect').value;
    
    if (categoryId) {
        const category = categoriesData.find(c => c.id == categoryId);
        if (category && category.sale_rate) {
            document.getElementById('saleRateInput').value = category.sale_rate;
            updateSaleAmountPreview();
        }
    }
    
    updateSaleQuantityPreview();
}

// Clear sale form
function clearSaleForm() {
    document.getElementById('saleCategorySelect').value = '';
    document.getElementById('saleTicketCode').value = '';
    document.getElementById('saleStartNumber').value = '';
    document.getElementById('saleEndNumber').value = '';
    document.getElementById('saleQuantityDisplay').textContent = '0';
    document.getElementById('saleRateInput').value = '';
    document.getElementById('saleAmountDisplay').textContent = '0';
    
    // Focus on category
    document.getElementById('saleCategorySelect').focus();
}

// Update sale quantity preview
function updateSaleQuantityPreview() {
    const startNumber = document.getElementById('saleStartNumber').value;
    const endNumber = document.getElementById('saleEndNumber').value;
    const categoryId = document.getElementById('saleCategorySelect').value;
    
    if (startNumber && endNumber) {
        const start = parseInt(startNumber);
        const fullEnd = completeSaleEndNumber();
        const end = parseInt(fullEnd);
        
        if (!isNaN(start) && !isNaN(end) && end >= start) {
            const ticketCount = end - start + 1;
            
            // Get denomination from category
            let denomination = 1;
            if (categoryId) {
                const category = categoriesData.find(c => c.id == categoryId);
                if (category) {
                    denomination = parseInt(category.denomination) || 1;
                }
            }
            
            const quantity = ticketCount * denomination;
            document.getElementById('saleQuantityDisplay').textContent = quantity;
            updateSaleAmountPreview();
            return;
        }
    }
    
    document.getElementById('saleQuantityDisplay').textContent = '0';
    document.getElementById('saleAmountDisplay').textContent = '0';
}

// Complete sale end number
function completeSaleEndNumber() {
    const startInput = document.getElementById('saleStartNumber');
    const endInput = document.getElementById('saleEndNumber');
    
    const startNumber = startInput.value;
    const endNumber = endInput.value;
    
    if (!startNumber || !endNumber) return endNumber;
    if (endNumber.length >= startNumber.length) return endNumber;
    
    const prefix = startNumber.substring(0, startNumber.length - endNumber.length);
    return prefix + endNumber;
}

// Handle sale end number complete
function handleSaleEndNumberComplete() {
    const endInput = document.getElementById('saleEndNumber');
    const fullEnd = completeSaleEndNumber();
    
    if (fullEnd !== endInput.value) {
        endInput.value = fullEnd;
    }
    
    updateSaleQuantityPreview();
}

// Update sale amount preview
function updateSaleAmountPreview() {
    const quantity = parseInt(document.getElementById('saleQuantityDisplay').textContent) || 0;
    const rate = parseFloat(document.getElementById('saleRateInput').value) || 0;
    const amount = quantity * rate;
    document.getElementById('saleAmountDisplay').textContent = amount.toFixed(2);
}

// Handle sale end number keydown
function handleSaleEndNumberKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleSaleEndNumberComplete();
        submitSaleEntry();
    }
}

// Handle sale rate keydown
function handleSaleRateKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        submitSaleEntry();
    }
}

// Submit sale entry
async function submitSaleEntry() {
    const entryDate = document.getElementById('saleEntryDate').value;
    const partyId = document.getElementById('salePartySelect').value;
    const categoryId = document.getElementById('saleCategorySelect').value;
    let ticketCode = document.getElementById('saleTicketCode').value.toUpperCase();
    const startNumber = document.getElementById('saleStartNumber').value;
    let endNumber = document.getElementById('saleEndNumber').value;
    const rate = parseFloat(document.getElementById('saleRateInput').value) || 0;
    
    // Validation
    if (!entryDate) {
        showToast('Please select a date', 'warning');
        document.getElementById('saleEntryDate').focus();
        return;
    }
    
    if (!partyId) {
        showToast('Please select a party', 'warning');
        document.getElementById('salePartySelect').focus();
        return;
    }
    
    if (!categoryId) {
        showToast('Please select a category', 'warning');
        document.getElementById('saleCategorySelect').focus();
        return;
    }
    
    // Code is optional - will be auto-detected or prompted
    
    if (!startNumber) {
        showToast('Please enter a start number', 'warning');
        document.getElementById('saleStartNumber').focus();
        return;
    }
    
    if (!endNumber) {
        showToast('Please enter an end number', 'warning');
        document.getElementById('saleEndNumber').focus();
        return;
    }
    
    if (!rate || rate <= 0) {
        showToast('Please enter a valid rate', 'warning');
        document.getElementById('saleRateInput').focus();
        return;
    }
    
    // Auto-complete end number
    endNumber = completeSaleEndNumber();
    document.getElementById('saleEndNumber').value = endNumber;
    
    // If no code provided, check stock for auto-detection
    if (!ticketCode) {
        try {
            const checkResponse = await fetch('/api/check-stock-range', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category_id: categoryId,
                    start_number: startNumber,
                    end_number: endNumber
                })
            });
            
            const checkData = await checkResponse.json();
            
            if (!checkData.available) {
                showToast(checkData.message || 'Tickets not available in stock', 'error');
                return;
            }
            
            if (checkData.multiple) {
                // Multiple matches - user must specify code
                const codes = checkData.matches.map(m => m.ticket_code || '(no code)').join(', ');
                showToast(`Multiple stock entries found with codes: ${codes}. Please enter the code.`, 'warning');
                document.getElementById('saleTicketCode').focus();
                return;
            }
            
            // Single match - use the auto-detected code
            ticketCode = checkData.auto_code || '';
            if (ticketCode) {
                document.getElementById('saleTicketCode').value = ticketCode;
            }
        } catch (error) {
            showToast('Error checking stock: ' + error.message, 'error');
            return;
        }
    }
    
    // Calculate quantity
    const start = parseInt(startNumber);
    const end = parseInt(endNumber);
    const ticketCount = end - start + 1;
    
    // Get denomination
    let denomination = 1;
    const category = categoriesData.find(c => c.id == categoryId);
    if (category) {
        denomination = parseInt(category.denomination) || 1;
    }
    const quantity = ticketCount * denomination;
    
    try {
        const response = await fetch('/api/sale-entries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                entry_date: entryDate,
                party_id: partyId,
                category_id: categoryId,
                ticket_code: ticketCode,
                start_number: startNumber,
                end_number: endNumber,
                quantity: quantity,
                rate: rate
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Sale entry added successfully!', 'success');
            clearSaleForm();
            loadSaleSessionEntries();
        } else {
            showToast(data.message || 'Failed to add sale entry', 'error');
        }
    } catch (error) {
        showToast('Error adding sale entry: ' + error.message, 'error');
    }
}

// Load sale session entries
async function loadSaleSessionEntries() {
    const entryDate = document.getElementById('saleEntryDate').value;
    const partyId = document.getElementById('salePartySelect').value;
    if (!entryDate) return;
    
    // Update date display
    document.getElementById('saleSessionDateDisplay').textContent = new Date(entryDate).toLocaleDateString();
    
    try {
        let url = `/api/sale-entries?date=${entryDate}`;
        if (partyId) {
            url += `&party_id=${partyId}`;
        }
        const response = await fetch(url);
        const entries = await response.json();
        
        const tbody = document.getElementById('saleSessionEntriesBody');
        
        if (entries.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 15px; color: #a0aec0;">No sales yet for this date</td></tr>';
            document.getElementById('saleSessionEntryCount').textContent = '0';
            document.getElementById('saleSessionTotalQty').textContent = '0';
            document.getElementById('saleSessionTotalAmount').textContent = '0';
            return;
        }
        
        let totalQty = 0;
        let totalAmount = 0;
        
        tbody.innerHTML = entries.map(entry => {
            totalQty += entry.quantity;
            totalAmount += entry.amount || 0;
            
            return `
                <tr id="sale-entry-row-${entry.id}">
                    <td>${entry.category}</td>
                    <td>${entry.ticket_code || ''}</td>
                    <td>${entry.start_number}</td>
                    <td>${entry.end_number}</td>
                    <td class="cell-qty">${entry.quantity}</td>
                    <td>${entry.rate || 0}</td>
                    <td class="cell-amount">${(entry.amount || 0).toFixed(2)}</td>
                    <td class="cell-actions">
                        <button class="btn-delete btn-sm" onclick="deleteSaleSessionEntry(${entry.id})">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');
        
        document.getElementById('saleSessionEntryCount').textContent = entries.length;
        document.getElementById('saleSessionTotalQty').textContent = totalQty;
        document.getElementById('saleSessionTotalAmount').textContent = totalAmount.toFixed(2);
        
    } catch (error) {
        console.error('Error loading sale session entries:', error);
    }
}

// Delete sale session entry
async function deleteSaleSessionEntry(entryId) {
    const confirmed = await showConfirm('Are you sure you want to delete this sale entry?', 'Confirm Delete');
    if (!confirmed) return;
    
    try {
        const response = await fetch(`/api/sale-entries/${entryId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Sale entry deleted', 'success');
            loadSaleSessionEntries();
        } else {
            showToast(data.message || 'Failed to delete', 'error');
        }
    } catch (error) {
        showToast('Error deleting entry: ' + error.message, 'error');
    }
}

// Start inline edit for sale entry
function startSaleInlineEdit(entryId, categoryId, ticketCode, startNumber, endNumber, rate = 0) {
    const row = document.getElementById(`sale-entry-row-${entryId}`);
    if (!row) return;
    
    // Build category options
    const categoryOptions = categoriesData.map(cat => 
        `<option value="${cat.id}" ${cat.id == categoryId ? 'selected' : ''}>${cat.name}</option>`
    ).join('');
    
    // Replace cells with input fields
    row.innerHTML = `
        <td>
            <select class="inline-edit-select" id="sale-edit-cat-${entryId}" tabindex="1">
                ${categoryOptions}
            </select>
        </td>
        <td>
            <input type="text" class="inline-edit-input" id="sale-edit-code-${entryId}" value="${ticketCode}" tabindex="2" style="text-transform: uppercase;">
        </td>
        <td>
            <input type="text" class="inline-edit-input" id="sale-edit-start-${entryId}" value="${startNumber}" tabindex="3">
        </td>
        <td>
            <input type="text" class="inline-edit-input" id="sale-edit-end-${entryId}" value="" placeholder="${endNumber.slice(-2)}" tabindex="4">
        </td>
        <td class="cell-qty" id="sale-edit-qty-${entryId}">--</td>
        <td>
            <input type="number" class="inline-edit-input" id="sale-edit-rate-${entryId}" value="${rate}" tabindex="5" min="0" step="0.01">
        </td>
        <td class="cell-amount" id="sale-edit-amount-${entryId}">--</td>
        <td class="cell-actions">
            <button class="btn-success btn-sm" onclick="saveSaleInlineEdit(${entryId})" tabindex="6">✓</button>
            <button class="btn-secondary btn-sm" onclick="cancelSaleInlineEdit()" tabindex="7">✕</button>
        </td>
    `;
    
    // Store original values
    row.dataset.originalStart = startNumber;
    row.dataset.originalEnd = endNumber;
    
    const catSelect = document.getElementById(`sale-edit-cat-${entryId}`);
    const codeInput = document.getElementById(`sale-edit-code-${entryId}`);
    const startInput = document.getElementById(`sale-edit-start-${entryId}`);
    const endInput = document.getElementById(`sale-edit-end-${entryId}`);
    const rateInput = document.getElementById(`sale-edit-rate-${entryId}`);
    
    // Focus on category
    catSelect.focus();
    
    // Update qty/amount on input changes
    const updateSaleInlineQtyAmount = () => {
        const start = parseInt(startInput.value) || 0;
        let end = parseInt(endInput.value) || 0;
        
        // Auto-complete end number
        if (endInput.value && endInput.value.length < startInput.value.length) {
            const prefix = startInput.value.substring(0, startInput.value.length - endInput.value.length);
            end = parseInt(prefix + endInput.value);
        }
        
        if (start && end && end >= start) {
            const ticketCount = end - start + 1;
            const category = categoriesData.find(c => c.id == catSelect.value);
            const denomination = parseInt(category?.denomination) || 1;
            const qty = ticketCount * denomination;
            const rate = parseFloat(rateInput.value) || 0;
            
            document.getElementById(`sale-edit-qty-${entryId}`).textContent = qty;
            document.getElementById(`sale-edit-amount-${entryId}`).textContent = (qty * rate).toFixed(2);
        }
    };
    
    startInput.addEventListener('input', updateSaleInlineQtyAmount);
    endInput.addEventListener('input', updateSaleInlineQtyAmount);
    rateInput.addEventListener('input', updateSaleInlineQtyAmount);
    catSelect.addEventListener('change', updateSaleInlineQtyAmount);
    
    updateSaleInlineQtyAmount();
}

// Save sale inline edit
async function saveSaleInlineEdit(entryId) {
    const categoryId = document.getElementById(`sale-edit-cat-${entryId}`).value;
    const ticketCode = document.getElementById(`sale-edit-code-${entryId}`).value.toUpperCase();
    const startNumber = document.getElementById(`sale-edit-start-${entryId}`).value;
    let endNumber = document.getElementById(`sale-edit-end-${entryId}`).value;
    const rate = parseFloat(document.getElementById(`sale-edit-rate-${entryId}`).value) || 0;
    
    // Auto-complete end number
    if (endNumber && endNumber.length < startNumber.length) {
        const prefix = startNumber.substring(0, startNumber.length - endNumber.length);
        endNumber = prefix + endNumber;
    }
    
    if (!startNumber || !endNumber) {
        showToast('Please fill in all fields', 'warning');
        return;
    }
    
    // Calculate quantity
    const start = parseInt(startNumber);
    const end = parseInt(endNumber);
    const ticketCount = end - start + 1;
    
    const category = categoriesData.find(c => c.id == categoryId);
    const denomination = parseInt(category?.denomination) || 1;
    const quantity = ticketCount * denomination;
    
    try {
        const response = await fetch(`/api/sale-entries/${entryId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                category_id: categoryId,
                ticket_code: ticketCode,
                start_number: startNumber,
                end_number: endNumber,
                quantity: quantity,
                rate: rate
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Sale entry updated', 'success');
            loadSaleSessionEntries();
        } else {
            showToast(data.message || 'Failed to update', 'error');
        }
    } catch (error) {
        showToast('Error updating entry: ' + error.message, 'error');
    }
}

// Cancel sale inline edit
function cancelSaleInlineEdit() {
    loadSaleSessionEntries();
}

// Setup sale tab event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Sale form event listeners
    const saleEndNumber = document.getElementById('saleEndNumber');
    if (saleEndNumber) {
        saleEndNumber.addEventListener('blur', handleSaleEndNumberComplete);
        saleEndNumber.addEventListener('input', updateSaleQuantityPreview);
        saleEndNumber.addEventListener('keydown', handleSaleEndNumberKeydown);
    }
    
    const saleRateInput = document.getElementById('saleRateInput');
    if (saleRateInput) {
        saleRateInput.addEventListener('input', updateSaleAmountPreview);
        saleRateInput.addEventListener('keydown', handleSaleRateKeydown);
    }
    
    const saleStartNumber = document.getElementById('saleStartNumber');
    if (saleStartNumber) {
        saleStartNumber.addEventListener('change', updateSaleQuantityPreview);
        saleStartNumber.addEventListener('input', updateSaleQuantityPreview);
    }
    
    const saleCategorySelect = document.getElementById('saleCategorySelect');
    if (saleCategorySelect) {
        saleCategorySelect.addEventListener('change', handleSaleCategoryChange);
    }
    
    const saleEntryDate = document.getElementById('saleEntryDate');
    if (saleEntryDate) {
        saleEntryDate.addEventListener('change', loadSaleSessionEntries);
    }
    
    const salePartySelect = document.getElementById('salePartySelect');
    if (salePartySelect) {
        salePartySelect.addEventListener('change', loadSaleSessionEntries);
    }
    
    // Set today's date for sale tab
    if (saleEntryDate && !saleEntryDate.value) {
        saleEntryDate.valueAsDate = new Date();
    }
});

// Handle keyboard shortcuts for sale tab
const originalHandleKeyboardShortcuts = handleKeyboardShortcuts;
handleKeyboardShortcuts = function(e) {
    // Check if on sale tab
    const saleTab = document.getElementById('sale-tab');
    if (saleTab && saleTab.classList.contains('active')) {
        // Escape key - clear form
        if (e.key === 'Escape') {
            e.preventDefault();
            clearSaleForm();
            return;
        }
        
        // Tab key - focus trap within the sale page
        if (e.key === 'Tab') {
            handleSaleFocusTrap(e);
            return;
        }
    }
    
    // Call original for purchase tab
    originalHandleKeyboardShortcuts.call(this, e);
};

// Focus trap for sale tab
function handleSaleFocusTrap(e) {
    const saleTab = document.getElementById('sale-tab');
    if (!saleTab.classList.contains('active')) return;
    
    const fields = [
        document.getElementById('saleEntryDate'),
        document.getElementById('salePartySelect'),
        document.getElementById('saleCategorySelect'),
        document.getElementById('saleTicketCode'),
        document.getElementById('saleStartNumber'),
        document.getElementById('saleEndNumber'),
        document.getElementById('saleRateInput')
    ].filter(el => el !== null);
    
    const currentIndex = fields.indexOf(document.activeElement);
    
    if (e.shiftKey) {
        if (currentIndex <= 0) {
            e.preventDefault();
            fields[fields.length - 1].focus();
        }
    } else {
        if (currentIndex === fields.length - 1) {
            e.preventDefault();
            fields[0].focus();
        }
    }
}
