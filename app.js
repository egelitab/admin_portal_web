document.addEventListener('DOMContentLoaded', () => {
    // 0. Authentication Logic
    const API_BASE_URL = 'http://localhost:5000/api';
    const loginOverlay = document.getElementById('login-overlay');
    const loginForm = document.getElementById('admin-login-form');
    const loginError = document.getElementById('login-error');

    function checkAuth() {
        const token = localStorage.getItem('token');
        if (!token) {
            loginOverlay.classList.add('show');
            return false;
        }
        loginOverlay.classList.remove('show');
        return true;
    }

    // Helper for authorized fetches
    async function authFetch(url, options = {}) {
        const token = localStorage.getItem('token');
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };

        const response = await fetch(url, { ...options, headers });
        if (response.status === 401) {
            localStorage.removeItem('token');
            checkAuth();
            throw new Error('Unauthorized');
        }
        return response;
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            try {
                const response = await fetch(`${API_BASE_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const result = await response.json();
                if (result.success) {
                    if (result.user.role !== 'admin') {
                        loginError.textContent = 'Access restricted to administrators only.';
                        loginError.style.display = 'block';
                        return;
                    }
                    localStorage.setItem('token', result.accessToken);
                    localStorage.setItem('adminUser', JSON.stringify(result.user));
                    loginOverlay.classList.remove('show');
                    // Refresh data
                    initDashboard();
                } else {
                    loginError.textContent = result.message || 'Invalid email or password';
                    loginError.style.display = 'block';
                }
            } catch (error) {
                loginError.textContent = 'Server connection error';
                loginError.style.display = 'block';
            }
        });
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('adminUser');
            window.location.reload();
        });
    }

    // Initial check
    if (!checkAuth()) {
        // Stop execution of other things if not logged in? 
        // Or just let them fail and show overlay
    }

    function initDashboard() {
        fetchUsers();
        fetchDepartments();
        fetchFaculties();
        fetchInstitutions();
        updateDashboardStats();
        fetchLogs();
    }

    // (Moved init call to the bottom of the script)

    // 1. Navigation Logic
    const navItems = document.querySelectorAll('.nav-item');
    const viewSections = document.querySelectorAll('.view-section');
    const headerTitle = document.getElementById('section-title');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            if (item.id === 'logout-btn') return;

            // Handle dropdown toggle
            if (item.classList.contains('dropdown-toggle')) {
                const group = item.closest('.nav-group');
                if (group) {
                    group.classList.toggle('expanded');
                }
                return;
            }

            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            const target = item.getAttribute('data-target');
            if (target) {
                viewSections.forEach(v => v.classList.remove('active'));
                const targetSection = document.getElementById(target);
                if (targetSection) {
                    targetSection.classList.add('active');
                }

                // Update Header Title
                const span = item.querySelector('span:not(.material-symbols-outlined)');
                if (span) {
                    headerTitle.textContent = span.textContent;
                }

                const createUserBtn = document.getElementById('open-create-user-modal');
                if (createUserBtn) {
                    createUserBtn.style.display = target === 'users' ? 'flex' : 'none';
                }
            }
        });
    });

    // Schedule Modal Logic
    const scheduleModal = document.getElementById('upload-schedule-modal');
    const openScheduleModalBtn = document.getElementById('open-upload-schedule-modal');
    const closeScheduleModalBtns = document.querySelectorAll('.close-schedule-modal, .close-schedule-modal-btn');

    if (openScheduleModalBtn) {
        openScheduleModalBtn.addEventListener('click', () => {
            if (scheduleModal) scheduleModal.classList.add('show');
            populateScheduleDropdowns();
        });
    }

    closeScheduleModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (scheduleModal) scheduleModal.classList.remove('show');
        });
    });

    window.addEventListener('click', (e) => {
        if (scheduleModal && e.target === scheduleModal) {
            scheduleModal.classList.remove('show');
        }
    });

    const uploadScheduleForm = document.getElementById('upload-schedule-form');
    if (uploadScheduleForm) {
        uploadScheduleForm.addEventListener('submit', (e) => {
            e.preventDefault();
            alert('Schedule uploaded successfully!');
            if (scheduleModal) scheduleModal.classList.remove('show');
            uploadScheduleForm.reset();
            const fileNameDisplay = document.getElementById('schedule-file-name');
            if (fileNameDisplay) {
                fileNameDisplay.textContent = 'Supports Excel and Word Documents';
                fileNameDisplay.style.color = 'var(--text-muted)';
            }
        });
    }

    // 2. Dashboard Stats Updater
    async function updateDashboardStats() {
        try {
            const response = await authFetch(`${API_BASE_URL}/system/stats`);
            const result = await response.json();
            if (result.success) {
                const stats = result.data;
                const statValues = document.querySelectorAll('.stat-value');
                if (statValues.length >= 4) {
                    statValues[0].textContent = stats.totalUsers.toLocaleString();
                    statValues[1].textContent = stats.activeSessions;
                }

                // Update specific elements by ID if they exist
                const totalUsersEl = document.querySelector('.stats-grid .stat-card:nth-child(1) .stat-value');
                if (totalUsersEl) totalUsersEl.textContent = stats.totalUsers.toLocaleString();

                const activeSessionsEl = document.querySelector('.stats-grid .stat-card:nth-child(2) .stat-value');
                if (activeSessionsEl) activeSessionsEl.innerHTML = `${stats.activeSessions} <span style="font-size: 0.8rem; font-weight: normal; color: var(--text-muted);">users online now</span>`;

                // Update storage usage
                updateDiskStorage(stats.storage);

                // Update Sector breakdown chart
                updateChartsWithData(stats.deptBreakdown);

                // Update Engagement Chart with real data
                if (stats.engagement && typeof engagementChartInstance !== 'undefined' && engagementChartInstance) {
                    chartDataMap.day = stats.engagement.day;
                    chartDataMap.week = stats.engagement.week;
                    chartDataMap.month = stats.engagement.month;

                    const activeToggle = document.querySelector('.toggle-btn.active');
                    const range = activeToggle ? activeToggle.getAttribute('data-range') : 'day';
                    const selectedData = chartDataMap[range];

                    engagementChartInstance.data.labels = selectedData.labels;
                    engagementChartInstance.data.datasets[0].data = selectedData.data;
                    engagementChartInstance.update();
                }
            }
        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }

    // Dynamic Disk Storage Updater
    const updateDiskStorage = (data = null) => {
        const USED_STORAGE_GB = data ? data.usedGB : 340;
        const TOTAL_STORAGE_GB = data ? data.totalGB : 500;

        const percentage = Math.round((USED_STORAGE_GB / TOTAL_STORAGE_GB) * 100);

        const diskPercentageEl = document.getElementById('disk-percentage');
        const diskProgressEl = document.getElementById('disk-progress');
        const diskTextEl = document.getElementById('disk-text');

        // Update dashboard-wide if elements exist
        if (diskPercentageEl && diskProgressEl && diskTextEl) {
            diskPercentageEl.textContent = `${percentage}%`;
            diskProgressEl.style.width = `${percentage}%`;
            diskTextEl.textContent = `${USED_STORAGE_GB}GB / ${TOTAL_STORAGE_GB}GB Used`;

            const breakdownEl = document.getElementById('storage-breakdown');
            if (breakdownEl && data) {
                breakdownEl.textContent = `Assessments: ${data.assessmentsGB}GB | Materials: ${data.othersGB}GB`;
            }
        }

        // Also update settings section stat card if it exists
        const settingsStorageEl = document.querySelector('#settings .dashboard-grid:last-of-type .card span:last-child');
        if (settingsStorageEl) {
            settingsStorageEl.textContent = `${USED_STORAGE_GB} GB / ${TOTAL_STORAGE_GB} GB (${percentage}%)`;
            const settingsBar = document.querySelector('#settings .dashboard-grid:last-of-type .card div:last-child div');
            if (settingsBar) settingsBar.style.width = `${percentage}%`;
        }
    };

    updateDiskStorage();

    // 3. User Data & Pagination Logic
    let usersData = [];
    let filteredUsers = [];
    let allDepartments = [];
    let allFaculties = [];
    let currentPage = 1;
    const itemsPerPage = 10;

    const searchInput = document.getElementById('user-search');
    const roleFilter = document.getElementById('role-filter');
    const usersTableBody = document.getElementById('users-table-body');
    const paginationText = document.getElementById('pagination-text');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');

    async function fetchUsers() {
        try {
            const response = await authFetch(`${API_BASE_URL}/users`);
            const result = await response.json();
            if (result.success) {
                usersData = result.data.map(u => ({
                    id: u.id,
                    name: `${u.first_name || ''} ${u.middle_name || ''} ${u.last_name || ''}`.replace(/\s+/g, ' ').trim() || 'Unknown',
                    email: u.email,
                    role: u.role ? (u.role.charAt(0).toUpperCase() + u.role.slice(1)) : 'Student',
                    roleClass: u.role === 'admin' ? 'role-admin' : (u.role === 'instructor' ? 'role-instructor' : 'role-student'),
                    dept: u.department_name || '-',
                    faculty: u.faculty_name || '-',
                    year: u.year || '-',
                    section: u.section || '-',
                    status: u.is_active ? 'Active' : 'Suspended',
                    statusClass: u.is_active ? 'status-active' : 'status-suspended',
                    avatarBg: 'dcfce7',
                    avatarColor: '166534'
                }));
                filterUsers();
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    }

    async function fetchDepartments() {
        try {
            const response = await authFetch(`${API_BASE_URL}/departments`);
            const result = await response.json();
            if (result.success) {
                allDepartments = result.data;
                const depDataList = document.getElementById('department-options');
                if (depDataList) {
                    depDataList.innerHTML = '';
                    result.data.forEach(d => {
                        const opt = document.createElement('option');
                        opt.value = d.name;
                        depDataList.appendChild(opt);
                    });
                }

                const courseDeptSelect = document.getElementById('course-dept');
                const deptFilterSelect = document.getElementById('dept-filter');

                if (courseDeptSelect) {
                    courseDeptSelect.innerHTML = '<option value="">Select Department...</option>';
                    result.data.forEach(d => {
                        const opt = document.createElement('option');
                        opt.value = d.name;
                        opt.textContent = d.name;
                        courseDeptSelect.appendChild(opt);
                    });
                }

                if (deptFilterSelect) {
                    deptFilterSelect.innerHTML = '<option value="all">All Departments</option>';
                    result.data.forEach(d => {
                        const opt = document.createElement('option');
                        opt.value = d.name;
                        opt.textContent = d.name;
                        deptFilterSelect.appendChild(opt);
                    });
                }

                renderDepartments();
            }
        } catch (error) {
            console.error('Error fetching departments:', error);
        }
    }

    function renderDepartments() {
        const gridContainer = document.getElementById('departments-grid-container');
        if (!gridContainer) return;

        const facultyFilter = document.getElementById('dept-section-faculty-filter');
        const selectedFaculty = facultyFilter ? facultyFilter.value : 'all';

        // Sort departments alphabetically
        const sortedDepartments = [...allDepartments].sort((a, b) => a.name.localeCompare(b.name));

        const filteredDepts = sortedDepartments.filter(d => {
            if (selectedFaculty === 'all') return true;
            return d.faculty_name === selectedFaculty;
        });

        const addNewRowHtml = `
            <div class="department-row add-new-dept-row" onclick="document.getElementById('add-department-modal').style.display='flex'">
                <span class="material-symbols-outlined">add_circle</span>
                <h3>Add New Department</h3>
            </div>
        `;

        const rowsHtml = filteredDepts.map(dept => {
            const staffCount = usersData.filter(u => u.dept === dept.name && ['Admin', 'Instructor', 'Administrator'].includes(u.role)).length;
            const studentCount = usersData.filter(u => u.dept === dept.name && u.role === 'Student').length;

            return `
            <div class="department-row" onclick="showDepartmentDetails('${dept.id}')">
                <div class="dept-info-main">
                    <div class="dept-icon-circle" style="background: rgba(48, 86, 211, 0.1); color: var(--primary);">
                        <span class="material-symbols-outlined">category</span>
                    </div>
                    <div class="dept-details">
                        <h3 class="dept-name-text">${dept.name}</h3>
                        <p class="dept-faculty-text text-muted">${dept.faculty_name || 'N/A'}</p>
                    </div>
                </div>
                
                <div class="dept-stats-row">
                    <div class="dept-stat-pill">
                        <span class="material-symbols-outlined">badge</span>
                        <span class="pill-label">Instructors:</span>
                        <span class="pill-value">${staffCount || 0}</span>
                    </div>
                    <div class="dept-stat-pill">
                        <span class="material-symbols-outlined">group</span>
                        <span class="pill-label">Students:</span>
                        <span class="pill-value">${studentCount || 0}</span>
                    </div>
                </div>

                <div class="dept-actions-area">
                    <button class="icon-btn edit-dept" title="Edit Department" onclick="event.stopPropagation()">
                        <span class="material-symbols-outlined">edit_note</span>
                    </button>
                    <span class="material-symbols-outlined chevron">chevron_right</span>
                </div>
            </div>`;
        }).join('');

        gridContainer.innerHTML = addNewRowHtml + rowsHtml;
    }

    window.showDepartmentDetails = function (deptId) {
        const dept = allDepartments.find(d => d.id === deptId);
        if (!dept) return;

        const staffCount = usersData.filter(u => u.dept === dept.name && ['Admin', 'Instructor', 'Administrator'].includes(u.role)).length;
        const studentCount = usersData.filter(u => u.dept === dept.name && u.role === 'Student').length;

        document.getElementById('dept-detail-title').textContent = dept.name;
        document.getElementById('dept-detail-faculty').textContent = dept.faculty_name || 'N/A';
        document.getElementById('dept-detail-head').innerHTML = `
            <span class="material-symbols-outlined" style="font-size: 1.2rem; color: var(--primary);">person</span>
            ${dept.person_in_charge || 'No Head Appointed'}
        `;
        document.getElementById('dept-detail-desc').textContent = dept.description || 'No description available for this department.';
        document.getElementById('dept-detail-staff-count').textContent = `${staffCount} Instructors`;
        document.getElementById('dept-detail-student-count').textContent = `${studentCount} Enrolled`;

        const modal = document.getElementById('dept-details-modal');
        modal.classList.add('show');

        // Setup "View Users" button
        const viewUsersBtn = document.getElementById('view-dept-users-btn');
        viewUsersBtn.onclick = () => {
            modal.classList.remove('show');
            navigateToUsersTabAndFilter(dept.name);
        };
    };

    // Department Modal Close Logic
    const closeDeptModalBtns = document.querySelectorAll('.close-dept-modal, .close-dept-modal-btn');
    closeDeptModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('dept-details-modal').classList.remove('show');
        });
    });

    window.addEventListener('click', (e) => {
        const modal = document.getElementById('dept-details-modal');
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });

    async function fetchFaculties() {
        try {
            const response = await authFetch(`${API_BASE_URL}/departments/faculties`);
            const result = await response.json();
            if (result.success) {
                allFaculties = result.data;
                const deptSectionFacultyList = document.getElementById('dept-section-faculty-filter');
                if (deptSectionFacultyList) {
                    deptSectionFacultyList.innerHTML = '<option value="all">All Faculties</option>';
                    allFaculties.forEach(f => {
                        const opt = document.createElement('option');
                        opt.value = f.name;
                        opt.textContent = f.name;
                        deptSectionFacultyList.appendChild(opt);
                    });
                }

                const deptFacultyList = document.getElementById('dept-faculty');
                if (deptFacultyList) {
                    deptFacultyList.innerHTML = '<option value="">Select Faculty...</option>';
                    allFaculties.forEach(f => {
                        const opt = document.createElement('option');
                        opt.value = f.id;
                        opt.textContent = f.name;
                        deptFacultyList.appendChild(opt);
                    });
                }

                renderFaculties();
            }
        } catch (error) {
            console.error('Error fetching faculties:', error);
        }
    }

    function renderFaculties() {
        const tableBody = document.getElementById('faculties-table-body');
        if (!tableBody) return;

        tableBody.innerHTML = allFaculties.map(f => `
            <tr>
                <td>${f.id}</td>
                <td><strong>${f.name}</strong></td>
                <td>${f.institution_name || 'Main University'}</td>
                <td style="text-align: center;">
                    <button class="btn btn-secondary btn-sm" onclick="alert('Edit faculty id: ${f.id}')">Edit</button>
                </td>
            </tr>
        `).join('');
    }

    let allInstitutions = [];
    async function fetchInstitutions() {
        try {
            const response = await authFetch(`${API_BASE_URL}/departments/institutions`);
            const result = await response.json();
            if (result.success) {
                allInstitutions = result.data;
                renderInstitutions();
            }
        } catch (error) {
            console.error('Error fetching institutions:', error);
        }
    }

    function renderInstitutions() {
        const tableBody = document.getElementById('institutions-table-body');
        if (!tableBody) return;

        tableBody.innerHTML = allInstitutions.map(inst => `
            <tr>
                <td>${inst.id}</td>
                <td><strong>${inst.name}</strong></td>
                <td>${inst.location || 'Standard Campus'}</td>
                <td style="text-align: center;">
                    <button class="btn btn-secondary btn-sm" onclick="alert('Edit institution id: ${inst.id}')">Edit</button>
                </td>
            </tr>
        `).join('');
    }

    // --- 3. Filtering Logic ---
    const facultyFilter = document.getElementById('faculty-filter');
    const deptFilter = document.getElementById('dept-filter');
    const yearFilter = document.getElementById('year-filter');
    const sectionFilter = document.getElementById('section-filter');
    const resetBtn = document.getElementById('reset-filters');

    function filterUsers() {
        const query = searchInput.value.toLowerCase();
        const role = roleFilter.value.toLowerCase();
        const faculty = facultyFilter ? facultyFilter.value : 'all';
        const dept = deptFilter ? deptFilter.value : 'all';
        const year = yearFilter ? yearFilter.value : 'all';
        const section = sectionFilter ? sectionFilter.value : 'all';

        filteredUsers = usersData.filter(user => {
            const matchSearch = user.name.toLowerCase().includes(query) ||
                user.email.toLowerCase().includes(query) ||
                (user.institutional_id && user.institutional_id.toLowerCase().includes(query));
            const matchRole = role === 'all' || user.role.toLowerCase() === role;
            const matchFaculty = faculty === 'all' || user.faculty === faculty;
            const matchDept = dept === 'all' || user.dept === dept;
            const matchYear = year === 'all' || String(user.year) === year;
            const matchSection = section === 'all' || user.section === section;

            return matchSearch && matchRole && matchFaculty && matchDept && matchYear && matchSection;
        });

        currentPage = 1;
        renderUserTable();
    }

    // Event Listeners for Filters
    if (searchInput) searchInput.addEventListener('input', filterUsers);
    if (roleFilter) roleFilter.addEventListener('change', filterUsers);
    const deptSectionFacultyFilter = document.getElementById('dept-section-faculty-filter');
    if (deptSectionFacultyFilter) {
        deptSectionFacultyFilter.addEventListener('change', renderDepartments);
    }

    if (facultyFilter) {
        facultyFilter.addEventListener('change', () => {
            // Dependent Department Filter Update
            if (facultyFilter.value === 'all') {
                // reset dept filter options to all depts
                deptFilter.innerHTML = '<option value="all">All Departments</option>';
                allDepartments.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d.name;
                    opt.textContent = d.name;
                    deptFilter.appendChild(opt);
                });
            } else {
                const filteredDepts = allDepartments.filter(d => d.faculty_name === facultyFilter.value);
                deptFilter.innerHTML = '<option value="all">All Departments</option>';
                filteredDepts.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d.name;
                    opt.textContent = d.name;
                    deptFilter.appendChild(opt);
                });
            }
            filterUsers();
        });
    }
    if (deptFilter) deptFilter.addEventListener('change', filterUsers);
    if (yearFilter) yearFilter.addEventListener('change', filterUsers);
    if (sectionFilter) sectionFilter.addEventListener('change', filterUsers);

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            searchInput.value = '';
            roleFilter.value = 'all';
            facultyFilter.value = 'all';
            deptFilter.value = 'all';
            yearFilter.value = 'all';
            sectionFilter.value = 'all';
            filterUsers();
        });
    }

    function renderUserTable() {
        if (!usersTableBody) return;

        // Apply fade-out
        usersTableBody.style.opacity = '0.5';

        setTimeout(() => {
            usersTableBody.innerHTML = '';

            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

            paginatedUsers.forEach(user => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="checkbox-col"><input type="checkbox" class="row-checkbox" value="${user.id}"></td>
                    <td>
                        <div class="user-info-cell">
                            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=${user.avatarBg}&color=${user.avatarColor}&rounded=true" alt="Avatar" class="avatar-sm">
                            <span class="user-name clickable-name">${user.name}</span>
                        </div>
                    </td>
                    <td class="text-muted">${user.email}</td>
                    <td><span class="badge ${user.roleClass}">${user.role}</span></td>
                    <td class="text-muted dept-cell" title="${user.dept}">${user.dept}</td>
                    <td><span class="badge ${user.statusClass}">${user.status}</span></td>
                `;
                usersTableBody.appendChild(tr);
            });

            // Update Pagination Text
            const totalItems = filteredUsers.length;
            const currentEnd = Math.min(endIndex, totalItems);
            const currentStart = totalItems === 0 ? 0 : startIndex + 1;

            if (paginationText) {
                paginationText.textContent = `Showing ${currentStart}-${currentEnd} of ${totalItems} users`;
            }

            // Update Buttons
            const totalPages = Math.ceil(totalItems / itemsPerPage);
            if (prevBtn) prevBtn.disabled = currentPage === 1;
            if (nextBtn) nextBtn.disabled = currentPage >= totalPages || totalPages === 0;

            // Re-attach drawer event listeners for newly injected elements
            attachDrawerListeners();
            attachCheckboxListeners();
            attachToggleListeners();

            // Apply fade-in
            usersTableBody.style.opacity = '1';
        }, 150); // 150ms structural transition
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderUserTable();
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                renderUserTable();
            }
        });
    }

    function filterUsers() {
        if (!searchInput || !roleFilter) return;

        const searchTerm = searchInput.value.toLowerCase();
        const roleTerm = roleFilter.value.toLowerCase();

        filteredUsers = usersData.filter(user => {
            const matchesSearch = user.name.toLowerCase().includes(searchTerm) ||
                user.email.toLowerCase().includes(searchTerm) ||
                user.dept.toLowerCase().includes(searchTerm);
            const matchesRole = roleTerm === 'all' || user.role.toLowerCase() === roleTerm;
            return matchesSearch && matchesRole;
        });

        // Reset to first page when filtering
        currentPage = 1;
        renderUserTable();
    }

    window.navigateToUsersTabAndFilter = function (departmentName) {
        // Activate 'users' tab
        const usersTab = document.querySelector('.nav-item[data-target="users"]');
        if (usersTab) usersTab.click();

        // Set the filter
        const searchInput = document.getElementById('user-search');
        if (searchInput) {
            searchInput.value = departmentName;
            // Trigger filter event
            searchInput.dispatchEvent(new Event('input'));
        }
    };

    if (searchInput) searchInput.addEventListener('input', filterUsers);
    if (roleFilter) roleFilter.addEventListener('change', filterUsers);

    // Initial render setup
    if (usersTableBody) {
        usersTableBody.style.transition = 'opacity 0.15s ease-in-out';
        renderUserTable();
    }

    // 4. Modal Logic
    const modal = document.getElementById('create-user-modal');
    const openModalBtn = document.getElementById('open-create-user-modal');
    const closeBtns = document.querySelectorAll('.close-modal, .close-modal-btn');

    if (openModalBtn) {
        openModalBtn.addEventListener('click', () => {
            modal.classList.add('show');
        });
    }

    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modal.classList.remove('show');
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });

    // 5. Form Submissions
    const userForm = document.getElementById('create-user-form');
    const roleSelect = document.getElementById('role');
    const deptGroup = document.getElementById('department-group');
    const deptInput = document.getElementById('department-input');
    const instIdGroup = document.getElementById('institutional-id-group');
    const instIdInput = document.getElementById('institutional-id');

    if (roleSelect && deptGroup && deptInput) {
        roleSelect.addEventListener('change', (e) => {
            if (e.target.value === 'student') {
                deptGroup.style.display = 'block';
                deptInput.required = true;
                if (instIdGroup && instIdInput) {
                    instIdGroup.style.display = 'block';
                    instIdInput.required = true;
                }
            } else {
                deptGroup.style.display = 'none';
                deptInput.required = false;
                deptInput.value = '';
                if (instIdGroup && instIdInput) {
                    instIdGroup.style.display = 'none';
                    instIdInput.required = false;
                    instIdInput.value = '';
                }
            }
        });
    }

    const addDeptForm = document.getElementById('add-dept-form');
    if (addDeptForm) {
        addDeptForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('dept-name').value.trim();
            const facultyId = document.getElementById('dept-faculty').value;

            try {
                const response = await fetch('http://localhost:5000/api/departments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: nameInput, faculty_id: facultyId })
                });
                const result = await response.json();

                if (result.success) {
                    alert('Department added successfully!');
                    document.getElementById('add-department-modal').style.display = 'none';
                    addDeptForm.reset();
                    fetchDepartments(); // Refresh grid
                } else {
                    alert(`Failed to add department: ${result.message}`);
                }
            } catch (error) {
                alert(`Error adding department: ${error.message}`);
            }
        });
    }

    if (userForm) {
        userForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('title') ? document.getElementById('title').value : 'None';
            const firstName = document.getElementById('first-name').value;
            const middleName = document.getElementById('middle-name').value;
            const lastName = document.getElementById('last-name').value;
            const email = document.getElementById('email').value;
            const role = document.getElementById('role').value;
            const deptName = document.getElementById('department-input').value;
            const instId = document.getElementById('institutional-id') ? document.getElementById('institutional-id').value : null;
            const passwordInput = document.getElementById('password').value.trim();
            const password = passwordInput !== '' ? passwordInput : '123456';
            const foundDept = allDepartments.find(d => d.name === deptName);
            const deptId = foundDept ? foundDept.id : null;

            const payload = {
                title: title,
                first_name: firstName,
                middle_name: middleName,
                last_name: lastName,
                email: email,
                role: role,
                department_id: deptId,
                institutional_id: instId,
                password: password
            };

            try {
                const response = await authFetch(`${API_BASE_URL}/users`, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                const result = await response.json();

                if (result.success) {
                    alert(`User account for ${firstName} created successfully!`);
                    modal.classList.remove('show');
                    userForm.reset();
                    fetchUsers();
                } else {
                    alert(`Failed to create account: ${result.message}`);
                }
            } catch (error) {
                alert(`Error creating user account: ${error.message}`);
            }
        });
    }

    const deleteSelectedBtn = document.getElementById('delete-selected-btn');
    if (deleteSelectedBtn) {
        deleteSelectedBtn.addEventListener('click', async () => {
            const selectedCheckboxes = document.querySelectorAll('.row-checkbox:checked');
            const selectedIds = Array.from(selectedCheckboxes).map(cb => cb.value);
            if (selectedIds.length === 0) return;

            const password = prompt("Enter admin password to delete:");
            if (password !== "123456") {
                alert("Incorrect password. Deletion canceled.");
                return;
            }

            try {
                for (const id of selectedIds) {
                    await authFetch(`${API_BASE_URL}/users/${id}`, { method: 'DELETE' });
                }
                alert("Selected users deleted successfully.");

                // Clear selection
                const bulkActionBar = document.getElementById('bulk-action-bar');
                if (bulkActionBar) bulkActionBar.style.display = 'none';

                fetchUsers();
            } catch (error) {
                alert("An error occurred while deleting users.");
            }
        });
    }

    const suspendSelectedBtn = document.getElementById('suspend-selected-btn');
    if (suspendSelectedBtn) {
        suspendSelectedBtn.addEventListener('click', async () => {
            const selectedCheckboxes = document.querySelectorAll('.row-checkbox:checked');
            const selectedIds = Array.from(selectedCheckboxes).map(cb => cb.value);
            if (selectedIds.length === 0) return;

            try {
                for (const id of selectedIds) {
                    await authFetch(`${API_BASE_URL}/users/${id}/status`, {
                        method: 'PATCH',
                        body: JSON.stringify({ is_active: false })
                    });
                }
                alert("Selected users suspended successfully.");

                // Clear selection
                const bulkActionBar = document.getElementById('bulk-action-bar');
                if (bulkActionBar) bulkActionBar.style.display = 'none';

                fetchUsers();
            } catch (error) {
                alert("An error occurred while suspending users.");
            }
        });
    }

    // --- 4. Course Catalog Management Logic ---
    let coursesData = [];
    const coursesTableBody = document.getElementById('courses-table-body');
    const courseSearch = document.getElementById('course-search');
    const createCourseForm = document.getElementById('create-course-form');
    const createCourseModal = document.getElementById('create-course-modal');

    // Filter selectors
    const courseInstFilter = document.getElementById('course-institution-filter');
    const courseFacultyFilter = document.getElementById('course-faculty-filter');
    const courseDeptFilter = document.getElementById('course-dept-filter');
    const courseYearFilter = document.getElementById('course-year-filter');
    const courseSemFilter = document.getElementById('course-semester-filter');
    const resetCoursesBtn = document.getElementById('reset-course-filters');

    async function initCoursesSection() {
        await Promise.all([
            fetchCourses(),
            populateCourseFilterDropdowns(),
            populateCreateCourseDropdowns()
        ]);
    }

    async function fetchCourses() {
        if (!coursesTableBody) return;
        try {
            const params = new URLSearchParams();
            if (courseInstFilter && courseInstFilter.value !== 'all') params.append('institution_id', courseInstFilter.value);
            if (courseFacultyFilter && courseFacultyFilter.value !== 'all') params.append('faculty_id', courseFacultyFilter.value);
            if (courseDeptFilter && courseDeptFilter.value !== 'all') params.append('department_id', courseDeptFilter.value);
            if (courseYearFilter && courseYearFilter.value !== 'all') params.append('year', courseYearFilter.value);
            if (courseSemFilter && courseSemFilter.value !== 'all') params.append('semester', courseSemFilter.value);
            const sortFilter = document.getElementById('course-sort-filter');
            if (sortFilter) params.append('sort', sortFilter.value);
            if (courseSearch && courseSearch.value) params.append('search', courseSearch.value);

            const response = await authFetch(`${API_BASE_URL}/courses?${params.toString()}`);
            const result = await response.json();
            if (result.success) {
                coursesData = result.data;
                renderCourses();
            }
        } catch (error) {
            console.error('Error fetching courses:', error);
        }
    }

    function renderCourses() {
        if (!coursesTableBody) return;
        coursesTableBody.innerHTML = (coursesData || []).map(course => `
            <tr>
                <td><strong style="color: var(--primary);">${course.course_code}</strong></td>
                <td><span style="font-weight: 600;">${course.title}</span></td>
                <td class="text-muted"><span class="badge" style="background: rgba(48, 86, 211, 0.05); color: var(--primary);">${course.department_name}</span></td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(course.instructor_name || 'N A')}&background=f1f5f9&color=64748b&rounded=true&size=24" class="avatar-sm" style="width:24px; height:24px;">
                        <span style="font-size: 0.9rem;">${course.instructor_name || 'Not Assigned'}</span>
                    </div>
                </td>
                <td><span class="text-muted">Yr ${course.year || 'N/A'}, Sem ${course.semester || 'N/A'}</span></td>
                <td style="text-align: center;">
                    <button class="icon-btn edit" title="Edit Course"><span class="material-symbols-outlined" style="font-size: 1.2rem;">edit_note</span></button>
                </td>
            </tr>
        `).join('');
    }

    // --- Course Detail Editing (Guide & Chapters) ---
    const editCourseModal = document.getElementById('edit-course-modal');
    const editCourseTitle = document.getElementById('edit-course-title');
    const editCourseCode = document.getElementById('edit-course-code');
    const closeEditCourseModal = document.querySelector('.close-edit-course-modal');
    const uploadGuideForm = document.getElementById('upload-guide-form');
    const addChapterForm = document.getElementById('add-chapter-form');
    const chaptersList = document.getElementById('chapters-list');
    let activeCourseId = null;

    // Helper to convert number to words for chapters
    function numberToWord(n) {
        const words = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
            'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'];
        return words[n] || n.toString();
    }

    async function openEditCourseModal(course) {
        activeCourseId = course.id;
        editCourseTitle.textContent = `Edit Details: ${course.title}`;
        editCourseCode.textContent = `Course Code: ${course.course_code}`;

        // Update Guide Status
        const statusEl = document.getElementById('current-guide-status');
        if (course.course_guide_url) {
            statusEl.innerHTML = `<span style="color: #10b981; display: flex; align-items: center; gap: 5px;"><span class="material-symbols-outlined">check_circle</span> Guide Uploaded</span>
                                  <a href="${API_BASE_URL.replace('/api', '')}${course.course_guide_url}" target="_blank" style="font-size: 0.8rem; margin-top: 5px; display: block; color: var(--primary);">View Current PDF</a>`;
        } else {
            statusEl.textContent = 'No guide uploaded yet.';
        }

        const chooseBtnText = document.getElementById('choose-btn-text');
        const saveBtn = document.getElementById('save-course-details-btn');
        if (chooseBtnText) chooseBtnText.textContent = 'Select Course Guide (PDF)';
        if (saveBtn) saveBtn.disabled = true;

        fetchChapters();
        editCourseModal.classList.add('show');
    }

    async function fetchChapters() {
        if (!activeCourseId) return;
        try {
            const res = await authFetch(`${API_BASE_URL}/courses/${activeCourseId}/chapters`);
            const result = await res.json();
            if (result.success) {
                chaptersList.innerHTML = result.data.length ? result.data.map(ch => `
                    <div style="padding: 10px 15px; background: white; border: 1px solid var(--border); border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 600; font-size: 0.85rem; color: var(--text-dark);">${ch.title}</span>
                        <span class="text-muted" style="font-size: 0.7rem; background: #f1f5f9; padding: 2px 8px; border-radius: 4px;">Chapter ${ch.order_index + 1}</span>
                    </div>
                `).join('') : '<p class="text-muted" style="text-align: center; padding: 20px; font-size: 0.85rem;">No chapters added yet.</p>';

                const label = document.getElementById('chapter-number-label');
                if (label) {
                    label.textContent = `Chapter ${numberToWord(result.data.length + 1)}:`;
                }
                updateSaveBtnState();
            }
        } catch (e) { console.error(e); }
    }

    function updateSaveBtnState() {
        const saveBtn = document.getElementById('save-course-details-btn');
        const fileInput = document.getElementById('guide-file-input');
        const hasFile = fileInput && fileInput.files.length > 0;
        const hasChapters = chaptersList && chaptersList.children.length > 0 && !chaptersList.querySelector('p.text-muted');

        if (saveBtn) saveBtn.disabled = !(hasFile || hasChapters);
    }

    if (closeEditCourseModal) closeEditCourseModal.addEventListener('click', () => editCourseModal.classList.remove('show'));

    const chooseGuideBtn = document.getElementById('choose-guide-btn');
    const guideFileInput = document.getElementById('guide-file-input');
    const saveCourseDetailsBtn = document.getElementById('save-course-details-btn');

    if (chooseGuideBtn) chooseGuideBtn.addEventListener('click', () => guideFileInput.click());
    if (guideFileInput) {
        guideFileInput.addEventListener('change', () => {
            const btnText = document.getElementById('choose-btn-text');
            if (guideFileInput.files.length > 0) {
                const fileName = guideFileInput.files[0].name;
                if (btnText) btnText.textContent = fileName.length > 20 ? fileName.substring(0, 17) + '...' : fileName;
            } else {
                if (btnText) btnText.textContent = 'Select Course Guide (PDF)';
            }
            updateSaveBtnState();
        });
    }

    if (saveCourseDetailsBtn) {
        saveCourseDetailsBtn.addEventListener('click', async () => {
            const fileInput = document.getElementById('guide-file-input');
            const hasFile = fileInput && fileInput.files.length > 0;

            saveCourseDetailsBtn.disabled = true;
            saveCourseDetailsBtn.textContent = 'Saving...';

            try {
                if (hasFile) {
                    const formData = new FormData();
                    formData.append('guide', fileInput.files[0]);

                    const res = await fetch(`${API_BASE_URL}/courses/${activeCourseId}/guide`, {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                        body: formData
                    });
                    const result = await res.json();
                    if (!result.success) {
                        alert('Guide upload failed: ' + result.message);
                        saveCourseDetailsBtn.disabled = false;
                        saveCourseDetailsBtn.textContent = 'Save Changes';
                        return;
                    }
                }

                alert('Changes saved successfully!');
                fetchCourses();
                editCourseModal.classList.remove('show');
            } catch (err) {
                console.error(err);
                alert('Operation failed');
            } finally {
                saveCourseDetailsBtn.textContent = 'Save Changes';
                updateSaveBtnState();
            }
        });
    }

    // Robust event delegation for chapter addition
    document.addEventListener('submit', async (e) => {
        if (e.target && e.target.id === 'add-chapter-form') {
            e.preventDefault();
            const form = e.target;
            const titleInput = form.querySelector('#chapter-title-input');
            const title = titleInput ? titleInput.value.trim() : '';
            if (!title) return;

            if (!activeCourseId) {
                alert("Session lost. Please close and reopen the modal.");
                return;
            }

            // Count existing chapters accurately
            const existingCount = chaptersList.querySelectorAll(':scope > div').length;

            try {
                const res = await authFetch(`${API_BASE_URL}/courses/${activeCourseId}/chapters`, {
                    method: 'POST',
                    body: JSON.stringify({ title, order_index: existingCount })
                });
                const result = await res.json();
                if (result.success) {
                    titleInput.value = '';
                    titleInput.focus();
                    fetchChapters();
                } else {
                    alert('Error: ' + result.message);
                }
            } catch (err) {
                console.error(err);
                alert('Connection failed while adding chapter');
            }
        }
    });

    if (coursesTableBody) {
        coursesTableBody.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit');
            if (editBtn) {
                const tr = editBtn.closest('tr');
                const trs = Array.from(coursesTableBody.querySelectorAll('tr'));
                const index = trs.indexOf(tr);
                if (coursesData[index]) openEditCourseModal(coursesData[index]);
            }
        });
    }

    async function populateCourseFilterDropdowns() {
        try {
            const instRes = await authFetch(`${API_BASE_URL}/departments/institutions`);
            const instData = await instRes.json();
            if (instData.success && courseInstFilter) {
                courseInstFilter.innerHTML = '<option value="all">All Institutions</option>' +
                    instData.data.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
            }
            const facRes = await authFetch(`${API_BASE_URL}/departments/faculties`);
            const facData = await facRes.json();
            if (facData.success && courseFacultyFilter) {
                courseFacultyFilter.innerHTML = '<option value="all">All Faculties</option>' +
                    facData.data.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
            }
            const deptRes = await authFetch(`${API_BASE_URL}/departments`);
            const deptData = await deptRes.json();
            if (deptData.success && courseDeptFilter) {
                courseDeptFilter.innerHTML = '<option value="all">All Departments</option>' +
                    deptData.data.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
            }
        } catch (e) { console.error(e); }
    }

    async function populateScheduleDropdowns() {
        try {
            const facultySelect = document.getElementById('schedule-faculty-input');
            const deptSelect = document.getElementById('schedule-department-input');

            // Faculties
            const facRes = await authFetch(`${API_BASE_URL}/departments/faculties`);
            const facData = await facRes.json();
            if (facData.success && facultySelect) {
                facultySelect.innerHTML = facData.data.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
                setupSearchableSelect('schedule-faculty-container', true); // Pass true if we update searchable component to handle multiple
            }

            // Departments 
            const deptRes = await authFetch(`${API_BASE_URL}/departments`);
            const deptData = await deptRes.json();
            if (deptData.success && deptSelect) {
                deptSelect.innerHTML = deptData.data.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
                setupSearchableSelect('schedule-department-container', true);
            }
        } catch (e) { console.error('Error populating schedule dropdowns', e); }
    }

    async function populateCreateCourseDropdowns() {
        try {
            const deptSelect = document.getElementById('course-dept-input');
            const instructorSelect = document.getElementById('course-instructor-input');

            // Departments
            const deptRes = await authFetch(`${API_BASE_URL}/departments`);
            const deptData = await deptRes.json();
            if (deptData.success && deptSelect) {
                deptSelect.innerHTML = '<option value="" disabled selected hidden>Select Department...</option>' +
                    deptData.data.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
                setupSearchableSelect('dept-search-container');
            }

            // Instructors
            const userRes = await authFetch(`${API_BASE_URL}/users`);
            const userData = await userRes.json();
            if (userData.success && instructorSelect) {
                const instructors = userData.data.filter(u => u.role === 'instructor');
                instructorSelect.innerHTML = '<option value="" disabled selected hidden>Select Instructor...</option>' +
                    instructors.map(i => `<option value="${i.id}">${i.first_name} ${i.last_name}</option>`).join('');
                setupSearchableSelect('instructor-search-container');
            }
        } catch (e) { console.error(e); }
    }

    function setupSearchableSelect(containerId, isMultiple = false) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const input = container.querySelector('.searchable-select-input');
        const dropdown = container.querySelector('.searchable-select-dropdown');
        const select = container.querySelector('select');

        // Clear existing dropdown items
        dropdown.innerHTML = '';

        const options = Array.from(select.options).filter(opt => !opt.disabled);

        const renderDropdown = (filter = '') => {
            const filtered = options.filter(opt => opt.text.toLowerCase().includes(filter.toLowerCase()));
            dropdown.innerHTML = filtered.length ? filtered.map(opt => `
                <div class="searchable-select-option ${isMultiple && opt.selected ? 'selected' : ''}" data-value="${opt.value}">
                    ${isMultiple ? `<input type="checkbox" ${opt.selected ? 'checked' : ''} style="margin-right: 8px;">` : ''}
                    ${opt.text}
                </div>
            `).join('') : '<div class="searchable-select-no-results">No matches found</div>';

            dropdown.classList.add('show');
        };

        const updateSelectedDisplay = () => {
            if (isMultiple) {
                const selectedTexts = Array.from(select.options).filter(opt => opt.selected).map(opt => opt.text);
                input.value = selectedTexts.length > 0 ? selectedTexts.join(', ') : '';
                input.placeholder = selectedTexts.length > 0 ? '' : 'Select Options...';
            }
        };

        // Event Listeners
        input.addEventListener('focus', () => renderDropdown(input.value));
        input.addEventListener('input', () => renderDropdown(input.value));

        dropdown.addEventListener('click', (e) => {
            const optionEl = e.target.closest('.searchable-select-option');
            if (optionEl) {
                const val = optionEl.getAttribute('data-value');
                const option = Array.from(select.options).find(opt => opt.value === val);

                if (isMultiple) {
                    option.selected = !option.selected;
                    const checkbox = optionEl.querySelector('input[type="checkbox"]');
                    if (checkbox) checkbox.checked = option.selected;

                    if (option.selected) {
                        optionEl.classList.add('selected');
                    } else {
                        optionEl.classList.remove('selected');
                    }
                    updateSelectedDisplay();
                    // Prevent input from losing focus or Dropdown closing so user can select more
                    input.focus();
                } else {
                    input.value = option.text;
                    select.value = val;
                    dropdown.classList.remove('show');
                }
                select.dispatchEvent(new Event('change'));
            }
        });

        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) dropdown.classList.remove('show');
        });
    }

    // Modal & Filter Event Listeners
    const openCourseModalBtn = document.getElementById('open-create-course-modal');
    const closeCourseModalBtns = document.querySelectorAll('.close-course-modal, .close-course-modal-btn');

    if (openCourseModalBtn) {
        openCourseModalBtn.addEventListener('click', () => {
            createCourseModal.classList.add('show');
            populateCreateCourseDropdowns();
        });
    }

    closeCourseModalBtns.forEach(btn => {
        btn.addEventListener('click', () => createCourseModal.classList.remove('show'));
    });

    const courseSortFilter = document.getElementById('course-sort-filter');
    [courseInstFilter, courseFacultyFilter, courseDeptFilter, courseYearFilter, courseSemFilter, courseSortFilter].forEach(el => {
        if (el) el.addEventListener('change', fetchCourses);
    });
    if (courseSearch) courseSearch.addEventListener('input', fetchCourses);
    if (resetCoursesBtn) {
        resetCoursesBtn.addEventListener('click', () => {
            if (courseInstFilter) courseInstFilter.value = 'all';
            if (courseFacultyFilter) courseFacultyFilter.value = 'all';
            if (courseDeptFilter) courseDeptFilter.value = 'all';
            if (courseYearFilter) courseYearFilter.value = 'all';
            if (courseSemFilter) courseSemFilter.value = 'all';
            if (courseSortFilter) courseSortFilter.value = 'newest';
            if (courseSearch) courseSearch.value = '';
            fetchCourses();
        });
    }

    if (createCourseForm) {
        createCourseForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                course_code: document.getElementById('course-code-input').value.trim().toUpperCase(),
                title: document.getElementById('course-title-input').value.trim(),
                description: document.getElementById('course-desc-input').value.trim(),
                department_id: document.getElementById('course-dept-input').value,
                instructor_id: document.getElementById('course-instructor-input').value,
                year: parseInt(document.getElementById('course-year-input').value),
                semester: parseInt(document.getElementById('course-semester-input').value)
            };
            try {
                const res = await authFetch(`${API_BASE_URL}/courses`, { method: 'POST', body: JSON.stringify(payload) });
                const result = await res.json();
                if (result.success) {
                    alert('Course created successfully!');
                    createCourseModal.classList.remove('show');
                    createCourseForm.reset();
                    fetchCourses();
                } else { alert('Error: ' + result.message); }
            } catch (err) { alert('Connection error'); }
        });
    }

    // Navigation trigger for courses section
    const currentNavItems = document.querySelectorAll('.nav-item');
    currentNavItems.forEach(item => {
        item.addEventListener('click', () => {
            if (item.getAttribute('data-target') === 'courses') {
                initCoursesSection();
            }
        });
    });

    // Check if courses view is active on load
    if (document.querySelector('.nav-item.active[data-target="courses"]')) {
        initCoursesSection();
    }

    // --- 3. Support Inbox Mockup ---
    let tickets = [];

    const supportTableBody = document.getElementById('support-table-body');
    async function fetchTickets() {
        try {
            // Note: If you add support tickets to backend, change this to authFetch
            // For now, let's keep it as is or try to fetch from /api/system/tickets if you implement it
            const response = await authFetch(`${API_BASE_URL}/system/tickets`).catch(() => null);
            if (response && response.status === 200) {
                const result = await response.json();
                tickets = result.data;
            } else {
                // Fallback mockup
                tickets = [
                    { id: '#1045', user_email: 'a.smith@university.edu', subject: 'Forgot Password', status: 'Open', created_at: new Date() },
                    { id: '#1044', user_email: 'faculty.john@university.edu', subject: 'Cannot upload PDF', status: 'Open', created_at: new Date() }
                ];
            }
            renderSupportTickets();
        } catch (error) {
            renderSupportTickets(); // render default
        }
    }

    const renderSupportTickets = () => {
        if (!supportTableBody) return;
        supportTableBody.innerHTML = '';
        tickets.forEach(ticket => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${ticket.id.substring(0, 5)}</strong></td>
                <td>${ticket.user_email || 'anonymous'}</td>
                <td>${ticket.subject}</td>
                <td><span class="badge" style="background: #fef3c7; color: #d97706;">${ticket.status}</span></td>
                <td>${timeAgo(new Date(ticket.created_at || new Date()))}</td>
                <td><button class="btn btn-secondary btn-sm">View Ticket</button></td>
            `;
            supportTableBody.appendChild(tr);
        });
    }

    // Add fetchTickets to initDashboard
    const currentInit = initDashboard;
    initDashboard = function () {
        currentInit();
        fetchTickets();
    };

    // 6. Action Buttons

    const triggerManualBackupBtn = document.getElementById('trigger-manual-backup');
    const backupStatusMsg = document.getElementById('backup-status-msg');
    if (triggerManualBackupBtn && backupStatusMsg) {
        triggerManualBackupBtn.addEventListener('click', async () => {
            const originalContent = triggerManualBackupBtn.innerHTML;
            triggerManualBackupBtn.innerHTML = '<span class="material-symbols-outlined" style="animation: spin 1s linear infinite;">sync</span><span class="backup-text">Backing up database...</span>';
            triggerManualBackupBtn.disabled = true;
            backupStatusMsg.style.display = 'none';

            try {
                const response = await authFetch(`${API_BASE_URL}/system/backup`, { method: 'POST' });
                const result = await response.json();

                setTimeout(() => {
                    triggerManualBackupBtn.innerHTML = originalContent;
                    triggerManualBackupBtn.disabled = false;

                    if (result.success) {
                        backupStatusMsg.textContent = result.message;
                        backupStatusMsg.style.color = '#10b981'; // Success color
                    } else {
                        backupStatusMsg.textContent = 'Error: ' + result.message;
                        backupStatusMsg.style.color = '#ef4444';
                    }
                    backupStatusMsg.style.display = 'block';
                }, 1500);
            } catch (error) {
                triggerManualBackupBtn.innerHTML = originalContent;
                triggerManualBackupBtn.disabled = false;
                backupStatusMsg.textContent = 'Network error during backup';
                backupStatusMsg.style.color = '#ef4444';
                backupStatusMsg.style.display = 'block';
            }
        });
    }

    // Duplicate logoutBtn removed (handled in Section 0)

    // 7. Chart Data Configurations
    const engagementCtx = document.getElementById('engagement-chart');
    const pieCtx = document.getElementById('departmentPieChart');

    // Gradient definitions
    let engagementGradient = null;
    let hoverGradient = null;

    if (engagementCtx) {
        const ctx = engagementCtx.getContext('2d');
        engagementGradient = ctx.createLinearGradient(0, 0, 0, 300);
        engagementGradient.addColorStop(0, '#3056D3');
        engagementGradient.addColorStop(1, '#818CF8');

        hoverGradient = '#2DD4BF';
    }

    const chartDataMap = {
        day: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            data: [40, 60, 35, 80, 50, 90, 70]
        },
        week: {
            labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'],
            data: [20, 85, 45, 60, 90, 30, 80]
        },
        month: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
            data: [70, 50, 80, 40, 65, 55, 95]
        }
    };

    let engagementChartInstance = null;

    if (engagementCtx) {
        engagementChartInstance = new Chart(engagementCtx, {
            type: 'bar',
            data: {
                labels: chartDataMap.day.labels,
                datasets: [{
                    label: 'Logins',
                    data: chartDataMap.day.data,
                    backgroundColor: engagementGradient,
                    hoverBackgroundColor: hoverGradient,
                    borderRadius: 6,
                    borderSkipped: false,
                    barPercentage: 0.6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.85)',
                        titleFont: { family: 'Inter', size: 13 },
                        bodyFont: { family: 'Inter', size: 12 },
                        padding: 10,
                        cornerRadius: 6,
                        yAlign: 'bottom'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#E2E8F0', drawBorder: false },
                        border: { display: false },
                        ticks: { color: '#64748B', font: { family: 'Inter' } }
                    },
                    x: {
                        grid: { display: false, drawBorder: false },
                        border: { display: false },
                        ticks: { color: '#64748B', font: { family: 'Inter' } }
                    }
                }
            }
        });
    }

    if (pieCtx) {
        new Chart(pieCtx, {
            type: 'doughnut',
            data: {
                labels: ['Computing', 'Engineering', 'Medicine', 'Social Science', 'Others'],
                datasets: [{
                    data: [40, 25, 18, 10, 7],
                    backgroundColor: [
                        '#3056D3',
                        '#10B981',
                        '#F59E0B',
                        '#8B5CF6',
                        '#EF4444'
                    ],
                    borderWidth: 2,
                    borderColor: '#FFFFFF',
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: { display: false }, /* using custom html legend */
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.85)',
                        titleFont: { family: 'Inter', size: 13 },
                        bodyFont: { family: 'Inter', size: 12 },
                        padding: 10,
                        cornerRadius: 6
                    }
                }
            }
        });
    }

    // Chart Toggles
    const toggleBtns = document.querySelectorAll('.toggle-btn');
    if (toggleBtns.length > 0 && engagementChartInstance) {
        toggleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                toggleBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const range = btn.getAttribute('data-range');
                const selectedData = chartDataMap[range] || chartDataMap.day;

                engagementChartInstance.data.labels = selectedData.labels;
                engagementChartInstance.data.datasets[0].data = selectedData.data;
                engagementChartInstance.update();
            });
        });
    }

    // 8. Bulk Action Checkbox Logic
    const bulkActionBar = document.getElementById('bulk-action-bar');
    const bulkActionCount = document.getElementById('bulk-action-count');
    const globalEditBtn = document.getElementById('global-edit-btn');

    function attachCheckboxListeners() {
        const rowCheckboxes = document.querySelectorAll('.row-checkbox');
        if (bulkActionBar && rowCheckboxes.length > 0) {
            rowCheckboxes.forEach(checkbox => {
                checkbox.addEventListener('change', function () {
                    const tr = this.closest('tr');
                    if (this.checked) {
                        tr.classList.add('row-selected');
                    } else {
                        tr.classList.remove('row-selected');
                    }

                    const checkedCount = document.querySelectorAll('.row-checkbox:checked').length;

                    if (checkedCount > 0) {
                        bulkActionBar.style.display = 'flex';
                        bulkActionCount.textContent = `${checkedCount} User${checkedCount > 1 ? 's' : ''} Selected`;

                        if (globalEditBtn) {
                            if (checkedCount === 1) {
                                globalEditBtn.classList.add('active');
                                globalEditBtn.disabled = false;
                            } else {
                                globalEditBtn.classList.remove('active');
                                globalEditBtn.disabled = true;
                            }
                        }
                    } else {
                        bulkActionBar.style.display = 'none';

                        if (globalEditBtn) {
                            globalEditBtn.classList.remove('active');
                            globalEditBtn.disabled = true;
                        }
                    }
                });
            });
        }
    }

    function attachToggleListeners() {
        const toggle = document.getElementById('drawer-status-toggle');
        if (!toggle) return;
        // Ensure we only attach the listener once
        if (toggle.dataset.listenerAttached) return;
        toggle.dataset.listenerAttached = 'true';

        toggle.addEventListener('change', async function () {
            const id = this.getAttribute('data-id');
            const isActive = this.checked;
            try {
                await authFetch(`${API_BASE_URL}/users/${id}/status`, {
                    method: 'PATCH',
                    body: JSON.stringify({ is_active: isActive })
                });
                fetchUsers();

                const statusText = isActive ? 'Active' : 'Suspended';
                const statusClass = isActive ? 'status-active' : 'status-suspended';
                document.getElementById('drawer-status').outerHTML = `<span id="drawer-status"><span class="badge ${statusClass}">${statusText}</span></span>`;
            } catch (e) {
                console.error('Error toggling status:', e);
            }
        });
    }

    // 9. Profile Drawer Logic
    const profileDrawer = document.getElementById('profile-drawer');
    const closeDrawerBtn = document.getElementById('close-drawer-btn');

    const openDrawerWithRowData = (tr) => {
        if (!tr || !profileDrawer) return;
        const avatarSrc = tr.querySelector('.avatar-sm').src;
        const nameText = tr.cells[1].querySelector('.user-name').textContent;
        const email = tr.cells[2].textContent;
        const roleHtml = tr.cells[3].innerHTML;
        const dept = tr.cells[4].textContent;
        const statusHtml = tr.cells[5].innerHTML;
        const userId = tr.querySelector('.row-checkbox').value;
        const isActiveText = tr.cells[5].textContent.trim();
        const isActive = isActiveText === 'Active';

        document.getElementById('drawer-avatar').src = avatarSrc;
        document.getElementById('drawer-name').textContent = nameText;
        document.getElementById('drawer-email').textContent = email;
        document.getElementById('drawer-role').outerHTML = `<span id="drawer-role">${roleHtml}</span>`;
        document.getElementById('drawer-dept').textContent = dept;
        document.getElementById('drawer-status').outerHTML = `<span id="drawer-status">${statusHtml}</span>`;

        const statusToggle = document.getElementById('drawer-status-toggle');
        if (statusToggle) {
            statusToggle.setAttribute('data-id', userId);
            statusToggle.checked = isActive;
        }

        profileDrawer.classList.add('open');
    };

    function attachDrawerListeners() {
        const clickableNames = document.querySelectorAll('.clickable-name');
        if (profileDrawer && clickableNames.length > 0) {
            clickableNames.forEach(nameEl => {
                // remove existing listener avoiding duplicates
                const newNameEl = nameEl.cloneNode(true);
                nameEl.parentNode.replaceChild(newNameEl, nameEl);

                newNameEl.addEventListener('click', function () {
                    openDrawerWithRowData(this.closest('tr'));
                });
            });
        }
    }

    if (closeDrawerBtn) {
        closeDrawerBtn.addEventListener('click', () => {
            profileDrawer.classList.remove('open');
        });
    }

    if (globalEditBtn) {
        globalEditBtn.addEventListener('click', () => {
            const checkedCheckbox = document.querySelector('.row-checkbox:checked');
            if (checkedCheckbox) openDrawerWithRowData(checkedCheckbox.closest('tr'));
        });
    }

    async function fetchLogs() {
        try {
            const response = await authFetch(`${API_BASE_URL}/system/logs`);
            const result = await response.json();
            if (result.success) {
                renderActivityFeed(result.data);
                renderLogsTable(result.data);
            }
        } catch (error) {
            console.error('Error fetching logs:', error);
        }
    }

    function renderActivityFeed(logs) {
        const feedContainer = document.querySelector('.feed-list');
        if (!feedContainer) return;

        feedContainer.innerHTML = logs.map(log => `
            <div class="feed-item">
                <div class="feed-icon" style="background: rgba(48, 86, 211, 0.1); color: var(--primary);">
                    <span class="material-symbols-outlined">${getIconForAction(log.action)}</span>
                </div>
                <div class="feed-content">
                    <p><strong>${log.first_name || 'System'}</strong> ${formatAction(log.action)} ${log.entity_type || ''}</p>
                    <span class="feed-time">${timeAgo(new Date(log.created_at))}</span>
                </div>
            </div>
        `).join('');
    }

    function renderLogsTable(logs) {
        const logsTableBody = document.getElementById('logs-table-body');
        if (!logsTableBody) return;

        logsTableBody.innerHTML = logs.map(log => `
            <tr>
                <td class="text-muted">${new Date(log.created_at).toLocaleString()}</td>
                <td>${log.email || 'system'}</td>
                <td><span class="badge" style="background: #e0f2fe; color: #0369a1;">${log.action}</span></td>
                <td class="text-muted">${log.ip_address || 'N/A'}</td>
                <td>${log.action} on ${log.entity_type || 'system'}</td>
            </tr>
        `).join('');
    }

    function updateChartsWithData(deptBreakdown) {
        if (!pieCtx || !deptBreakdown) return;

        // Sort by count descending
        deptBreakdown.sort((a, b) => b.count - a.count);

        const chart = Chart.getChart(pieCtx);
        if (chart) {
            chart.data.labels = deptBreakdown.map(d => d.name);
            chart.data.datasets[0].data = deptBreakdown.map(d => d.count);
            chart.update();

            const legendContainer = document.querySelector('.donut-legend');
            if (legendContainer) {
                const total = deptBreakdown.reduce((sum, d) => sum + d.count, 0);
                const colors = chart.data.datasets[0].backgroundColor;

                const renderLegendItems = (items, colorOffset = 0) => {
                    return items.map((d, i) => `
                        <div class="legend-item" style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                            <span class="dot" style="width: 10px; height: 10px; border-radius: 50%; background: ${colors[(i + colorOffset) % colors.length]};"></span>
                            <span style="font-size: 0.85rem; color: var(--text-dark); flex: 1;">${d.name}</span>
                            <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted);">${Math.round((d.count / total) * 100)}%</span>
                        </div>
                    `).join('');
                };

                const INITIAL_LIMIT = 4;
                const visibleItems = deptBreakdown.slice(0, INITIAL_LIMIT);
                const hiddenItems = deptBreakdown.slice(INITIAL_LIMIT);

                legendContainer.innerHTML = `
                    <div id="visible-depts">${renderLegendItems(visibleItems)}</div>
                    ${hiddenItems.length > 0 ? `
                        <div id="hidden-depts" style="display: none;">${renderLegendItems(hiddenItems, INITIAL_LIMIT)}</div>
                        <button id="see-more-depts" style="background: transparent; border: none; color: var(--primary); font-size: 0.8rem; font-weight: 600; cursor: pointer; padding: 0; margin-top: 5px;">
                            See More (+${hiddenItems.length})
                        </button>
                    ` : ''}
                `;

                const seeMoreBtn = document.getElementById('see-more-depts');
                if (seeMoreBtn) {
                    seeMoreBtn.addEventListener('click', () => {
                        const hiddenEl = document.getElementById('hidden-depts');
                        if (hiddenEl.style.display === 'none') {
                            hiddenEl.style.display = 'block';
                            seeMoreBtn.textContent = 'See Less';
                        } else {
                            hiddenEl.style.display = 'none';
                            seeMoreBtn.textContent = `See More (+${hiddenItems.length})`;
                        }
                    });
                }
            }
        }
    }

    function getIconForAction(action) {
        if (action.includes('LOGIN')) return 'login';
        if (action.includes('CREATE')) return 'add_circle';
        if (action.includes('UPDATE')) return 'edit';
        if (action.includes('DELETE')) return 'delete';
        return 'history';
    }

    function formatAction(action) {
        return action.toLowerCase().replace(/_/g, ' ');
    }

    function timeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " years ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " months ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hours ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutes ago";
        return Math.floor(seconds) + " seconds ago";
    }

    // Select Users Mode Logic
    const toggleSelectModeBtn = document.getElementById('toggle-select-mode-btn');
    const toggleSelectText = document.getElementById('toggle-select-text');
    const usersTable = document.getElementById('users-table');

    if (toggleSelectModeBtn && usersTable) {
        toggleSelectModeBtn.addEventListener('click', () => {
            const isSelectMode = usersTable.classList.toggle('select-mode');

            if (isSelectMode) {
                toggleSelectText.textContent = 'Cancel Selection';
                toggleSelectModeBtn.classList.remove('btn-secondary');
                toggleSelectModeBtn.classList.add('btn-primary');
            } else {
                toggleSelectText.textContent = 'Select Users';
                toggleSelectModeBtn.classList.remove('btn-primary');
                toggleSelectModeBtn.classList.add('btn-secondary');

                // Uncheck all boxes
                const checkboxes = document.querySelectorAll('.row-checkbox');
                checkboxes.forEach(cb => {
                    cb.checked = false;
                    const tr = cb.closest('tr');
                    if (tr) tr.classList.remove('row-selected');
                });

                // Hide bulk action bar
                const bulkActionBar = document.getElementById('bulk-action-bar');
                if (bulkActionBar) bulkActionBar.style.display = 'none';
            }
        });
    }

    // Final Initialization
    if (localStorage.getItem('token')) {
        initDashboard();
        // Update admin name in UI
        const adminData = JSON.parse(localStorage.getItem('adminUser') || '{}');
        const adminNameElements = document.querySelectorAll('.admin-name');
        adminNameElements.forEach(el => el.textContent = `${adminData.first_name || 'Admin'} ${adminData.last_name || 'User'}`);
    }
});
