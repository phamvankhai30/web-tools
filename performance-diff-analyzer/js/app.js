// Performance Diff Analyzer - Main Application Logic

let apiId = 0;
const resultMap = new Map();
const responseStore = new Map(); // Store responses for comparison

// Save URLs for autocomplete
let historyUrlsA = [];
let historyUrlsB = [];

// Initialize the application
function initApp() {
    // Add initial API row
    addApi();
    
    // Setup event listeners
    setupEventListeners();
    
    // Update datalists with sample URLs
    updateDatalist('baseUrlsA', [
        'https://jsonplaceholder.typicode.com',
        'https://api.github.com',
        'https://reqres.in/api'
    ]);
    
    updateDatalist('baseUrlsB', [
        'https://jsonplaceholder.typicode.com',
        'https://api.github.com',
        'https://reqres.in/api'
    ]);

    initDropdown();
}

function setupEventListeners() {
    // Setup clear buttons
    ['baseA', 'baseB', 'headersA', 'headersB', 'timeout'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', () => toggleClearButton(id));
        }
    });
}

function formatTimeMS(date) {
    const d = new Date(date);
    const ms = d.getMilliseconds().toString().padStart(3, '0');
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${ms}`;
}

function clearInput(inputId) {
    const input = document.getElementById(inputId);
    if (inputId === 'timeout') {
        input.value = '30';
    } else {
        input.value = '';
    }
    toggleClearButton(inputId);
}

function toggleClearButton(inputId) {
    const input = document.getElementById(inputId);
    const clearBtn = input.parentNode.querySelector('button');
    if (!clearBtn) return;
    
    if (inputId === 'timeout') {
        clearBtn.classList.toggle('hidden', input.value === '30');
    } else {
        clearBtn.classList.toggle('hidden', !input.value.trim());
    }
}

function addApi() {
    apiId++;
    const tr = document.createElement('tr');
    tr.dataset.apiId = apiId;
    tr.className = "hover:bg-gray-50";
    tr.innerHTML = `
        <td class="px-2 py-1.5">
            <select class="w-full px-1 py-1 text-gray-900 bg-white border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent">
                <option>GET</option>
                <option>POST</option>
                <option>PUT</option>
                <option>PATCH</option>
            </select>
        </td>
        <td class="px-2 py-1.5">
            <input class="w-full px-1 py-1 text-gray-900 bg-white border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent" placeholder="/api/path" />
        </td>
        <td class="px-2 py-1.5">
            <input type="number" class="w-full px-1 py-1 text-gray-900 bg-white border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent" value="1" min="1"/>
        </td>
        <td class="px-2 py-1.5">
            <textarea class="w-full px-1 py-1 text-gray-900 bg-white border border-gray-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent" rows="2" placeholder='{"id":1}'></textarea>
        </td>
        <td class="px-2 py-1.5 text-center">
            <button onclick="this.closest('tr').remove()" class="px-1.5 py-1 bg-error text-white text-xs rounded hover:bg-red-700 transition-colors">Remove</button>
        </td>
    `;
    document.getElementById('apiList').appendChild(tr);
}

function validateInputs() {
    const baseA = document.getElementById('baseA').value.trim();
    const baseB = document.getElementById('baseB').value.trim();
    if (!baseA || !baseB) {
        alert('Base URL for Server A and B must be entered');
        return false;
    }

    const apiRows = Array.from(document.querySelectorAll('#apiList > tr'));
    if (apiRows.length === 0) {
        alert('Must add at least 1 API');
        return false;
    }

    // Validate headers JSON
    try {
        const headersAText = document.getElementById('headersA').value.trim();
        if (headersAText) {
            JSON.parse(headersAText);
        }
    } catch (e) {
        alert('Invalid JSON format in Server A headers');
        return false;
    }
    
    try {
        const headersBText = document.getElementById('headersB').value.trim();
        if (headersBText) {
            JSON.parse(headersBText);
        }
    } catch (e) {
        alert('Invalid JSON format in Server B headers');
        return false;
    }

    const seen = new Set();
    for (const row of apiRows) {
        const method = row.children[0].querySelector('select').value.trim();
        const path = row.children[1].querySelector('input').value.trim();
        if (!method || !path) {
            alert('Each API must have Method and Path');
            return false;
        }
        const key = method + '|' + path;
        if (seen.has(key)) {
            alert(`Duplicate API: ${method} ${path}`);
            return false;
        }
        seen.add(key);
    }
    return true;
}

async function sendAll() {
    console.log('Starting to send requests...');
    if (!validateInputs()) return;

    const baseA = document.getElementById('baseA').value.trim();
    const baseB = document.getElementById('baseB').value.trim();
    
    // Save to history
    if (!historyUrlsA.includes(baseA)) {
        historyUrlsA.push(baseA);
        updateDatalist('baseUrlsA', historyUrlsA);
    }
    if (!historyUrlsB.includes(baseB)) {
        historyUrlsB.push(baseB);
        updateDatalist('baseUrlsB', historyUrlsB);
    }

    // Clear previous results
    document.getElementById('resultBody').innerHTML = '';
    resultMap.clear();
    responseStore.clear();

    // Parse headers from JSON
    let headersA = {};
    let headersB = {};
    
    try {
        const headersAText = document.getElementById('headersA').value.trim();
        if (headersAText) {
            headersA = JSON.parse(headersAText);
        }
    } catch (e) {
        alert('Invalid JSON in Server A headers');
        return;
    }
    
    try {
        const headersBText = document.getElementById('headersB').value.trim();
        if (headersBText) {
            headersB = JSON.parse(headersBText);
        }
    } catch (e) {
        alert('Invalid JSON in Server B headers');
        return;
    }

    const timeout = Number(document.getElementById('timeout').value) * 1000;
    
    // Lưu tất cả config trước khi gửi
    const requestConfigs = [];
    const globalStartTime = performance.now(); // Thời gian chung cho tất cả requests
    
    // Tạo config cho tất cả requests
    document.querySelectorAll('#apiList > tr').forEach(row => {
        const tds = row.children;
        const method = tds[0].querySelector('select').value;
        const path = tds[1].querySelector('input').value;
        const concurrency = Number(tds[2].querySelector('input').value);
        const bodyText = tds[3].querySelector('textarea').value.trim();
        const body = bodyText ? JSON.parse(bodyText) : null;
        const apiKey = row.dataset.apiId;

        console.log(`Adding API: ${method} ${path}, Concurrency: ${concurrency}`);

        for (let i = 1; i <= concurrency; i++) {
            // Server A config
            requestConfigs.push({
                apiKey,
                reqIndex: i,
                server: 'A',
                method,
                path,
                body,
                baseUrl: baseA,
                headers: { ...headersA },
                timeout,
                globalStartTime
            });
            
            // Server B config
            requestConfigs.push({
                apiKey,
                reqIndex: i,
                server: 'B',
                method,
                path,
                body,
                baseUrl: baseB,
                headers: { ...headersB },
                timeout,
                globalStartTime
            });
        }
    });

    // ===== GỬI TẤT CẢ REQUEST CÙNG LÚC =====
    const fetchPromises = requestConfigs.map(config => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout);

        // Build URL và body
        let url = config.baseUrl + config.path;
        let fetchBody;
        
        // Đảm bảo có Content-Type cho các method có body
        const headers = { ...config.headers };
        if (!headers['Content-Type'] && config.method !== 'GET' && config.body) {
            headers['Content-Type'] = 'application/json';
        }
        
        if (config.method === 'GET' && config.body) {
            url += '?' + new URLSearchParams(config.body).toString();
        } else if (config.body) {
            fetchBody = JSON.stringify(config.body);
        }

        // Generate cURL command
        const curlCmd = generateCurlCommand(url, config.method, headers, fetchBody, config.timeout / 1000);
        const requestTime = formatTimeMS(Date.now());

        // TẤT CẢ REQUEST ĐƯỢC TẠO CÙNG LÚC
        return fetch(url, {
            method: config.method,
            headers: headers,
            body: fetchBody,
            signal: controller.signal
        })
        .then(async response => {
            clearTimeout(timeoutId);
            const text = await response.text();
            const duration = Math.round(performance.now() - config.globalStartTime);
            
            return {
                status: response.status,
                duration: duration,
                response: text,
                server: config.server,
                curl: curlCmd,
                method: config.method,
                path: config.path,
                requestTime: requestTime,
                responseTime: formatTimeMS(Date.now()),
                headers: Object.fromEntries(response.headers.entries()),
                apiKey: config.apiKey,
                reqIndex: config.reqIndex
            };
        })
        .catch(error => {
            clearTimeout(timeoutId);
            const duration = Math.round(performance.now() - config.globalStartTime);
            let status = 'ERR';
            if (error.name === 'AbortError') {
                status = 'TIMEOUT';
            }
            
            return {
                status: status,
                duration: duration,
                response: error.message,
                server: config.server,
                curl: curlCmd,
                method: config.method,
                path: config.path,
                requestTime: requestTime,
                responseTime: formatTimeMS(Date.now()),
                headers: {},
                apiKey: config.apiKey,
                reqIndex: config.reqIndex
            };
        })
        .then(result => {
            // Store response
            const key = `${config.apiKey}-${config.path}-${config.reqIndex}-${config.server}`;
            responseStore.set(key, result);

            // Store in result map
            resultMap.set(`${config.apiKey}-${config.reqIndex}-${config.server}`, {
                ...result,
                endpoint: config.path
            });
            
            return result;
        });
    });

    // GỬI TẤT CẢ ĐỒNG THỜI
    console.log(`Sending ${fetchPromises.length} requests simultaneously...`);
    await Promise.allSettled(fetchPromises);
    
    console.log('All requests completed.');
    render();
    updateCompareViews();
    updateSummaryView();
}

function generateCurlCommand(url, method, headers, body, timeoutSeconds) {
    let curl = `curl -X ${method} "${url}" \\\n`;
    
    // Add timeout option
    curl += `  --max-time ${timeoutSeconds} \\\n`;
    
    // Add headers
    Object.entries(headers).forEach(([key, value]) => {
        if (key.toLowerCase() === 'content-type' && value === 'application/json' && method === 'GET') {
            // Skip Content-Type for GET requests
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

function addDefaultHeaders(textareaId) {
    const textarea = document.getElementById(textareaId);
    const defaultHeaders = {
        "Authorization": "Bearer your_token_here",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "PerformanceDiffAnalyzer/1.0"
    };
    
    try {
        const currentHeaders = textarea.value.trim();
        let mergedHeaders = defaultHeaders;
        
        if (currentHeaders) {
            const parsed = JSON.parse(currentHeaders);
            mergedHeaders = { ...defaultHeaders, ...parsed };
        }
        
        textarea.value = JSON.stringify(mergedHeaders, null, 2);
        showToast("Default headers added!");
    } catch (e) {
        // If invalid JSON, just set defaults
        textarea.value = JSON.stringify(defaultHeaders, null, 2);
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

function showToast(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.className = 'fixed bottom-3 right-3 bg-primary text-white px-3 py-2 rounded shadow z-50 text-xs';
    toast.style.animation = 'slideInUp 0.3s ease-out';
    
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

function render() {
    const results = Array.from(resultMap.values());
    const tbody = document.getElementById('resultBody');
    tbody.innerHTML = '';

    if (results.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="px-2 py-8 text-center text-gray-500">
                    No test results yet. Click "SEND ALL REQUESTS" to start testing.
                </td>
            </tr>
        `;
        return;
    }

    results
        .sort((a, b) => a.apiKey - b.apiKey || a.reqIndex - b.reqIndex || a.server.localeCompare(b.server))
        .forEach(r => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50';

            let statusClass = 'bg-gray-100 text-gray-800';
            if (r.status === 'ERR' || r.status === 'TIMEOUT') {
                statusClass = 'bg-red-100 text-red-800';
            } else if (r.status >= 200 && r.status < 300) {
                statusClass = 'bg-green-100 text-green-800';
            } else if (r.status >= 400 && r.status < 500) {
                statusClass = 'bg-yellow-100 text-yellow-800';
            } else if (r.status >= 500) {
                statusClass = 'bg-red-100 text-red-800';
            }

            tr.innerHTML = `
                <td class="px-2 py-1.5">${r.method}</td>
                <td class="px-2 py-1.5 font-mono text-xs">${r.path}</td>
                <td class="px-2 py-1.5 text-center">${r.reqIndex}</td>
                <td class="px-2 py-1.5">
                    <span class="inline-block px-2 py-0.5 text-2xs font-medium rounded-full ${r.server === 'A' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}">
                        Server ${r.server}
                    </span>
                </td>
                <td class="px-2 py-1.5 text-2xs">${r.requestTime}</td>
                <td class="px-2 py-1.5 text-2xs">${r.responseTime}</td>
                <td class="px-2 py-1.5">${r.duration}ms</td>
                <td class="px-2 py-1.5">
                    <span class="inline-block px-1.5 py-0.5 text-2xs font-medium rounded-full ${statusClass}">
                        ${r.status}
                    </span>
                </td>
                <td class="px-2 py-1.5">
                    <div class="flex gap-1">
                        <button class="px-1.5 py-0.5 bg-blue-50 border border-blue-200 rounded text-2xs text-blue-700 hover:bg-blue-100 transition-colors view-curl">cURL</button>
                        <button class="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-2xs text-gray-700 hover:bg-gray-200 transition-colors view-response">View</button>
                        <button onclick="openDetailedCompare(${r.apiKey}, '${r.path}', ${r.reqIndex})" class="px-1.5 py-0.5 bg-purple-50 border border-purple-200 rounded text-2xs text-purple-700 hover:bg-purple-100 transition-colors">Compare</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);

            tr.querySelector('.view-curl').addEventListener('click', () => openModal('curl', r.curl));
            tr.querySelector('.view-response').addEventListener('click', () => openModal('response', r.response));
        });
}

// COMPARE VIEW FUNCTIONS
function toggleView(viewType) {
    // Reset all button styles
    document.getElementById('viewTableBtn').className = 'px-3 py-1.5 bg-gray-200 text-gray-800 font-medium rounded text-xs hover:bg-gray-300 transition-colors view-toggle';
    document.getElementById('viewCompareBtn').className = 'px-3 py-1.5 bg-gray-200 text-gray-800 font-medium rounded text-xs hover:bg-gray-300 transition-colors view-toggle';
    document.getElementById('viewSummaryBtn').className = 'px-3 py-1.5 bg-gray-200 text-gray-800 font-medium rounded text-xs hover:bg-gray-300 transition-colors view-toggle';

    // Hide all views
    document.getElementById('tableView').classList.add('hidden');
    document.getElementById('compareView').classList.add('hidden');
    document.getElementById('summaryView').classList.add('hidden');

    // Show selected view and update button
    if (viewType === 'table') {
        document.getElementById('tableView').classList.remove('hidden');
        document.getElementById('viewTableBtn').className = 'px-3 py-1.5 bg-primary text-white font-medium rounded text-xs hover:bg-primary-dark transition-colors view-toggle active';
    } else if (viewType === 'compare') {
        document.getElementById('compareView').classList.remove('hidden');
        document.getElementById('viewCompareBtn').className = 'px-3 py-1.5 bg-primary text-white font-medium rounded text-xs hover:bg-primary-dark transition-colors view-toggle active';
        updateCompareViews();
    } else if (viewType === 'summary') {
        document.getElementById('summaryView').classList.remove('hidden');
        document.getElementById('viewSummaryBtn').className = 'px-3 py-1.5 bg-primary text-white font-medium rounded text-xs hover:bg-primary-dark transition-colors view-toggle active';
        updateSummaryView();
    }
}

function switchCompareTab(tabName) {
    // Reset all tabs
    document.getElementById('perfTab').className = 'px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800';
    document.getElementById('relTab').className = 'px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800';
    document.getElementById('consTab').className = 'px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800';
    document.getElementById('heatTab').className = 'px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800';
    document.getElementById('timeTab').className = 'px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800';

    // Hide all tabs
    document.querySelectorAll('.compare-tab').forEach(tab => {
        tab.classList.add('hidden');
    });

    // Show selected tab and update tab style
    document.getElementById(`${tabName}Tab`).classList.remove('hidden');
    document.getElementById(`${tabName.slice(0, 4)}Tab`).className = 'px-4 py-2 text-sm font-medium tab-active';
}

function updateCompareViews() {
    const results = Array.from(resultMap.values());
    if (results.length === 0) return;

    // Calculate statistics
    const serverAResults = results.filter(r => r.server === 'A');
    const serverBResults = results.filter(r => r.server === 'B');

    // Performance calculations
    const aStats = calculateStats(serverAResults);
    const bStats = calculateStats(serverBResults);

    updatePerformanceTab(aStats, bStats);
    updateReliabilityTab(aStats, bStats);
    updateHeatMapTab(results);
    updateTimelineTab(results);
}

function calculateStats(results) {
    if (results.length === 0) return {};

    const durations = results.map(r => r.duration).filter(d => !isNaN(d));
    const successCount = results.filter(r => r.status >= 200 && r.status < 300).length;
    const errorCount = results.filter(r => r.status === 'ERR' || r.status === 'TIMEOUT' || r.status >= 400).length;

    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const minDuration = durations.length > 0 ? Math.min(...durations) : 0;
    const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;

    // Calculate percentiles
    const sortedDurations = [...durations].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedDurations.length * 0.95);
    const p95 = sortedDurations.length > 0 ? sortedDurations[p95Index] : 0;

    // Group by endpoint
    const endpointStats = {};
    results.forEach(r => {
        if (!endpointStats[r.path]) {
            endpointStats[r.path] = { durations: [], successes: 0, total: 0 };
        }
        endpointStats[r.path].durations.push(r.duration);
        endpointStats[r.path].total++;
        if (r.status >= 200 && r.status < 300) {
            endpointStats[r.path].successes++;
        }
    });

    return {
        total: results.length,
        successCount,
        errorCount,
        successRate: results.length > 0 ? (successCount / results.length * 100).toFixed(1) : '0.0',
        avgDuration: Math.round(avgDuration),
        minDuration,
        maxDuration,
        p95: Math.round(p95),
        endpointStats
    };
}

function updatePerformanceTab(aStats, bStats) {
    // Update server stats
    document.getElementById('serverAStats').innerHTML = `
        <div class="flex justify-between">
            <span>Total Requests:</span>
            <span class="font-medium">${aStats.total || 0}</span>
        </div>
        <div class="flex justify-between">
            <span>Avg Response Time:</span>
            <span class="font-medium">${aStats.avgDuration || 0}ms</span>
        </div>
        <div class="flex justify-between">
            <span>Min/Max Time:</span>
            <span class="font-medium">${aStats.minDuration || 0}ms / ${aStats.maxDuration || 0}ms</span>
        </div>
        <div class="flex justify-between">
            <span>95th Percentile:</span>
            <span class="font-medium">${aStats.p95 || 0}ms</span>
        </div>
        <div class="flex justify-between">
            <span>Success Rate:</span>
            <span class="font-medium">${aStats.successRate || 0}%</span>
        </div>
    `;

    document.getElementById('serverBStats').innerHTML = `
        <div class="flex justify-between">
            <span>Total Requests:</span>
            <span class="font-medium">${bStats.total || 0}</span>
        </div>
        <div class="flex justify-between">
            <span>Avg Response Time:</span>
            <span class="font-medium">${bStats.avgDuration || 0}ms</span>
        </div>
        <div class="flex justify-between">
            <span>Min/Max Time:</span>
            <span class="font-medium">${bStats.minDuration || 0}ms / ${bStats.maxDuration || 0}ms</span>
        </div>
        <div class="flex justify-between">
            <span>95th Percentile:</span>
            <span class="font-medium">${bStats.p95 || 0}ms</span>
        </div>
        <div class="flex justify-between">
            <span>Success Rate:</span>
            <span class="font-medium">${bStats.successRate || 0}%</span>
        </div>
    `;

    // Update comparison table
    const comparisonTable = document.getElementById('comparisonTable');
    comparisonTable.innerHTML = `
        <tr>
            <td class="px-3 py-2">Average Response Time</td>
            <td class="px-3 py-2">${aStats.avgDuration || 0}ms</td>
            <td class="px-3 py-2">${bStats.avgDuration || 0}ms</td>
            <td class="px-3 py-2 ${getDiffClass(aStats.avgDuration, bStats.avgDuration)}">
                ${getDifference(aStats.avgDuration, bStats.avgDuration, 'ms')}
            </td>
            <td class="px-3 py-2">${getWinner(aStats.avgDuration, bStats.avgDuration, 'lower')}</td>
        </tr>
        <tr>
            <td class="px-3 py-2">95th Percentile</td>
            <td class="px-3 py-2">${aStats.p95 || 0}ms</td>
            <td class="px-3 py-2">${bStats.p95 || 0}ms</td>
            <td class="px-3 py-2 ${getDiffClass(aStats.p95, bStats.p95)}">
                ${getDifference(aStats.p95, bStats.p95, 'ms')}
            </td>
            <td class="px-3 py-2">${getWinner(aStats.p95, bStats.p95, 'lower')}</td>
        </tr>
        <tr>
            <td class="px-3 py-2">Success Rate</td>
            <td class="px-3 py-2">${aStats.successRate || 0}%</td>
            <td class="px-3 py-2">${bStats.successRate || 0}%</td>
            <td class="px-3 py-2 ${getDiffClass(parseFloat(aStats.successRate), parseFloat(bStats.successRate), 'higher')}">
                ${getDifference(parseFloat(aStats.successRate), parseFloat(bStats.successRate), '%', true)}
            </td>
            <td class="px-3 py-2">${getWinner(parseFloat(aStats.successRate), parseFloat(bStats.successRate), 'higher')}</td>
        </tr>
        <tr>
            <td class="px-3 py-2">Error Count</td>
            <td class="px-3 py-2">${aStats.errorCount || 0}</td>
            <td class="px-3 py-2">${bStats.errorCount || 0}</td>
            <td class="px-3 py-2 ${getDiffClass(aStats.errorCount, bStats.errorCount, 'lower')}">
                ${getDifference(aStats.errorCount, bStats.errorCount, 'errors', false, true)}
            </td>
            <td class="px-3 py-2">${getWinner(aStats.errorCount, bStats.errorCount, 'lower')}</td>
        </tr>
    `;

    // Update response time chart
    const maxTime = Math.max(aStats.avgDuration || 0, bStats.avgDuration || 0, 100);
    const aWidth = ((aStats.avgDuration || 0) / maxTime * 100).toFixed(1);
    const bWidth = ((bStats.avgDuration || 0) / maxTime * 100).toFixed(1);

    document.getElementById('responseTimeChart').innerHTML = `
        <div>
            <div class="flex justify-between text-xs mb-1">
                <span>Server A: ${aStats.avgDuration || 0}ms</span>
                <span>${aWidth}%</span>
            </div>
            <div class="h-4 bg-gray-200 rounded overflow-hidden">
                <div class="h-full bg-blue-500 progress-bar" style="--target-width: ${aWidth}%"></div>
            </div>
        </div>
        <div>
            <div class="flex justify-between text-xs mb-1">
                <span>Server B: ${bStats.avgDuration || 0}ms</span>
                <span>${bWidth}%</span>
            </div>
            <div class="h-4 bg-gray-200 rounded overflow-hidden">
                <div class="h-full bg-purple-500 progress-bar" style="--target-width: ${bWidth}%"></div>
            </div>
        </div>
    `;

    // Update performance summary
    const winner = getOverallWinner(aStats, bStats);
    document.getElementById('performanceSummary').innerHTML = `
        <div class="mb-2">
            <span class="font-medium">Overall Performance Winner:</span>
            <span class="ml-2 px-2 py-1 ${winner === 'Server A' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'} rounded">
                ${winner}
            </span>
        </div>
        <div class="text-sm">
            ${getPerformanceInsights(aStats, bStats)}
        </div>
    `;
}

function getDiffClass(a, b, better = 'lower') {
    if (a === b) return '';
    const isABetter = better === 'lower' ? a < b : a > b;
    return isABetter ? 'text-green-600 font-medium' : 'text-red-600 font-medium';
}

function getDifference(a, b, unit = '', isPercentage = false, inverse = false) {
    if (a === b) return '0' + unit;
    const diff = a - b;
    const absDiff = Math.abs(diff);
    const percent = b !== 0 ? ((absDiff / b) * 100).toFixed(1) : '∞';

    let sign = diff > 0 ? '+' : '-';
    if (inverse) sign = diff > 0 ? '-' : '+';

    if (isPercentage) {
        return `${sign}${absDiff.toFixed(1)}% (${sign}${percent}%)`;
    }
    return `${sign}${absDiff}${unit} (${sign}${percent}%)`;
}

function getWinner(a, b, better = 'lower') {
    if (a === b) return 'Tie';
    const isABetter = better === 'lower' ? a < b : a > b;
    return isABetter ? 'Server A' : 'Server B';
}

function getOverallWinner(aStats, bStats) {
    // Simple scoring system
    let aScore = 0;
    let bScore = 0;

    // Compare response time (lower is better)
    if (aStats.avgDuration < bStats.avgDuration) aScore += 2;
    else if (bStats.avgDuration < aStats.avgDuration) bScore += 2;

    // Compare success rate (higher is better)
    if (parseFloat(aStats.successRate) > parseFloat(bStats.successRate)) aScore += 3;
    else if (parseFloat(bStats.successRate) > parseFloat(aStats.successRate)) bScore += 3;

    // Compare error count (lower is better)
    if (aStats.errorCount < bStats.errorCount) aScore += 1;
    else if (bStats.errorCount < aStats.errorCount) bScore += 1;

    return aScore > bScore ? 'Server A' : aScore < bScore ? 'Server B' : 'Tie';
}

function getPerformanceInsights(aStats, bStats) {
    const insights = [];

    if (aStats.avgDuration < bStats.avgDuration) {
        const improvement = ((bStats.avgDuration - aStats.avgDuration) / bStats.avgDuration * 100).toFixed(1);
        insights.push(`• Server A is <span class="text-green-600 font-medium">${improvement}% faster</span> on average`);
    } else if (bStats.avgDuration < aStats.avgDuration) {
        const improvement = ((aStats.avgDuration - bStats.avgDuration) / aStats.avgDuration * 100).toFixed(1);
        insights.push(`• Server B is <span class="text-purple-600 font-medium">${improvement}% faster</span> on average`);
    }

    if (parseFloat(aStats.successRate) > parseFloat(bStats.successRate)) {
        const diff = (parseFloat(aStats.successRate) - parseFloat(bStats.successRate)).toFixed(1);
        insights.push(`• Server A has <span class="text-green-600 font-medium">${diff}% higher</span> success rate`);
    } else if (parseFloat(bStats.successRate) > parseFloat(aStats.successRate)) {
        const diff = (parseFloat(bStats.successRate) - parseFloat(aStats.successRate)).toFixed(1);
        insights.push(`• Server B has <span class="text-purple-600 font-medium">${diff}% higher</span> success rate`);
    }

    if (insights.length === 0) {
        insights.push('• Both servers show similar performance');
    }

    return insights.join('<br>');
}

function updateReliabilityTab(aStats, bStats) {
    // Success rate comparison
    const maxRate = Math.max(parseFloat(aStats.successRate || 0), parseFloat(bStats.successRate || 0), 1);
    const aRateWidth = (parseFloat(aStats.successRate || 0) / maxRate * 100).toFixed(1);
    const bRateWidth = (parseFloat(bStats.successRate || 0) / maxRate * 100).toFixed(1);

    document.getElementById('successRateChart').innerHTML = `
        <div>
            <div class="flex justify-between text-xs mb-1">
                <span>Server A Success Rate: ${aStats.successRate || 0}%</span>
                <span>${aStats.successCount || 0}/${aStats.total || 0} requests</span>
            </div>
            <div class="h-4 bg-gray-200 rounded overflow-hidden">
                <div class="h-full ${parseFloat(aStats.successRate || 0) >= 95 ? 'bg-green-500' : parseFloat(aStats.successRate || 0) >= 80 ? 'bg-yellow-500' : 'bg-red-500'} progress-bar" style="--target-width: ${aRateWidth}%"></div>
            </div>
        </div>
        <div>
            <div class="flex justify-between text-xs mb-1">
                <span>Server B Success Rate: ${bStats.successRate || 0}%</span>
                <span>${bStats.successCount || 0}/${bStats.total || 0} requests</span>
            </div>
            <div class="h-4 bg-gray-200 rounded overflow-hidden">
                <div class="h-full ${parseFloat(bStats.successRate || 0) >= 95 ? 'bg-green-500' : parseFloat(bStats.successRate || 0) >= 80 ? 'bg-yellow-500' : 'bg-red-500'} progress-bar" style="--target-width: ${bRateWidth}%"></div>
            </div>
        </div>
    `;

    // Error analysis
    const errorAnalysis = [];

    if (aStats.errorCount > 0) {
        errorAnalysis.push(`<div class="text-red-600">
            <span class="font-medium">Server A:</span> ${aStats.errorCount} errors (${((aStats.errorCount / aStats.total) * 100).toFixed(1)}% failure rate)
        </div>`);
    } else {
        errorAnalysis.push(`<div class="text-green-600">
            <span class="font-medium">Server A:</span> No errors detected
        </div>`);
    }

    if (bStats.errorCount > 0) {
        errorAnalysis.push(`<div class="text-red-600">
            <span class="font-medium">Server B:</span> ${bStats.errorCount} errors (${((bStats.errorCount / bStats.total) * 100).toFixed(1)}% failure rate)
        </div>`);
    } else {
        errorAnalysis.push(`<div class="text-green-600">
            <span class="font-medium">Server B:</span> No errors detected
        </div>`);
    }

    // Reliability recommendation
    let recommendation = '';
    if (parseFloat(aStats.successRate) > parseFloat(bStats.successRate)) {
        recommendation = `<div class="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
            <span class="font-medium">Recommendation:</span> Server A is more reliable with ${aStats.successRate}% success rate vs ${bStats.successRate}%
        </div>`;
    } else if (parseFloat(bStats.successRate) > parseFloat(aStats.successRate)) {
        recommendation = `<div class="mt-2 p-2 bg-purple-50 border border-purple-200 rounded">
            <span class="font-medium">Recommendation:</span> Server B is more reliable with ${bStats.successRate}% success rate vs ${aStats.successRate}%
        </div>`;
    } else {
        recommendation = `<div class="mt-2 p-2 bg-gray-50 border border-gray-200 rounded">
            <span class="font-medium">Note:</span> Both servers have similar reliability
        </div>`;
    }

    document.getElementById('errorAnalysis').innerHTML = errorAnalysis.join('') + recommendation;
}

function updateHeatMapTab(results) {
    // Group by endpoint
    const endpointMap = {};
    results.forEach(r => {
        if (!endpointMap[r.path]) {
            endpointMap[r.path] = { A: [], B: [] };
        }
        endpointMap[r.path][r.server].push(r.duration);
    });

    let heatMapHTML = `
        <table class="w-full text-xs border-collapse">
            <thead class="bg-gray-100">
                <tr>
                    <th class="px-3 py-2 text-left font-medium">Endpoint</th>
                    <th class="px-3 py-2 text-left font-medium">Server A Avg</th>
                    <th class="px-3 py-2 text-left font-medium">Server B Avg</th>
                    <th class="px-3 py-2 text-left font-medium">Performance</th>
                    <th class="px-3 py-2 text-left font-medium">Winner</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
    `;

    Object.entries(endpointMap).forEach(([endpoint, data]) => {
        const aAvg = data.A.length > 0 ? Math.round(data.A.reduce((a, b) => a + b, 0) / data.A.length) : 0;
        const bAvg = data.B.length > 0 ? Math.round(data.B.reduce((a, b) => a + b, 0) / data.B.length) : 0;

        const getHeatClass = (time) => {
            if (time < 200) return 'heat-excellent';
            if (time < 500) return 'heat-good';
            return 'heat-poor';
        };

        const getPerformance = (a, b) => {
            if (a === 0 || b === 0) return 'N/A';
            const diff = ((a - b) / b * 100).toFixed(1);
            return a < b ? `${Math.abs(diff)}% faster` : a > b ? `${diff}% slower` : 'Same';
        };

        heatMapHTML += `
            <tr>
                <td class="px-3 py-2 font-mono">${endpoint}</td>
                <td class="px-3 py-2">
                    <span class="px-2 py-1 rounded ${getHeatClass(aAvg)}">${aAvg}ms</span>
                </td>
                <td class="px-3 py-2">
                    <span class="px-2 py-1 rounded ${getHeatClass(bAvg)}">${bAvg}ms</span>
                </td>
                <td class="px-3 py-2">${getPerformance(aAvg, bAvg)}</td>
                <td class="px-3 py-2 font-medium">
                    ${aAvg === 0 || bAvg === 0 ? '-' : aAvg < bAvg ? 'Server A' : aAvg > bAvg ? 'Server B' : 'Tie'}
                </td>
            </tr>
        `;
    });

    heatMapHTML += `</tbody></table>`;
    document.getElementById('heatMapContent').innerHTML = heatMapHTML;
}

function updateTimelineTab(results) {
    // Sort by time
    const sortedResults = [...results].sort((a, b) => {
        return new Date(`1970/01/01 ${a.requestTime}`) - new Date(`1970/01/01 ${b.requestTime}`);
    });

    let timelineHTML = '';

    // Group by minute
    const timeGroups = {};
    sortedResults.forEach(r => {
        const minute = r.requestTime.substring(0, 5); // HH:MM
        if (!timeGroups[minute]) {
            timeGroups[minute] = { A: { success: 0, total: 0 }, B: { success: 0, total: 0 } };
        }
        timeGroups[minute][r.server].total++;
        if (r.status >= 200 && r.status < 300) {
            timeGroups[minute][r.server].success++;
        }
    });

    Object.entries(timeGroups).forEach(([time, data]) => {
        const aRate = data.A.total > 0 ? Math.round((data.A.success / data.A.total) * 100) : 0;
        const bRate = data.B.total > 0 ? Math.round((data.B.success / data.B.total) * 100) : 0;

        timelineHTML += `
            <div class="border rounded p-2">
                <div class="font-medium mb-2">${time}:00 - ${time}:59</div>
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <div class="text-xs text-blue-600 mb-1">Server A: ${aRate}% success</div>
                        <div class="h-2 bg-gray-200 rounded overflow-hidden">
                            <div class="h-full bg-blue-500" style="width: ${aRate}%"></div>
                        </div>
                    </div>
                    <div>
                        <div class="text-xs text-purple-600 mb-1">Server B: ${bRate}% success</div>
                        <div class="h-2 bg-gray-200 rounded overflow-hidden">
                            <div class="h-full bg-purple-500" style="width: ${bRate}%"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    document.getElementById('timelineComparison').innerHTML = timelineHTML || '<div class="text-gray-500 text-center py-4">No timeline data available</div>';
}

