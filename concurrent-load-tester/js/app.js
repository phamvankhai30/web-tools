// Concurrent Load Tester - Main Application Logic

// Sample API endpoints for quick testing
const sampleEndpoints = [
    "https://jsonplaceholder.typicode.com/posts",
    "https://jsonplaceholder.typicode.com/comments",
    "https://jsonplaceholder.typicode.com/albums",
    "https://jsonplaceholder.typicode.com/photos"
];

// Store response data separately
const responseData = new Map();
// Store cURL commands for each request
const curlCommands = new Map();
// Store input data for each request (for array inputs)
const inputData = new Map();
// Variables for sorting
let currentSort = {
    column: null,
    direction: 'asc' // 'asc' or 'desc'
};
let tableData = []; // Store table data for sorting

// Initialize the application
function initApp() {
    // Set a sample endpoint on page load
    const randomEndpoint = sampleEndpoints[Math.floor(Math.random() * sampleEndpoints.length)];
    document.getElementById('url').value = randomEndpoint;

    // Add event listener for array inputs checkbox
    document.getElementById('useArrayInputs').addEventListener('change', function() {
        updateBodyPlaceholder();
    });

    // Focus on URL input
    document.getElementById('url').focus();

    // Initialize clear buttons visibility
    toggleClearButton('url');
    toggleClearButton('timeout');
    toggleClearButton('delay');

    // Initialize sorting
    initSorting();
    
    // Setup event listeners for real-time updates
    setupEventListeners();

    initDropdown();
}

function setupEventListeners() {
    const urlInput = document.getElementById('url');
    const timeoutInput = document.getElementById('timeout');
    const delayInput = document.getElementById('delay');

    urlInput.addEventListener('input', () => toggleClearButton('url'));
    timeoutInput.addEventListener('input', () => toggleClearButton('timeout'));
    delayInput.addEventListener('input', () => toggleClearButton('delay'));
}

function updateBodyPlaceholder() {
    const useArrayInputs = document.getElementById('useArrayInputs').checked;
    const bodyTextarea = document.getElementById('body');
    const arrayInfo = document.getElementById('array-info');
    
    if (useArrayInputs) {
        bodyTextarea.placeholder = '[{"key": "value1"}, {"key": "value2"}, {"key": "value3"}]';
        arrayInfo.textContent = 'When "Use array inputs" is checked, each array element will be used as input for separate requests. Number of requests = array length.';
    } else {
        bodyTextarea.placeholder = '{"key": "value"}';
        arrayInfo.textContent = 'When "Use array inputs" is checked, each array element will be used as input for separate requests';
    }
}

function clearInput(inputId) {
    const input = document.getElementById(inputId);
    const defaultValue = inputId === 'timeout' ? '30' : 
                        inputId === 'delay' ? '0' : '';
    
    input.value = defaultValue;
    // Focus back on input after clearing
    input.focus();
    // Hide clear button
    toggleClearButton(inputId);
}

function toggleClearButton(inputId) {
    const input = document.getElementById(inputId);
    const clearBtn = input.parentNode.querySelector('button');
    
    const defaultValue = inputId === 'timeout' ? '30' : 
                        inputId === 'delay' ? '0' : '';
    
    if (input.value !== defaultValue && input.value.trim() !== '') {
        clearBtn.classList.remove('hidden');
    } else {
        clearBtn.classList.add('hidden');
    }
}

function addDefaultHeaders() {
    const headersTextarea = document.getElementById('headers');
    const defaultHeaders = {
        "Authorization": "Bearer your_token_here",
        "Content-Type": "application/json",
        "Accept": "application/json"
    };
    
    try {
        const currentHeaders = headersTextarea.value.trim();
        let mergedHeaders = defaultHeaders;
        
        if (currentHeaders) {
            const parsed = JSON.parse(currentHeaders);
            mergedHeaders = { ...defaultHeaders, ...parsed };
        }
        
        headersTextarea.value = JSON.stringify(mergedHeaders, null, 2);
        showToast("Default headers added!");
    } catch (e) {
        headersTextarea.value = JSON.stringify(defaultHeaders, null, 2);
        showToast("Default headers added!");
    }
}

function formatJson(textareaId) {
    const textarea = document.getElementById(textareaId);
    const text = textarea.value.trim();

    if (!text) return;

    try {
        const parsed = JSON.parse(text);
        textarea.value = JSON.stringify(parsed, null, 2);
        showToast("JSON formatted successfully!");
    } catch (e) {
        alert("Invalid JSON format. Cannot format.");
    }
}

