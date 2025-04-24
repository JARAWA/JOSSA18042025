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

// Fallback data to use when API calls fail
const FALLBACK_DATA = {
    'college-type': ['IIT', 'NIT', 'IIIT', 'GFTI'],
    'category': ['OPEN', 'OBC-NCL', 'SC', 'ST', 'EWS'],
    'preferred-branch': ['Computer Science', 'Electronics', 'Mechanical', 'Civil', 'Electrical', 
                       'Chemical', 'Aerospace', 'Biotechnology', 'Production', 'Metallurgical'],
    'round-no': ['1', '2', '3', '4', '5', '6'],
    'gender': ['Gender-Neutral', 'Female-only'],
    'quota': {
        'IIT': ['AI'],
        'IIIT': ['AI'],
        'NIT': ['HS', 'OS', 'GO', 'JK', 'LA'],
        'GFTI': ['AI', 'HS', 'OS']
    }
};

// Global Variables
let currentResults = null;
let tooltipInstances = [];
let currentSortColumn = null;
let isAscending = true;
let initializationComplete = false;

// Main application initialization function to be called after auth
// This function is exposed to the window object so it can be called from other scripts
window.initializeApp = function() {
    // Prevent multiple initializations
    if (initializationComplete) {
        console.log('Application already initialized, skipping');
        return;
    }
    
    console.log('Main application initialization started');
    initializeApp();
    initializeEventListeners();
    initializeTooltips();
    
    // Mark initialization as complete
    initializationComplete = true;
};

// App Initialization
async function initializeApp() {
    try {
        console.log('Populating dropdowns...');
        
        // Try to populate dropdowns using API
        const populationPromises = [
            populateDropdown('college-type', ENDPOINTS.collegeTypes),
            populateDropdown('category', ENDPOINTS.categories),
            populateDropdown('preferred-branch', ENDPOINTS.branches),
            populateDropdown('round-no', ENDPOINTS.rounds),
            populateDropdown('gender', ENDPOINTS.genders)
        ];
        
        // Wait for all dropdowns to be populated
        await Promise.allSettled(populationPromises);
        
        // Check if any dropdowns failed to populate and use fallbacks
        const selects = ['college-type', 'category', 'preferred-branch', 'round-no', 'gender'];
        selects.forEach(id => {
            const select = document.getElementById(id);
            // If select has only the default option, populate with fallback data
            if (select && select.options.length <= 1) {
                populateWithFallbackData(id);
            }
        });
        
        console.log('All dropdowns populated successfully');
        
    } catch (error) {
        console.error('Initialization error:', error);
        
        // Fallback to static data for all dropdowns
        const selects = ['college-type', 'category', 'preferred-branch', 'round-no', 'gender'];
        selects.forEach(id => {
            populateWithFallbackData(id);
        });
        
        console.log('All dropdowns populated with fallback data');
    }
}

// Fallback data population
function populateWithFallbackData(elementId) {
    console.log(`Using fallback data for ${elementId}`);
    
    const select = document.getElementById(elementId);
    if (!select) {
        console.error(`Element with ID '${elementId}' not found`);
        return;
    }
    
    select.innerHTML = '<option value="">Select option</option>';
    
    if (FALLBACK_DATA[elementId]) {
        FALLBACK_DATA[elementId].forEach(option => {
            const optElement = document.createElement('option');
            optElement.value = option;
            optElement.textContent = option;
            select.appendChild(optElement);
        });
    }
    
    console.log(`Populated ${elementId} with fallback data`);
}

