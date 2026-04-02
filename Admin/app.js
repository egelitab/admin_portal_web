document.addEventListener('DOMContentLoaded', () => {
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
    function updateDashboardStats() {
        // Dummy data for now
        const stats = {
            students: 4250,
            instructors: 142,
            courses: 95,
            status: "Healthy"
        };

        // Find elements and update them
        const statValues = document.querySelectorAll('.stat-value');
        if (statValues.length >= 4) {
            statValues[0].textContent = stats.students.toLocaleString();
            statValues[1].textContent = stats.instructors;
            statValues[2].textContent = stats.courses;
            statValues[3].textContent = stats.status;
            statValues[3].className = 'stat-value';
        }
    }

    // Call immediately
    updateDashboardStats();

    // Dynamic Disk Storage Updater
    const updateDiskStorage = () => {
        const USED_STORAGE_GB = 340; // You can change this dynamically
        const TOTAL_STORAGE_GB = 500; // Constant

        const percentage = Math.round((USED_STORAGE_GB / TOTAL_STORAGE_GB) * 100);

        const diskPercentageEl = document.getElementById('disk-percentage');
        const diskProgressEl = document.getElementById('disk-progress');
        const diskTextEl = document.getElementById('disk-text');

        if (diskPercentageEl && diskProgressEl && diskTextEl) {
            diskPercentageEl.textContent = `${percentage}%`;
            diskProgressEl.style.width = `${percentage}%`;
            diskTextEl.textContent = `${USED_STORAGE_GB}GB / ${TOTAL_STORAGE_GB}GB Used`;
        }
    };

    updateDiskStorage();

    // 3. User Data & Pagination Logic
    let usersData = [];
    let filteredUsers = [];
    let allDepartments = [];
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
            const response = await fetch('http://localhost:5000/api/users');
            const result = await response.json();
            if (result.success) {
                usersData = result.data.map(u => ({
                    id: u.id,
                    name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Unknown',
                    email: u.email,
                    role: u.role ? (u.role.charAt(0).toUpperCase() + u.role.slice(1)) : 'Student',
                    roleClass: u.role === 'admin' ? 'role-admin' : (u.role === 'instructor' ? 'role-instructor' : 'role-student'),
                    dept: u.department_name || '-',
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
            const response = await fetch('http://localhost:5000/api/departments');
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
            }
        } catch (error) {
            console.error('Error fetching departments:', error);
        }
    }

    // Initial load
    fetchUsers();
    fetchDepartments();

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
                const response = await fetch('http://localhost:5000/api/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
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
                    await fetch(`http://localhost:5000/api/users/${id}`, { method: 'DELETE' });
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
                    await fetch(`http://localhost:5000/api/users/${id}/status`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
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
    let courses = [
        { code: 'CS101', name: 'Introduction to Programming', dept: 'Computer Science', credits: 3 },
        { code: 'MATH201', name: 'Calculus II', dept: 'Mathematics', credits: 4 }
    ];

    const courseTableBody = document.getElementById('courses-table-body');

    // Render courses to the table
    const renderCourses = () => {
        if (!courseTableBody) return;
        courseTableBody.innerHTML = '';
        courses.forEach(course => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${course.code}</strong></td>
                <td>${course.name}</td>
                <td>${course.dept}</td>
                <td>${course.credits}</td>
                <td><button class="icon-btn edit"><span class="material-symbols-outlined">edit</span></button></td>
            `;
            courseTableBody.appendChild(tr);
        });
    };

    // Initial Render
    renderCourses();

    const courseForm = document.getElementById('course-form');
    // Error feedback element
    const courseErrorMsg = document.createElement('p');
    courseErrorMsg.style.color = '#ef4444';
    courseErrorMsg.style.fontSize = '0.85rem';
    courseErrorMsg.style.marginTop = '8px';
    courseErrorMsg.style.display = 'none';
    if (courseForm) courseForm.appendChild(courseErrorMsg);

    if (courseForm) {
        courseForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const name = document.getElementById('course-name').value.trim();
            const code = document.getElementById('course-code').value.trim().toUpperCase();
            const credits = document.getElementById('course-credits').value;
            const dept = document.getElementById('course-dept').value;

            // --- 2. Form Validation ---
            if (!name || !code || !credits || !dept) {
                courseErrorMsg.textContent = 'Please fill out all fields before submitting.';
                courseErrorMsg.style.display = 'block';
                return;
            }

            courseErrorMsg.style.display = 'none';

            // Add to array
            courses.push({
                code: code,
                name: name,
                dept: dept,
                credits: parseInt(credits)
            });

            // Re-render and reset
            renderCourses();
            courseForm.reset();
            alert('New course registered successfully!');
        });
    }

    // --- 3. Support Inbox Mockup ---
    const tickets = [
        { id: '#1045', user: 'a.smith@university.edu', subject: 'Forgot Password', status: 'Open', statusColor: '#fef3c7', textColor: '#d97706', date: 'Just Now' },
        { id: '#1044', user: 'faculty.john@university.edu', subject: 'Cannot upload PDF to syllabus', status: 'Open', statusColor: '#fef3c7', textColor: '#d97706', date: '1 hr ago' },
        { id: '#1043', user: 'm.lee@university.edu', subject: 'Course registration failing', status: 'In Progress', statusColor: '#e0f2fe', textColor: '#0369a1', date: '3 hrs ago' },
        { id: '#1042', user: 'john.d@university.edu', subject: 'Cannot access CS101 materials', status: 'Resolved', statusColor: '#d1fae5', textColor: '#047857', date: 'Yesterday' },
        { id: '#1041', user: 's.jenkins@university.edu', subject: 'Grade submission error', status: 'Resolved', statusColor: '#d1fae5', textColor: '#047857', date: 'Yesterday' }
    ];

    const supportTableBody = document.getElementById('support-table-body');
    const renderSupportTickets = () => {
        if (!supportTableBody) return;
        supportTableBody.innerHTML = '';
        tickets.forEach(ticket => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${ticket.id}</strong></td>
                <td>${ticket.user}</td>
                <td>${ticket.subject}</td>
                <td><span class="badge" style="background: ${ticket.statusColor}; color: ${ticket.textColor};">${ticket.status}</span></td>
                <td>${ticket.date}</td>
                <td><button class="btn btn-secondary btn-sm">View Ticket</button></td>
            `;
            supportTableBody.appendChild(tr);
        });
    }

    renderSupportTickets();

    // 6. Action Buttons

    const triggerManualBackupBtn = document.getElementById('trigger-manual-backup');
    const backupStatusMsg = document.getElementById('backup-status-msg');
    if (triggerManualBackupBtn && backupStatusMsg) {
        triggerManualBackupBtn.addEventListener('click', () => {
            const originalContent = triggerManualBackupBtn.innerHTML;
            triggerManualBackupBtn.innerHTML = '<span class="material-symbols-outlined" style="animation: spin 1s linear infinite;">sync</span><span class="backup-text">Backing up database...</span>';
            triggerManualBackupBtn.disabled = true;
            backupStatusMsg.style.display = 'none';

            setTimeout(() => {
                triggerManualBackupBtn.innerHTML = originalContent;
                triggerManualBackupBtn.disabled = false;
                backupStatusMsg.textContent = 'Success: Backup saved to /server/backups/db_backup.sql';
                backupStatusMsg.style.color = '#10b981'; // Success color
                backupStatusMsg.style.display = 'block';
            }, 3000);
        });
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            alert('Clearing session and logging out...');
        });
    }

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
                    await fetch(`http://localhost:5000/api/users/${id}/status`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
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
});