async function runRequests() {
    let url = document.getElementById('url').value.trim();
    const method = document.getElementById('method').value;
    const headersText = document.getElementById('headers').value.trim();
    const bodyText = document.getElementById('body').value.trim();
    const count = parseInt(document.getElementById('count').value);
    const timeoutSeconds = parseInt(document.getElementById('timeout').value);
    const delayMs = parseInt(document.getElementById('delay').value);
    const useArrayInputs = document.getElementById('useArrayInputs').checked;

    if (!url) {
        alert("Please enter a valid URL");
        return;
    }

    if (isNaN(timeoutSeconds) || timeoutSeconds < 1 || timeoutSeconds > 300) {
        alert("Timeout must be between 1 and 300 seconds");
        return;
    }

    if (isNaN(delayMs) || delayMs < 0 || delayMs > 10000) {
        alert("Delay must be between 0 and 10000 ms");
        return;
    }

    // Show loading indicator
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('stats-container').classList.add('hidden');

    // Parse headers
    let headers = { 'Content-Type': 'application/json' };
    if (headersText) {
        try {
            const parsedHeaders = JSON.parse(headersText);
            // Merge parsed headers with defaults
            headers = { ...headers, ...parsedHeaders };
        } catch (e) {
            alert("Invalid JSON in headers field");
            document.getElementById('loading').classList.add('hidden');
            return;
        }
    }

    // Parse request body
    let bodyArray = null;
    let bodyObject = null;
    
    if (bodyText) {
        try {
            const parsed = JSON.parse(bodyText);
            
            if (useArrayInputs && Array.isArray(parsed)) {
                bodyArray = parsed;
                if (bodyArray.length === 0) {
                    alert("Array is empty. Please provide array with data.");
                    document.getElementById('loading').classList.add('hidden');
                    return;
                }
                showToast(`Using array inputs: ${bodyArray.length} requests will be made`);
            } else if (useArrayInputs && !Array.isArray(parsed)) {
                alert("When 'Use array inputs' is checked, request body must be a JSON array");
                document.getElementById('loading').classList.add('hidden');
                return;
            } else {
                bodyObject = parsed;
            }
        } catch (e) {
            alert("Invalid JSON in request body");
            document.getElementById('loading').classList.add('hidden');
            return;
        }
    }

    // Determine actual request count
    let actualCount = count;
    if (useArrayInputs && bodyArray) {
        actualCount = Math.min(bodyArray.length, count);
        if (actualCount < bodyArray.length) {
            showToast(`Using first ${actualCount} elements from array (limited by concurrent requests setting)`);
        }
    }

    // Clear previous results
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';
    responseData.clear();
    curlCommands.clear();
    inputData.clear();
    tableData = []; // Clear sort data
    resetSort(); // Reset sort state

    // ===== CHUẨN BỊ TẤT CẢ REQUEST CONFIGS TRƯỚC =====
    const requestConfigs = [];
    
    for (let i = 0; i < actualCount; i++) {
        const requestIndex = i + 1;

        // Determine body for this specific request
        let requestBody = null;
        let queryParams = null;
        
        if (useArrayInputs && bodyArray && i < bodyArray.length) {
            // Use array element as body
            requestBody = JSON.stringify(bodyArray[i]);
            inputData.set(requestIndex, bodyArray[i]);
        } else if (bodyObject) {
            // Use single object as body
            requestBody = JSON.stringify(bodyObject);
            inputData.set(requestIndex, bodyObject);
        }

        // AUTO convert JSON body to query params if method is GET and has body
        if (requestBody && method === "GET") {
            try {
                const json = JSON.parse(requestBody);
                const params = new URLSearchParams();
                for (const key in json) {
                    if (json.hasOwnProperty(key)) {
                        params.append(key, json[key]);
                    }
                }
                queryParams = params.toString();
            } catch (e) {
                // If JSON is invalid, still proceed with GET request normally
                console.warn("Invalid JSON in request body for GET request, ignoring body");
            }
        }

        // Create URL with query params if any
        let requestUrl = url;
        if (queryParams) {
            requestUrl = url.split('?')[0];
            const existingParams = url.includes('?') ? url.split('?')[1] : '';
            const combinedParams = existingParams ? `${existingParams}&${queryParams}` : queryParams;
            requestUrl = `${requestUrl}?${combinedParams}`;
        }

        // Create fetch options
        const fetchOptions = {
            method,
            headers: { ...headers },
            mode: 'cors',
            cache: 'no-cache'
        };

        // Only add body if not GET or GET but has query params
        if (requestBody && method !== "GET") {
            fetchOptions.body = requestBody;
        }

        // Store config
        requestConfigs.push({
            index: requestIndex,
            url: requestUrl,
            options: fetchOptions,
            requestBody: requestBody,
            timeoutMs: timeoutSeconds * 1000
        });
    }

    // ===== GỬI REQUEST VỚI DELAY NẾU CẦN =====
    const globalStartTime = Date.now(); // Thời gian chung cho tất cả
    
    // Initialize stats với var thay vì let để đảm bảo scope
    var successCount = 0;
    var errorCount = 0;
    var totalDuration = 0;
    var minDuration = Infinity;
    var maxDuration = 0;

    // Function để cập nhật stats
    const updateStatsFromResult = (data, requestIndex) => {
        totalDuration += data.duration;
        minDuration = Math.min(minDuration, data.duration);
        maxDuration = Math.max(maxDuration, data.duration);
        
        if (data.success) {
            successCount++;
        } else {
            errorCount++;
        }
        
        // Store response data
        responseData.set(data.index, data.responseText);
        
        // Add to table
        addTableRow(data.index, data.success, data.status, 
                   new Date(data.startTime), new Date(data.endTime), data.duration);
    };

    // Nếu có delay, gửi tuần tự với delay
    if (delayMs > 0) {
        showToast(`Sending requests sequentially with ${delayMs}ms delay between requests`);
        
        for (let i = 0; i < requestConfigs.length; i++) {
            const config = requestConfigs[i];
            const result = await sendRequestWithDelay(config, i, delayMs, globalStartTime);
            
            // Process result
            updateStatsFromResult(result, config.index);
        }
        
    } else {
        // Gửi đồng thời (không có delay)
        // Tạo tất cả fetch promises CÙNG LÚC
        const fetchPromises = requestConfigs.map(config => {
            // Create AbortController for timeout
            const abortController = new AbortController();
            config.options.signal = abortController.signal;
            
            // Set timeout
            setTimeout(() => {
                abortController.abort();
            }, config.timeoutMs);
            
            // Generate cURL command
            const curlCommand = generateCurlCommand(config.url, method, config.options.headers, config.requestBody, timeoutSeconds);
            curlCommands.set(config.index, curlCommand);
            
            // GỬI REQUEST - tất cả được gọi cùng lúc qua Promise.all
            return fetch(config.url, config.options)
                .then(async response => {
                    const endTime = Date.now();
                    const duration = endTime - globalStartTime;
                    
                    let responseText;
                    try {
                        responseText = await response.text();
                        // Try to parse as JSON for formatting
                        try {
                            const parsed = JSON.parse(responseText);
                            responseText = JSON.stringify(parsed, null, 2);
                        } catch {
                            // Keep as is if not JSON
                        }
                    } catch {
                        responseText = "No response body or unable to read";
                    }
                    
                    return {
                        index: config.index,
                        success: response.ok,
                        status: response.status,
                        responseText,
                        duration,
                        startTime: globalStartTime,
                        endTime
                    };
                })
                .catch(error => {
                    const endTime = Date.now();
                    const duration = endTime - globalStartTime;
                    
                    let errorMessage = error.toString();
                    let statusCode = "Error";
                    if (error.name === 'AbortError') {
                        errorMessage = `Request timed out after ${timeoutSeconds} seconds`;
                        statusCode = "Timeout";
                    }
                    
                    return {
                        index: config.index,
                        success: false,
                        status: statusCode,
                        responseText: errorMessage,
                        duration,
                        startTime: globalStartTime,
                        endTime
                    };
                });
        });

        // ===== CHỜ TẤT CẢ HOÀN THÀNH VÀ XỬ LÝ KẾT QUẢ =====
        const results = await Promise.allSettled(fetchPromises);
        
        // Process all results
        results.forEach((result, i) => {
            if (result.status === 'fulfilled') {
                const data = result.value;
                
                // Update stats
                updateStatsFromResult(data, data.index);
            } else {
                // Handle promise rejection
                const requestIndex = requestConfigs[i]?.index || i + 1;
                const duration = Date.now() - globalStartTime;
                
                responseData.set(requestIndex, "Promise rejected: " + result.reason);
                addTableRow(requestIndex, false, "Error", 
                           new Date(globalStartTime), new Date(), duration);
                
                errorCount++;
                totalDuration += duration;
                minDuration = Math.min(minDuration, duration);
                maxDuration = Math.max(maxDuration, duration);
            }
        });
    }

    // Hide loading indicator
    document.getElementById('loading').classList.add('hidden');
    
    // Show stats container
    document.getElementById('stats-container').classList.remove('hidden');

    // Final stats update
    updateStats(successCount, errorCount, totalDuration, actualCount, minDuration, maxDuration);

    // Scroll to show results
    document.querySelector('.overflow-auto').scrollTop = 0;
}