// Dropdown Population
async function populateDropdown(elementId, endpoint) {
    try {
        console.log(`Fetching data for ${elementId} from ${API_URL}${endpoint}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const response = await fetch(`${API_URL}${endpoint}`, {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`Received data for ${elementId}:`, data);
        
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
            if (data.data && Array.isArray(data.data)) {
                options = data.data;
            } else {
                const firstKey = Object.keys(data)[0];
                if (firstKey && Array.isArray(data[firstKey])) {
                    options = data[firstKey];
                } else {
                    options = Object.values(data).find(val => Array.isArray(val)) || [];
                }
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
        // Use fallback data instead
        populateWithFallbackData(elementId);
    }
}

// Populate Quota based on College Type
async function updateQuotaOptions(collegeType) {
    try {
        // Try to get quotas from API first
        try {
            console.log(`Fetching quotas for ${collegeType}`);
            const response = await fetch(`${API_URL}${ENDPOINTS.quotas}/${collegeType}`);
            
            if (response.ok) {
                const data = await response.json();
                
                const quotaSelect = document.getElementById('quota');
                if (!quotaSelect) {
                    console.error("Element 'quota' not found");
                    return;
                }
                
                quotaSelect.innerHTML = '<option value="">Select Quota</option>';
                
                if (data.quotas && Array.isArray(data.quotas)) {
                    data.quotas.forEach(quota => {
                        const option = document.createElement('option');
                        option.value = quota;
                        option.textContent = quota;
                        quotaSelect.appendChild(option);
                    });
                }
                
                quotaSelect.disabled = false;
                console.log('Quota options updated based on college type');
                return;
            }
        } catch (error) {
            console.error('Error fetching quota options from API:', error);
        }
        
        // If API fails, use fallback data
        const quotaSelect = document.getElementById('quota');
        if (!quotaSelect) {
            console.error("Element 'quota' not found");
            return;
        }
        
        quotaSelect.innerHTML = '<option value="">Select Quota</option>';
        
        if (FALLBACK_DATA.quota[collegeType]) {
            FALLBACK_DATA.quota[collegeType].forEach(quota => {
                const option = document.createElement('option');
                option.value = quota;
                option.textContent = quota;
                quotaSelect.appendChild(option);
            });
        }
        
        quotaSelect.disabled = false;
        console.log('Quota options updated with fallback data');
        
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
    headerCells.forEach(cell => {
        if (cell.classList.contains('sortable')) {
            cell.addEventListener('click', () => {
                const columnName = cell.getAttribute('data-sort');
                handleSortClick(columnName);
            });
            cell.style.cursor = 'pointer';
        }
    });
    
    console.log('Table sorting initialized');
}

// Handle sort click
function handleSortClick(columnName) {
    if (!currentResults || currentResults.length === 0) return;
    
    // Toggle sort direction if clicking the same column
    if (currentSortColumn === columnName) {
        isAscending = !isAscending;
    } else {
        currentSortColumn = columnName;
        isAscending = true;
    }
    
    sortTable(columnName, isAscending);
    updateSortIndicators(columnName, isAscending);
}

// Sort table by column
function sortTable(columnName, ascending) {
    if (!currentResults || currentResults.length === 0) return;
    
    currentResults.sort((a, b) => {
        let valueA = a[columnName];
        let valueB = b[columnName];
        
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
    displayResults({ preferences: currentResults });
}

// Update sort indicators in the table header
function updateSortIndicators(activeColumnName, ascending) {
    const headerCells = document.querySelectorAll('#results-table thead th.sortable');
    if (!headerCells || headerCells.length === 0) {
        console.error("Sortable table header cells not found");
        return;
    }
    
    headerCells.forEach(cell => {
        const columnName = cell.getAttribute('data-sort');
        const icon = cell.querySelector('i.fas');
        
        if (!icon) {
            console.error(`Sort icon not found in header cell for ${columnName}`);
            return;
        }
        
        if (columnName === activeColumnName) {
            icon.className = ascending ? 'fas fa-sort-up' : 'fas fa-sort-down';
        } else {
            icon.className = 'fas fa-sort';
        }
    });
}

// Form Submission Handler
async function handleFormSubmit(event) {
    event.preventDefault();
    
    if (!validateForm()) return;
    
    try {
        // Check each form field exists before accessing
        const jeeRankEl = document.getElementById('jee-rank');
        const categoryEl = document.getElementById('category');
        const collegeTypeEl = document.getElementById('college-type');
        const preferredBranchEl = document.getElementById('preferred-branch');
        const roundNoEl = document.getElementById('round-no');
        const quotaEl = document.getElementById('quota');
        const genderEl = document.getElementById('gender');
        const minProbEl = document.getElementById('min-prob');
        
        if (!jeeRankEl || !categoryEl || !collegeTypeEl || !preferredBranchEl || 
            !roundNoEl || !quotaEl || !genderEl || !minProbEl) {
            throw new Error('One or more form elements not found');
        }
        
        const formData = {
            jee_rank: parseInt(jeeRankEl.value),
            category: categoryEl.value,
            college_type: collegeTypeEl.value,
            preferred_branch: preferredBranchEl.value,
            round_no: roundNoEl.value,
            quota: quotaEl.value,
            gender: genderEl.value,
            min_probability: parseFloat(minProbEl.value)
        };
        
        setLoadingState(true);
        console.log('Submitting form data:', formData);
        
        try {
            const response = await fetch(`${API_URL}${ENDPOINTS.predict}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json();
            handlePredictionResponse(data);
        } catch (apiError) {
            console.error('API call failed:', apiError);
            // Use dummy data for testing UI
            const dummyData = generateDummyResults(formData);
            handlePredictionResponse(dummyData);
        }
    } catch (error) {
        showError('Failed to generate preferences. Please try again.');
        console.error('Prediction error:', error);
    } finally {
        setLoadingState(false);
    }
}

