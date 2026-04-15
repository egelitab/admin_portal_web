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
        updateDashboardStats();
        fetchLogs();
    }

    // Call init if authorized
    if (localStorage.getItem('token')) {
        initDashboard();
        // Update admin name in UI
        const adminData = JSON.parse(localStorage.getItem('adminUser') || '{}');
        const adminNameElements = document.querySelectorAll('.admin-name');
        adminNameElements.forEach(el => el.textContent = `${adminData.first_name} ${adminData.last_name}`);
    }

    // 1. Navigation Logic
    const navItems = document.querySelectorAll('.nav-item');
    const viewSections = document.querySelectorAll('.view-section');
    const headerTitle = document.getElementById('section-title');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (item.id === 'logout-btn') return;

            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active'); // Instant switch

            viewSections.forEach(v => v.classList.remove('active'));
            const target = item.getAttribute('data-target');
            document.getElementById(target).classList.add('active');

            const title = item.querySelector('span:nth-child(2)').textContent;
            headerTitle.textContent = title;

            const breadcrumbEl = document.getElementById('breadcrumb');
            if (breadcrumbEl) {
                breadcrumbEl.textContent = title === 'Dashboard' ? 'Dashboard' : `Dashboard / ${title}`;
            }

            const createUserBtn = document.getElementById('open-create-user-modal');
            if (createUserBtn) {
                createUserBtn.style.display = target === 'users' ? 'flex' : 'none';
            }
        });
    });

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
                    // stats[2] is Disk storage in HTML, let's check index.html again
                    // statValues[0] is Total Users
                    // statValues[1] is Active Sessions
                    // statValues[2] is actually handled by updateDiskStorage usually, but let's see
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
                    name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Unknown',
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

        const facultyFilter = document.getElementById('faculty-filter');
        const selectedFaculty = facultyFilter ? facultyFilter.value : 'all';

        const filteredDivs = allDepartments.filter(d => {
            if (selectedFaculty === 'all') return true;
            return d.faculty_name === selectedFaculty;
        });

        const addNewCardHtml = `
            <div class="department-card add-new-dept-card" onclick="document.getElementById('add-department-modal').style.display='flex'">
                <span class="material-symbols-outlined">add</span>
                <h3>Add New Department</h3>
            </div>
        `;

        const cardsHtml = filteredDivs.map(dept => {
            const staffCount = usersData.filter(u => u.dept === dept.name && ['Admin', 'Instructor', 'Administrator'].includes(u.role)).length;
            const studentCount = usersData.filter(u => u.dept === dept.name && u.role === 'Student').length;

            return `
            <div class="department-card" onclick="navigateToUsersTabAndFilter('${dept.name}')">
                <div class="dept-card-top">
                    <div class="dept-title-area">
                        <div class="dept-icon-small" style="background: rgba(48, 86, 211, 0.1); color: var(--primary);">
                            <span class="material-symbols-outlined">domain</span>
                        </div>
                        <h3 class="dept-name" title="${dept.name}" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;">${dept.name}</h3>
                    </div>
                    <button class="icon-btn edit-dept" title="Edit Department" onclick="event.stopPropagation()"><span class="material-symbols-outlined">edit</span></button>
                </div>
                <div class="dept-card-middle">
                    <p class="text-muted" style="font-size: 0.85rem;" title="${dept.faculty_name || 'N/A'}">${dept.faculty_name || 'N/A'}</p>
                </div>
                <div class="dept-stats-boxes">
                    <div class="stat-box">
                        <span class="stat-label">Staff</span>
                        <span class="stat-num">${staffCount || 0}</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-label">Students</span>
                        <span class="stat-num">${studentCount || 0}</span>
                    </div>
                </div>
            </div>`;
        }).join('');

        gridContainer.innerHTML = cardsHtml + addNewCardHtml;
    }

    async function fetchFaculties() {
        try {
            const response = await authFetch(`${API_BASE_URL}/departments/faculties`);
            const result = await response.json();
            if (result.success) {
                allFaculties = result.data;
                const facultyFilterList = document.getElementById('faculty-filter');
                if (facultyFilterList) {
                    facultyFilterList.innerHTML = '<option value="all">All Faculties</option>';
                    allFaculties.forEach(f => {
                        const opt = document.createElement('option');
                        opt.value = f.name;
                        opt.textContent = f.name;
                        facultyFilterList.appendChild(opt);
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
            }
        } catch (error) {
            console.error('Error fetching faculties:', error);
        }
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
                    <td class="actions-cell" style="justify-content: center;">
                        <label class="toggle-switch" title="Toggle Status">
                            <input type="checkbox" class="status-toggle" data-id="${user.id}" ${user.status === 'Suspended' ? '' : 'checked'}>
                            <span class="slider round"></span>
                        </label>
                    </td>
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

    // --- 1. Course Registration Logic ---
    let courses = [];
    const courseTableBody = document.getElementById('courses-table-body');

    async function fetchCourses() {
        try {
            const response = await authFetch(`${API_BASE_URL}/courses`);
            const result = await response.json();
            if (result.success) {
                courses = result.data;
                renderCourses();
            }
        } catch (error) {
            console.error('Error fetching courses:', error);
        }
    }

    // Add fetchCourses to initDashboard
    const oldInit = initDashboard;
    initDashboard = function () {
        oldInit();
        fetchCourses();
    };

    // Render courses to the table
    const renderCourses = () => {
        if (!courseTableBody) return;
        courseTableBody.innerHTML = '';
        courses.forEach(course => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${course.course_code}</strong></td>
                <td>${course.title}</td>
                <td>${course.department_name || '-'}</td>
                <td>${course.credits || 3}</td>
                <td><button class="icon-btn edit"><span class="material-symbols-outlined">edit</span></button></td>
            `;
            courseTableBody.appendChild(tr);
        });
    };

    const courseForm = document.getElementById('course-form');
    // Error feedback element
    const courseErrorMsg = document.createElement('p');
    courseErrorMsg.style.color = '#ef4444';
    courseErrorMsg.style.fontSize = '0.85rem';
    courseErrorMsg.style.marginTop = '8px';
    courseErrorMsg.style.display = 'none';
    if (courseForm) courseForm.appendChild(courseErrorMsg);

    if (courseForm) {
        courseForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const title = document.getElementById('course-name').value.trim();
            const course_code = document.getElementById('course-code').value.trim().toUpperCase();
            const credits = document.getElementById('course-credits').value;
            const deptName = document.getElementById('course-dept').value;

            const foundDept = allDepartments.find(d => d.name === deptName);
            const department_id = foundDept ? foundDept.id : null;

            if (!title || !course_code || !department_id) {
                courseErrorMsg.textContent = 'Please fill out all fields before submitting.';
                courseErrorMsg.style.display = 'block';
                return;
            }

            try {
                const response = await authFetch(`${API_BASE_URL}/courses`, {
                    method: 'POST',
                    body: JSON.stringify({ title, course_code, credits, department_id })
                });
                const result = await response.json();

                if (result.success) {
                    alert('New course registered successfully!');
                    courseForm.reset();
                    fetchCourses();
                } else {
                    alert(`Failed to create course: ${result.message}`);
                }
            } catch (error) {
                alert(`Error: ${error.message}`);
            }
        });
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
        const toggleBoxes = document.querySelectorAll('.status-toggle');
        toggleBoxes.forEach(toggle => {
            // Remove previous listeners
            const newToggle = toggle.cloneNode(true);
            toggle.parentNode.replaceChild(newToggle, toggle);

            newToggle.addEventListener('change', async function () {
                const id = this.getAttribute('data-id');
                const isActive = this.checked;
                try {
                    await authFetch(`${API_BASE_URL}/users/${id}/status`, {
                        method: 'PATCH',
                        body: JSON.stringify({ is_active: isActive })
                    });

                    // Update user's status in usersData without refetching fully if we want,
                    // but calling fetchUsers is easier to ensure data is synced:
                    fetchUsers();
                } catch (e) {
                    console.error('Error toggling status:', e);
                }
            });
        });
    }

    // 9. Profile Drawer Logic
    const profileDrawer = document.getElementById('profile-drawer');
    const closeDrawerBtn = document.getElementById('close-drawer-btn');

    const openDrawerWithRowData = (tr) => {
        if (!tr || !profileDrawer) return;
        const avatarSrc = tr.querySelector('.avatar-sm').src;
        const nameText = tr.querySelector('.user-name').textContent;
        const email = tr.cells[2].textContent;
        const roleHtml = tr.cells[3].innerHTML;
        const dept = tr.cells[4].textContent;
        const statusHtml = tr.cells[5].innerHTML;

        document.getElementById('drawer-avatar').src = avatarSrc;
        document.getElementById('drawer-name').textContent = nameText;
        document.getElementById('drawer-email').textContent = email;
        document.getElementById('drawer-role').outerHTML = `<span id="drawer-role">${roleHtml}</span>`;
        document.getElementById('drawer-dept').textContent = dept;
        document.getElementById('drawer-status').outerHTML = `<span id="drawer-status">${statusHtml}</span>`;

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
});
