/**
 * HCM Lite - Employee Management Module (js/employees.js)
 * Handles Employee CRUD, search, filtering, CSV export, and role generation.
 */

const Employees = {
  currentFilter: 'all',
  currentDept: 'all',
  searchQuery: '',

  init() {
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    // Add Employee Button
    const addBtn = document.getElementById('openAddEmployeeBtn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.openAddModal();
      });
    }

    // Add/Edit Form Submission
    const form = document.getElementById('employeeForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleFormSubmit();
      });
    }

    // Search Input
    const searchInput = document.getElementById('employeeSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderTable();
      });
    }

    // Filter by Status
    const statusFilter = document.getElementById('employeeStatusFilter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.currentFilter = e.target.value;
        this.renderTable();
      });
    }

    // Filter by Department
    const deptFilter = document.getElementById('employeeDeptFilter');
    if (deptFilter) {
      deptFilter.addEventListener('change', (e) => {
        this.currentDept = e.target.value;
        this.renderTable();
      });
    }

    // Export to CSV Button
    const exportBtn = document.getElementById('exportEmployeesBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.exportToCSV();
      });
    }
  },

  openAddModal() {
    document.getElementById('modalEmployeeTitle').textContent = 'Add New Employee';
    document.getElementById('employeeId').value = '';
    document.getElementById('employeeForm').reset();
    document.getElementById('employeePassword').required = true;
    document.getElementById('passwordHelpText').textContent = 'This password will allow the employee to log in.';
    document.getElementById('employeeJoiningDate').value = Storage.getTodayString();
    UI.openModal('employeeModal');
  },

  openEditModal(id) {
    const user = Storage.getUserById(id);
    if (!user) return;

    document.getElementById('modalEmployeeTitle').textContent = 'Edit Employee Details';
    document.getElementById('employeeId').value = user.id;
    document.getElementById('employeeName').value = user.name;
    document.getElementById('employeeEmail').value = user.email;
    document.getElementById('employeePassword').value = user.password;
    document.getElementById('employeePassword').required = false;
    document.getElementById('passwordHelpText').textContent = 'Leave unchanged or type a new password.';
    document.getElementById('employeeDepartment').value = user.department;
    document.getElementById('employeeDesignation').value = user.designation;
    document.getElementById('employeePhone').value = user.phone || '';
    document.getElementById('employeeSalary').value = user.salary;
    document.getElementById('employeeJoiningDate').value = user.joiningDate;
    document.getElementById('employeeStatus').value = user.status;

    UI.openModal('employeeModal');
  },

  handleFormSubmit() {
    const id = document.getElementById('employeeId').value;
    const name = document.getElementById('employeeName').value.trim();
    const email = document.getElementById('employeeEmail').value.trim().toLowerCase();
    const password = document.getElementById('employeePassword').value;
    const department = document.getElementById('employeeDepartment').value;
    const designation = document.getElementById('employeeDesignation').value.trim();
    const phone = document.getElementById('employeePhone').value.trim();
    const salary = parseFloat(document.getElementById('employeeSalary').value);
    const joiningDate = document.getElementById('employeeJoiningDate').value;
    const status = document.getElementById('employeeStatus').value;

    // Validation
    if (!name || !email || !department || !designation || !joiningDate) {
      UI.alert('Validation Error', 'Please fill in all mandatory fields.', 'warning');
      return;
    }

    if (isNaN(salary) || salary <= 0) {
      UI.alert('Invalid Salary', 'Monthly salary must be a positive number greater than 0.', 'error');
      return;
    }

    if (!id && (!password || password.length < 6)) {
      UI.alert('Password Required', 'Initial password must be at least 6 characters long.', 'error');
      return;
    }

    try {
      const payload = {
        id: id || undefined,
        name,
        email,
        password: password || '123456',
        role: 'employee',
        department,
        designation,
        phone,
        salary,
        joiningDate,
        status
      };

      Storage.saveUser(payload);
      UI.closeModal('employeeModal');
      UI.toast('success', id ? 'Employee details updated.' : 'New employee registered successfully.');
      this.render();
    } catch (err) {
      UI.alert('Error', err.message, 'error');
    }
  },

  confirmDelete(id) {
    const user = Storage.getUserById(id);
    if (!user) return;

    if (window.Swal) {
      Swal.fire({
        title: `Delete ${user.name}?`,
        html: `Are you sure you want to delete this employee? <br><small class="text-muted">Associated attendance and leave records will also be safely cleaned up to prevent orphaned records.</small>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, Delete Employee'
      }).then((result) => {
        if (result.isConfirmed) {
          Storage.deleteUser(id);
          UI.toast('success', 'Employee record removed.');
          this.render();
        }
      });
    } else {
      if (confirm(`Delete ${user.name}? Associated attendance and leave records will be removed.`)) {
        Storage.deleteUser(id);
        this.render();
      }
    }
  },

  render() {
    this.populateDepartmentFilter();
    this.renderStats();
    this.renderTable();
  },

  populateDepartmentFilter() {
    const select = document.getElementById('employeeDeptFilter');
    if (!select) return;

    const users = Storage.getUsers().filter(u => u.role === 'employee');
    const departments = Array.from(new Set(users.map(u => u.department))).filter(Boolean);

    let html = '<option value="all">All Departments</option>';
    departments.forEach(dept => {
      html += `<option value="${UI.escapeHTML(dept)}">${UI.escapeHTML(dept)}</option>`;
    });
    select.innerHTML = html;
  },

  renderStats() {
    const users = Storage.getUsers().filter(u => u.role === 'employee');
    const active = users.filter(u => u.status === 'active').length;
    const inactive = users.filter(u => u.status === 'inactive').length;

    const totalEl = document.getElementById('empStatTotal');
    const activeEl = document.getElementById('empStatActive');
    const inactiveEl = document.getElementById('empStatInactive');

    if (totalEl) totalEl.textContent = users.length;
    if (activeEl) activeEl.textContent = active;
    if (inactiveEl) inactiveEl.textContent = inactive;
  },

  renderTable() {
    const tbody = document.getElementById('employeeTableBody');
    const emptyState = document.getElementById('employeeEmptyState');
    const tableContainer = document.getElementById('employeeTableContainer');
    const countEl = document.getElementById('employeeCountDisplay');

    if (!tbody) return;

    let list = Storage.getUsers().filter(u => u.role === 'employee');

    // Filter by status
    if (this.currentFilter !== 'all') {
      list = list.filter(u => u.status === this.currentFilter);
    }

    // Filter by department
    if (this.currentDept !== 'all') {
      list = list.filter(u => u.department === this.currentDept);
    }

    // Search query
    if (this.searchQuery) {
      list = list.filter(u => 
        u.name.toLowerCase().includes(this.searchQuery) ||
        u.email.toLowerCase().includes(this.searchQuery) ||
        u.id.toLowerCase().includes(this.searchQuery) ||
        u.designation.toLowerCase().includes(this.searchQuery)
      );
    }

    if (countEl) countEl.textContent = `Showing ${list.length} employee${list.length === 1 ? '' : 's'}`;

    if (list.length === 0) {
      if (emptyState) emptyState.style.display = 'flex';
      if (tableContainer) tableContainer.style.display = 'none';
      tbody.innerHTML = '';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (tableContainer) tableContainer.style.display = 'block';

    tbody.innerHTML = list.map(emp => {
      const initials = emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      const statusBadge = emp.status === 'active' 
        ? '<span class="badge badge-success"><i data-lucide="check-circle" style="width:12px;height:12px"></i> Active</span>' 
        : '<span class="badge badge-neutral">Inactive</span>';

      return `
        <tr>
          <td>
            <div class="user-table-cell">
              <div class="user-table-avatar">${initials}</div>
              <div class="user-table-details">
                <span class="user-table-name">${UI.escapeHTML(emp.name)}</span>
                <span class="user-table-sub">${UI.escapeHTML(emp.email)}</span>
              </div>
            </div>
          </td>
          <td><span class="badge badge-info">${UI.escapeHTML(emp.id)}</span></td>
          <td>
            <div style="font-weight: 600; color: var(--text-main);">${UI.escapeHTML(emp.designation)}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">${UI.escapeHTML(emp.department)}</div>
          </td>
          <td>${UI.escapeHTML(emp.phone || '-')}</td>
          <td style="font-weight: 600;">${UI.formatCurrency(emp.salary)}</td>
          <td>${UI.formatDate(emp.joiningDate)}</td>
          <td>${statusBadge}</td>
          <td>
            <div class="action-btn-group">
              <button class="action-btn btn-edit" title="Edit Employee" onclick="Employees.openEditModal('${emp.id}')">
                <i data-lucide="edit-2" style="width: 15px; height: 15px;"></i>
              </button>
              <button class="action-btn btn-delete" title="Delete Employee" onclick="Employees.confirmDelete('${emp.id}')">
                <i data-lucide="trash-2" style="width: 15px; height: 15px;"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    UI.initIcons();
  },

  exportToCSV() {
    const list = Storage.getUsers().filter(u => u.role === 'employee');
    if (list.length === 0) {
      UI.alert('No Records', 'There are no employees to export.', 'info');
      return;
    }

    const headers = ['ID', 'Full Name', 'Email', 'Department', 'Designation', 'Phone', 'Salary', 'Joining Date', 'Status'];
    const rows = list.map(e => [
      `"${e.id}"`,
      `"${e.name.replace(/"/g, '""')}"`,
      `"${e.email}"`,
      `"${e.department.replace(/"/g, '""')}"`,
      `"${e.designation.replace(/"/g, '""')}"`,
      `"${e.phone || ''}"`,
      e.salary,
      `"${e.joiningDate}"`,
      `"${e.status}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `hcm_employees_${Storage.getTodayString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    UI.toast('success', 'Employees list exported to CSV.');
  }
};