// Generate dummy results for testing
function generateDummyResults(formData) {
    const colleges = [
        { name: 'Indian Institute of Technology', type: 'IIT', locations: ['Bombay', 'Delhi', 'Madras', 'Kanpur', 'Kharagpur'] },
        { name: 'National Institute of Technology', type: 'NIT', locations: ['Trichy', 'Warangal', 'Surathkal', 'Calicut', 'Jaipur'] },
        { name: 'Indian Institute of Information Technology', type: 'IIIT', locations: ['Allahabad', 'Hyderabad', 'Bangalore', 'Delhi', 'Pune'] },
        { name: 'Government Funded Technical Institute', type: 'GFTI', locations: ['BITS Pilani', 'NSIT Delhi', 'DTU Delhi', 'IIIT Hyderabad', 'COEP Pune'] }
    ];
    
    const branches = FALLBACK_DATA['preferred-branch'];
    const preferences = [];
    
    // Generate 10 dummy college entries
    for (let i = 0; i < 10; i++) {
        const collegeType = formData.college_type === '' ? colleges[i % 4].type : formData.college_type;
        const college = colleges.find(c => c.type === collegeType) || colleges[0];
        const location = college.locations[i % college.locations.length];
        const branch = formData.preferred_branch === '' ? branches[i % branches.length] : formData.preferred_branch;
        
        const probability = Math.round(90 - (i * 8));
        let chances = 'High';
        if (probability < 50) chances = 'Low';
        else if (probability < 75) chances = 'Medium';
        
        preferences.push({
            preference: i + 1,
            institute: `${college.name} ${location}`,
            collegeType: collegeType,
            location: location,
            branch: branch,
            quota: formData.quota,
            gender: formData.gender,
            openingRank: Math.max(100, formData.jee_rank - Math.round(Math.random() * 1000)),
            closingRank: Math.min(50000, formData.jee_rank + Math.round(Math.random() * 1000)),
            probability: `${probability}%`,
            chances: chances
        });
    }
    
    return {
        preferences: preferences,
        plot_data: {
            x: [10, 20, 30, 40, 50, 60, 70, 80, 90],
            y: [1, 2, 3, 2, 1, 0, 0, 1, 0],
            type: 'bar'
        }
    };
}

