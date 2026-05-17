// ========== AI ASSISTANT PAGE ==========
function renderAssistant() {
  const messages = Store.get('chatMessages') || [];
  const suggestions = ['Suggest a workout for muscle gain','What should I eat after training?','I need motivation!','Best exercises for beginners?','How to improve cardio?','Recovery tips please'];

  return `
  <div class="page-header animate-fade">
    <h1>${icon('bot',24)} AI Gym Coach</h1>
    <p>Your personal fitness assistant — ask anything!</p>
  </div>

  <div class="chat-container animate-slide-up delay-1">
    <div class="chat-messages" id="chat-messages">
      ${messages.length === 0 ? `
        <div style="text-align:center;padding:40px 0">
          <div style="font-size:3rem;margin-bottom:16px">🤖</div>
          <h3 style="margin-bottom:8px">Hey there, champion!</h3>
          <p style="color:var(--text-secondary);margin-bottom:24px">I'm your AI gym coach. Ask me about workouts, nutrition, recovery, or anything fitness!</p>
          <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">
            ${suggestions.map(s => `<button class="btn btn-secondary btn-sm" onclick="sendChat('${s}')">${s}</button>`).join('')}
          </div>
        </div>
      ` : messages.map(m => `<div class="chat-bubble ${m.role}">${formatChatText(m.text)}</div>`).join('')}
    </div>

    <div class="chat-input-area">
      <input class="input" id="chat-input" placeholder="Ask me anything about fitness..." onkeydown="if(event.key==='Enter')sendChatFromInput()">
      <button class="btn btn-primary btn-icon" onclick="sendChatFromInput()">${icon('send',18)}</button>
    </div>
  </div>`;
}

function formatChatText(text) {
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
}

function sendChatFromInput() {
  const input = document.getElementById('chat-input');
  if (!input || !input.value.trim()) return;
  sendChat(input.value.trim());
}

function sendChat(text) {
  Store.update('chatMessages', msgs => [...msgs, { role: 'user', text }]);
  render();
  scrollChat();

  // Simulate typing delay
  setTimeout(() => {
    const response = getAIResponse(text);
    Store.update('chatMessages', msgs => [...msgs, { role: 'bot', text: response }]);
    render();
    scrollChat();
  }, 800);
}

function scrollChat() {
  setTimeout(() => {
    const el = document.getElementById('chat-messages');
    if (el) el.scrollTop = el.scrollHeight;
  }, 50);
}

// ========== PROFILE PAGE ==========
function renderProfile() {
  const user = Store.get('user');
  const progress = Store.get('progressData');
  const history = Store.get('workoutHistory') || [];
  if (!user) return '';

  const goalIcons = { 'muscle gain': '💪', 'fat loss': '🔥', 'strength': '🏋️', 'cardio': '🏃' };
  const daysSinceJoin = Math.max(1, Math.floor((Date.now() - new Date(user.joinDate).getTime()) / 86400000));

  const badges = [
    { icon: '🏆', name: 'First Workout', unlocked: progress.totalWorkouts >= 1 },
    { icon: '🔥', name: '3-Day Streak', unlocked: progress.streak >= 3 },
    { icon: '⚡', name: '10 Workouts', unlocked: progress.totalWorkouts >= 10 },
    { icon: '💎', name: '25 Workouts', unlocked: progress.totalWorkouts >= 25 },
    { icon: '👑', name: '50 Workouts', unlocked: progress.totalWorkouts >= 50 },
    { icon: '🌟', name: '7-Day Streak', unlocked: progress.streak >= 7 },
  ];

  return `
  <div class="page-header animate-fade">
    <h1>${icon('user',24)} Profile</h1>
    <p>Manage your account and fitness goals</p>
  </div>

  <!-- Profile Header -->
  <div class="card animate-slide-up delay-1" style="margin-bottom:24px">
    <div class="profile-header">
      <div class="profile-avatar">${user.name.charAt(0).toUpperCase()}</div>
      <div class="profile-info">
        <h2>${user.name}</h2>
        <p>${user.email}</p>
        <span class="badge badge-accent" style="margin-top:8px">${goalIcons[user.goal] || '🎯'} ${user.goal?.charAt(0).toUpperCase() + user.goal?.slice(1)}</span>
      </div>
    </div>
  </div>

  <div class="grid grid-2 animate-slide-up delay-2" style="margin-bottom:24px">
    <!-- Stats -->
    <div class="card">
      <h3 style="margin-bottom:16px">${icon('chart',18)} Your Stats</h3>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div style="display:flex;justify-content:space-between"><span style="color:var(--text-secondary)">Member Since</span><span style="font-weight:600">${new Date(user.joinDate).toLocaleDateString()}</span></div>
        <div style="display:flex;justify-content:space-between"><span style="color:var(--text-secondary)">Total Workouts</span><span style="font-weight:600;color:var(--accent)">${progress.totalWorkouts}</span></div>
        <div style="display:flex;justify-content:space-between"><span style="color:var(--text-secondary)">Current Streak</span><span style="font-weight:600">${progress.streak} days</span></div>
        <div style="display:flex;justify-content:space-between"><span style="color:var(--text-secondary)">Days Active</span><span style="font-weight:600">${daysSinceJoin}</span></div>
        <div style="display:flex;justify-content:space-between"><span style="color:var(--text-secondary)">Avg Workouts/Week</span><span style="font-weight:600">${(progress.totalWorkouts / Math.max(1, daysSinceJoin / 7)).toFixed(1)}</span></div>
      </div>
    </div>

    <!-- Edit Goal -->
    <div class="card">
      <h3 style="margin-bottom:16px">${icon('target',18)} Fitness Goal</h3>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${['muscle gain','fat loss','strength','cardio'].map(g => `
          <button class="btn ${user.goal === g ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="updateGoal('${g}')" style="width:100%">
            ${goalIcons[g]} ${g.charAt(0).toUpperCase() + g.slice(1)}
          </button>
        `).join('')}
      </div>
    </div>
  </div>

  <!-- Achievements -->
  <div class="card animate-slide-up delay-3" style="margin-bottom:24px">
    <h3 style="margin-bottom:16px">${icon('trophy',18)} Achievements</h3>
    <div class="grid grid-3">
      ${badges.map(b => `
        <div style="text-align:center;padding:20px;background:var(--bg-card);border-radius:var(--radius-sm);border:1px solid ${b.unlocked ? 'var(--accent)' : 'var(--border)'};opacity:${b.unlocked ? 1 : 0.4}">
          <div style="font-size:2rem;margin-bottom:8px">${b.icon}</div>
          <div style="font-size:.85rem;font-weight:600">${b.name}</div>
          <div style="font-size:.75rem;color:${b.unlocked ? 'var(--accent)' : 'var(--text-secondary)'};margin-top:4px">${b.unlocked ? '✓ Unlocked' : 'Locked'}</div>
        </div>
      `).join('')}
    </div>
  </div>

  <!-- Danger Zone -->
  <div class="card animate-slide-up delay-4">
    <h3 style="margin-bottom:16px;color:var(--danger)">${icon('logout',18)} Account</h3>
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <button class="btn btn-secondary btn-sm" onclick="if(confirm('Clear all data?')){localStorage.clear();location.reload()}">${icon('trash',14)} Reset All Data</button>
      <button class="btn btn-danger btn-sm" onclick="Store.logout();render()">${icon('logout',14)} Sign Out</button>
    </div>
  </div>`;
}

function updateGoal(goal) {
  Store.update('user', u => ({ ...u, goal }));
  render();
}
