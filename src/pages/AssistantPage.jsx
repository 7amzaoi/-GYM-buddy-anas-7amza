import { useEffect, useRef, useState } from 'react';
import { Store } from '../store.js';
import { icon } from '../icons.jsx';
import { getAIResponse } from '../data.js';

const suggestions = [
  { iconKey: 'dumbbell', text: 'Suggest a workout for muscle gain' },
  { iconKey: 'leaf', text: 'What should I eat after training?' },
  { iconKey: 'fire', text: 'I need motivation!' },
  { iconKey: 'star', text: 'Best exercises for beginners?' },
  { iconKey: 'activity', text: 'How to improve cardio?' },
  { iconKey: 'clock', text: 'Recovery tips please' },
];

function formatChatText(text) {
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
}

export default function AssistantPage() {
  const messages = Store.get('chatMessages') || [];
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
    return () => window.clearTimeout(t);
  }, [messages.length, typing]);

  function sendChat(text) {
    Store.update('chatMessages', msgs => [...msgs, { role: 'user', text }]);
    setTyping(true);
    window.setTimeout(() => {
      const response = getAIResponse(text);
      setTyping(false);
      Store.update('chatMessages', msgs => [...msgs, { role: 'bot', text: response }]);
    }, 800);
  }

  function sendFromInput() {
    const input = inputRef.current;
    if (!input || !input.value.trim()) return;
    sendChat(input.value.trim());
    input.value = '';
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="ai">
      {/* ===== Header ===== */}
      <header className="ai-header">
        <span className="gx-eyebrow">{icon('bot', 13)} AI Coach</span>
        <h1 className="ai-h1">Gym Coach</h1>
        <p className="gx-subtitle">Your personal fitness assistant — ask anything about training, nutrition or recovery.</p>
      </header>

      {/* ===== Chat panel ===== */}
      <div className="ai-panel gx-card">
        <div className="ai-messages" ref={scrollRef}>
          {isEmpty ? (
            <div className="ai-welcome">
              <div className="ai-welcome-avatar">{icon('bot', 30)}</div>
              <h3 className="ai-welcome-title">Hey there, champion!</h3>
              <p className="ai-welcome-desc">
                I&apos;m your AI gym coach. Ask me about workouts, nutrition, recovery, or anything fitness.
              </p>
              <div className="ai-suggestions">
                {suggestions.map((s) => (
                  <button key={s.text} type="button" className="ai-suggestion" onClick={() => sendChat(s.text)}>
                    <span className="ai-suggestion-icon">{icon(s.iconKey, 15)}</span>
                    {s.text}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((m, i) => (
                <div key={i} className={`ai-row ${m.role}`}>
                  {m.role === 'bot' ? <span className="ai-msg-avatar">{icon('bot', 16)}</span> : null}
                  <div
                    className={`ai-bubble ${m.role}`}
                    dangerouslySetInnerHTML={{ __html: formatChatText(m.text) }}
                  />
                </div>
              ))}
              {typing ? (
                <div className="ai-row bot">
                  <span className="ai-msg-avatar">{icon('bot', 16)}</span>
                  <div className="ai-bubble bot ai-typing" aria-label="Coach is typing">
                    <span /><span /><span />
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        {/* ===== Quick chips (when conversation active) ===== */}
        {!isEmpty ? (
          <div className="ai-quickbar">
            {suggestions.slice(0, 4).map((s) => (
              <button key={s.text} type="button" className="ai-quickchip" onClick={() => sendChat(s.text)}>
                {icon(s.iconKey, 13)} {s.text}
              </button>
            ))}
          </div>
        ) : null}

        {/* ===== Input ===== */}
        <div className="ai-input-row">
          <input
            ref={inputRef}
            className="ai-input"
            placeholder="Ask me anything about fitness..."
            onKeyDown={(e) => { if (e.key === 'Enter') sendFromInput(); }}
          />
          <button type="button" className="ai-send" onClick={sendFromInput} aria-label="Send message">
            {icon('send', 17)}
          </button>
        </div>
      </div>
    </div>
  );
}