function updateSummaryView() {
    const results = Array.from(resultMap.values());
    if (results.length === 0) return;

    const serverAResults = results.filter(r => r.server === 'A');
    const serverBResults = results.filter(r => r.server === 'B');

    const aStats = calculateStats(serverAResults);
    const bStats = calculateStats(serverBResults);

    // Update summary metrics
    document.getElementById('summaryTotalRequests').textContent = results.length;
    const overallSuccessRate = results.length > 0 ? ((aStats.successCount + bStats.successCount) / results.length * 100).toFixed(1) : '0.0';
    document.getElementById('summarySuccessRate').textContent = `${overallSuccessRate}%`;

    const overallWinner = getOverallWinner(aStats, bStats);
    document.getElementById('summaryWinner').textContent = overallWinner;
    document.getElementById('summaryWinner').className = `text-2xl font-bold mb-1 ${overallWinner === 'Server A' ? 'text-blue-600' : overallWinner === 'Server B' ? 'text-purple-600' : 'text-gray-600'}`;

    // Update winner analysis
    let winnerHTML = '';
    if (overallWinner === 'Server A') {
        winnerHTML = `
            <div class="text-green-600">✓ Server A is the overall winner</div>
            <div class="ml-4 mt-1">
                <div>• Faster by ${((bStats.avgDuration - aStats.avgDuration) / bStats.avgDuration * 100).toFixed(1)}% on average</div>
                <div>• Higher success rate by ${(parseFloat(aStats.successRate) - parseFloat(bStats.successRate)).toFixed(1)}%</div>
                <div>• ${aStats.errorCount < bStats.errorCount ? 'Fewer errors' : 'Same error count'}</div>
            </div>
        `;
    } else if (overallWinner === 'Server B') {
        winnerHTML = `
            <div class="text-purple-600">✓ Server B is the overall winner</div>
            <div class="ml-4 mt-1">
                <div>• Faster by ${((aStats.avgDuration - bStats.avgDuration) / aStats.avgDuration * 100).toFixed(1)}% on average</div>
                <div>• Higher success rate by ${(parseFloat(bStats.successRate) - parseFloat(aStats.successRate)).toFixed(1)}%</div>
                <div>• ${bStats.errorCount < aStats.errorCount ? 'Fewer errors' : 'Same error count'}</div>
            </div>
        `;
    } else {
        winnerHTML = `
            <div class="text-gray-600">• Both servers perform similarly</div>
            <div class="ml-4 mt-1">
                <div>• Response times are within 5% of each other</div>
                <div>• Success rates are nearly identical</div>
                <div>• Consider other factors for selection</div>
            </div>
        `;
    }

    document.getElementById('winnerAnalysis').innerHTML = winnerHTML;

    // Update issues found
    const issues = [];
    if (parseFloat(aStats.successRate) < 95) {
        issues.push(`<div class="text-red-600">• Server A success rate is below 95% (${aStats.successRate}%)</div>`);
    }
    if (parseFloat(bStats.successRate) < 95) {
        issues.push(`<div class="text-red-600">• Server B success rate is below 95% (${bStats.successRate}%)</div>`);
    }
    if (aStats.avgDuration > 1000) {
        issues.push(`<div class="text-yellow-600">• Server A average response time is high (${aStats.avgDuration}ms)</div>`);
    }
    if (bStats.avgDuration > 1000) {
        issues.push(`<div class="text-yellow-600">• Server B average response time is high (${bStats.avgDuration}ms)</div>`);
    }

    document.getElementById('issuesFound').innerHTML = issues.join('') || '<div class="text-green-600">✓ No major issues detected</div>';

    // Update performance insights
    document.getElementById('performanceInsights').innerHTML = getPerformanceInsights(aStats, bStats);
}

