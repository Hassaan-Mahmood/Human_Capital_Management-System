/**
 * HCM Lite - Company Settings Module (js/settings.js)
 * Manages configuration for working days, grace period, office hours, and system backup/reset.
 */

const Settings = {
  init() {
    this.loadSettings();
    this.bindEvents();
  },

  loadSettings() {
    const company = Storage.getCompany();

    const nameInput = document.getElementById('settingCompanyName');
    const adminNameInput = document.getElementById('settingAdminName');
    const adminEmailInput = document.getElementById('settingAdminEmail');
    const startTimeInput = document.getElementById('settingStartTime');
    const gracePeriodInput = document.getElementById('settingGracePeriod');
    const leaveQuotaInput = document.getElementById('settingLeaveQuota');
    const logoUrlInput = document.getElementById('settingLogoUrl');

    if (nameInput) nameInput.value = company.name || '';
    if (adminNameInput) adminNameInput.value = company.adminName || '';
    if (adminEmailInput) adminEmailInput.value = company.adminEmail || '';
    if (startTimeInput) startTimeInput.value = company.startTime || '09:00';
    if (gracePeriodInput) gracePeriodInput.value = company.gracePeriod || 15;
    if (leaveQuotaInput) leaveQuotaInput.value = company.annualLeaveQuota || 20;
    if (logoUrlInput) logoUrlInput.value = company.logoUrl || '';

    // Set working days checkboxes
    const workingDays = company.workingDays || [1, 2, 3, 4, 5];
    for (let i = 0; i <= 6; i++) {
      const checkbox = document.getElementById(`workDay_${i}`);
      if (checkbox) {
        checkbox.checked = workingDays.includes(i);
      }
    }
  },

  bindEvents() {
    const form = document.getElementById('companySettingsForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveSettings();
      });
    }

    const resetBtn = document.getElementById('resetSystemBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.confirmResetSystem();
      });
    }

    const backupBtn = document.getElementById('backupDataBtn');
    if (backupBtn) {
      backupBtn.addEventListener('click', () => {
        this.exportFullBackup();
      });
    }

    const restoreInput = document.getElementById('restoreDataInput');
    if (restoreInput) {
      restoreInput.addEventListener('change', (e) => {
        this.handleRestoreBackup(e);
      });
    }
  },

  saveSettings() {
    const companyName = document.getElementById('settingCompanyName').value.trim();
    const adminName = document.getElementById('settingAdminName').value.trim();
    const adminEmail = document.getElementById('settingAdminEmail').value.trim().toLowerCase();
    const startTime = document.getElementById('settingStartTime').value || '09:00';
    const gracePeriod = parseInt(document.getElementById('settingGracePeriod').value, 10);
    const annualLeaveQuota = parseInt(document.getElementById('settingLeaveQuota').value, 10);
    const logoUrl = document.getElementById('settingLogoUrl').value.trim();

    if (!companyName || !adminName || !adminEmail) {
      UI.alert('Missing Info', 'Company and Administrator information cannot be blank.', 'warning');
      return;
    }

    if (isNaN(gracePeriod) || gracePeriod < 0) {
      UI.alert('Invalid Grace Period', 'Grace period must be 0 or positive minutes.', 'error');
      return;
    }

    if (isNaN(annualLeaveQuota) || annualLeaveQuota <= 0) {
      UI.alert('Invalid Quota', 'Annual leave quota must be a positive number of days.', 'error');
      return;
    }

    // Collect working days
    const workingDays = [];
    for (let i = 0; i <= 6; i++) {
      const checkbox = document.getElementById(`workDay_${i}`);
      if (checkbox && checkbox.checked) {
        workingDays.push(i);
      }
    }

    if (workingDays.length === 0) {
      UI.alert('Working Days Required', 'At least one working day must be enabled.', 'warning');
      return;
    }

    Storage.saveCompany({
      name: companyName,
      adminName: adminName,
      adminEmail: adminEmail,
      startTime: startTime,
      gracePeriod: gracePeriod,
      annualLeaveQuota: annualLeaveQuota,
      workingDays: workingDays,
      logoUrl: logoUrl
    });

    UI.toast('success', 'Company configuration saved.');
  },

  confirmResetSystem() {
    if (window.Swal) {
      Swal.fire({
        title: 'Factory Reset All Data?',
        html: `This will erase all employees, attendance logs, leave records, and company settings from localStorage.<br><br><strong class="text-danger">You will be redirected to the First-Run Setup screen.</strong>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, Wipe Everything'
      }).then((result) => {
        if (result.isConfirmed) {
          Storage.resetAllData();
          window.location.href = 'index.html';
        }
      });
    } else {
      if (confirm('Are you sure you want to reset all data and return to First-Run Setup?')) {
        Storage.resetAllData();
        window.location.href = 'index.html';
      }
    }
  },

  exportFullBackup() {
    const backup = {
      company: Storage.getCompany(),
      users: Storage.getUsers(),
      attendance: Storage.getAttendance(),
      leaves: Storage.getLeaves(),
      announcements: Storage.getAnnouncements(),
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backup, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', `hcm_backup_${Storage.getTodayString()}.json`);
    dlAnchorElem.click();
    UI.toast('success', 'Backup JSON downloaded successfully.');
  },

  handleRestoreBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (parsed.company && parsed.users) {
          Storage.set(StorageKeys.COMPANY, parsed.company);
          Storage.set(StorageKeys.USERS, parsed.users);
          Storage.set(StorageKeys.ATTENDANCE, parsed.attendance || []);
          Storage.set(StorageKeys.LEAVES, parsed.leaves || []);
          Storage.set(StorageKeys.ANNOUNCEMENTS, parsed.announcements || []);
          UI.toast('success', 'Backup restored successfully!');
          setTimeout(() => location.reload(), 800);
        } else {
          UI.alert('Invalid Backup', 'The file does not appear to be a valid HCM Lite backup.', 'error');
        }
      } catch (err) {
        UI.alert('Parse Error', 'Failed to read backup file: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  }
};