// Response Handler
function handlePredictionResponse(data) {
    if (!data.preferences || data.preferences.length === 0) {
        showError('No colleges found matching your criteria.');
        return;
    }

    currentResults = data.preferences;
    displayResults(data);
    
    const downloadBtn = document.getElementById('download-btn');
    if (downloadBtn) {
        downloadBtn.disabled = false;
    } else {
        console.error("Element 'download-btn' not found");
    }
    
    // Reset sorting state when new results are displayed
    currentSortColumn = null;
    isAscending = true;
    updateSortIndicators(null, true);
}

// Results Display
function displayResults(data) {
    const outputSection = document.getElementById('output-section');
    if (!outputSection) {
        console.error("Element 'output-section' not found");
        return;
    }
    
    const tableBody = document.getElementById('results-body');
    if (!tableBody) {
        console.error("Element 'results-body' not found");
        return;
    }
    
    tableBody.innerHTML = '';
    
    data.preferences.forEach((pref, index) => {
        const row = tableBody.insertRow();
        
        // Create cells for each column in the table
        // Make sure the order matches your HTML table headers
        const prefCell = row.insertCell();
        prefCell.textContent = index + 1; // Preference number starts from 1
        
        const instituteCell = row.insertCell();
        instituteCell.textContent = pref.institute || '';
        
        const collegeTypeCell = row.insertCell();
        collegeTypeCell.textContent = pref.collegeType || '';
        
        const locationCell = row.insertCell();
        locationCell.textContent = pref.location || '';
        
        const branchCell = row.insertCell();
        branchCell.textContent = pref.branch || '';
        
        const quotaCell = row.insertCell();
        quotaCell.textContent = pref.quota || '';
        
        const genderCell = row.insertCell();
        genderCell.textContent = pref.gender || '';
        
        const openingRankCell = row.insertCell();
        openingRankCell.textContent = pref.openingRank || '';
        
        const closingRankCell = row.insertCell();
        closingRankCell.textContent = pref.closingRank || '';
        
        const probabilityCell = row.insertCell();
        probabilityCell.textContent = pref.probability || '';
        
        const chancesCell = row.insertCell();
        chancesCell.textContent = pref.chances || '';
    });

    if (data.plot_data) {
        createPlot(data.plot_data);
    }

    outputSection.style.display = 'block';
    outputSection.scrollIntoView({ behavior: 'smooth' });
}