function openDetailedCompare(apiKey, path, reqIndex) {
    const aKey = `${apiKey}-${path}-${reqIndex}-A`;
    const bKey = `${apiKey}-${path}-${reqIndex}-B`;

    const aResult = responseStore.get(aKey);
    const bResult = responseStore.get(bKey);

    if (!aResult || !bResult) {
        alert('Comparison data not available for this request');
        return;
    }

    let comparisonHTML = `
        <div class="grid grid-cols-2 gap-4">
            <div class="border rounded p-3">
                <h4 class="font-semibold text-blue-700 mb-3">Server A Response</h4>
                <div class="space-y-2 mb-3">
                    <div><span class="font-medium">Status:</span> ${aResult.status}</div>
                    <div><span class="font-medium">Duration:</span> ${aResult.duration}ms</div>
                    <div><span class="font-medium">Time:</span> ${aResult.requestTime} → ${aResult.responseTime}</div>
                </div>
                <pre class="bg-gray-50 p-2 rounded text-xs max-h-60 overflow-auto">${formatResponse(aResult.response)}</pre>
            </div>
            
            <div class="border rounded p-3">
                <h4 class="font-semibold text-purple-700 mb-3">Server B Response</h4>
                <div class="space-y-2 mb-3">
                    <div><span class="font-medium">Status:</span> ${bResult.status}</div>
                    <div><span class="font-medium">Duration:</span> ${bResult.duration}ms</div>
                    <div><span class="font-medium">Time:</span> ${bResult.requestTime} → ${bResult.responseTime}</div>
                </div>
                <pre class="bg-gray-50 p-2 rounded text-xs max-h-60 overflow-auto">${formatResponse(bResult.response)}</pre>
            </div>
        </div>
        
        <div class="mt-4 border-t pt-4">
            <h4 class="font-semibold mb-2">Comparison Analysis</h4>
            <div class="space-y-2">
                ${getComparisonAnalysis(aResult, bResult)}
            </div>
        </div>
    `;

    document.getElementById('modalCompareContent').innerHTML = comparisonHTML;
    document.getElementById('modalCompare').classList.remove('hidden');
}

