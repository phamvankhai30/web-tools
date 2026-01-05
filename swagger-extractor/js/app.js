// Swagger Extractor - Main Application Logic

let parsedData = [];

// Initialize the application
function initApp() {
    // Initialize dropdown
    initDropdown();
    
    // Focus on input textarea
    document.getElementById('swaggerInput').focus();
}

function initDropdown() {
    const dropdownToggle = document.querySelector('.dropdown-toggle');
    const dropdownMenu = document.querySelector('.dropdown-menu');
    
    if (!dropdownToggle || !dropdownMenu) return;
    
    // Toggle menu when clicking the button
    dropdownToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('show');
        
        // Update aria-expanded attribute
        const isExpanded = dropdownMenu.classList.contains('show');
        dropdownToggle.setAttribute('aria-expanded', isExpanded);
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!dropdownMenu.contains(e.target) && !dropdownToggle.contains(e.target)) {
            dropdownMenu.classList.remove('show');
            dropdownToggle.setAttribute('aria-expanded', 'false');
        }
    });
    
    // Close menu when clicking on a dropdown item
    dropdownMenu.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            setTimeout(() => {
                dropdownMenu.classList.remove('show');
                dropdownToggle.setAttribute('aria-expanded', 'false');
            }, 150);
        });
    });
    
    // Close menu when pressing Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && dropdownMenu.classList.contains('show')) {
            dropdownMenu.classList.remove('show');
            dropdownToggle.setAttribute('aria-expanded', 'false');
            dropdownToggle.focus();
        }
    });
    
    // Set active menu item
    document.querySelectorAll('.dropdown-item').forEach(item => {
        item.classList.remove('active');
        if (item.textContent.includes('Swagger Extractor')) {
            item.classList.add('active');
        }
    });
}

function parseSwagger() {
    const input = document.getElementById("swaggerInput").value.trim();
    const tbody = document.getElementById("resultBody");
    const emptyState = document.getElementById("emptyState");
    const exportBtn = document.getElementById("exportBtn");
    const loadingSpinner = document.getElementById("loadingSpinner");
    const parseStatus = document.getElementById("parseStatus");
    const statsPanel = document.getElementById("statsPanel");
    
    if (!input) {
        showToast("Please paste Swagger JSON first", "error");
        return;
    }
    
    // Show loading
    loadingSpinner.classList.remove("hidden");
    parseStatus.textContent = "Parsing...";
    parseStatus.classList.remove("text-success", "text-error");
    parseStatus.classList.add("text-primary");
    
    // Clear previous data
    tbody.innerHTML = "";
    parsedData = [];
    
    let swagger;
    try {
        swagger = JSON.parse(input);
    } catch (e) {
        loadingSpinner.classList.add("hidden");
        parseStatus.textContent = "Parse failed";
        parseStatus.classList.remove("text-primary");
        parseStatus.classList.add("text-error");
        showToast("❌ Invalid JSON format", "error");
        tbody.appendChild(emptyState);
        return;
    }
    
    if (!swagger.paths) {
        loadingSpinner.classList.add("hidden");
        parseStatus.textContent = "No paths found";
        parseStatus.classList.remove("text-primary");
        parseStatus.classList.add("text-warning");
        showToast("❌ No 'paths' found in Swagger JSON", "error");
        tbody.appendChild(emptyState);
        return;
    }
    
    // Parse paths
    Object.entries(swagger.paths).forEach(([path, methods]) => {
        Object.entries(methods).forEach(([method, api]) => {
            const row = {
                TAG: (api.tags || []).join(", "),
                METHOD: method.toUpperCase(),
                API: path,
                SUMMARY: api.summary || "",
                DESCRIPTION: api.description || ""
            };
            
            parsedData.push(row);
            
            const tr = document.createElement("tr");
            tr.className = "hover:bg-gray-50";
            tr.innerHTML = `
                <td class="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-800">${row.TAG || "-"}</td>
                <td class="px-3 py-2 whitespace-nowrap">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        row.METHOD === 'GET' ? 'bg-blue-100 text-blue-800' :
                        row.METHOD === 'POST' ? 'bg-green-100 text-green-800' :
                        row.METHOD === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
                        row.METHOD === 'DELETE' ? 'bg-red-100 text-red-800' :
                        row.METHOD === 'PATCH' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                    }">
                        ${row.METHOD}
                    </span>
                </td>
                <td class="px-3 py-2">
                    <code class="text-xs font-mono text-gray-800 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">${row.API}</code>
                </td>
                <td class="px-3 py-2 text-xs text-gray-800 truncate max-w-[200px]">${row.SUMMARY || "-"}</td>
                <td class="px-3 py-2 text-xs text-gray-600 truncate max-w-[200px]">${row.DESCRIPTION || "-"}</td>
            `;
            tbody.appendChild(tr);
        });
    });
    
    // Update UI
    loadingSpinner.classList.add("hidden");
    parseStatus.textContent = "Success";
    parseStatus.classList.remove("text-primary");
    parseStatus.classList.add("text-success");
    
    document.getElementById("apiCount").textContent = parsedData.length;
    exportBtn.disabled = parsedData.length === 0;
    
    if (parsedData.length > 0) {
        emptyState.remove();
        showToast(`✅ Parsed ${parsedData.length} API endpoints`, "success");
        
        // Show and update stats
        statsPanel.classList.remove("hidden");
        updateStats();
    } else {
        tbody.appendChild(emptyState);
        statsPanel.classList.add("hidden");
    }
}

