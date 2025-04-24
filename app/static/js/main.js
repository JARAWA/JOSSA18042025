// Constants and Configuration
const API_URL = window.location.origin;
const ENDPOINTS = {
    branches: '/api/branches',
    categories: '/api/categories',
    collegeTypes: '/api/college-types',
    rounds: '/api/rounds',
    quotas: '/api/quotas',
    genders: '/api/genders',
    predict: '/api/predict'
};

// Global Variables
let currentResults = null;
let tooltipInstances = [];
let currentSortColumn = null;
let isAscending = true;

// IMPORTANT: Remove the DOMContentLoaded auto-initialization
// Instead, export a function that will be called after authentication

// Main application initialization function to be called after auth
window.initializeMainApp = function() {
    console.log('Main application initialization started');
    initializeApp();
    initializeEventListeners();
    initializeTooltips();
};

// App Initialization
async function initializeApp() {
    try {
        console.log('Populating dropdowns...');
        await Promise.all([
            populateDropdown('college-type', ENDPOINTS.collegeTypes),
            populateDropdown('category', ENDPOINTS.categories),
            populateDropdown('preferred-branch', ENDPOINTS.branches),
            populateDropdown('round-no', ENDPOINTS.rounds),
            populateDropdown('gender', ENDPOINTS.genders)
        ]);
        console.log('All dropdowns populated successfully');
        // Quota will be populated based on college type selection
    } catch (error) {
        showError('Failed to initialize application. Please refresh the page.');
        console.error('Initialization error:', error);
    }
}

// Dropdown Population
async function populateDropdown(elementId, endpoint) {
    try {
        const response = await fetch(`${API_URL}${endpoint}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        
        const select = document.getElementById(elementId);
        if (!select) {
            console.error(`Element with ID '${elementId}' not found`);
            return;
        }
        
        select.innerHTML = '<option value="">Select option</option>';
        
        let options = [];
        if (Array.isArray(data)) {
            options = data;
        } else if (typeof data === 'object') {
            const firstKey = Object.keys(data)[0];
            if (Array.isArray(data[firstKey])) {
                options = data[firstKey];
            } else {
                options = Object.values(data).find(val => Array.isArray(val)) || [];
            }
        }
        
        options.forEach(option => {
            const optElement = document.createElement('option');
            optElement.value = option;
            optElement.textContent = option;
            select.appendChild(optElement);
        });
        console.log(`Populated ${elementId} with ${options.length} options`);
    } catch (error) {
        console.error(`Error populating ${elementId}:`, error);
        throw error;
    }
}

// Populate Quota based on College Type
async function updateQuotaOptions(collegeType) {
    try {
        const response = await fetch(`${API_URL}${ENDPOINTS.quotas}/${collegeType}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        
        const quotaSelect = document.getElementById('quota');
        if (!quotaSelect) {
            console.error("Element 'quota' not found");
            return;
        }
        
        quotaSelect.innerHTML = '<option value="">Select Quota</option>';
        
        data.quotas.forEach(quota => {
            const option = document.createElement('option');
            option.value = quota;
            option.textContent = quota;
            quotaSelect.appendChild(option);
        });
        
        quotaSelect.disabled = false;
        console.log('Quota options updated based on college type');
    } catch (error) {
        console.error('Error updating quota options:', error);
        showError('Failed to update quota options');
    }
}

// Event Listeners
function initializeEventListeners() {
    console.log('Setting up event listeners...');
    
    // Form submission
    const form = document.getElementById('preference-form');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
        console.log('Form submission listener added');
    } else {
        console.error("Form element 'preference-form' not found");
    }
    
    // College type change
    const collegeTypeSelect = document.getElementById('college-type');
    if (collegeTypeSelect) {
        collegeTypeSelect.addEventListener('change', async (event) => {
            handleCollegeTypeChange(event);
            if (event.target.value) {
                await updateQuotaOptions(event.target.value);
            }
        });
        console.log('College type change listener added');
    } else {
        console.error("Element 'college-type' not found");
    }
    
    // Probability slider
    const probSlider = document.getElementById('min-prob');
    if (probSlider) {
        probSlider.addEventListener('input', handleProbabilityChange);
        console.log('Probability slider listener added');
    } else {
        console.error("Element 'min-prob' not found");
    }
    
    // Download button
    const downloadBtn = document.getElementById('download-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', handleDownload);
        console.log('Download button listener added');
    } else {
        console.error("Element 'download-btn' not found");
    }
    
    // Initialize table header click events for sorting
    initializeTableSorting();
    
    console.log('Event listeners setup complete');
}

// Initialize table sorting
function initializeTableSorting() {
    const resultsTable = document.getElementById('results-table');
    if (!resultsTable) {
        console.error("Element 'results-table' not found");
        return;
    }
    
    const headerRow = resultsTable.querySelector('thead tr');
    if (!headerRow) {
        console.error("Header row in 'results-table' not found");
        return;
    }
    
    const headerCells = headerRow.querySelectorAll('th');
    headerCells.forEach((cell, columnIndex) => {
        cell.addEventListener('click', () => handleSortClick(columnIndex));
        cell.style.cursor = 'pointer';
        // Add sort indicator elements
        const sortIndicator = document.createElement('span');
        sortIndicator.className = 'sort-indicator ms-1';
        sortIndicator.innerHTML = '⇅';
        cell.appendChild(sortIndicator);
    });
    
    console.log('Table sorting initialized');
}

// Handle sort click
function handleSortClick(columnIndex) {
    if (currentResults && currentResults.length > 0) {
        // Toggle sort direction if clicking the same column
        if (currentSortColumn === columnIndex) {
            isAscending = !isAscending;
        } else {
            currentSortColumn = columnIndex;
            isAscending = true;
        }
        
        sortTable(columnIndex, isAscending);
        updateSortIndicators(columnIndex, isAscending);
    }
}

// Sort table by column
function sortTable(columnIndex, ascending) {
    if (!currentResults || currentResults.length === 0) return;
    
    const columnKeys = Object.keys(currentResults[0]);
    const columnKey = columnKeys[columnIndex];
    
    currentResults.sort((a, b) => {
        let valueA = a[columnKey];
        let valueB = b[columnKey];
        
        // Check if values are numeric
        const isNumeric = !isNaN(parseFloat(valueA)) && !isNaN(parseFloat(valueB));
        
        if (isNumeric) {
            valueA = parseFloat(valueA);
            valueB = parseFloat(valueB);
        } else {
            valueA = String(valueA).toLowerCase();
            valueB = String(valueB).toLowerCase();
        }
        
        if (valueA < valueB) return ascending ? -1 : 1;
        if (valueA > valueB) return ascending ? 1 : -1;
        return 0;
    });
    
    // Redisplay sorted results
    const tableBody = document.getElementById('results-body');
    if (!tableBody) {
        console.error("Element 'results-body' not found");
        return;
    }
    
    tableBody.innerHTML = '';
    
    currentResults.forEach(pref => {
        const row = tableBody.insertRow();
        Object.values(pref).forEach(value => {
            const cell = row.insertCell();
            cell.textContent = value;
        });
    });
}
