/**
 * HCM Lite - Monthly Payslip Module (js/payslip.js)
 * Implements strict hackathon salary formulas, working-day calculations, and printable vouchers.
 */

const Payslip = {
  selectedUserId: null,
  selectedMonthYear: '', // YYYY-MM

  init() {
    this.initMonthSelector();
    this.initEmployeeSelector();
    this.bindEvents();
    this.render();
  },

  initMonthSelector() {
    const monthInput = document.getElementById('payslipMonthInput');
    if (!monthInput) return;

    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    monthInput.value = currentMonthStr;
    this.selectedMonthYear = currentMonthStr;

    monthInput.addEventListener('change', (e) => {
      this.selectedMonthYear = e.target.value;
      this.render();
    });
  },

  initEmployeeSelector() {
    const session = Storage.getSession();
    const select = document.getElementById('payslipEmployeeSelect');
    const selectorContainer = document.getElementById('payslipEmployeeSelectorContainer');

    if (!session) return;

    if (session.role === 'employee') {
      // Employees only view their own payslip
      this.selectedUserId = session.userId;
      if (selectorContainer) selectorContainer.style.display = 'none';
    } else {
      // Admin can select any employee
      if (selectorContainer) selectorContainer.style.display = 'block';
      const employees = Storage.getUsers().filter(u => u.role === 'employee');
      
      let html = '<option value="">-- Select an Employee --</option>';
      employees.forEach(emp => {
        html += `<option value="${emp.id}">${UI.escapeHTML(emp.name)} (${emp.id}) - ${UI.escapeHTML(emp.department)}</option>`;
      });

      if (select) {
        select.innerHTML = html;
        if (employees.length > 0) {
          select.value = employees[0].id;
          this.selectedUserId = employees[0].id;
        }
        select.addEventListener('change', (e) => {
          this.selectedUserId = e.target.value;
          this.render();
        });
      }
    }
  },

  bindEvents() {
    const printBtn = document.getElementById('printPayslipBtn');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        window.print();
      });
    }
  },

  /**
   * Calculate salary and attendance metrics for selected user and month
   */
  calculate(userId, monthYearStr) {
    const user = Storage.getUserById(userId);
    const company = Storage.getCompany();

    if (!user || !monthYearStr) return null;

    const [year, month] = monthYearStr.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    const todayStr = Storage.getTodayString();
    const [currYear, currMonth, currDay] = todayStr.split('-').map(Number);

    const isCurrentMonth = (year === currYear && month === currMonth);
    const isFutureMonth = (year > currYear || (year === currYear && month > currMonth));

    // Calculate total scheduled working days in this month
    let totalWorkingDaysInMonth = 0;
    const workingDates = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (Storage.isWorkingDay(dStr, company.workingDays)) {
        totalWorkingDaysInMonth++;
        workingDates.push(dStr);
      }
    }

    // Attendance breakdown
    let presentDays = 0;
    let lateRecords = 0;
    let halfDayDays = 0;
    let absentDays = 0;
    let approvedPaidLeaveDays = 0;

    if (!isFutureMonth) {
      // Evaluate only days that have occurred
      workingDates.forEach(dStr => {
        // If current month, only evaluate past days and today
        if (isCurrentMonth && dStr > todayStr) {
          return; // Future day in current month
        }

        // Check attendance record
        const att = Storage.getAttendance({ userId, date: dStr })[0];
        if (att) {
          if (att.status === 'half_day') {
            halfDayDays++;
          } else {
            presentDays++;
            if (att.status === 'late' || att.isLate) {
              lateRecords++;
            }
          }
        } else {
          // Check approved leave
          const leaves = Storage.getLeaves({ userId, status: 'approved' });
          const onLeave = leaves.find(l => dStr >= l.startDate && dStr <= l.endDate);

          if (onLeave) {
            if (onLeave.leaveType !== 'unpaid') {
              approvedPaidLeaveDays++;
            } else {
              absentDays++; // Unpaid leave is treated as absence deduction
            }
          } else {
            absentDays++;
          }
        }
      });
    }

    // Salary Formulas as required:
    // Per-day salary = Monthly salary ÷ Working days in the selected month
    const monthlySalary = user.salary || 0;
    const perDaySalary = totalWorkingDaysInMonth > 0 ? (monthlySalary / totalWorkingDaysInMonth) : 0;

    // Deduction = Per-day salary × (Absent days + 0.5 × Half-day days)
    const deductionDays = absentDays + (0.5 * halfDayDays);
    const totalDeduction = perDaySalary * deductionDays;

    // Net salary = Monthly salary − Deduction
    const netSalary = Math.max(0, monthlySalary - totalDeduction);

    return {
      user,
      company,
      monthYearStr,
      totalWorkingDaysInMonth,
      presentDays,
      lateRecords,
      halfDayDays,
      absentDays,
      approvedPaidLeaveDays,
      monthlySalary,
      perDaySalary,
      deductionDays,
      totalDeduction,
      netSalary,
      generatedDate: Storage.getTodayString()
    };
  },

  render() {
    const container = document.getElementById('payslipVoucherContainer');
    const emptyState = document.getElementById('payslipEmptyState');
    const printBtn = document.getElementById('printPayslipBtn');

    if (!this.selectedUserId) {
      if (emptyState) emptyState.style.display = 'flex';
      if (container) container.style.display = 'none';
      if (printBtn) printBtn.disabled = true;
      return;
    }

    const data = this.calculate(this.selectedUserId, this.selectedMonthYear);
    if (!data) return;

    if (emptyState) emptyState.style.display = 'none';
    if (container) container.style.display = 'block';
    if (printBtn) printBtn.disabled = false;

    // Format Month Label (e.g. October 2026)
    const [y, m] = data.monthYearStr.split('-');
    const monthDate = new Date(y, parseInt(m, 10) - 1, 1);
    const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    container.innerHTML = `
      <div class="payslip-printable-document">
        <!-- Payslip Header -->
        <div class="payslip-header" style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--primary-800); margin-bottom: 4px;">
              ${UI.escapeHTML(data.company.name)}
            </h2>
            <div style="font-size: 0.85rem; color: var(--text-muted);">
              Official Monthly Salary Statement &bull; Pay Period: <strong>${monthName}</strong>
            </div>
          </div>
          <div style="text-align: right;">
            <span class="badge badge-success" style="font-size: 0.85rem; padding: 6px 14px;">SALARY SLIP</span>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 6px;">Generated: ${UI.formatDate(data.generatedDate)}</div>
          </div>
        </div>

        <!-- Employee Info Grid -->
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 20px 0; padding: 16px; background-color: var(--bg-surface-hover); border-radius: var(--radius-lg); border: 1px solid var(--border-color);">
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Employee Name</div>
            <div style="font-size: 1rem; font-weight: 700; color: var(--text-main);">${UI.escapeHTML(data.user.name)}</div>
            <div style="font-size: 0.85rem; color: var(--text-secondary);">${UI.escapeHTML(data.user.designation)} &bull; ${UI.escapeHTML(data.user.department)}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Employee ID</div>
            <div style="font-size: 0.95rem; font-weight: 700; color: var(--primary-600);">${UI.escapeHTML(data.user.id)}</div>
            <div style="font-size: 0.85rem; color: var(--text-secondary);">${UI.escapeHTML(data.user.email)}</div>
          </div>
        </div>

        <!-- Attendance Breakdown Cards -->
        <div style="margin: 20px 0;">
          <h4 style="font-size: 0.9rem; font-weight: 700; margin-bottom: 10px; color: var(--text-muted); text-transform: uppercase;">
            Monthly Attendance Summary
          </h4>
          <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; text-align: center;">
            <div style="padding: 10px; border-radius: var(--radius-md); border: 1px solid var(--border-color); background: var(--bg-surface);">
              <div style="font-size: 0.72rem; color: var(--text-muted);">Working Days</div>
              <div style="font-size: 1.25rem; font-weight: 800;">${data.totalWorkingDaysInMonth}</div>
            </div>
            <div style="padding: 10px; border-radius: var(--radius-md); border: 1px solid var(--success-border); background: var(--success-bg);">
              <div style="font-size: 0.72rem; color: var(--success-text);">Present</div>
              <div style="font-size: 1.25rem; font-weight: 800; color: var(--success);">${data.presentDays}</div>
            </div>
            <div style="padding: 10px; border-radius: var(--radius-md); border: 1px solid var(--warning-border); background: var(--warning-bg);">
              <div style="font-size: 0.72rem; color: var(--warning-text);">Late Logs</div>
              <div style="font-size: 1.25rem; font-weight: 800; color: var(--warning);">${data.lateRecords}</div>
            </div>
            <div style="padding: 10px; border-radius: var(--radius-md); border: 1px solid var(--warning-border); background: var(--warning-bg);">
              <div style="font-size: 0.72rem; color: var(--warning-text);">Half-Days</div>
              <div style="font-size: 1.25rem; font-weight: 800; color: var(--warning);">${data.halfDayDays}</div>
            </div>
            <div style="padding: 10px; border-radius: var(--radius-md); border: 1px solid var(--info-border); background: var(--info-bg);">
              <div style="font-size: 0.72rem; color: var(--info-text);">Paid Leaves</div>
              <div style="font-size: 1.25rem; font-weight: 800; color: var(--info);">${data.approvedPaidLeaveDays}</div>
            </div>
            <div style="padding: 10px; border-radius: var(--radius-md); border: 1px solid var(--danger-border); background: var(--danger-bg);">
              <div style="font-size: 0.72rem; color: var(--danger-text);">Absent Days</div>
              <div style="font-size: 1.25rem; font-weight: 800; color: var(--danger);">${data.absentDays}</div>
            </div>
          </div>
        </div>

        <!-- Salary Breakdown Table -->
        <table class="payslip-table data-table" style="margin-top: 20px;">
          <thead>
            <tr>
              <th>Description / Formula Component</th>
              <th style="text-align: right;">Basis / Units</th>
              <th style="text-align: right;">Amount (${data.company.currency || 'PKR'})</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Monthly Basic Salary</strong>
                <div style="font-size:0.75rem; color:var(--text-muted)">Fixed monthly compensation</div>
              </td>
              <td style="text-align: right;">Full Month</td>
              <td style="text-align: right; font-weight: 600;">${UI.formatCurrency(data.monthlySalary, '')}</td>
            </tr>
            <tr>
              <td>
                <strong>Calculated Per-Day Salary</strong>
                <div style="font-size:0.75rem; color:var(--text-muted)">Monthly Salary ÷ ${data.totalWorkingDaysInMonth} Working Days</div>
              </td>
              <td style="text-align: right;">1 Work Day</td>
              <td style="text-align: right; font-weight: 600;">${UI.formatCurrency(data.perDaySalary, '')}</td>
            </tr>
            <tr>
              <td>
                <span style="color: var(--danger); font-weight: 600;">Absence & Half-Day Deductions</span>
                <div style="font-size:0.75rem; color:var(--text-muted)">
                  Formula: Per-Day Salary × (${data.absentDays} Absences + 0.5 × ${data.halfDayDays} Half-Days)
                </div>
              </td>
              <td style="text-align: right; color: var(--danger); font-weight: 600;">-${data.deductionDays} days</td>
              <td style="text-align: right; color: var(--danger); font-weight: 700;">-${UI.formatCurrency(data.totalDeduction, '')}</td>
            </tr>
          </tbody>
        </table>

        <!-- Net Payable Box -->
        <div class="payslip-net-box" style="display: flex; justify-content: space-between; align-items: center; border-radius: var(--radius-lg); margin-top: 24px; padding: 20px; background: linear-gradient(135deg, var(--primary-50), #ffffff); border: 2px solid var(--primary-200);">
          <div>
            <div style="font-size: 0.85rem; font-weight: 700; color: var(--primary-800); text-transform: uppercase; letter-spacing: 0.05em;">
              Net Payable Salary
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">
              Monthly Basic (${UI.formatCurrency(data.monthlySalary)}) − Deductions (${UI.formatCurrency(data.totalDeduction)})
            </div>
          </div>
          <div style="font-size: 2rem; font-weight: 800; color: var(--primary-700);">
            ${UI.formatCurrency(data.netSalary)}
          </div>
        </div>

        <!-- Signatures (Visible in Print) -->
        <div class="payslip-signatures">
          <div class="signature-line">
            Employee Signature
          </div>
          <div class="signature-line">
            HR / Authorized Officer
          </div>
        </div>
      </div>
    `;

    UI.initIcons();
  }
};