function updateStats() {
    if (parsedData.length === 0) return;
    
    document.getElementById("totalApis").textContent = parsedData.length;
    
    // Count unique tags
    const tags = parsedData.map(item => item.TAG).filter(tag => tag);
    const uniqueTags = [...new Set(tags.flatMap(tag => tag.split(", ")))];
    document.getElementById("uniqueTags").textContent = uniqueTags.length;
    
    // Count unique methods
    const methods = parsedData.map(item => item.METHOD);
    const uniqueMethods = [...new Set(methods)];
    document.getElementById("methodsCount").textContent = uniqueMethods.length;
}

function exportExcel() {
    if (parsedData.length === 0) {
        showToast("❌ No data to export", "error");
        return;
    }
    
    try {
        const worksheet = XLSX.utils.json_to_sheet(parsedData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Swagger APIs");
        
        XLSX.writeFile(workbook, `swagger-apis-${new Date().toISOString().slice(0,10)}.xlsx`);
        showToast(`✅ Exported ${parsedData.length} APIs to Excel`, "success");
    } catch (error) {
        showToast("❌ Error exporting to Excel", "error");
        console.error(error);
    }
}

function clearAll() {
    document.getElementById("swaggerInput").value = "";
    document.getElementById("resultBody").innerHTML = "";
    document.getElementById("emptyState").innerHTML = `
        <td colspan="5" class="px-3 py-10 text-center">
            <div class="text-gray-400">
                <svg class="w-10 h-10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <p class="font-medium text-gray-500 text-sm">No data yet</p>
                <p class="text-xs mt-1 text-gray-400">Parse Swagger JSON to see extracted APIs</p>
            </div>
        </td>
    `;
    document.getElementById("resultBody").appendChild(document.getElementById("emptyState"));
    document.getElementById("apiCount").textContent = "0";
    document.getElementById("exportBtn").disabled = true;
    document.getElementById("statsPanel").classList.add("hidden");
    document.getElementById("parseStatus").textContent = "";
    parsedData = [];
    
    showToast("Cleared all data", "info");
}

function showToast(message, type = "info") {
    // Remove existing toast
    const existingToast = document.getElementById("toast");
    if (existingToast) existingToast.remove();
    
    // Create toast
    const toast = document.createElement("div");
    toast.id = "toast";
    toast.className = `fixed bottom-3 right-3 px-3 py-2 rounded shadow transform transition-all duration-300 translate-y-full ${
        type === "success" ? "bg-green-100 text-green-800 border border-green-200" :
        type === "error" ? "bg-red-100 text-red-800 border border-red-200" :
        "bg-blue-100 text-blue-800 border border-blue-200"
    }`;
    toast.innerHTML = `
        <div class="flex items-center">
            <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                ${
                    type === "success" ? 
                    '<path fill-rule="evenodd" d="M10 18a8 0 100-16 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>' :
                    type === "error" ?
                    '<path fill-rule="evenodd" d="M10 18a8 0 100-16 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>' :
                    '<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>'
                }
            </svg>
            <span class="text-sm font-medium">${message}</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.classList.remove("translate-y-full");
    }, 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.add("translate-y-full");
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 300);
    }, 3000);
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);