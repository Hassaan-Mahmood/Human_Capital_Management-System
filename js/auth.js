/**
 * HCM Lite - Authentication & Route Guard Module (js/auth.js)
 * Handles role-based access control, session validation, first-run wizard, and sign-in.
 */

const Auth = {
  /**
   * Enforce route protection based on current page and user session
   */
  guard() {
    const session = Storage.getSession();
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    const isAuthPage = currentPage === 'index.html' || currentPage === '';
    const adminPages = ['admin.html', 'employees.html', 'leaves.html', 'settings.html'];
    const employeePages = ['employee.html'];

    if (!session) {
      // Unauthenticated user trying to access protected page
      if (!isAuthPage) {
        window.location.href = 'index.html';
        return false;
      }
    } else {
      // Authenticated user on auth page -> redirect to respective dashboard
      if (isAuthPage) {
        if (session.role === 'admin') {
          window.location.href = 'admin.html';
          return false;
        } else {
          window.location.href = 'employee.html';
          return false;
        }
      }

      // Role authorization check
      if (session.role === 'employee' && adminPages.includes(currentPage)) {
        window.location.href = 'employee.html';
        return false;
      }

      if (session.role === 'admin' && employeePages.includes(currentPage)) {
        window.location.href = 'admin.html';
        return false;
      }
    }

    return true;
  },

  /**
   * Initialize login or setup screen based on system state
   */
  initIndexPage() {
    const isFirstRun = Storage.isFirstRun();
    const setupCard = document.getElementById('setupCard');
    const loginCard = document.getElementById('loginCard');

    if (isFirstRun) {
      if (setupCard) setupCard.style.display = 'block';
      if (loginCard) loginCard.style.display = 'none';
      this.bindSetupEvents();
    } else {
      if (setupCard) setupCard.style.display = 'none';
      if (loginCard) loginCard.style.display = 'block';
      this.bindLoginEvents();
    }

    this.bindPasswordToggle();
  },

  /**
   * Bind show/hide password toggle buttons
   */
  bindPasswordToggle() {
    const toggleButtons = document.querySelectorAll('.toggle-password-btn');
    toggleButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const input = document.getElementById(targetId);
        if (!input) return;

        if (input.type === 'password') {
          input.type = 'text';
          btn.innerHTML = '<i data-lucide="eye-off"></i>';
        } else {
          input.type = 'password';
          btn.innerHTML = '<i data-lucide="eye"></i>';
        }
        UI.initIcons();
      });
    });
  },

  /**
   * Bind First-Run Setup form submission
   */
  bindSetupEvents() {
    const form = document.getElementById('setupForm');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const companyName = document.getElementById('setupCompanyName').value.trim();
      const adminName = document.getElementById('setupAdminName').value.trim();
      const adminEmail = document.getElementById('setupAdminEmail').value.trim().toLowerCase();
      const password = document.getElementById('setupPassword').value;
      const confirmPassword = document.getElementById('setupConfirmPassword').value;
      const startTime = document.getElementById('setupStartTime').value || '09:00';
      const gracePeriod = parseInt(document.getElementById('setupGracePeriod').value, 10) || 15;
      const annualLeaveQuota = parseInt(document.getElementById('setupLeaveQuota').value, 10) || 20;

      // Collect selected working days (checkboxes)
      const workingDaysBoxes = document.querySelectorAll('input[name="setupWorkingDays"]:checked');
      const workingDays = Array.from(workingDaysBoxes).map(cb => parseInt(cb.value, 10));

      // Validation
      if (!companyName || !adminName || !adminEmail || !password) {
        UI.alert('Missing Fields', 'Please fill in all required setup details.', 'warning');
        return;
      }

      if (password.length < 6) {
        UI.alert('Weak Password', 'Password must be at least 6 characters.', 'warning');
        return;
      }

      if (password !== confirmPassword) {
        UI.alert('Password Mismatch', 'The passwords entered do not match.', 'error');
        return;
      }

      if (workingDays.length === 0) {
        UI.alert('Working Days Required', 'Please select at least one working day of the week.', 'warning');
        return;
      }

      // Save Company
      const company = {
        name: companyName,
        adminName: adminName,
        adminEmail: adminEmail,
        startTime: startTime,
        gracePeriod: gracePeriod,
        annualLeaveQuota: annualLeaveQuota,
        workingDays: workingDays,
        logoUrl: '',
        createdAt: new Date().toISOString()
      };
      Storage.saveCompany(company);

      // Create Initial Admin User
      const adminUser = Storage.saveUser({
        name: adminName,
        email: adminEmail,
        password: password,
        role: 'admin',
        department: 'Executive',
        designation: 'Managing Director / Administrator',
        phone: '',
        salary: 0,
        status: 'active'
      });

      // Save Session
      Storage.setSession(adminUser);

      // Add a Welcome Announcement
      Storage.saveAnnouncement({
        title: `Welcome to ${companyName}!`,
        message: 'The HCM Lite system has been successfully initialized. Administrators can manage employees, leaves, attendance, and run payslips.',
        authorName: adminName,
        category: 'System',
        priority: 'High'
      });

      UI.toast('success', 'Setup completed successfully!');
      setTimeout(() => {
        window.location.href = 'admin.html';
      }, 700);
    });
  },

  /**
   * Bind Login form submission
   */
  bindLoginEvents() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const email = document.getElementById('loginEmail').value.trim().toLowerCase();
      const password = document.getElementById('loginPassword').value;

      if (!email || !password) {
        UI.alert('Validation Error', 'Please enter your email and password.', 'warning');
        return;
      }

      const user = Storage.getUserByEmail(email);

      if (!user) {
        UI.alert('Account Not Found', 'No account exists with this email address. Please check your spelling.', 'error');
        return;
      }

      if (user.status === 'inactive') {
        UI.alert('Account Suspended', 'This account has been deactivated. Please contact your HR administrator.', 'error');
        return;
      }

      if (user.password !== password) {
        UI.alert('Incorrect Password', 'The password you entered is incorrect. Please try again.', 'error');
        return;
      }

      // Valid Login
      Storage.setSession(user);
      UI.toast('success', `Welcome back, ${user.name}!`);

      setTimeout(() => {
        if (user.role === 'admin') {
          window.location.href = 'admin.html';
        } else {
          window.location.href = 'employee.html';
        }
      }, 600);
    });

    // Forgot password info trigger
    const forgotLink = document.getElementById('forgotPasswordLink');
    if (forgotLink) {
      forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        UI.alert(
          'Password Recovery',
          'For security in this browser-based prototype, passwords can be viewed or updated by the Administrator in the Employees management console, or you may reset the system.',
          'info'
        );
      });
    }
  }
};

// Execute route check immediately on load
Auth.guard();
