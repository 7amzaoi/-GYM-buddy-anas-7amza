import { useEffect, useRef } from 'react';
import { Store } from '../store.js';
import { icon } from '../icons.jsx';
import { getAIResponse } from '../data.js';

const suggestions = ['Suggest a workout for muscle gain', 'What should I eat after training?', 'I need motivation!', 'Best exercises for beginners?', 'How to improve cardio?', 'Recovery tips please'];

function formatChatText(text) {
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
}

export default function AssistantPage() {
  const messages = Store.get('chatMessages') || [];
  const inputRef = useRef(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const el = document.getElementById('chat-messages');
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
    return () => window.clearTimeout(t);
  }, [messages.length]);

  function sendChat(text) {
    Store.update('chatMessages', msgs => [...msgs, { role: 'user', text }]);
    window.setTimeout(() => {
      const response = getAIResponse(text);
      Store.update('chatMessages', msgs => [...msgs, { role: 'bot', text: response }]);
    }, 800);
  }

  function sendFromInput() {
    const input = inputRef.current;
    if (!input || !input.value.trim()) return;
    sendChat(input.value.trim());
    input.value = '';
  }

  return (
    <>
      <div className="page-header animate-fade">
        <h1>{icon('bot', 24)} AI Gym Coach</h1>
        <p>Your personal fitness assistant — ask anything!</p>
      </div>

      <div className="chat-container animate-slide-up delay-1">
        <div className="chat-messages" id="chat-messages">
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🤖</div>
              <h3 style={{ marginBottom: '8px' }}>Hey there, champion!</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>I'm your AI gym coach. Ask me about workouts, nutrition, recovery, or anything fitness!</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                {suggestions.map(s => (
                  <button key={s} type="button" className="btn btn-secondary btn-sm" onClick={() => sendChat(s)}>{s}</button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`chat-bubble ${m.role}`} dangerouslySetInnerHTML={{ __html: formatChatText(m.text) }} />
            ))
          )}
        </div>

        <div className="chat-input-area">
          <input
            ref={inputRef}
            className="input"
            id="chat-input"
            placeholder="Ask me anything about fitness..."
            onKeyDown={(e) => { if (e.key === 'Enter') sendFromInput(); }}
          />
          <button type="button" className="btn btn-primary btn-icon" onClick={sendFromInput}>{icon('send', 18)}</button>
        </div>
      </div>
    </>
  );
}