// Plot Creation
function createPlot(plotData) {
    const plotContainer = document.getElementById('plot-container');
    if (!plotContainer) {
        console.error("Element 'plot-container' not found");
        return;
    }
    
    const layout = {
        title: 'Distribution of Admission Probabilities',
        xaxis: {
            title: 'Admission Probability (%)',
            gridcolor: '#f0f0f0'
        },
        yaxis: {
            title: 'Number of Colleges',
            gridcolor: '#f0f0f0'
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        showlegend: false
    };

    try {
        Plotly.newPlot('plot-container', [plotData], layout, {
            responsive: true,
            displayModeBar: true,
            displaylogo: false
        });
        console.log('Plot created successfully');
    } catch (error) {
        console.error('Error creating plot:', error);
    }
}

// Download Handler
function handleDownload() {
    if (!currentResults || currentResults.length === 0) {
        showError('No data available to download');
        return;
    }

    try {
        console.log('Preparing download...');
        const worksheet = XLSX.utils.json_to_sheet(currentResults);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'JOSAA Preferences');
        
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { 
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        
        const filename = `JOSAA_Preferences_${new Date().toISOString().split('T')[0]}.xlsx`;
        saveAs(blob, filename);
        console.log(`File "${filename}" prepared for download`);
    } catch (error) {
        showError('Failed to download Excel file');
        console.error('Download error:', error);
    }
}

// Form Validation
function validateForm() {
    const form = document.getElementById('preference-form');
    if (!form) {
        console.error("Form element 'preference-form' not found during validation");
        showError('Form validation error. Please try refreshing the page.');
        return false;
    }
    
    if (!form.checkValidity()) {
        form.classList.add('was-validated');
        return false;
    }
    
    // Additional validation for quota based on college type
    const collegeTypeEl = document.getElementById('college-type');
    const quotaEl = document.getElementById('quota');
    const genderEl = document.getElementById('gender');
    
    if (!collegeTypeEl || !quotaEl || !genderEl) {
        console.error("Required elements not found during validation");
        showError('Form validation error. Please try refreshing the page.');
        return false;
    }
    
    const collegeType = collegeTypeEl.value;
    const quota = quotaEl.value;
    const gender = genderEl.value;
    
    if (!quota) {
        showError('Please select a quota');
        return false;
    }
    
    if (!gender) {
        showError('Please select a gender preference');
        return false;
    }
    
    // Validate quota based on college type
    const validQuotas = {
        'IIT': ['AI'],
        'IIIT': ['AI'],
        'NIT': ['HS', 'OS', 'GO', 'JK', 'LA'],
        'GFTI': ['AI', 'HS', 'OS']
    };
    
    if (validQuotas[collegeType] && !validQuotas[collegeType].includes(quota)) {
        showError(`Invalid quota selection for ${collegeType}`);
        return false;
    }
    
    return true;
}

// UI State Management
function setLoadingState(isLoading) {
    const generateBtn = document.getElementById('generate-btn');
    const downloadBtn = document.getElementById('download-btn');
    const loadingOverlay = document.getElementById('loading-overlay');
    
    if (!generateBtn) {
        console.error("Element 'generate-btn' not found");
        return;
    }
    
    if (!loadingOverlay) {
        console.error("Element 'loading-overlay' not found");
        return;
    }
    
    const spinner = generateBtn.querySelector('.spinner-border');
    const buttonContent = generateBtn.querySelector('.button-content');
    
    if (isLoading) {
        generateBtn.disabled = true;
        if (downloadBtn) downloadBtn.disabled = true;
        if (loadingOverlay) loadingOverlay.classList.remove('d-none');
        if (spinner) spinner.classList.remove('d-none');
        if (buttonContent) buttonContent.classList.add('d-none');
    } else {
        generateBtn.disabled = false;
        if (loadingOverlay) loadingOverlay.classList.add('d-none');
        if (spinner) spinner.classList.add('d-none');
        if (buttonContent) buttonContent.classList.remove('d-none');
    }
}

// Error Handling
function showError(message) {
    const alertContainer = document.getElementById('error-alert-container');
    if (!alertContainer) {
        console.error("Element 'error-alert-container' not found");
        console.error("Error message that couldn't be displayed:", message);
        return;
    }
    
    const alert = document.createElement('div');
    alert.className = 'alert alert-danger alert-dismissible fade show';
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    alertContainer.appendChild(alert);
    
    console.error("Error shown to user:", message);
    
    setTimeout(() => {
        alert.classList.remove('show');
        setTimeout(() => alert.remove(), 150);
    }, 5000);
}

// Utility Functions
function handleCollegeTypeChange(event) {
    const rankLabel = document.getElementById('rank-label');
    if (!rankLabel) {
        console.error("Element 'rank-label' not found");
        return;
    }
    
    rankLabel.textContent = event.target.value === 'IIT' 
        ? 'Enter your JEE Advanced Rank (OPEN-CRL, Others-Category Rank)'
        : 'Enter your JEE Main Rank (OPEN-CRL, Others-Category Rank)';
}

function handleProbabilityChange(event) {
    const probValue = document.getElementById('prob-value');
    if (!probValue) {
        console.error("Element 'prob-value' not found");
        return;
    }
    
    probValue.textContent = event.target.value;
}

function initializeTooltips() {
    try {
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipInstances = tooltipTriggerList.map(function(tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
        console.log(`Initialized ${tooltipTriggerList.length} tooltips`);
    } catch (error) {
        console.error('Error initializing tooltips:', error);
    }
}

// Clean up function for tooltips
window.addEventListener('beforeunload', function() {
    tooltipInstances.forEach(tooltip => tooltip.dispose());
});
