/**
 * HCM Lite - Storage Module (js/storage.js)
 * Robust LocalStorage wrapper with schema validation, ID generators, and business calculation helpers.
 */

const StorageKeys = {
  COMPANY: 'hcm_company',
  USERS: 'hcm_users',
  ATTENDANCE: 'hcm_attendance',
  LEAVES: 'hcm_leaves',
  SESSION: 'hcm_session',
  ANNOUNCEMENTS: 'hcm_announcements',
  THEME: 'hcm_theme'
};

const Storage = {
  /**
   * Safe getter from localStorage with fallback
   */
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      if (item === null || item === undefined) return defaultValue;
      return JSON.parse(item);
    } catch (err) {
      console.error(`Error reading ${key} from localStorage:`, err);
      return defaultValue;
    }
  },

  /**
   * Safe setter to localStorage
   */
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error(`Error saving ${key} to localStorage:`, err);
      return false;
    }
  },

  /**
   * Remove item from localStorage
   */
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (err) {
      console.error(`Error removing ${key} from localStorage:`, err);
      return false;
    }
  },

  /**
   * Check if application is in first-run state (no company or admin setup yet)
   */
  isFirstRun() {
    const company = this.get(StorageKeys.COMPANY, null);
    const users = this.get(StorageKeys.USERS, []);
    const hasAdmin = users.some(u => u.role === 'admin');
    return !company || !hasAdmin;
  },

  // ================= COMPANY =================
  getCompany() {
    return this.get(StorageKeys.COMPANY, {
      name: 'HCM Lite Demo Corp',
      adminName: 'Administrator',
      adminEmail: 'admin@hcmlite.com',
      startTime: '09:00',
      gracePeriod: 15, // in minutes
      annualLeaveQuota: 20, // days per year
      workingDays: [1, 2, 3, 4, 5], // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri
      logoUrl: '',
      currency: 'PKR',
      createdAt: new Date().toISOString()
    });
  },

  saveCompany(companyData) {
    const existing = this.getCompany();
    const updated = { ...existing, ...companyData, updatedAt: new Date().toISOString() };
    return this.set(StorageKeys.COMPANY, updated);
  },

  // ================= USERS / EMPLOYEES =================
  getUsers() {
    return this.get(StorageKeys.USERS, []);
  },

  getUserById(id) {
    const users = this.getUsers();
    return users.find(u => u.id === id) || null;
  },

  getUserByEmail(email) {
    if (!email) return null;
    const cleanEmail = email.trim().toLowerCase();
    const users = this.getUsers();
    return users.find(u => u.email.trim().toLowerCase() === cleanEmail) || null;
  },

  saveUser(userData) {
    const users = this.getUsers();
    const cleanEmail = userData.email.trim().toLowerCase();
    
    // Check duplicate email
    const duplicate = users.find(u => u.email.trim().toLowerCase() === cleanEmail && u.id !== userData.id);
    if (duplicate) {
      throw new Error(`An account with email '${userData.email}' already exists.`);
    }

    const newUser = {
      id: userData.id || this.generateId(userData.role === 'admin' ? 'ADM' : 'EMP'),
      name: userData.name.trim(),
      email: cleanEmail,
      password: userData.password, // Plain string for prototype
      role: userData.role || 'employee',
      department: userData.department || 'General',
      designation: userData.designation || 'Staff',
      phone: userData.phone || '',
      salary: parseFloat(userData.salary) || 0,
      joiningDate: userData.joiningDate || this.getTodayString(),
      status: userData.status || 'active',
      createdAt: userData.createdAt || new Date().toISOString()
    };

    const index = users.findIndex(u => u.id === newUser.id);
    if (index >= 0) {
      users[index] = { ...users[index], ...newUser, updatedAt: new Date().toISOString() };
    } else {
      users.push(newUser);
    }

    this.set(StorageKeys.USERS, users);
    return newUser;
  },

  deleteUser(userId) {
    const users = this.getUsers();
    const filteredUsers = users.filter(u => u.id !== userId);
    this.set(StorageKeys.USERS, filteredUsers);

    // Consistency handling for attendance and leaves
    const attendance = this.getAttendance();
    const filteredAttendance = attendance.filter(a => a.userId !== userId);
    this.set(StorageKeys.ATTENDANCE, filteredAttendance);

    const leaves = this.getLeaves();
    const filteredLeaves = leaves.filter(l => l.userId !== userId);
    this.set(StorageKeys.LEAVES, filteredLeaves);

    return true;
  },

  // ================= ATTENDANCE =================
  getAttendance(filters = {}) {
    let records = this.get(StorageKeys.ATTENDANCE, []);
    if (filters.userId) {
      records = records.filter(r => r.userId === filters.userId);
    }
    if (filters.date) {
      records = records.filter(r => r.date === filters.date);
    }
    if (filters.month) { // YYYY-MM
      records = records.filter(r => r.date && r.date.startsWith(filters.month));
    }
    return records;
  },

  getAttendanceToday(userId) {
    const today = this.getTodayString();
    const records = this.getAttendance({ userId, date: today });
    return records.length > 0 ? records[0] : null;
  },

  saveAttendance(record) {
    const list = this.get(StorageKeys.ATTENDANCE, []);
    const existingIndex = list.findIndex(r => r.id === record.id || (r.userId === record.userId && r.date === record.date));

    const item = {
      id: record.id || this.generateId('ATT'),
      userId: record.userId,
      userName: record.userName || '',
      date: record.date || this.getTodayString(),
      checkIn: record.checkIn, // 'HH:mm'
      checkOut: record.checkOut || null, // 'HH:mm' or null
      workHours: record.workHours || 0, // float
      status: record.status || 'present', // 'present', 'late', 'half_day'
      isLate: !!record.isLate,
      lateMinutes: record.lateMinutes || 0,
      method: record.method || 'Standard Web', // 'Standard Web', 'Webcam Biometric'
      location: record.location || 'Office',
      notes: record.notes || '',
      updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...item };
    } else {
      list.push(item);
    }

    this.set(StorageKeys.ATTENDANCE, list);
    return item;
  },

  // ================= LEAVES =================
  getLeaves(filters = {}) {
    let records = this.get(StorageKeys.LEAVES, []);
    if (filters.userId) {
      records = records.filter(l => l.userId === filters.userId);
    }
    if (filters.status) {
      records = records.filter(l => l.status === filters.status);
    }
    if (filters.leaveType) {
      records = records.filter(l => l.leaveType === filters.leaveType);
    }
    return records;
  },

  getLeaveById(id) {
    const leaves = this.getLeaves();
    return leaves.find(l => l.id === id) || null;
  },

  saveLeave(leaveData) {
    const list = this.getLeaves();
    const item = {
      id: leaveData.id || this.generateId('LEV'),
      userId: leaveData.userId,
      userName: leaveData.userName,
      department: leaveData.department || 'General',
      leaveType: leaveData.leaveType, // 'casual', 'sick', 'annual', 'unpaid'
      startDate: leaveData.startDate, // YYYY-MM-DD
      endDate: leaveData.endDate,     // YYYY-MM-DD
      workingDays: leaveData.workingDays, // number
      reason: leaveData.reason.trim(),
      status: leaveData.status || 'pending', // 'pending', 'approved', 'rejected'
      adminComment: leaveData.adminComment || '',
      appliedAt: leaveData.appliedAt || new Date().toISOString(),
      actionedAt: leaveData.actionedAt || null
    };

    const index = list.findIndex(l => l.id === item.id);
    if (index >= 0) {
      list[index] = item;
    } else {
      list.push(item);
    }

    this.set(StorageKeys.LEAVES, list);
    return item;
  },

  // ================= ANNOUNCEMENTS =================
  getAnnouncements() {
    const list = this.get(StorageKeys.ANNOUNCEMENTS, []);
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  saveAnnouncement(announcementData) {
    const list = this.get(StorageKeys.ANNOUNCEMENTS, []);
    const item = {
      id: announcementData.id || this.generateId('ANN'),
      title: announcementData.title.trim(),
      message: announcementData.message.trim(),
      authorName: announcementData.authorName || 'Administrator',
      category: announcementData.category || 'General',
      priority: announcementData.priority || 'Normal',
      date: announcementData.date || this.getTodayString(),
      createdAt: announcementData.createdAt || new Date().toISOString()
    };

    const index = list.findIndex(a => a.id === item.id);
    if (index >= 0) {
      list[index] = item;
    } else {
      list.unshift(item);
    }

    this.set(StorageKeys.ANNOUNCEMENTS, list);
    return item;
  },

  deleteAnnouncement(id) {
    const list = this.get(StorageKeys.ANNOUNCEMENTS, []);
    const filtered = list.filter(a => a.id !== id);
    this.set(StorageKeys.ANNOUNCEMENTS, filtered);
    return true;
  },

  // ================= SESSION =================
  getSession() {
    return this.get(StorageKeys.SESSION, null);
  },

  setSession(userData) {
    const session = {
      userId: userData.id,
      name: userData.name,
      email: userData.email,
      role: userData.role,
      department: userData.department,
      designation: userData.designation,
      salary: userData.salary,
      loginAt: new Date().toISOString()
    };
    this.set(StorageKeys.SESSION, session);
    return session;
  },

  clearSession() {
    return this.remove(StorageKeys.SESSION);
  },

  // ================= THEME =================
  getTheme() {
    return this.get(StorageKeys.THEME, 'light');
  },

  setTheme(theme) {
    this.set(StorageKeys.THEME, theme);
    document.documentElement.setAttribute('data-theme', theme);
  },

  // ================= UTILITIES & HELPERS =================
  generateId(prefix = 'ID') {
    const random = Math.floor(1000 + Math.random() * 9000);
    const timestamp = Date.now().toString().slice(-4);
    return `${prefix}-${timestamp}${random}`;
  },

  getTodayString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  getCurrentTimeString() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  },

  /**
   * Check if a specific date is a working day
   */
  isWorkingDay(dateInput, workingDaysConfig = null) {
    const date = typeof dateInput === 'string' ? new Date(dateInput + 'T00:00:00') : dateInput;
    const dayOfWeek = date.getDay();
    const company = this.getCompany();
    const workingDays = workingDaysConfig || company.workingDays || [1, 2, 3, 4, 5];
    return workingDays.includes(dayOfWeek);
  },

  /**
   * Calculate number of working days between two dates inclusive
   */
  calculateWorkingDays(startDateStr, endDateStr, workingDaysConfig = null) {
    const start = new Date(startDateStr + 'T00:00:00');
    const end = new Date(endDateStr + 'T00:00:00');
    if (start > end) return 0;

    let count = 0;
    const current = new Date(start);
    while (current <= end) {
      if (this.isWorkingDay(current, workingDaysConfig)) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    return count;
  },

  /**
   * Calculate used approved paid leaves for an employee in current year
   */
  getApprovedLeaveDaysThisYear(userId) {
    const currentYear = new Date().getFullYear();
    const leaves = this.getLeaves({ userId, status: 'approved' });
    
    let totalPaidDays = 0;
    leaves.forEach(l => {
      if (l.leaveType !== 'unpaid' && l.startDate.startsWith(String(currentYear))) {
        totalPaidDays += (l.workingDays || 0);
      }
    });
    return totalPaidDays;
  },

  /**
   * Get remaining leave quota for employee
   */
  getRemainingLeaveBalance(userId) {
    const company = this.getCompany();
    const annualQuota = company.annualLeaveQuota || 20;
    const usedDays = this.getApprovedLeaveDaysThisYear(userId);
    return Math.max(0, annualQuota - usedDays);
  },

  /**
   * Check if an employee has any approved leave on a given date (YYYY-MM-DD)
   */
  hasApprovedLeaveOnDate(userId, dateStr) {
    const leaves = this.getLeaves({ userId, status: 'approved' });
    return leaves.some(l => dateStr >= l.startDate && dateStr <= l.endDate);
  },

  /**
   * Recheck overlap for leave request
   */
  checkLeaveOverlap(userId, startDateStr, endDateStr, excludeLeaveId = null) {
    const userLeaves = this.getLeaves({ userId });
    return userLeaves.some(l => {
      if (excludeLeaveId && l.id === excludeLeaveId) return false;
      if (l.status === 'rejected') return false;
      return (startDateStr <= l.endDate && endDateStr >= l.startDate);
    });
  },

  /**
   * Reset database to clean first-run state
   */
  resetAllData() {
    localStorage.removeItem(StorageKeys.COMPANY);
    localStorage.removeItem(StorageKeys.USERS);
    localStorage.removeItem(StorageKeys.ATTENDANCE);
    localStorage.removeItem(StorageKeys.LEAVES);
    localStorage.removeItem(StorageKeys.SESSION);
    localStorage.removeItem(StorageKeys.ANNOUNCEMENTS);
    return true;
  }
};
