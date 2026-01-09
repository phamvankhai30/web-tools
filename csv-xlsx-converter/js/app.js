// CSV ↔ XLSX Converter - Main Application Logic

// Initialize the application
function initApp() {
    initDropdown();
    setupFileHandlers();
    setupDragAndDrop();
    setupEventListeners();
}

function setupFileHandlers() {
    const fileInput = document.getElementById("fileInput");
    const dropZone = document.getElementById("dropZone");
    const previewTable = document.getElementById("preview");
    const fileList = document.getElementById("fileList");
    const fileListContent = document.getElementById("fileListContent");

    // Click drop zone to trigger file input
    dropZone.addEventListener("click", () => {
        fileInput.click();
    });

    // File input change
    fileInput.addEventListener("change", () => {
        if (fileInput.files.length) {
            updateFileList();
            previewFile(fileInput.files[0]);
        }
    });
}

function setupDragAndDrop() {
    const dropZone = document.getElementById("dropZone");
    const fileInput = document.getElementById("fileInput");

    dropZone.addEventListener("dragover", e => {
        e.preventDefault();
        dropZone.classList.add("border-primary-dark", "bg-blue-50");
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("border-primary-dark", "bg-blue-50");
    });

    dropZone.addEventListener("drop", e => {
        e.preventDefault();
        dropZone.classList.remove("border-primary-dark", "bg-blue-50");
        
        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            updateFileList();
            previewFile(fileInput.files[0]);
            showToast(`${e.dataTransfer.files.length} file(s) added`, "success");
        }
    });
}

function setupEventListeners() {
    // Add change listeners for controls
    document.getElementById("mode").addEventListener("change", function() {
        const mode = this.value;
        const sheetNameInput = document.getElementById("sheetName");
        const delimiterSelect = document.getElementById("delimiter");
        
        if (mode === "csv2xlsx") {
            sheetNameInput.disabled = false;
            delimiterSelect.disabled = false;
        } else {
            sheetNameInput.disabled = false;
            delimiterSelect.disabled = false;
        }
    });
}

function updateFileList() {
    const fileInput = document.getElementById("fileInput");
    const fileList = document.getElementById("fileList");
    const fileListContent = document.getElementById("fileListContent");
    
    if (fileInput.files.length === 0) {
        fileList.classList.add("hidden");
        return;
    }
    
    fileListContent.innerHTML = "";
    
    Array.from(fileInput.files).forEach((file, index) => {
        const fileSize = formatFileSize(file.size);
        const fileExt = file.name.split('.').pop().toUpperCase();
        const isCSV = fileExt === 'CSV';
        const isExcel = fileExt === 'XLSX' || fileExt === 'XLS';
        
        const fileItem = document.createElement("div");
        fileItem.className = "flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200";
        fileItem.innerHTML = `
            <div class="flex items-center">
                <div class="w-8 h-8 mr-3 rounded flex items-center justify-center ${isCSV ? 'bg-green-100' : isExcel ? 'bg-blue-100' : 'bg-gray-100'}">
                    <span class="text-xs font-medium ${isCSV ? 'text-green-700' : isExcel ? 'text-blue-700' : 'text-gray-700'}">${fileExt}</span>
                </div>
                <div>
                    <p class="text-sm font-medium text-gray-800 truncate max-w-[200px]">${file.name}</p>
                    <p class="text-xs text-gray-500">${fileSize}</p>
                </div>
            </div>
            <button onclick="removeFile(${index})" class="text-gray-400 hover:text-red-500 transition-colors">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
            </button>
        `;
        fileListContent.appendChild(fileItem);
    });
    
    fileList.classList.remove("hidden");
}

