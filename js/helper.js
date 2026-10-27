/**
 * HCM Lite - Smart Helper Chat Widget (js/helper.js)
 * Rule-based, role-aware assistant answering real-time questions directly from localStorage.
 */

const SmartHelper = {
  isOpen: false,

  init() {
    this.createWidgetDOM();
    this.bindEvents();
    this.renderWelcome();
  },

  createWidgetDOM() {
    if (document.getElementById('smartHelperWidget')) return;

    const div = document.createElement('div');
    div.id = 'smartHelperWidget';
    div.innerHTML = `
      <!-- Floating Trigger Button -->
      <div id="smartHelperTrigger" class="smart-helper-trigger" title="Open Smart Assistant">
        <i data-lucide="bot-message-square" style="width: 26px; height: 26px;"></i>
        <div class="smart-helper-badge"></div>
      </div>

      <!-- Chat Drawer Window -->
      <div id="smartHelperWindow" class="smart-helper-window">
        <div class="smart-helper-header">
          <div class="smart-helper-title-box">
            <div style="width:32px; height:32px; border-radius:var(--radius-md); background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center;">
              <i data-lucide="sparkles" style="width:18px;height:18px"></i>
            </div>
            <div>
              <div class="smart-helper-title">Smart Helper</div>
              <div class="smart-helper-subtitle">Live Data Assistant &bull; Offline</div>
            </div>
          </div>
          <button id="smartHelperCloseBtn" style="color:#ffffff; opacity:0.8; padding:4px;" title="Close">
            <i data-lucide="x" style="width:18px; height:18px;"></i>
          </button>
        </div>

        <div id="smartHelperBody" class="smart-helper-body">
          <!-- Messages will be injected here -->
        </div>

        <div class="smart-helper-footer">
          <input type="text" id="smartHelperInput" class="smart-helper-input" placeholder="Ask a question..." autocomplete="off" />
          <button id="smartHelperSendBtn" class="smart-helper-send" title="Send Question">
            <i data-lucide="send" style="width:16px;height:16px"></i>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(div);
    UI.initIcons();
  },

  bindEvents() {
    const trigger = document.getElementById('smartHelperTrigger');
    const closeBtn = document.getElementById('smartHelperCloseBtn');
    const input = document.getElementById('smartHelperInput');
    const sendBtn = document.getElementById('smartHelperSendBtn');

    if (trigger) {
      trigger.addEventListener('click', () => this.toggleWindow());
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.toggleWindow(false));
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.handleSend());
    }

    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleSend();
        }
      });
    }
  },

  toggleWindow(forceState = null) {
    const win = document.getElementById('smartHelperWindow');
    if (!win) return;

    this.isOpen = (forceState !== null) ? forceState : !this.isOpen;
    if (this.isOpen) {
      win.classList.add('active');
      document.getElementById('smartHelperInput')?.focus();
    } else {
      win.classList.remove('active');
    }
    UI.initIcons();
  },

  renderWelcome() {
    const session = Storage.getSession();
    const role = session ? session.role : 'guest';
    const name = session ? session.name.split(' ')[0] : 'there';

    let promptPills = [];
    if (role === 'admin') {
      promptPills = [
        "How many employees do we have?",
        "Who is on leave today?",
        "Who was late today?",
        "How many employees are absent today?",
        "How many pending leave requests are there?",
        "How many employees are in each department?"
      ];
    } else {
      promptPills = [
        "How many leaves do I have left?",
        "Was I late today?",
        "What time did I check in?",
        "How many hours did I work this week?",
        "What is my attendance this month?",
        "What is my leave request status?"
      ];
    }

    const html = `
      <div class="chat-bubble chat-bubble-bot">
        Hello <strong>${UI.escapeHTML(name)}</strong>! I'm your local HR assistant. I can answer real-time questions based on actual system records.
        <div style="margin-top: 8px; font-weight: 600; font-size: 0.75rem; color: var(--text-muted);">SUGGESTED QUESTIONS:</div>
        <div class="chat-quick-suggestions">
          ${promptPills.map(q => `<button class="quick-btn" onclick="SmartHelper.ask('${q.replace(/'/g, "\\'")}')">${q}</button>`).join('')}
        </div>
      </div>
    `;

    const body = document.getElementById('smartHelperBody');
    if (body) {
      body.innerHTML = html;
      this.scrollToBottom();
    }
  },

  ask(questionText) {
    const input = document.getElementById('smartHelperInput');
    if (input) input.value = questionText;
    this.handleSend();
  },

  handleSend() {
    const input = document.getElementById('smartHelperInput');
    if (!input) return;

    const query = input.value.trim();
    if (!query) return;

    // Append User Message
    this.appendMessage(query, 'user');
    input.value = '';

    // Process Response with a tiny natural typing delay
    setTimeout(() => {
      const response = this.processQuery(query);
      this.appendMessage(response, 'bot');
    }, 200);
  },

  appendMessage(text, sender = 'bot') {
    const body = document.getElementById('smartHelperBody');
    if (!body) return;

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble chat-bubble-${sender}`;
    bubble.innerHTML = text;
    body.appendChild(bubble);
    this.scrollToBottom();
  },

  scrollToBottom() {
    const body = document.getElementById('smartHelperBody');
    if (body) {
      body.scrollTop = body.scrollHeight;
    }
  },

  /**
   * Natural Language Keyword Processing against stored data
   */
  processQuery(rawQuery) {
    const session = Storage.getSession();
    const role = session ? session.role : 'guest';
    const q = rawQuery.toLowerCase();
    const today = Storage.getTodayString();

    // ==========================================
    // 1. ADMINISTRATOR QUESTIONS
    // ==========================================
    if (role === 'admin') {
      // Question: How many employees do we have?
      if (q.includes('how many employee') || q.includes('total employee') || q.includes('employee count') || q.includes('number of employee')) {
        const users = Storage.getUsers().filter(u => u.role === 'employee');
        const active = users.filter(u => u.status === 'active').length;
        const inactive = users.filter(u => u.status === 'inactive').length;
        return `We currently have <strong>${users.length} total employees</strong> registered (${active} active, ${inactive} inactive).`;
      }

      // Question: Who is on leave today?
      if (q.includes('on leave today') || q.includes('who is on leave') || q.includes('leaves today')) {
        const leaves = Storage.getLeaves({ status: 'approved' });
        const onLeaveList = leaves.filter(l => today >= l.startDate && today <= l.endDate);
        if (onLeaveList.length === 0) {
          return "No employees are on approved leave today.";
        }
        const names = onLeaveList.map(l => `&bull; <strong>${UI.escapeHTML(l.userName)}</strong> (${l.leaveType.toUpperCase()} leave: ${l.startDate} to ${l.endDate})`).join('<br>');
        return `There ${onLeaveList.length === 1 ? 'is' : 'are'} <strong>${onLeaveList.length} employee${onLeaveList.length === 1 ? '' : 's'}</strong> on approved leave today:<br>${names}`;
      }

      // Question: Who was late today?
      if (q.includes('who was late') || q.includes('who is late') || q.includes('late today') || q.includes('late arrival')) {
        const attendance = Storage.getAttendance({ date: today });
        const lateList = attendance.filter(a => a.status === 'late' || a.isLate);
        if (lateList.length === 0) {
          return "No late check-ins have been recorded today. Great punctuality!";
        }
        const details = lateList.map(a => `&bull; <strong>${UI.escapeHTML(a.userName || 'Employee')}</strong> checked in late at ${a.checkIn} (+${a.lateMinutes} mins)`).join('<br>');
        return `<strong>${lateList.length} employee${lateList.length === 1 ? '' : 's'}</strong> arrived late today:<br>${details}`;
      }

      // Question: How many employees are absent today?
      if (q.includes('absent today') || q.includes('how many absent') || q.includes('who is absent')) {
        const stats = Attendance.getTodayStats();
        if (!stats.isWorkingDay) {
          return "Today is configured as a non-working day for the company, so no employees are considered absent.";
        }
        return `Currently, <strong>${stats.absent} employee${stats.absent === 1 ? '' : 's'}</strong> ${stats.absent === 1 ? 'is' : 'are'} absent today (out of ${stats.totalEmployees} active employees).`;
      }

      // Question: How many pending leave requests are there?
      if (q.includes('pending leave') || q.includes('leave requests pending') || q.includes('how many pending')) {
        const leaves = Storage.getLeaves({ status: 'pending' });
        if (leaves.length === 0) {
          return "There are currently <strong>0 pending leave requests</strong>. All requests have been actioned!";
        }
        return `There ${leaves.length === 1 ? 'is' : 'are'} <strong>${leaves.length} pending leave request${leaves.length === 1 ? '' : 's'}</strong> awaiting your review on the Leaves page.`;
      }

      // Question: How many employees are in each department?
      if (q.includes('each department') || q.includes('department distribution') || q.includes('by department') || q.includes('departments')) {
        const users = Storage.getUsers().filter(u => u.role === 'employee');
        if (users.length === 0) return "There are no employees registered yet.";
        const counts = {};
        users.forEach(u => {
          counts[u.department] = (counts[u.department] || 0) + 1;
        });
        const list = Object.entries(counts).map(([dept, count]) => `&bull; <strong>${UI.escapeHTML(dept)}</strong>: ${count} employee${count === 1 ? '' : 's'}`).join('<br>');
        return `Employee count by department:<br>${list}`;
      }
    }

    // ==========================================
    // 2. EMPLOYEE QUESTIONS (RESTRICTED TO SELF)
    // ==========================================
    if (role === 'employee' || role === 'admin') {
      const targetUserId = session.userId;

      // Question: How many leaves do I have left?
      if (q.includes('leaves do i have left') || q.includes('remaining leave') || q.includes('leave balance') || q.includes('my leaves')) {
        const company = Storage.getCompany();
        const quota = company.annualLeaveQuota || 20;
        const used = Storage.getApprovedLeaveDaysThisYear(targetUserId);
        const remaining = Math.max(0, quota - used);
        return `You have <strong>${remaining} paid leave days remaining</strong> for this year (out of an annual quota of ${quota} days; ${used} days used so far).`;
      }

      // Question: Was I late today?
      if (q.includes('was i late') || q.includes('am i late') || q.includes('late today')) {
        const att = Storage.getAttendanceToday(targetUserId);
        if (!att) {
          return "You haven't checked in yet today.";
        }
        if (att.isLate || att.status === 'late') {
          return `Yes, you were logged as late today. You checked in at <strong>${att.checkIn}</strong> (+${att.lateMinutes} mins after grace period).`;
        } else {
          return `No, you checked in on time at <strong>${att.checkIn}</strong>. Well done!`;
        }
      }

      // Question: What time did I check in?
      if (q.includes('check in') || q.includes('checked in') || q.includes('punch in')) {
        const att = Storage.getAttendanceToday(targetUserId);
        if (!att) {
          return "You haven't checked in yet today. Use the Check In button on your dashboard.";
        }
        return `You checked in today at <strong>${att.checkIn}</strong> via ${att.method || 'Web'}.`;
      }

      // Question: How many hours did I work this week?
      if (q.includes('work this week') || q.includes('hours this week') || q.includes('worked this week')) {
        // Calculate week bounds (Sunday to Saturday)
        const now = new Date();
        const dayOfWeek = now.getDay();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - dayOfWeek);
        startOfWeek.setHours(0, 0, 0, 0);

        const records = Storage.getAttendance({ userId: targetUserId });
        let totalHours = 0;
        records.forEach(r => {
          const rDate = new Date(r.date + 'T00:00:00');
          if (rDate >= startOfWeek && rDate <= now) {
            totalHours += (r.workHours || 0);
          }
        });

        return `You have worked <strong>${totalHours.toFixed(2)} hours</strong> this week across completed sessions.`;
      }

      // Question: What is my attendance this month?
      if (q.includes('attendance this month') || q.includes('my attendance') || q.includes('attendance summary')) {
        const now = new Date();
        const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const records = Storage.getAttendance({ userId: targetUserId, month: monthStr });

        let present = 0;
        let late = 0;
        let halfDay = 0;

        records.forEach(r => {
          if (r.status === 'half_day') halfDay++;
          else {
            present++;
            if (r.isLate || r.status === 'late') late++;
          }
        });

        return `Your attendance for this month (${records.length} total logged sessions):<br>&bull; <strong>${present}</strong> Days Present<br>&bull; <strong>${late}</strong> Late Arrivals<br>&bull; <strong>${halfDay}</strong> Half-Days`;
      }

      // Question: What is my leave request status?
      if (q.includes('leave request status') || q.includes('leave status') || q.includes('my leave request')) {
        const leaves = Storage.getLeaves({ userId: targetUserId })
          .sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));

        if (leaves.length === 0) {
          return "You have not submitted any leave requests yet.";
        }

        const latest = leaves[0];
        let statusBadge = latest.status.toUpperCase();
        let commentText = latest.adminComment ? `<br>HR Comment: <em>"${UI.escapeHTML(latest.adminComment)}"</em>` : '';

        return `Your most recent leave request (${UI.formatDate(latest.startDate)} to ${UI.formatDate(latest.endDate)}) is currently <strong>${statusBadge}</strong>.${commentText}`;
      }
    }

    // ==========================================
    // 3. FALLBACK FOR UNSUPPORTED QUESTIONS
    // ==========================================
    const fallbackSuggestions = role === 'admin'
      ? ["How many employees do we have?", "Who was late today?", "Who is on leave today?", "How many pending leave requests are there?"]
      : ["How many leaves do I have left?", "Was I late today?", "What time did I check in?", "What is my attendance this month?"];

    return `
      I'm not sure how to answer that yet. I'm a rule-based assistant answering specific HR questions.
      <div style="margin-top: 8px; font-weight:600; font-size:0.75rem;">YOU CAN ASK ME:</div>
      <div class="chat-quick-suggestions">
        ${fallbackSuggestions.map(s => `<button class="quick-btn" onclick="SmartHelper.ask('${s.replace(/'/g, "\\'")}')">${s}</button>`).join('')}
      </div>
    `;
  }
};