async function sendRequestWithDelay(config, index, delayMs, globalStartTime) {
    // Nếu không phải request đầu tiên, delay
    if (index > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    
    // Create AbortController for timeout
    const abortController = new AbortController();
    config.options.signal = abortController.signal;
    
    // Set timeout
    setTimeout(() => {
        abortController.abort();
    }, config.timeoutMs);
    
    // Generate cURL command
    const method = document.getElementById('method').value;
    const timeoutSeconds = parseInt(document.getElementById('timeout').value);
    const curlCommand = generateCurlCommand(config.url, method, config.options.headers, config.requestBody, timeoutSeconds);
    curlCommands.set(config.index, curlCommand);
    
    try {
        const response = await fetch(config.url, config.options);
        const endTime = Date.now();
        const duration = endTime - globalStartTime;
        
        let responseText;
        try {
            responseText = await response.text();
            // Try to parse as JSON for formatting
            try {
                const parsed = JSON.parse(responseText);
                responseText = JSON.stringify(parsed, null, 2);
            } catch {
                // Keep as is if not JSON
            }
        } catch {
            responseText = "No response body or unable to read";
        }
        
        const result = {
            index: config.index,
            success: response.ok,
            status: response.status,
            responseText,
            duration,
            startTime: globalStartTime,
            endTime
        };
        
        return result;
        
    } catch (error) {
        const endTime = Date.now();
        const duration = endTime - globalStartTime;
        
        let errorMessage = error.toString();
        let statusCode = "Error";
        if (error.name === 'AbortError') {
            const timeoutSeconds = parseInt(document.getElementById('timeout').value);
            errorMessage = `Request timed out after ${timeoutSeconds} seconds`;
            statusCode = "Timeout";
        }
        
        return {
            index: config.index,
            success: false,
            status: statusCode,
            responseText: errorMessage,
            duration,
            startTime: globalStartTime,
            endTime
        };
    }
}

function updateStatsFromResult(data, requestIndex) {
    // Update global stats variables
    if (typeof successCount === 'undefined') successCount = 0;
    if (typeof errorCount === 'undefined') errorCount = 0;
    if (typeof totalDuration === 'undefined') totalDuration = 0;
    if (typeof minDuration === 'undefined') minDuration = Infinity;
    if (typeof maxDuration === 'undefined') maxDuration = 0;
    
    totalDuration += data.duration;
    minDuration = Math.min(minDuration, data.duration);
    maxDuration = Math.max(maxDuration, data.duration);
    
    if (data.success) {
        successCount++;
    } else {
        errorCount++;
    }
    
    // Store response data
    responseData.set(data.index, data.responseText);
    
    // Add to table
    addTableRow(data.index, data.success, data.status, 
               new Date(data.startTime), new Date(data.endTime), data.duration);
}

function generateCurlCommand(url, method, headers, body, timeoutSeconds) {
    let curl = `curl -X ${method} "${url}" \\\n`;

    // Add timeout option
    curl += `  --max-time ${timeoutSeconds} \\\n`;

    // Add headers
    Object.entries(headers).forEach(([key, value]) => {
        if (key.toLowerCase() === 'content-type' && value === 'application/json' && method === 'GET') {
            // Skip Content-Type for GET requests since we don't have body
            return;
        }
        curl += `  -H "${key}: ${value}" \\\n`;
    });

    // Add body data if exists and method is not GET
    if (body && method !== 'GET') {
        // Escape quotes and newlines for cURL
        const escapedBody = body.replace(/"/g, '\\"').replace(/\n/g, '\\n');
        curl += `  -d "${escapedBody}"`;
    } else {
        // Remove trailing backslash and newline
        curl = curl.slice(0, -3);
    }

    return curl;
}

function addTableRow(index, success, status, startTime, endTime, duration) {
    const tbody = document.getElementById('table-body');

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50';
    tr.setAttribute('data-index', index);

    // Format start time
    const startTimeStr = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}:${startTime.getSeconds().toString().padStart(2, '0')}.${startTime.getMilliseconds().toString().padStart(3, '0')}`;

    // Format end time
    const endTimeStr = `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}:${endTime.getSeconds().toString().padStart(2, '0')}.${endTime.getMilliseconds().toString().padStart(3, '0')}`;

    // Determine status badge color
    let statusClass = 'bg-gray-100 text-gray-800';
    let statusSymbol = '?';
    if (status === "Timeout") {
        statusClass = 'bg-red-100 text-red-800';
        statusSymbol = '⏰';
    } else if (success) {
        statusClass = 'bg-green-100 text-green-800';
        statusSymbol = '✓';
    } else if (!success && status !== "Error" && status !== "Timeout") {
        statusClass = 'bg-yellow-100 text-yellow-800';
        statusSymbol = '✗';
    } else {
        statusClass = 'bg-red-100 text-red-800';
        statusSymbol = '✗';
    }

    tr.innerHTML = `
        <td class="px-2 py-1.5" data-sort="index">${index}</td>
        <td class="px-2 py-1.5" data-sort="status">
            <span class="inline-block px-1.5 py-0.5 text-2xs font-medium rounded-full ${statusClass}">
                ${statusSymbol}
            </span>
        </td>
        <td class="px-2 py-1.5 font-semibold" data-sort="code">${status}</td>
        <td class="px-2 py-1.5 text-2xs" data-sort="startTime">${startTimeStr}</td>
        <td class="px-2 py-1.5 text-2xs" data-sort="endTime">${endTimeStr}</td>
        <td class="px-2 py-1.5" data-sort="duration">${duration}ms</td>
        <td class="px-2 py-1.5">
            <div class="flex gap-1">
                <button class="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-2xs text-gray-700 hover:bg-gray-200 transition-colors view-btn" data-index="${index}">
                    View
                </button>
                <button class="px-1.5 py-0.5 bg-blue-50 border border-blue-200 rounded text-2xs text-blue-700 hover:bg-blue-100 transition-colors curl-btn" data-index="${index}">
                    cURL
                </button>
                <button class="px-1.5 py-0.5 bg-purple-50 border border-purple-200 rounded text-2xs text-purple-700 hover:bg-purple-100 transition-colors input-btn" data-index="${index}">
                    Input
                </button>
            </div>
        </td>
    `;

    // Add event listener to the view button
    const viewBtn = tr.querySelector('.view-btn');
    viewBtn.addEventListener('click', function () {
        const dataIndex = this.getAttribute('data-index');
        showModal(responseData.get(parseInt(dataIndex)) || "No response data available", "Response Details");
    });

    // Add event listener to the cURL button
    const curlBtn = tr.querySelector('.curl-btn');
    curlBtn.addEventListener('click', function () {
        const dataIndex = this.getAttribute('data-index');
        showCurlModal(curlCommands.get(parseInt(dataIndex)) || "No cURL command available");
    });

    // Add event listener to the input button
    const inputBtn = tr.querySelector('.input-btn');
    inputBtn.addEventListener('click', function () {
        const dataIndex = this.getAttribute('data-index');
        const input = inputData.get(parseInt(dataIndex));
        showModal(input ? JSON.stringify(input, null, 2) : "No input data available", "Input Data");
    });

    // Store row data for sorting
    const rowData = {
        index: index,
        success: success,
        status: status,
        startTime: startTimeStr,
        endTime: endTimeStr,
        duration: duration,
        element: tr,
        statusSymbol: statusSymbol,
        statusClass: statusClass
    };
    
    tableData.push(rowData);

    // Add to table
    if (tbody.firstChild) {
        tbody.insertBefore(tr, tbody.firstChild);
    } else {
        tbody.appendChild(tr);
    }

    // If there's an active sort, re-sort the table
    if (currentSort.column) {
        sortTable(currentSort.column);
    }
}

function updateStats(success, error, totalDuration, completed, minTime, maxTime) {
    const total = completed; // Sử dụng completed làm total
    const avgTime = completed > 0 ? Math.round(totalDuration / completed) : 0;

    document.getElementById('stat-success').textContent = success;
    document.getElementById('stat-error').textContent = error;
    document.getElementById('stat-avg-time').textContent = avgTime;
    document.getElementById('stat-total').textContent = total; // Sử dụng total thay vì completed
    document.getElementById('stat-min-time').textContent = minTime === Infinity ? 0 : minTime;
    document.getElementById('stat-max-time').textContent = maxTime;

    // Color the avg time based on performance
    const avgTimeEl = document.getElementById('stat-avg-time');
    avgTimeEl.className = 'text-base font-semibold';
    if (avgTime < 200) avgTimeEl.classList.add('text-success');
    else if (avgTime < 1000) avgTimeEl.classList.add('text-warning');
    else avgTimeEl.classList.add('text-error');
}

// Sorting functionality
function initSorting() {
    const headers = document.querySelectorAll('.sort-header');
    headers.forEach(header => {
        header.addEventListener('click', function() {
            const column = this.getAttribute('data-sort');
            sortTable(column);
        });
    });
}

function sortTable(column) {
    // If clicking the same column, toggle direction
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'asc';
    }
    
    // Update sort indicators
    updateSortIndicators();
    
    // Sort tableData array
    tableData.sort((a, b) => {
        let comparison = 0;
        
        switch(column) {
            case 'status':
                // Sort by success status: success first, then errors, then timeouts
                if (a.success && !b.success) comparison = -1;
                else if (!a.success && b.success) comparison = 1;
                else if (a.status === 'Timeout' && b.status !== 'Timeout') comparison = 1;
                else if (a.status !== 'Timeout' && b.status === 'Timeout') comparison = -1;
                else comparison = a.statusSymbol.localeCompare(b.statusSymbol);
                break;
                
            case 'code':
                // Sort by status code
                const aCode = typeof a.status === 'number' ? a.status : 
                             a.status === 'Timeout' ? 999 : 
                             a.status === 'Error' ? 998 : parseInt(a.status) || 0;
                const bCode = typeof b.status === 'number' ? b.status : 
                             b.status === 'Timeout' ? 999 : 
                             b.status === 'Error' ? 998 : parseInt(b.status) || 0;
                comparison = aCode - bCode;
                break;
                
            case 'startTime':
            case 'endTime':
                // Sort by time (convert to timestamp)
                const aTime = new Date('1970/01/01 ' + a[column]).getTime();
                const bTime = new Date('1970/01/01 ' + b[column]).getTime();
                comparison = aTime - bTime;
                break;
                
            case 'duration':
                // Sort by duration (numeric)
                comparison = a.duration - b.duration;
                break;
                
            default:
                // Default numeric sort for index
                comparison = a.index - b.index;
        }
        
        return currentSort.direction === 'asc' ? comparison : -comparison;
    });
    
    // Rebuild table in sorted order
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';
    tableData.forEach(data => {
        tbody.appendChild(data.element);
    });
}

function updateSortIndicators() {
    // Reset all headers
    document.querySelectorAll('.sort-header').forEach(header => {
        header.classList.remove('active', 'sort-asc', 'sort-desc');
        const icon = header.querySelector('.sort-icon');
        icon.textContent = '↕';
    });
    
    // Update active header
    const activeHeader = document.querySelector(`.sort-header[data-sort="${currentSort.column}"]`);
    if (activeHeader) {
        activeHeader.classList.add('active');
        if (currentSort.direction === 'asc') {
            activeHeader.classList.add('sort-asc');
            activeHeader.querySelector('.sort-icon').textContent = '↑';
        } else {
            activeHeader.classList.add('sort-desc');
            activeHeader.querySelector('.sort-icon').textContent = '↓';
        }
    }
}

function resetSort() {
    currentSort = {
        column: null,
        direction: 'asc'
    };
    updateSortIndicators();
}

function showModal(responseText, title = "Response Details") {
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');
    const modalTitle = modal.querySelector('h3');

    // Update modal title
    modalTitle.textContent = title;

    // Try to format if it's JSON
    if (responseText) {
        try {
            // Remove any extra quotes or backslashes
            let cleanText = responseText;
            if (typeof cleanText === 'string') {
                // Try to parse as JSON
                const parsed = JSON.parse(cleanText);
                modalBody.textContent = JSON.stringify(parsed, null, 2);
            } else {
                modalBody.textContent = cleanText;
            }
        } catch {
            // If not JSON, display as is
            modalBody.textContent = responseText;
        }
    } else {
        modalBody.textContent = "No data available";
    }

    modal.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
}

function showCurlModal(curlCommand) {
    const modal = document.getElementById('curl-modal');
    const curlBody = document.getElementById('curl-body');

    curlBody.textContent = curlCommand;
    modal.classList.remove('hidden');
}

function closeCurlModal() {
    document.getElementById('curl-modal').classList.add('hidden');
}

function copyCurlToClipboard() {
    const curlText = document.getElementById('curl-body').textContent;
    navigator.clipboard.writeText(curlText).then(() => {
        showToast("cURL command copied to clipboard!");
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
}

// Show toast notification
function showToast(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.className = 'fixed bottom-3 right-3 bg-primary text-white px-3 py-2 rounded shadow z-50 text-xs animate-slideInUp';
    
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// Upload modal functions
function openUploadModal() {
    document.getElementById('upload-modal').classList.remove('hidden');
}

function closeUploadModal() {
    document.getElementById('upload-modal').classList.add('hidden');
}

function processUpload() {
    const fileInput = document.getElementById('xlsxFile');
    const jsonMappingText = document.getElementById('jsonMapping').value;
    const output = document.getElementById('upload-output');
    const preview = document.getElementById('upload-preview');
    const useArrayInputs = document.getElementById('useArrayInputs');

    if (!fileInput.files.length) {
        alert("Please upload an XLSX file!");
        return;
    }

    let mapping;
    try {
        mapping = JSON.parse(jsonMappingText);
    } catch (err) {
        alert("Invalid JSON format in mapping template!");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

            const result = jsonData.map(rowObj => {
                const mapped = {};
                for (const key in mapping) {
                    if (mapping[key] === "from_upload") {
                        // Map from uploaded file - using the same key name
                        mapped[key] = rowObj[key] !== undefined ? rowObj[key] : null;
                    } else {
                        // Keep static value from mapping
                        mapped[key] = mapping[key];
                    }
                }
                return mapped;
            });

            // Show preview
            output.textContent = JSON.stringify(result, null, 2);
            preview.classList.remove('hidden');

            // Show success message
            showToast(`Processed ${result.length} rows from Excel file`);

            // Ask user if they want to apply the result to request body
            if (confirm(`Processed ${result.length} rows. Do you want to use this as request body?`)) {
                const bodyTextarea = document.getElementById('body');

                if (result.length > 1) {
                    // If multiple rows, automatically check "Use array inputs"
                    useArrayInputs.checked = true;
                    updateBodyPlaceholder();
                    bodyTextarea.value = JSON.stringify(result, null, 2);
                } else {
                    bodyTextarea.value = JSON.stringify(result[0], null, 2);
                }

                // ===== XÓA GIỚI HẠN 100, ĐỂ NGUYÊN =====
                const countInput = document.getElementById('count');
                // Luôn đề xuất đúng số lượng rows từ Excel
                countInput.value = result.length;

                closeUploadModal();
                showToast("Request body updated with uploaded data");
            }

        } catch (error) {
            alert("Error processing Excel file: " + error.message);
            console.error(error);
        }
    };

    reader.readAsArrayBuffer(file);
}

// ===== DROPDOWN MENU FUNCTIONALITY =====
function setupModernDropdown() {
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
            // Small delay to show click feedback before closing
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
}

// Initialize dropdown when DOM is loaded
function initDropdown() {
    setupModernDropdown();
    
    // Update active state based on current page
    updateActiveMenuItem();
}

function updateActiveMenuItem() {
    const url = window.location.pathname;
    document.querySelectorAll('.dropdown-item').forEach(item => {
        item.classList.remove('active');
        
        if (url.includes('concurrent') && item.textContent.includes('Concurrent')) {
            item.classList.add('active');
        }
        if (url.includes('performance') && item.textContent.includes('Performance')) {
            item.classList.add('active');
        }
        if (!url.includes('concurrent') && !url.includes('performance') && item.textContent.includes('Home')) {
            item.classList.add('active');
        }
    });
}

// Close modal when clicking outside or pressing Escape
window.addEventListener('click', (e) => {
    if (e.target.id === 'modal') closeModal();
    if (e.target.id === 'curl-modal') closeCurlModal();
    if (e.target.id === 'upload-modal') closeUploadModal();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
        closeCurlModal();
        closeUploadModal();
    }
});

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);