function formatResponse(response) {
    try {
        const parsed = JSON.parse(response);
        return JSON.stringify(parsed, null, 2);
    } catch {
        return response;
    }
}

function getComparisonAnalysis(a, b) {
    const analysis = [];

    // Status comparison
    if (a.status === b.status) {
        analysis.push(`<div class="text-green-600">✓ Both servers returned same status code: ${a.status}</div>`);
    } else {
        analysis.push(`<div class="text-red-600">✗ Status codes differ: Server A=${a.status}, Server B=${b.status}</div>`);
    }

    // Duration comparison
    if (Math.abs(a.duration - b.duration) < 50) {
        analysis.push(`<div class="text-green-600">✓ Response times are similar (${a.duration}ms vs ${b.duration}ms)</div>`);
    } else if (a.duration < b.duration) {
        const diff = ((b.duration - a.duration) / b.duration * 100).toFixed(1);
        analysis.push(`<div class="text-blue-600">→ Server A is ${diff}% faster (${a.duration}ms vs ${b.duration}ms)</div>`);
    } else {
        const diff = ((a.duration - b.duration) / a.duration * 100).toFixed(1);
        analysis.push(`<div class="text-purple-600">→ Server B is ${diff}% faster (${b.duration}ms vs ${a.duration}ms)</div>`);
    }

    // Response content comparison (simple)
    try {
        const aJson = JSON.parse(a.response);
        const bJson = JSON.parse(b.response);

        if (JSON.stringify(aJson) === JSON.stringify(bJson)) {
            analysis.push(`<div class="text-green-600">✓ Response bodies are identical</div>`);
        } else {
            analysis.push(`<div class="text-yellow-600">⚠ Response bodies differ in content</div>`);
        }
    } catch {
        analysis.push(`<div class="text-gray-600">• Response bodies cannot be compared as JSON</div>`);
    }

    return analysis.join('');
}

function openModal(type, content) {
    if (type === 'curl') {
        document.getElementById('modalCurlContent').textContent = content;
        document.getElementById('modalCurl').classList.remove('hidden');
    } else {
        let displayContent = content;
        try {
            if (content && typeof content === 'string') {
                const parsed = JSON.parse(content);
                displayContent = JSON.stringify(parsed, null, 2);
            }
        } catch (e) { }
        document.getElementById('modalResponseContent').textContent = displayContent;
        document.getElementById('modalResponse').classList.remove('hidden');
    }
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

function updateDatalist(id, values) {
    const data = document.getElementById(id);
    data.innerHTML = '';
    values.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v;
        data.appendChild(opt);
    });
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
}

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target.id === 'modalCurl') closeModal('modalCurl');
    if (e.target.id === 'modalResponse') closeModal('modalResponse');
    if (e.target.id === 'modalCompare') closeModal('modalCompare');
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal('modalCurl');
        closeModal('modalResponse');
        closeModal('modalCompare');
    }
});

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);