/**
 * HCM Lite - Attendance Engine (js/attendance.js)
 * Manages Check-in, Check-out, Lateness, Half-day, Camera Biometrics & Absence tracking.
 */

const Attendance = {
  webcamStream: null,

  initEmployeeAttendance() {
    this.updateClock();
    setInterval(() => this.updateClock(), 1000);
    this.bindPunchEvents();
    this.renderEmployeeStatus();
    this.renderEmployeeHistory();
  },

  updateClock() {
    const clockEl = document.getElementById('liveClock');
    const dateEl = document.getElementById('liveDate');
    const now = new Date();

    if (clockEl) {
      clockEl.textContent = now.toLocaleTimeString('en-US', { hour12: false });
    }
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
  },

  bindPunchEvents() {
    const checkInBtn = document.getElementById('checkInBtn');
    const checkOutBtn = document.getElementById('checkOutBtn');
    const cameraCheckInBtn = document.getElementById('cameraCheckInBtn');
    const captureWebcamBtn = document.getElementById('captureWebcamBtn');
    const closeWebcamBtn = document.getElementById('closeWebcamModalBtn');

    if (checkInBtn) {
      checkInBtn.addEventListener('click', () => {
        this.processCheckIn('Standard Web');
      });
    }

    if (checkOutBtn) {
      checkOutBtn.addEventListener('click', () => {
        this.processCheckOut();
      });
    }

    if (cameraCheckInBtn) {
      cameraCheckInBtn.addEventListener('click', () => {
        this.openWebcamModal();
      });
    }

    if (captureWebcamBtn) {
      captureWebcamBtn.addEventListener('click', () => {
        this.captureAndPunch();
      });
    }

    if (closeWebcamBtn) {
      closeWebcamBtn.addEventListener('click', () => {
        this.closeWebcamModal();
      });
    }
  },

  /**
   * Process Check-In
   */
  processCheckIn(method = 'Standard Web', locationText = 'Office') {
    const session = Storage.getSession();
    if (!session) return;

    const today = Storage.getTodayString();
    const existing = Storage.getAttendanceToday(session.userId);

    if (existing) {
      UI.alert('Already Checked In', `You have already checked in today at ${existing.checkIn}.`, 'warning');
      return;
    }

    const company = Storage.getCompany();
    const nowTime = Storage.getCurrentTimeString(); // 'HH:mm'

    // Calculate Lateness
    const startParts = (company.startTime || '09:00').split(':').map(Number);
    const nowParts = nowTime.split(':').map(Number);

    const startMinutes = startParts[0] * 60 + startParts[1];
    const graceMinutes = company.gracePeriod || 15;
    const currentMinutes = nowParts[0] * 60 + nowParts[1];

    const isLate = currentMinutes > (startMinutes + graceMinutes);
    const lateMinutes = isLate ? (currentMinutes - startMinutes) : 0;
    const initialStatus = isLate ? 'late' : 'present';

    const record = {
      userId: session.userId,
      userName: session.name,
      date: today,
      checkIn: nowTime,
      checkOut: null,
      workHours: 0,
      status: initialStatus,
      isLate: isLate,
      lateMinutes: lateMinutes,
      method: method,
      location: locationText
    };

    Storage.saveAttendance(record);
    UI.toast('success', `Checked in successfully at ${nowTime}! ${isLate ? `(Late arrival logged)` : ''}`);
    this.renderEmployeeStatus();
    this.renderEmployeeHistory();
  },

  /**
   * Process Check-Out
   */
  processCheckOut() {
    const session = Storage.getSession();
    if (!session) return;

    const today = Storage.getTodayString();
    const existing = Storage.getAttendanceToday(session.userId);

    if (!existing) {
      UI.alert('No Check-In Record', 'You must check in first before checking out.', 'warning');
      return;
    }

    if (existing.checkOut) {
      UI.alert('Already Checked Out', `You have already checked out today at ${existing.checkOut}.`, 'info');
      return;
    }

    const nowTime = Storage.getCurrentTimeString();

    // Calculate work hours
    const inParts = existing.checkIn.split(':').map(Number);
    const outParts = nowTime.split(':').map(Number);

    const inTotalMinutes = inParts[0] * 60 + inParts[1];
    const outTotalMinutes = outParts[0] * 60 + outParts[1];
    let diffMinutes = outTotalMinutes - inTotalMinutes;
    if (diffMinutes < 0) diffMinutes = 0;

    const workHours = parseFloat((diffMinutes / 60).toFixed(2));

    // Determine status: If under 5 hours -> 'half_day'
    let finalStatus = existing.status;
    if (workHours < 5.0) {
      finalStatus = 'half_day';
    } else {
      finalStatus = existing.isLate ? 'late' : 'present';
    }

    Storage.saveAttendance({
      ...existing,
      checkOut: nowTime,
      workHours: workHours,
      status: finalStatus
    });

    UI.toast('success', `Checked out at ${nowTime}. Total worked: ${workHours} hrs.`);
    this.renderEmployeeStatus();
    this.renderEmployeeHistory();
  },

  /**
   * Render Employee Attendance Dashboard Status Card
   */
  renderEmployeeStatus() {
    const session = Storage.getSession();
    if (!session) return;

    const todayRecord = Storage.getAttendanceToday(session.userId);
    const checkInBtn = document.getElementById('checkInBtn');
    const checkOutBtn = document.getElementById('checkOutBtn');
    const cameraCheckInBtn = document.getElementById('cameraCheckInBtn');
    const statusPill = document.getElementById('todayAttendanceStatus');
    const checkInTimeEl = document.getElementById('todayCheckInTime');
    const checkOutTimeEl = document.getElementById('todayCheckOutTime');
    const hoursWorkedEl = document.getElementById('todayHoursWorked');

    if (!todayRecord) {
      if (checkInBtn) checkInBtn.disabled = false;
      if (cameraCheckInBtn) cameraCheckInBtn.disabled = false;
      if (checkOutBtn) checkOutBtn.disabled = true;

      if (statusPill) {
        statusPill.innerHTML = '<span class="badge badge-warning">Not Checked In Yet</span>';
      }
      if (checkInTimeEl) checkInTimeEl.textContent = '--:--';
      if (checkOutTimeEl) checkOutTimeEl.textContent = '--:--';
      if (hoursWorkedEl) hoursWorkedEl.textContent = '0 hrs';
    } else {
      if (checkInBtn) checkInBtn.disabled = true;
      if (cameraCheckInBtn) cameraCheckInBtn.disabled = true;
      if (checkOutBtn) checkOutBtn.disabled = !!todayRecord.checkOut;

      let badgeHtml = '';
      if (todayRecord.status === 'half_day') {
        badgeHtml = '<span class="badge badge-warning">Half-Day (&lt; 5 hrs)</span>';
      } else if (todayRecord.status === 'late' || todayRecord.isLate) {
        badgeHtml = '<span class="badge badge-danger">Late Arrival</span>';
      } else {
        badgeHtml = '<span class="badge badge-success">Present</span>';
      }

      if (statusPill) statusPill.innerHTML = badgeHtml;
      if (checkInTimeEl) checkInTimeEl.textContent = todayRecord.checkIn || '--:--';
      if (checkOutTimeEl) checkOutTimeEl.textContent = todayRecord.checkOut || 'In Progress';
      if (hoursWorkedEl) hoursWorkedEl.textContent = `${todayRecord.workHours || 0} hrs`;
    }
  },

  /**
   * Render Employee Recent Attendance History
   */
  renderEmployeeHistory() {
    const session = Storage.getSession();
    const tbody = document.getElementById('employeeAttendanceHistoryBody');
    if (!tbody || !session) return;

    const records = Storage.getAttendance({ userId: session.userId })
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 15);

    if (records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">No attendance records found yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = records.map(r => {
      let statusBadge = '<span class="badge badge-success">Present</span>';
      if (r.status === 'half_day') {
        statusBadge = '<span class="badge badge-warning">Half-Day</span>';
      } else if (r.status === 'late' || r.isLate) {
        statusBadge = `<span class="badge badge-danger">Late (+${r.lateMinutes || 0}m)</span>`;
      }

      return `
        <tr>
          <td style="font-weight: 600;">${UI.formatDate(r.date)}</td>
          <td>${r.checkIn || '-'}</td>
          <td>${r.checkOut || '<span style="color:var(--text-muted)">Active</span>'}</td>
          <td style="font-weight: 600;">${r.workHours ? `${r.workHours} hrs` : '-'}</td>
          <td>${statusBadge}</td>
          <td><span class="badge badge-neutral">${UI.escapeHTML(r.method || 'Web')}</span></td>
        </tr>
      `;
    }).join('');

    UI.initIcons();
  },

  // ================= BONUS FEATURE: CAMERA BIOMETRIC CHECK-IN =================
  openWebcamModal() {
    const modal = document.getElementById('webcamModal');
    const video = document.getElementById('webcamVideo');
    if (!modal || !video) return;

    UI.openModal('webcamModal');

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 360 } })
        .then(stream => {
          this.webcamStream = stream;
          video.srcObject = stream;
          video.play();
        })
        .catch(err => {
          console.warn('Webcam access error:', err);
          UI.alert('Camera Unavailable', 'Camera access was denied or is not supported in this browser. You can still use standard check-in.', 'info');
        });
    } else {
      UI.alert('Not Supported', 'Camera access is not supported by your browser.', 'info');
    }
  },

  closeWebcamModal() {
    if (this.webcamStream) {
      this.webcamStream.getTracks().forEach(track => track.stop());
      this.webcamStream = null;
    }
    UI.closeModal('webcamModal');
  },

  captureAndPunch() {
    const video = document.getElementById('webcamVideo');
    const canvas = document.getElementById('webcamCanvas');
    if (video && canvas) {
      const ctx = canvas.getContext('2d');
      canvas.width = 320;
      canvas.height = 240;
      ctx.drawImage(video, 0, 0, 320, 240);
    }

    let locationText = 'Office Biometric';
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          locationText = `Geo (${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)})`;
          this.finishWebcamPunch(locationText);
        },
        () => {
          this.finishWebcamPunch('Camera Biometric');
        },
        { timeout: 3000 }
      );
    } else {
      this.finishWebcamPunch('Camera Biometric');
    }
  },

  finishWebcamPunch(locationText) {
    this.closeWebcamModal();
    this.processCheckIn('Camera Biometric', locationText);
  },

  // ================= ADMIN ATTENDANCE REPORT & METRICS =================
  getTodayStats() {
    const today = Storage.getTodayString();
    const activeEmployees = Storage.getUsers().filter(u => u.role === 'employee' && u.status === 'active');
    const attendanceToday = Storage.getAttendance({ date: today });
    const company = Storage.getCompany();

    const isTodayWorkingDay = Storage.isWorkingDay(today, company.workingDays);

    let present = 0;
    let late = 0;
    let halfDay = 0;
    let onLeave = 0;

    activeEmployees.forEach(emp => {
      if (Storage.hasApprovedLeaveOnDate(emp.id, today)) {
        onLeave++;
        return;
      }

      const att = attendanceToday.find(a => a.userId === emp.id);
      if (att) {
        if (att.status === 'half_day') {
          halfDay++;
        } else if (att.status === 'late' || att.isLate) {
          late++;
        } else {
          present++;
        }
      }
    });

    const attendedCount = present + late + halfDay;
    const absent = isTodayWorkingDay ? Math.max(0, activeEmployees.length - attendedCount - onLeave) : 0;

    return {
      totalEmployees: activeEmployees.length,
      present,
      late,
      halfDay,
      onLeave,
      absent,
      isWorkingDay: isTodayWorkingDay
    };
  }
};