function removeFile(index) {
    const fileInput = document.getElementById("fileInput");
    const dt = new DataTransfer();
    
    Array.from(fileInput.files).forEach((file, i) => {
        if (i !== index) {
            dt.items.add(file);
        }
    });
    
    fileInput.files = dt.files;
    updateFileList();
    
    if (fileInput.files.length > 0) {
        previewFile(fileInput.files[0]);
    } else {
        document.getElementById("preview").innerHTML = "";
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function detectDelimiter(text) {
    const delimiters = [",", ";", "|", "\t"];
    return delimiters.reduce((a, b) =>
        text.split(b).length > text.split(a).length ? b : a
    );
}

function previewFile(file) {
    const previewTable = document.getElementById("preview");
    previewTable.innerHTML = "";
    
    const reader = new FileReader();
    
    reader.onload = e => {
        if (file.name.toLowerCase().endsWith(".csv")) {
            const text = e.target.result;
            const delimiter = document.getElementById("delimiter").value === "auto" 
                ? detectDelimiter(text) 
                : document.getElementById("delimiter").value;

            const rows = text.split("\n").slice(0, 20).map(r => r.split(delimiter));
            
            if (rows.length === 0) return;
            
            // Create table header
            const thead = document.createElement("thead");
            const headerRow = document.createElement("tr");
            const firstRow = rows[0];
            
            firstRow.forEach(cell => {
                const th = document.createElement("th");
                th.className = "px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider bg-gray-50 border-b border-gray-200";
                th.textContent = cell || "Column";
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            previewTable.appendChild(thead);
            
            // Create table body
            const tbody = document.createElement("tbody");
            rows.slice(1).forEach((row, i) => {
                const tr = document.createElement("tr");
                tr.className = i % 2 === 0 ? "bg-white" : "bg-gray-50";
                
                row.forEach(cell => {
                    const td = document.createElement("td");
                    td.className = "px-3 py-2 text-xs text-gray-800 border-b border-gray-200";
                    td.textContent = cell || "";
                    tr.appendChild(td);
                });
                
                tbody.appendChild(tr);
            });
            previewTable.appendChild(tbody);
            
        } else {
            // XLSX/XLS file
            const wb = XLSX.read(e.target.result, { type: "array" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(0, 20);
            
            if (data.length === 0) return;
            
            // Create table header
            const thead = document.createElement("thead");
            const headerRow = document.createElement("tr");
            const firstRow = data[0];
            
            firstRow.forEach((cell, index) => {
                const th = document.createElement("th");
                th.className = "px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider bg-gray-50 border-b border-gray-200";
                th.textContent = cell !== undefined ? cell : `Column ${index + 1}`;
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            previewTable.appendChild(thead);
            
            // Create table body
            const tbody = document.createElement("tbody");
            data.slice(1).forEach((row, i) => {
                const tr = document.createElement("tr");
                tr.className = i % 2 === 0 ? "bg-white" : "bg-gray-50";
                
                firstRow.forEach((_, index) => {
                    const td = document.createElement("td");
                    td.className = "px-3 py-2 text-xs text-gray-800 border-b border-gray-200";
                    td.textContent = row && row[index] !== undefined ? row[index] : "";
                    tr.appendChild(td);
                });
                
                tbody.appendChild(tr);
            });
            previewTable.appendChild(tbody);
        }
    };

    if (file.name.toLowerCase().endsWith(".csv")) {
        reader.readAsText(file);
    } else {
        reader.readAsArrayBuffer(file);
    }
}

function convert() {
    const fileInput = document.getElementById("fileInput");
    const mode = document.getElementById("mode").value;
    const delimiter = document.getElementById("delimiter").value;
    const sheetName = document.getElementById("sheetName").value || "Sheet1";
    const outputName = document.getElementById("outputName").value;
    
    if (!fileInput.files.length) {
        showToast("Please select at least one file", "error");
        return;
    }
    
    const files = Array.from(fileInput.files);
    let processed = 0;
    
    files.forEach(file => {
        const reader = new FileReader();
        
        reader.onload = e => {
            try {
                if (mode === "csv2xlsx") {
                    // CSV to XLSX
                    const text = e.target.result;
                    const fs = delimiter === "auto" ? detectDelimiter(text) : delimiter;
                    
                    const wb = XLSX.read(text, { type: "string", FS: fs });
                    const newWB = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(newWB, wb.Sheets[wb.SheetNames[0]], sheetName);
                    
                    const fileName = outputName || file.name.replace(/\.[^/.]+$/, "");
                    XLSX.writeFile(newWB, `${fileName}.xlsx`);
                    
                } else {
                    // XLSX to CSV
                    const wb = XLSX.read(e.target.result, { type: "array" });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    const csv = XLSX.utils.sheet_to_csv(ws, {
                        FS: delimiter === "auto" ? "," : delimiter
                    });
                    
                    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    const fileName = outputName || file.name.replace(/\.[^/.]+$/, "");
                    a.download = `${fileName}.csv`;
                    a.click();
                }
                
                processed++;
                if (processed === files.length) {
                    showToast(`Converted ${files.length} file(s) successfully`, "success");
                }
                
            } catch (error) {
                console.error("Conversion error:", error);
                showToast(`Error converting ${file.name}: ${error.message}`, "error");
            }
        };
        
        if (mode === "csv2xlsx") {
            reader.readAsText(file);
        } else {
            reader.readAsArrayBuffer(file);
        }
    });
}

function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `fixed bottom-3 right-3 px-3 py-2 rounded shadow transform transition-all duration-300 translate-y-full z-50 ${
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
    
    setTimeout(() => {
        toast.classList.remove("translate-y-full");
    }, 10);
    
    setTimeout(() => {
        toast.classList.add("translate-y-full");
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 300);
    }, 3000);
}

// ===== DROPDOWN MENU FUNCTIONALITY =====
function initDropdown() {
    const dropdownToggle = document.querySelector('.dropdown-toggle');
    const dropdownMenu = document.querySelector('.dropdown-menu');
    
    if (!dropdownToggle || !dropdownMenu) return;
    
    dropdownToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('show');
        dropdownToggle.setAttribute('aria-expanded', dropdownMenu.classList.contains('show'));
    });
    
    document.addEventListener('click', (e) => {
        if (!dropdownMenu.contains(e.target) && !dropdownToggle.contains(e.target)) {
            dropdownMenu.classList.remove('show');
            dropdownToggle.setAttribute('aria-expanded', 'false');
        }
    });
    
    dropdownMenu.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            setTimeout(() => {
                dropdownMenu.classList.remove('show');
                dropdownToggle.setAttribute('aria-expanded', 'false');
            }, 150);
        });
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && dropdownMenu.classList.contains('show')) {
            dropdownMenu.classList.remove('show');
            dropdownToggle.setAttribute('aria-expanded', 'false');
            dropdownToggle.focus();
        }
    });
    
    document.querySelectorAll('.dropdown-item').forEach(item => {
        item.classList.remove('active');
        if (item.textContent.includes('CSV ↔ XLSX')) {
            item.classList.add('active');
        }
    });
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);