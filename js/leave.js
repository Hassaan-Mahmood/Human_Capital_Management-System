/**
 * HCM Lite - Leave Management Module (js/leave.js)
 * Manages Leave Applications, Working-day computations, Admin Approvals/Rejections & Quotas.
 */

const Leaves = {
  adminFilterStatus: 'all',
  adminFilterType: 'all',
  adminSearchQuery: '',

  // ================= EMPLOYEE LEAVE APPLICATION =================
  initEmployeeLeave() {
    this.bindEmployeeEvents();
    this.renderEmployeeLeaveSummary();
    this.renderEmployeeLeaveHistory();
  },

  bindEmployeeEvents() {
    const form = document.getElementById('leaveApplyForm');
    const startDateInput = document.getElementById('leaveStartDate');
    const endDateInput = document.getElementById('leaveEndDate');
    const workingDaysDisplay = document.getElementById('calculatedWorkingDays');

    // Auto calculate working days when dates change
    const updateDaysCount = () => {
      const start = startDateInput?.value;
      const end = endDateInput?.value;
      if (start && end && start <= end) {
        const days = Storage.calculateWorkingDays(start, end);
        if (workingDaysDisplay) {
          workingDaysDisplay.textContent = `${days} working day${days === 1 ? '' : 's'}`;
        }
      } else if (workingDaysDisplay) {
        workingDaysDisplay.textContent = '0 working days';
      }
    };

    if (startDateInput) startDateInput.addEventListener('change', updateDaysCount);
    if (endDateInput) endDateInput.addEventListener('change', updateDaysCount);

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleEmployeeApply();
      });
    }
  },

  handleEmployeeApply() {
    const session = Storage.getSession();
    if (!session) return;

    const leaveType = document.getElementById('leaveType').value;
    const startDate = document.getElementById('leaveStartDate').value;
    const endDate = document.getElementById('leaveEndDate').value;
    const reason = document.getElementById('leaveReason').value.trim();

    // Validation
    if (!leaveType || !startDate || !endDate || !reason) {
      UI.alert('Incomplete Form', 'Please fill in all leave request fields.', 'warning');
      return;
    }

    if (startDate > endDate) {
      UI.alert('Invalid Date Range', 'Leave end date must be on or after start date.', 'error');
      return;
    }

    // Working days calculation
    const workingDays = Storage.calculateWorkingDays(startDate, endDate);
    if (workingDays <= 0) {
      UI.alert('Zero Working Days', 'The selected date range contains no scheduled working days.', 'warning');
      return;
    }

    // Overlap validation
    if (Storage.checkLeaveOverlap(session.userId, startDate, endDate)) {
      UI.alert('Overlapping Leave', 'You already have a pending or approved leave request covering these dates.', 'error');
      return;
    }

    // Quota validation for paid leave
    if (leaveType !== 'unpaid') {
      const remainingBalance = Storage.getRemainingLeaveBalance(session.userId);
      if (workingDays > remainingBalance) {
        UI.alert(
          'Insufficient Quota',
          `You requested ${workingDays} working days, but your remaining annual paid leave quota is only ${remainingBalance} days.`,
          'error'
        );
        return;
      }
    }

    // Save request
    Storage.saveLeave({
      userId: session.userId,
      userName: session.name,
      department: session.department || 'General',
      leaveType,
      startDate,
      endDate,
      workingDays,
      reason,
      status: 'pending'
    });

    UI.toast('success', 'Leave request submitted to administration.');
    document.getElementById('leaveApplyForm').reset();
    document.getElementById('calculatedWorkingDays').textContent = '0 working days';
    
    this.renderEmployeeLeaveSummary();
    this.renderEmployeeLeaveHistory();
  },

  renderEmployeeLeaveSummary() {
    const session = Storage.getSession();
    if (!session) return;

    const company = Storage.getCompany();
    const annualQuota = company.annualLeaveQuota || 20;
    const usedDays = Storage.getApprovedLeaveDaysThisYear(session.userId);
    const remaining = Math.max(0, annualQuota - usedDays);

    const userLeaves = Storage.getLeaves({ userId: session.userId });
    const pendingCount = userLeaves.filter(l => l.status === 'pending').length;

    const quotaEl = document.getElementById('empQuotaDisplay');
    const remainingEl = document.getElementById('empRemainingLeaveDisplay');
    const usedEl = document.getElementById('empUsedLeaveDisplay');
    const pendingEl = document.getElementById('empPendingLeavesDisplay');

    if (quotaEl) quotaEl.textContent = `${annualQuota} days`;
    if (remainingEl) remainingEl.textContent = `${remaining} days`;
    if (usedEl) usedEl.textContent = `${usedDays} days`;
    if (pendingEl) pendingEl.textContent = pendingCount;
  },

  renderEmployeeLeaveHistory() {
    const session = Storage.getSession();
    const tbody = document.getElementById('employeeLeaveHistoryBody');
    if (!tbody || !session) return;

    const list = Storage.getLeaves({ userId: session.userId })
      .sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 24px;">No leave requests found.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(l => {
      let statusBadge = '<span class="badge badge-warning">Pending</span>';
      if (l.status === 'approved') statusBadge = '<span class="badge badge-success">Approved</span>';
      if (l.status === 'rejected') statusBadge = '<span class="badge badge-danger">Rejected</span>';

      return `
        <tr>
          <td><span class="badge badge-info">${l.leaveType.toUpperCase()}</span></td>
          <td style="font-weight: 600;">${UI.formatDate(l.startDate)} - ${UI.formatDate(l.endDate)}</td>
          <td><strong>${l.workingDays}</strong> days</td>
          <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${UI.escapeHTML(l.reason)}">
            ${UI.escapeHTML(l.reason)}
          </td>
          <td>${statusBadge}</td>
          <td>${l.adminComment ? `<span style="font-style:italic; font-size:0.8rem; color:var(--text-secondary);">${UI.escapeHTML(l.adminComment)}</span>` : '<span style="color:var(--text-muted);">-</span>'}</td>
          <td style="font-size: 0.78rem; color: var(--text-muted);">${UI.formatDate(l.appliedAt)}</td>
        </tr>
      `;
    }).join('');

    UI.initIcons();
  },

  // ================= ADMINISTRATOR LEAVE CONSOLE =================
  initAdminLeaves() {
    this.bindAdminEvents();
    this.renderAdminSummary();
    this.renderAdminTable();
  },

  bindAdminEvents() {
    const statusFilter = document.getElementById('adminLeaveStatusFilter');
    const typeFilter = document.getElementById('adminLeaveTypeFilter');
    const searchInput = document.getElementById('adminLeaveSearchInput');

    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.adminFilterStatus = e.target.value;
        this.renderAdminTable();
      });
    }

    if (typeFilter) {
      typeFilter.addEventListener('change', (e) => {
        this.adminFilterType = e.target.value;
        this.renderAdminTable();
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.adminSearchQuery = e.target.value.toLowerCase().trim();
        this.renderAdminTable();
      });
    }
  },

  renderAdminSummary() {
    const all = Storage.getLeaves();
    const pending = all.filter(l => l.status === 'pending').length;
    const approved = all.filter(l => l.status === 'approved').length;
    const rejected = all.filter(l => l.status === 'rejected').length;

    const totalEl = document.getElementById('adminLeaveTotalCount');
    const pendingEl = document.getElementById('adminLeavePendingCount');
    const approvedEl = document.getElementById('adminLeaveApprovedCount');
    const rejectedEl = document.getElementById('adminLeaveRejectedCount');

    if (totalEl) totalEl.textContent = all.length;
    if (pendingEl) pendingEl.textContent = pending;
    if (approvedEl) approvedEl.textContent = approved;
    if (rejectedEl) rejectedEl.textContent = rejected;
  },

  renderAdminTable() {
    const tbody = document.getElementById('adminLeavesTableBody');
    const emptyState = document.getElementById('adminLeavesEmptyState');
    const tableContainer = document.getElementById('adminLeavesTableContainer');
    const countDisplay = document.getElementById('adminLeavesCountDisplay');

    if (!tbody) return;

    let list = Storage.getLeaves().sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));

    // Filters
    if (this.adminFilterStatus !== 'all') {
      list = list.filter(l => l.status === this.adminFilterStatus);
    }

    if (this.adminFilterType !== 'all') {
      list = list.filter(l => l.leaveType === this.adminFilterType);
    }

    if (this.adminSearchQuery) {
      list = list.filter(l => 
        l.userName.toLowerCase().includes(this.adminSearchQuery) ||
        (l.department && l.department.toLowerCase().includes(this.adminSearchQuery)) ||
        l.reason.toLowerCase().includes(this.adminSearchQuery)
      );
    }

    if (countDisplay) countDisplay.textContent = `Showing ${list.length} leave request${list.length === 1 ? '' : 's'}`;

    if (list.length === 0) {
      if (emptyState) emptyState.style.display = 'flex';
      if (tableContainer) tableContainer.style.display = 'none';
      tbody.innerHTML = '';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (tableContainer) tableContainer.style.display = 'block';

    tbody.innerHTML = list.map(l => {
      let statusBadge = '<span class="badge badge-warning">Pending</span>';
      if (l.status === 'approved') statusBadge = '<span class="badge badge-success">Approved</span>';
      if (l.status === 'rejected') statusBadge = '<span class="badge badge-danger">Rejected</span>';

      const actionButtons = l.status === 'pending' ? `
        <div class="action-btn-group">
          <button class="btn btn-sm btn-success" title="Approve Leave" onclick="Leaves.approveRequest('${l.id}')">
            <i data-lucide="check" style="width:14px;height:14px"></i> Approve
          </button>
          <button class="btn btn-sm btn-danger" title="Reject Leave" onclick="Leaves.rejectRequest('${l.id}')">
            <i data-lucide="x" style="width:14px;height:14px"></i> Reject
          </button>
        </div>
      ` : `
        <span style="font-size:0.75rem; color:var(--text-muted);">Actioned ${UI.formatDate(l.actionedAt)}</span>
      `;

      return `
        <tr>
          <td>
            <div style="font-weight: 600; color: var(--text-main);">${UI.escapeHTML(l.userName)}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${UI.escapeHTML(l.department || 'General')}</div>
          </td>
          <td><span class="badge badge-info">${l.leaveType.toUpperCase()}</span></td>
          <td style="font-weight: 600;">${UI.formatDate(l.startDate)} - ${UI.formatDate(l.endDate)}</td>
          <td><strong>${l.workingDays}</strong> days</td>
          <td style="max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${UI.escapeHTML(l.reason)}">
            ${UI.escapeHTML(l.reason)}
          </td>
          <td>${statusBadge}</td>
          <td>${l.adminComment ? `<span style="font-size:0.8rem; font-style:italic;">${UI.escapeHTML(l.adminComment)}</span>` : '<span style="color:var(--text-muted);">-</span>'}</td>
          <td>${actionButtons}</td>
        </tr>
      `;
    }).join('');

    UI.initIcons();
  },

  /**
   * Admin Approve Request
   */
  approveRequest(id) {
    const leave = Storage.getLeaveById(id);
    if (!leave) return;

    if (leave.status !== 'pending') {
      UI.alert('Already Processed', 'This leave request has already been actioned.', 'info');
      return;
    }

    // Revalidate quota and overlap before approval
    if (leave.leaveType !== 'unpaid') {
      const remainingQuota = Storage.getRemainingLeaveBalance(leave.userId);
      if (leave.workingDays > remainingQuota) {
        UI.alert(
          'Cannot Approve',
          `Employee has only ${remainingQuota} days remaining in their annual paid leave quota, but requested ${leave.workingDays} days.`,
          'error'
        );
        return;
      }
    }

    if (Storage.checkLeaveOverlap(leave.userId, leave.startDate, leave.endDate, leave.id)) {
      UI.alert('Overlap Detected', 'This leave request overlaps with another approved leave for this employee.', 'error');
      return;
    }

    if (window.Swal) {
      Swal.fire({
        title: 'Approve Leave Request?',
        html: `Approve <strong>${leave.workingDays} working days</strong> for <strong>${UI.escapeHTML(leave.userName)}</strong>?`,
        icon: 'question',
        input: 'text',
        inputPlaceholder: 'Optional approval comment (e.g. Approved by HR)',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, Approve'
      }).then((result) => {
        if (result.isConfirmed) {
          Storage.saveLeave({
            ...leave,
            status: 'approved',
            adminComment: result.value?.trim() || 'Approved',
            actionedAt: new Date().toISOString()
          });
          UI.toast('success', 'Leave request approved.');
          this.renderAdminSummary();
          this.renderAdminTable();
        }
      });
    } else {
      if (confirm(`Approve leave for ${leave.userName}?`)) {
        Storage.saveLeave({
          ...leave,
          status: 'approved',
          adminComment: 'Approved',
          actionedAt: new Date().toISOString()
        });
        this.renderAdminSummary();
        this.renderAdminTable();
      }
    }
  },

  /**
   * Admin Reject Request
   */
  rejectRequest(id) {
    const leave = Storage.getLeaveById(id);
    if (!leave) return;

    if (leave.status !== 'pending') {
      UI.alert('Already Processed', 'This leave request has already been actioned.', 'info');
      return;
    }

    if (window.Swal) {
      Swal.fire({
        title: 'Reject Leave Request',
        html: `Provide a reason for rejecting <strong>${UI.escapeHTML(leave.userName)}</strong>'s leave:`,
        input: 'textarea',
        inputPlaceholder: 'Enter rejection reason (Required)...',
        inputValidator: (value) => {
          if (!value || !value.trim()) {
            return 'You must enter a reason for rejection!';
          }
        },
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Reject Leave'
      }).then((result) => {
        if (result.isConfirmed) {
          Storage.saveLeave({
            ...leave,
            status: 'rejected',
            adminComment: result.value.trim(),
            actionedAt: new Date().toISOString()
          });
          UI.toast('info', 'Leave request marked as rejected.');
          this.renderAdminSummary();
          this.renderAdminTable();
        }
      });
    } else {
      const reason = prompt('Enter reason for rejection:');
      if (reason && reason.trim()) {
        Storage.saveLeave({
          ...leave,
          status: 'rejected',
          adminComment: reason.trim(),
          actionedAt: new Date().toISOString()
        });
        this.renderAdminSummary();
        this.renderAdminTable();
      }
    }
  }
};
