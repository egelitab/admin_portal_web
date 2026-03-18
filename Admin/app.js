document.addEventListener('DOMContentLoaded', () => {
    // 1. Navigation Logic
    const navItems = document.querySelectorAll('.nav-item');
    const viewSections = document.querySelectorAll('.view-section');
    const headerTitle = document.getElementById('section-title');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active'); // Instant switch

            viewSections.forEach(v => v.classList.remove('active'));
            const target = item.getAttribute('data-target');
            document.getElementById(target).classList.add('active');

            const title = item.querySelector('span:nth-child(2)').textContent;
            headerTitle.textContent = title;
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

    // 3. Search and Filter Logic for Users
    const searchInput = document.getElementById('user-search');
    const roleFilter = document.getElementById('role-filter');

    function filterUsers() {
        if (!searchInput || !roleFilter) return;

        const searchTerm = searchInput.value.toLowerCase();
        const roleTerm = roleFilter.value.toLowerCase();

        const userRows = document.querySelectorAll('#users-table-body tr');

        userRows.forEach(row => {
            const name = row.cells[1].textContent.toLowerCase();
            const email = row.cells[2].textContent.toLowerCase();
            const instId = row.cells[3].textContent.toLowerCase();
            const role = row.cells[4].textContent.toLowerCase();

            const matchesSearch = name.includes(searchTerm) || email.includes(searchTerm) || instId.includes(searchTerm);
            const matchesRole = roleTerm === 'all' || role.includes(roleTerm);

            if (matchesSearch && matchesRole) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    if (searchInput) searchInput.addEventListener('input', filterUsers);
    if (roleFilter) roleFilter.addEventListener('change', filterUsers);

    // Dynamic User Fetching
    const usersTableBody = document.getElementById('users-table-body');
    const API_URL = 'http://localhost:5000/api/users';

    async function fetchUsers() {
        if (!usersTableBody) return;
        try {
            const res = await fetch(API_URL);
            const json = await res.json();
            if (json.success) {
                renderUsers(json.data);
            }
        } catch (err) {
            console.error("Failed to fetch users", err);
        }
    }

    function renderUsers(users) {
        usersTableBody.innerHTML = '';
        users.forEach(user => {
            const tr = document.createElement('tr');
            tr.setAttribute('data-id', user.id);

            const middle = user.middle_name ? ` ${user.middle_name}` : '';
            const name = `${user.first_name || ''}${middle} ${user.last_name || ''}`.trim();
            const roleBadge = user.role === 'admin' ? 'role-instructor' : (user.role === 'instructor' ? 'role-instructor' : 'role-student');
            const roleDisplay = user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Unknown';
            const statusBadge = user.is_active ? 'status-active' : 'status-suspended';
            const statusDisplay = user.is_active ? 'Active' : 'Suspended';

            tr.innerHTML = `
                <td class="checkbox-col"><input type="checkbox" class="row-checkbox"></td>
                <td>
                    <div class="user-info-cell">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&rounded=true" alt="Avatar" class="avatar-sm">
                        <span class="user-name clickable-name">${user.title ? user.title + ' ' : ''}${name}</span>
                    </div>
                </td>
                <td class="text-muted">${user.email}</td>
                <td class="text-muted">${user.institutional_id || '-'}</td>
                <td><span class="badge ${roleBadge}">${roleDisplay}</span></td>
                <td class="text-muted">${user.department_name || 'N/A'}</td>
                <td><span class="badge ${statusBadge}">${statusDisplay}</span></td>
                <td class="actions-cell" style="justify-content: center;">
                    <label class="toggle-switch" title="Toggle Status">
                        <input type="checkbox" ${user.is_active ? 'checked' : ''} onchange="toggleUserStatus('${user.id}', this.checked)">
                        <span class="slider round"></span>
                    </label>
                </td>
            `;
            usersTableBody.appendChild(tr);
        });

        // Re-attach profile drawer events
        // (Delegation takes care of this now)
    }

    window.toggleUserStatus = async function (id, isActive) {
        try {
            await fetch(`${API_URL}/${id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: isActive })
            });
            fetchUsers();
        } catch (err) {
            console.error("Failed to update status", err);
        }
    };

    fetchUsers();

    // Fetch and populate departments
    async function fetchDepartments() {
        try {
            const res = await fetch('http://localhost:5000/api/departments');
            const data = await res.json();
            if (data.success) {
                const deptSelects = [
                    document.getElementById('department'),
                    document.getElementById('profile-department')
                ];
                deptSelects.forEach(selectEl => {
                    if (selectEl) {
                        selectEl.innerHTML = '<option value="" disabled selected hidden>Select department...</option>';
                        data.data.forEach(dept => {
                            const option = document.createElement('option');
                            option.value = dept.id;
                            option.textContent = dept.name;
                            selectEl.appendChild(option);
                        });
                    }
                });
            }
        } catch (err) {
            console.error("Failed to fetch departments", err);
        }
    }
    fetchDepartments();

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

    // Role-dependent field toggling
    const roleSelect = document.getElementById('role');
    const deptGroup = document.getElementById('department-group');
    const instIdGroup = document.getElementById('institutional-id-group');
    const deptInput = document.getElementById('department');
    const instIdInput = document.getElementById('institutional-id');

    if (roleSelect) {
        roleSelect.addEventListener('change', (e) => {
            if (e.target.value === 'student') {
                if (deptGroup) deptGroup.style.display = 'block';
                if (instIdGroup) instIdGroup.style.display = 'block';
                if (deptInput) deptInput.required = true;
                if (instIdInput) instIdInput.required = true;
            } else {
                if (deptGroup) deptGroup.style.display = 'none';
                if (instIdGroup) instIdGroup.style.display = 'none';
                if (deptInput) {
                    deptInput.required = false;
                    deptInput.value = '';
                }
                if (instIdInput) {
                    instIdInput.required = false;
                    instIdInput.value = '';
                }
            }
        });
    }

    // 5. Form Submissions
    const userForm = document.getElementById('create-user-form');
    if (userForm) {
        userForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('title').value;
            const firstName = document.getElementById('first-name').value.trim();
            const middleNameInput = document.getElementById('middle-name');
            const middleName = middleNameInput ? middleNameInput.value.trim() : '';
            const lastName = document.getElementById('last-name').value.trim();
            const email = document.getElementById('email').value.trim();
            const role = document.getElementById('role').value;

            const deptEl = document.getElementById('department');
            const departmentId = deptEl ? (deptEl.value || null) : null;

            const instIdEl = document.getElementById('institutional-id');
            const instId = instIdEl ? (instIdEl.value.trim() || null) : null;

            const fullName = `${title ? title + ' ' : ''}${firstName} ${lastName}`.trim();

            try {
                const payload = {
                    title: title,
                    first_name: firstName,
                    middle_name: middleName,
                    last_name: lastName,
                    email: email,
                    role: role,
                    department_id: departmentId,
                    institutional_id: instId
                };

                const res = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.success) {
                    alert(`User ${fullName} created successfully!`);
                    modal.classList.remove('show');
                    userForm.reset();
                    fetchUsers();
                } else {
                    alert(`Error creating user: ${data.message}`);
                }
            } catch (err) {
                console.error(err);
                alert("Failed to create user.");
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
    const backupBtn = document.getElementById('backup-btn');
    if (backupBtn) {
        backupBtn.addEventListener('click', () => {
            alert('Backup Started! System data is being securely archived.');
        });
    }

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

    // 8. Bulk Action Checkbox Logic (Using Event Delegation)
    const bulkActionBar = document.getElementById('bulk-action-bar');
    const bulkActionCount = document.getElementById('bulk-action-count');
    const globalViewBtn = document.getElementById('global-view-btn');
    const globalEditBtn = document.getElementById('global-edit-btn');

    // Checkbox delegation and Drawer delegation on usersTableBody
    if (usersTableBody) {
        usersTableBody.addEventListener('change', (e) => {
            if (e.target.classList.contains('row-checkbox')) {
                const tr = e.target.closest('tr');
                if (e.target.checked) {
                    tr.classList.add('row-selected');
                } else {
                    tr.classList.remove('row-selected');
                }

                if (bulkActionBar) {
                    const checkedCount = document.querySelectorAll('.row-checkbox:checked').length;
                    if (checkedCount > 0) {
                        bulkActionBar.style.display = 'flex';
                        if (bulkActionCount) bulkActionCount.textContent = `${checkedCount} User${checkedCount > 1 ? 's' : ''} Selected`;

                        if (globalViewBtn && globalEditBtn) {
                            if (checkedCount === 1) {
                                globalViewBtn.classList.add('active');
                                globalViewBtn.disabled = false;
                                globalEditBtn.classList.add('active');
                                globalEditBtn.disabled = false;
                            } else {
                                globalViewBtn.classList.remove('active');
                                globalViewBtn.disabled = true;
                                globalEditBtn.classList.remove('active');
                                globalEditBtn.disabled = true;
                            }
                        }
                    } else {
                        bulkActionBar.style.display = 'none';

                        if (globalViewBtn && globalEditBtn) {
                            globalViewBtn.classList.remove('active');
                            globalViewBtn.disabled = true;
                            globalEditBtn.classList.remove('active');
                            globalEditBtn.disabled = true;
                        }
                    }
                }
            }
        });

        usersTableBody.addEventListener('click', (e) => {
            if (e.target.closest('.clickable-name')) {
                openDrawerWithRowData(e.target.closest('tr'));
            }
        });
    }

    // Bulk Delete & Suspend Feature
    const deleteSelectedBtn = document.getElementById('delete-selected-btn');
    const suspendSelectedBtn = document.getElementById('suspend-selected-btn');

    if (deleteSelectedBtn) {
        deleteSelectedBtn.addEventListener('click', async () => {
            const checkedBoxes = document.querySelectorAll('.row-checkbox:checked');
            if (checkedBoxes.length === 0) return;
            if (!confirm(`Are you sure you want to permanently delete ${checkedBoxes.length} user(s)?`)) return;

            const promises = [];
            checkedBoxes.forEach(box => {
                const tr = box.closest('tr');
                const userId = tr.getAttribute('data-id');
                if (userId) {
                    promises.push(fetch(`${API_URL}/${userId}`, {
                        method: 'DELETE'
                    }));
                }
            });

            try {
                await Promise.all(promises);
                if (bulkActionBar) bulkActionBar.style.display = 'none';
                fetchUsers(); // Refresh the list
            } catch (err) {
                console.error("Error during bulk delete", err);
                alert("Failed to delete some or all users.");
            }
        });
    }

    if (suspendSelectedBtn) {
        suspendSelectedBtn.addEventListener('click', async () => {
            const checkedBoxes = document.querySelectorAll('.row-checkbox:checked');
            if (checkedBoxes.length === 0) return;
            if (!confirm(`Are you sure you want to suspend ${checkedBoxes.length} user(s)?`)) return;

            const promises = [];
            checkedBoxes.forEach(box => {
                const tr = box.closest('tr');
                const userId = tr.getAttribute('data-id');
                if (userId) {
                    promises.push(fetch(`${API_URL}/${userId}/status`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ is_active: false })
                    }));
                }
            });

            try {
                await Promise.all(promises);
                if (bulkActionBar) bulkActionBar.style.display = 'none';
                fetchUsers(); // Refresh the list
            } catch (err) {
                console.error("Error during bulk suspend", err);
                alert("Failed to suspend some or all users.");
            }
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
        const instId = tr.cells[3].textContent;
        const roleHtml = tr.cells[4].innerHTML;
        const dept = tr.cells[5].textContent;
        const statusHtml = tr.cells[6].innerHTML;

        document.getElementById('drawer-avatar').src = avatarSrc;
        document.getElementById('drawer-name').textContent = nameText;
        document.getElementById('drawer-email').textContent = email;
        document.getElementById('drawer-role').outerHTML = `<span id="drawer-role">${roleHtml}</span>`;

        const isStudent = roleHtml.toLowerCase().includes('student');
        const deptGroup = document.getElementById('drawer-dept-group');
        const instIdGroup = document.getElementById('drawer-inst-id-group');

        if (isStudent) {
            if (deptGroup) deptGroup.style.display = 'block';
            if (instIdGroup) instIdGroup.style.display = 'block';
            document.getElementById('drawer-dept').textContent = dept;
            document.getElementById('drawer-inst-id').textContent = instId;
        } else {
            if (deptGroup) deptGroup.style.display = 'none';
            if (instIdGroup) instIdGroup.style.display = 'none';
        }

        document.getElementById('drawer-status').outerHTML = `<span id="drawer-status">${statusHtml}</span>`;

        profileDrawer.classList.add('open');
    };

    if (profileDrawer && closeDrawerBtn) {
        closeDrawerBtn.addEventListener('click', () => {
            profileDrawer.classList.remove('open');
        });
    }

    if (globalViewBtn) {
        globalViewBtn.addEventListener('click', () => {
            const checkedCheckbox = document.querySelector('.row-checkbox:checked');
            if (checkedCheckbox) openDrawerWithRowData(checkedCheckbox.closest('tr'));
        });
    }

    if (globalEditBtn) {
        globalEditBtn.addEventListener('click', () => {
            const checkedCheckbox = document.querySelector('.row-checkbox:checked');
            if (checkedCheckbox) openDrawerWithRowData(checkedCheckbox.closest('tr'));
        });
    }
});
