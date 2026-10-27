/**
 * HCM Lite - Announcements Module (js/announcements.js)
 * Manages publishing, displaying, and deleting company-wide announcements.
 */

const Announcements = {
  init() {
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    const openBtn = document.getElementById('openAddAnnouncementBtn');
    if (openBtn) {
      openBtn.addEventListener('click', () => {
        this.openAddModal();
      });
    }

    const form = document.getElementById('announcementForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSubmit();
      });
    }
  },

  openAddModal() {
    document.getElementById('announcementForm').reset();
    UI.openModal('announcementModal');
  },

  handleSubmit() {
    const session = Storage.getSession();
    const title = document.getElementById('announcementTitle').value.trim();
    const message = document.getElementById('announcementMessage').value.trim();
    const priority = document.getElementById('announcementPriority').value;
    const category = document.getElementById('announcementCategory').value;

    if (!title || !message) {
      UI.alert('Incomplete Form', 'Please enter a title and message.', 'warning');
      return;
    }

    Storage.saveAnnouncement({
      title,
      message,
      priority,
      category,
      authorName: session ? session.name : 'Administrator',
      date: Storage.getTodayString()
    });

    UI.closeModal('announcementModal');
    UI.toast('success', 'Announcement published.');
    this.render();
  },

  confirmDelete(id) {
    if (window.Swal) {
      Swal.fire({
        title: 'Delete Announcement?',
        text: 'This will remove the announcement from all dashboards.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, Delete'
      }).then((result) => {
        if (result.isConfirmed) {
          Storage.deleteAnnouncement(id);
          UI.toast('info', 'Announcement deleted.');
          this.render();
        }
      });
    } else {
      if (confirm('Delete this announcement?')) {
        Storage.deleteAnnouncement(id);
        this.render();
      }
    }
  },

  render() {
    const container = document.getElementById('announcementsContainer');
    if (!container) return;

    const list = Storage.getAnnouncements();
    const session = Storage.getSession();
    const isAdmin = session && session.role === 'admin';

    if (list.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 24px;">
          <div class="empty-state-icon" style="width: 44px; height: 44px; margin-bottom: 8px;">
            <i data-lucide="bell" style="width: 20px; height: 20px;"></i>
          </div>
          <h4 style="font-size: 0.95rem; font-weight: 600;">No Announcements Yet</h4>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0;">Check back later for company updates.</p>
        </div>
      `;
      UI.initIcons();
      return;
    }

    container.innerHTML = list.map(item => {
      let priorityBadge = '<span class="badge badge-info">Normal</span>';
      if (item.priority === 'High') priorityBadge = '<span class="badge badge-warning">High</span>';
      if (item.priority === 'Urgent') priorityBadge = '<span class="badge badge-danger">Urgent</span>';

      const deleteAction = isAdmin ? `
        <button class="action-btn btn-delete" title="Delete Announcement" onclick="Announcements.confirmDelete('${item.id}')">
          <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
        </button>
      ` : '';

      return `
        <div class="announcement-card">
          <div class="announcement-header">
            <div style="display:flex; align-items:center; gap:8px;">
              ${priorityBadge}
              <span class="announcement-title">${UI.escapeHTML(item.title)}</span>
            </div>
            ${deleteAction}
          </div>
          <div class="announcement-body">${UI.escapeHTML(item.message)}</div>
          <div class="announcement-footer">
            <span>Posted by <strong>${UI.escapeHTML(item.authorName)}</strong></span>
            <span>${UI.formatDate(item.date)}</span>
          </div>
        </div>
      `;
    }).join('');

    UI.initIcons();
  }
};
