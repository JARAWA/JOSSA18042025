// Table Sorting Functionality
document.addEventListener('DOMContentLoaded', function() {
    const table = document.getElementById('results-table');
    const headers = table.querySelectorAll('th.sortable');
    
    headers.forEach(header => {
        header.addEventListener('click', function() {
            const column = this.dataset.sort;
            const isAsc = !this.classList.contains('asc');
            
            // Remove sorting classes from all headers
            headers.forEach(h => {
                h.classList.remove('asc', 'desc');
                h.querySelector('i').className = 'fas fa-sort';
            });
            
            // Add sorting class to clicked header
            this.classList.add(isAsc ? 'asc' : 'desc');
            this.querySelector('i').className = `fas fa-sort-${isAsc ? 'up' : 'down'}`;
            
            sortTable(column, isAsc);
        });
    });
});

function sortTable(column, isAsc) {
    const tbody = document.getElementById('results-body');
    const rows = Array.from(tbody.getElementsByTagName('tr'));
    
    // Sort rows
    rows.sort((a, b) => {
        let aValue = getCellValue(a, column);
        let bValue = getCellValue(b, column);
        
        // Handle numeric values
        if (column === 'preference' || column === 'openingRank' || 
            column === 'closingRank' || column === 'probability') {
            aValue = parseFloat(aValue) || 0;
            bValue = parseFloat(bValue) || 0;
        }
        
        if (aValue === bValue) return 0;
        return (aValue > bValue ? 1 : -1) * (isAsc ? 1 : -1);
    });
    
    // Reorder rows in the table
    rows.forEach(row => tbody.appendChild(row));
}

function getCellValue(row, column) {
    // Map column names to indices
    const columnMap = {
        'preference': 0,
        'institute': 1,
        'collegeType': 2,
        'location': 3,
        'branch': 4,
        'openingRank': 5,
        'closingRank': 6,
        'probability': 7,
        'chances': 8
    };
    
    const cell = row.getElementsByTagName('td')[columnMap[column]];
    return cell.textContent.trim();
}
