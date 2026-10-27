/**
 * HCM Lite - Common UI & Helper Utilities (js/common.js)
 * Manages theme switching, sidebar navigation, modals, toasts, and UI helpers.
 */

const UI = {
  /**
   * Initialize layout, themes, icons, and listeners on DOM ready
   */
  init() {
    this.initTheme();
    this.initSidebar();
    this.initProfileMenu();
    this.initIcons();
  },

  /**
   * Initialize Lucide icons safely
   */
  initIcons() {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  },

  /**
   * Initialize Theme from localStorage
   */
  initTheme() {
    const savedTheme = Storage.getTheme();
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeIcon(savedTheme);

    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        Storage.setTheme(newTheme);
        this.updateThemeIcon(newTheme);
      });
    }
  },

  updateThemeIcon(theme) {
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (!themeToggleBtn) return;
    themeToggleBtn.innerHTML = theme === 'dark' 
      ? '<i data-lucide="sun"></i>' 
      : '<i data-lucide="moon"></i>';
    this.initIcons();
  },

  /**
   * Collapsible desktop sidebar and mobile drawer
   */
  initSidebar() {
    const toggleBtn = document.getElementById('sidebarToggleBtn');
    const overlay = document.getElementById('sidebarOverlay');

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          document.body.classList.toggle('sidebar-mobile-open');
        } else {
          document.body.classList.toggle('sidebar-collapsed');
        }
      });
    }

    if (overlay) {
      overlay.addEventListener('click', () => {
        document.body.classList.remove('sidebar-mobile-open');
      });
    }

    // Close mobile sidebar on resize if window expands
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) {
        document.body.classList.remove('sidebar-mobile-open');
      }
    });
  },

  /**
   * Set user information in top navigation bar
   */
  initProfileMenu() {
    const session = Storage.getSession();
    const nameEl = document.getElementById('topbarUserName');
    const roleEl = document.getElementById('topbarUserRole');
    const avatarEl = document.getElementById('topbarUserAvatar');

    if (session) {
      if (nameEl) nameEl.textContent = session.name;
      if (roleEl) roleEl.textContent = session.role === 'admin' ? 'Administrator' : (session.designation || 'Employee');
      if (avatarEl) {
        const initials = session.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        avatarEl.textContent = initials || 'U';
      }
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.confirmLogout();
      });
    }
  },

  /**
   * Show confirm logout dialog
   */
  confirmLogout() {
    if (window.Swal) {
      Swal.fire({
        title: 'Sign Out?',
        text: 'Are you sure you want to end your current session?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#4f46e5',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, Sign Out'
      }).then((result) => {
        if (result.isConfirmed) {
          Storage.clearSession();
          window.location.href = 'index.html';
        }
      });
    } else {
      if (confirm('Are you sure you want to sign out?')) {
        Storage.clearSession();
        window.location.href = 'index.html';
      }
    }
  },

  /**
   * Modal Open Helper
   */
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('show');
      document.body.style.overflow = 'hidden';
      this.initIcons();
    }
  },

  /**
   * Modal Close Helper
   */
  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('show');
      document.body.style.overflow = '';
    }
  },

  /**
   * Toast Notification Helper using SweetAlert2
   */
  toast(icon = 'success', title = 'Success') {
    if (window.Swal) {
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
          toast.addEventListener('mouseenter', Swal.stopTimer);
          toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
      });
      Toast.fire({ icon, title });
    } else {
      alert(`${icon.toUpperCase()}: ${title}`);
    }
  },

  /**
   * Alert Dialog Helper
   */
  alert(title, text, icon = 'info') {
    if (window.Swal) {
      return Swal.fire({
        title,
        text,
        icon,
        confirmButtonColor: '#4f46e5'
      });
    } else {
      alert(`${title}\n${text}`);
      return Promise.resolve();
    }
  },

  /**
   * Format Currency
   */
  formatCurrency(amount, currency = 'PKR') {
    return `${currency} ${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  },

  /**
   * Format Date to friendly string (e.g. 26 Oct 2026)
   */
  formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  UI.init();
});
