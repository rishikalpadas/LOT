let isAdmin = false;
let editingCategoryId = null;
let categoriesData = [];

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
    await loadStats();
    await loadStockEntries();
    if (isAdmin) {
        await loadUsers();
    }
    
    // Event listeners
    document.getElementById('stockForm').addEventListener('submit', handleAddStockEntry);
    document.getElementById('categoryForm').addEventListener('submit', handleAddCategory);
    document.getElementById('adminForm').addEventListener('submit', handleMakeAdmin);
    
    document.getElementById('endNumber').addEventListener('change', updateQuantity);
    document.getElementById('startNumber').addEventListener('change', updateQuantity);
    document.getElementById('categorySelect').addEventListener('change', updateQuantity);
});

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
        select.innerHTML = '<option value="">Select Category</option>';
        
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
                <p style="font-size: 12px;">Series: ${cat.series} | Denom: ${cat.denomination}</p>
                <div style="display: flex; gap: 8px; margin-top: 10px;">
                    <button class="btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="editCategory(${cat.id}, '${cat.name}')">Edit</button>
                    <button class="btn-danger" style="padding: 6px 12px; font-size: 12px;" onclick="deleteCategory(${cat.id})">Delete</button>
                </div>
            </div>
        </div>
    `).join('');
}

async function handleAddCategory(e) {
    e.preventDefault();
    
    const categoryName = document.getElementById('categoryName').value.toUpperCase();
    
    // Validate format
    if (!categoryName || categoryName.length < 2) {
        document.getElementById('categoryMessage').className = 'message error';
        document.getElementById('categoryMessage').textContent = 'Invalid format. Use format like M25, D10, E5';
        return;
    }
    
    const data = {
        name: categoryName
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
        const messageEl = document.getElementById('categoryMessage');
        
        if (result.success) {
            messageEl.className = 'message success';
            messageEl.textContent = editingCategoryId ? 'Category updated successfully!' : 'Category added successfully!';
            document.getElementById('categoryForm').reset();
            document.getElementById('categorySubmitBtn').textContent = 'Add Category';
            editingCategoryId = null;
            await loadCategories();
            setTimeout(() => messageEl.style.display = 'none', 3000);
        } else {
            messageEl.className = 'message error';
            messageEl.textContent = result.message;
        }
    } catch (error) {
        document.getElementById('categoryMessage').className = 'message error';
        document.getElementById('categoryMessage').textContent = 'Error: ' + error.message;
    }
}

async function deleteCategory(categoryId) {
    if (!confirm('Are you sure you want to delete this category?')) return;
    
    try {
        const response = await fetch(`/api/categories/${categoryId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        if (result.success) {
            await loadCategories();
            alert('Category deleted successfully');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function editCategory(categoryId, categoryName) {
    editingCategoryId = categoryId;
    document.getElementById('categoryName').value = categoryName;
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

async function handleAddStockEntry(e) {
    e.preventDefault();
    
    const startNum = document.getElementById('startNumber').value;
    const endNum = document.getElementById('endNumber').value;
    const categoryId = document.getElementById('categorySelect').value;
    
    // Calculate quantity from the display
    const quantityText = document.getElementById('quantityDisplay').textContent;
    const quantity = parseInt(quantityText) || 0;
    
    console.log('[FRONTEND] Stock Entry Submission:');
    console.log(`  Start Number: ${repr(startNum)} (length: ${startNum.length})`);
    console.log(`  End Number: ${repr(endNum)} (length: ${endNum.length})`);
    console.log(`  Quantity: ${quantity}`);
    
    const data = {
        category_id: categoryId,
        entry_date: document.getElementById('entryDate').value,
        start_number: startNum,
        end_number: endNum,
        quantity: quantity,
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
        const messageEl = document.getElementById('stockMessage');
        
        if (result.success) {
            console.log('[FRONTEND] Stock entry created successfully!');
            messageEl.className = 'message success';
            messageEl.textContent = 'Stock entry added successfully!';
            document.getElementById('stockForm').reset();
            document.getElementById('entryDate').valueAsDate = new Date();
            await loadStockEntries();
            await loadStats();
            setTimeout(() => messageEl.style.display = 'none', 3000);
        } else {
            messageEl.className = 'message error';
            messageEl.textContent = result.message;
        }
    } catch (error) {
        document.getElementById('stockMessage').className = 'message error';
        document.getElementById('stockMessage').textContent = 'Error: ' + error.message;
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
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">No entries found</td></tr>';
            return;
        }
        
        tbody.innerHTML = entries.map(entry => `
            <tr>
                <td>${entry.date}</td>
                <td>${entry.category}</td>
                <td>${entry.start}</td>
                <td>${entry.end}</td>
                <td>${entry.quantity}</td>
                <td>${entry.notes || '-'}</td>
                <td><button class="btn-danger" onclick="deleteStockEntry(${entry.id})">Delete</button></td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading stock entries:', error);
    }
}

async function deleteStockEntry(entryId) {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    
    try {
        const response = await fetch(`/api/stock-entries/${entryId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        if (result.success) {
            await loadStockEntries();
            await loadStats();
            alert('Entry deleted successfully');
        }
    } catch (error) {
        alert('Error: ' + error.message);
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
        alert('Error exporting CSV: ' + error.message);
    }
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
        const messageEl = document.getElementById('adminMessage');
        
        if (result.success) {
            messageEl.className = 'message success';
            messageEl.textContent = result.message;
            document.getElementById('adminForm').reset();
            setTimeout(() => messageEl.style.display = 'none', 3000);
        } else {
            messageEl.className = 'message error';
            messageEl.textContent = result.message;
        }
    } catch (error) {
        document.getElementById('adminMessage').className = 'message error';
        document.getElementById('adminMessage').textContent = 'Error: ' + error.message;
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
        alert('Error logging out: ' + error.message);
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
