// Constants and Configuration
const API_URL = window.location.origin;
const ENDPOINTS = {
    branches: '/api/branches',
    categories: '/api/categories',
    collegeTypes: '/api/college-types',
    rounds: '/api/rounds',
    predict: '/api/predict'
};

// Global Variables
let currentResults = null;
let tooltipInstances = [];

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    initializeEventListeners();
    initializeTooltips();
});

// App Initialization
async function initializeApp() {
    try {
        await Promise.all([
            populateDropdown('college-type', ENDPOINTS.collegeTypes),
            populateDropdown('category', ENDPOINTS.categories),
            populateDropdown('preferred-branch', ENDPOINTS.branches),
            populateDropdown('round-no', ENDPOINTS.rounds)
        ]);
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
        select.innerHTML = '<option value="">Select option</option>';
        
        const options = data[Object.keys(data)[0]]; // Get first property of response object
        options.forEach(option => {
            const optElement = document.createElement('option');
            optElement.value = option;
            optElement.textContent = option;
            select.appendChild(optElement);
        });
    } catch (error) {
        console.error(`Error populating ${elementId}:`, error);
        throw error;
    }
}

// Event Listeners
function initializeEventListeners() {
    // Form submission
    document.getElementById('preference-form').addEventListener('submit', handleFormSubmit);
    
    // College type change
    document.getElementById('college-type').addEventListener('change', handleCollegeTypeChange);
    
    // Probability slider
    document.getElementById('min-prob').addEventListener('input', handleProbabilityChange);
    
    // Download button
    document.getElementById('download-btn').addEventListener('click', handleDownload);
}

// Form Submission Handler
async function handleFormSubmit(event) {
    event.preventDefault();
    
    if (!validateForm()) return;
    
    const formData = {
        jee_rank: parseInt(document.getElementById('jee-rank').value),
        category: document.getElementById('category').value,
        college_type: document.getElementById('college-type').value,
        preferred_branch: document.getElementById('preferred-branch').value,
        round_no: document.getElementById('round-no').value,
        min_probability: parseFloat(document.getElementById('min-prob').value)
    };

    try {
        setLoadingState(true);
        
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
    } catch (error) {
        showError('Failed to generate preferences. Please try again.');
        console.error('Prediction error:', error);
    } finally {
        setLoadingState(false);
    }
}

// Response Handler
function handlePredictionResponse(data) {
    if (!data.preferences || data.preferences.length === 0) {
        showError('No colleges found matching your criteria.');
        return;
    }

    currentResults = data.preferences;
    displayResults(data);
    document.getElementById('download-btn').disabled = false;
}

// Results Display
function displayResults(data) {
    const outputSection = document.getElementById('output-section');
    const tableBody = document.getElementById('results-body');
    
    // Clear previous results
    tableBody.innerHTML = '';
    
    // Populate table
    data.preferences.forEach(pref => {
        const row = tableBody.insertRow();
        Object.values(pref).forEach(value => {
            const cell = row.insertCell();
            cell.textContent = value;
        });
    });

    // Create plot if data available
    if (data.plot_data) {
        createPlot(data.plot_data);
    }

    outputSection.style.display = 'block';
    outputSection.scrollIntoView({ behavior: 'smooth' });
}

// Plot Creation
function createPlot(plotData) {
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

    Plotly.newPlot('plot-container', [plotData], layout, {
        responsive: true,
        displayModeBar: true,
        displaylogo: false
    });
}

// Download Handler
function handleDownload() {
    if (!currentResults || currentResults.length === 0) {
        showError('No data available to download');
        return;
    }

    try {
        const worksheet = XLSX.utils.json_to_sheet(currentResults);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'JOSAA Preferences');
        
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { 
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        
        saveAs(blob, `JOSAA_Preferences_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
        showError('Failed to download Excel file');
        console.error('Download error:', error);
    }
}

// Form Validation
function validateForm() {
    const form = document.getElementById('preference-form');
    if (!form.checkValidity()) {
        form.classList.add('was-validated');
        return false;
    }
    return true;
}

// UI State Management
function setLoadingState(isLoading) {
    const generateBtn = document.getElementById('generate-btn');
    const downloadBtn = document.getElementById('download-btn');
    const loadingOverlay = document.getElementById('loading-overlay');
    const spinner = generateBtn.querySelector('.spinner-border');
    const buttonContent = generateBtn.querySelector('.button-content');

    if (isLoading) {
        generateBtn.disabled = true;
        downloadBtn.disabled = true;
        loadingOverlay.classList.remove('d-none');
        spinner.classList.remove('d-none');
        buttonContent.classList.add('d-none');
    } else {
        generateBtn.disabled = false;
        loadingOverlay.classList.add('d-none');
        spinner.classList.add('d-none');
        buttonContent.classList.remove('d-none');
    }
}

// Error Handling
function showError(message) {
    const alertContainer = document.getElementById('error-alert-container');
    const alert = document.createElement('div');
    alert.className = 'alert alert-danger alert-dismissible fade show';
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    alertContainer.appendChild(alert);
    
    setTimeout(() => {
        alert.classList.remove('show');
        setTimeout(() => alert.remove(), 150);
    }, 5000);
}

// Utility Functions
function handleCollegeTypeChange(event) {
    const rankLabel = document.getElementById('rank-label');
    rankLabel.textContent = event.target.value === 'IIT' 
        ? 'Enter your JEE Advanced Rank (OPEN-CRL, Others-Category Rank)'
        : 'Enter your JEE Main Rank (OPEN-CRL, Others-Category Rank)';
}

function handleProbabilityChange(event) {
    document.getElementById('prob-value').textContent = event.target.value;
}

function initializeTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipInstances = tooltipTriggerList.map(function(tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

// Clean up function for tooltips
window.addEventListener('beforeunload', function() {
    tooltipInstances.forEach(tooltip => tooltip.dispose());
});
