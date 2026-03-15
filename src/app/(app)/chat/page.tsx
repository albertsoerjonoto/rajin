'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getToday, cn } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import type { ParsedFood, ParsedExercise, MealType } from '@/lib/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  parsedFoods?: ParsedFood[];
  parsedExercises?: ParsedExercise[];
  saved?: boolean;
}

let msgCounter = 0;
function nextMsgId() {
  return `msg-${Date.now()}-${++msgCounter}`;
}

export default function ChatPage() {
  const { user } = useAuth();
  const { showToast, ToastContainer } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hi! Tell me what you ate or what exercise you did, and I\'ll log it for you. Try something like "had nasi goreng for lunch and ran 3km this morning".',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    if (input.trim().length > 1000) {
      showToast('error', 'Message too long (max 1,000 characters)');
      return;
    }

    const userMsg: Message = {
      id: nextMsgId(),
      role: 'user',
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.content }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextMsgId(),
            role: 'assistant',
            content: data.error || 'Sorry, something went wrong. Please try again.',
          },
        ]);
        setLoading(false);
        return;
      }

      const foods: ParsedFood[] = data.foods || [];
      const exercises: ParsedExercise[] = data.exercises || [];

      let responseText = '';
      if (foods.length > 0) {
        responseText += `Found ${foods.length} food item${foods.length > 1 ? 's' : ''}`;
      }
      if (exercises.length > 0) {
        if (responseText) responseText += ' and ';
        responseText += `${exercises.length} exercise${exercises.length > 1 ? 's' : ''}`;
      }
      if (!responseText) {
        responseText = "I couldn't find any food or exercise in your message. Try being more specific!";
      } else {
        responseText += '. Review and tap Save to log them.';
      }

      const assistantMsg: Message = {
        id: nextMsgId(),
        role: 'assistant',
        content: responseText,
        parsedFoods: foods,
        parsedExercises: exercises,
        saved: false,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: nextMsgId(),
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
        },
      ]);
    }

    setLoading(false);
  };

  const saveResults = async (msgId: string, foods: ParsedFood[], exercises: ParsedExercise[]) => {
    if (!user || savingId) return;
    setSavingId(msgId);
    const supabase = createClient();
    const today = getToday();
    let hasError = false;

    if (foods.length > 0) {
      const { error } = await supabase.from('food_logs').insert(
        foods.map((f) => ({
          user_id: user.id,
          date: today,
          meal_type: f.meal_type,
          description: f.description,
          calories: f.calories,
          protein_g: f.protein_g,
          carbs_g: f.carbs_g,
          fat_g: f.fat_g,
          source: 'chat' as const,
        }))
      );
      if (error) hasError = true;
    }

    if (exercises.length > 0) {
      const { error } = await supabase.from('exercise_logs').insert(
        exercises.map((e) => ({
          user_id: user.id,
          date: today,
          exercise_type: e.exercise_type,
          duration_minutes: e.duration_minutes,
          calories_burned: e.calories_burned,
          notes: e.notes,
          source: 'chat' as const,
        }))
      );
      if (error) hasError = true;
    }

    if (hasError) {
      showToast('error', 'Failed to save some entries. Please try again.');
      setSavingId(null);
      return;
    }

    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, saved: true } : m))
    );
    setSavingId(null);
  };

  const updateFood = (msgId: string, index: number, field: keyof ParsedFood, value: string | number) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId || !m.parsedFoods) return m;
        const newFoods = [...m.parsedFoods];
        newFoods[index] = { ...newFoods[index], [field]: value };
        return { ...m, parsedFoods: newFoods };
      })
    );
  };

  const updateExercise = (msgId: string, index: number, field: keyof ParsedExercise, value: string | number) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId || !m.parsedExercises) return m;
        const newExercises = [...m.parsedExercises];
        newExercises[index] = { ...newExercises[index], [field]: value };
        return { ...m, parsedExercises: newExercises };
      })
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  return (
    <div className="max-w-lg mx-auto flex flex-col h-[calc(100vh-4rem)]">
      {ToastContainer}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-3 space-y-5 scrollbar-hide">
        {messages.map((msg) => (
          <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>

            {/* Assistant avatar */}
            {msg.role === 'assistant' && (
              <div
                className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
                style={{ background: 'var(--accent)' }}
              >
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
                </svg>
              </div>
            )}

            <div className={cn('animate-fade-in', msg.role === 'user' ? 'max-w-[80%]' : 'flex-1 max-w-[calc(100%-2.5rem)]')}>
              {msg.role === 'user' ? (
                /* User bubble */
                <div
                  className="px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm"
                  style={{
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {msg.content}
                </div>
              ) : (
                /* Assistant — no bubble, just text */
                <div>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                    {msg.content}
                  </p>

                  {/* Parsed Food Cards */}
                  {msg.parsedFoods && msg.parsedFoods.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {msg.parsedFoods.map((food, i) => (
                        <div
                          key={i}
                          className="rounded-xl p-3"
                          style={{
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span
                              className="text-xs font-semibold uppercase tracking-wide"
                              style={{ color: 'var(--accent)' }}
                            >
                              {food.meal_type}
                            </span>
                            {!msg.saved && (
                              <select
                                value={food.meal_type}
                                onChange={(e) => updateFood(msg.id, i, 'meal_type', e.target.value as MealType)}
                                className="text-xs rounded-lg px-1.5 py-0.5"
                                style={{
                                  background: 'var(--bg-main)',
                                  border: '1px solid var(--border)',
                                  color: 'var(--text-secondary)',
                                  outline: 'none',
                                }}
                              >
                                <option value="breakfast">Breakfast</option>
                                <option value="lunch">Lunch</option>
                                <option value="dinner">Dinner</option>
                                <option value="snack">Snack</option>
                              </select>
                            )}
                          </div>
                          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {food.description}
                          </p>
                          <div className="flex gap-3 mt-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                            <span>{food.calories} cal</span>
                            {food.protein_g ? <span>{food.protein_g}g P</span> : null}
                            {food.carbs_g ? <span>{food.carbs_g}g C</span> : null}
                            {food.fat_g ? <span>{food.fat_g}g F</span> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Parsed Exercise Cards */}
                  {msg.parsedExercises && msg.parsedExercises.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {msg.parsedExercises.map((ex, i) => (
                        <div
                          key={i}
                          className="rounded-xl p-3"
                          style={{
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {ex.exercise_type}
                          </p>
                          <div className="flex gap-3 mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                            <span>{ex.duration_minutes} min</span>
                            <span>{ex.calories_burned} cal burned</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Save Button */}
                  {(msg.parsedFoods?.length || msg.parsedExercises?.length) && !msg.saved ? (
                    <button
                      onClick={() => saveResults(msg.id, msg.parsedFoods || [], msg.parsedExercises || [])}
                      disabled={savingId === msg.id}
                      className="mt-3 px-4 py-2 text-sm font-medium rounded-lg transition-all disabled:opacity-50"
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        color: 'var(--accent)',
                      }}
                    >
                      {savingId === msg.id ? 'Saving...' : 'Save to Log'}
                    </button>
                  ) : msg.saved ? (
                    <p
                      className="mt-2 text-xs font-medium flex items-center gap-1"
                      style={{ color: 'var(--accent)' }}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      Saved
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div
              className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center"
              style={{ background: 'var(--accent)' }}
            >
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
              </svg>
            </div>
            <div className="flex items-center gap-1 pt-1">
              <div
                className="w-2 h-2 rounded-full animate-bounce"
                style={{ background: 'var(--text-secondary)', animationDelay: '0ms' }}
              />
              <div
                className="w-2 h-2 rounded-full animate-bounce"
                style={{ background: 'var(--text-secondary)', animationDelay: '150ms' }}
              />
              <div
                className="w-2 h-2 rounded-full animate-bounce"
                style={{ background: 'var(--text-secondary)', animationDelay: '300ms' }}
              />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ChatGPT-style input */}
      <div className="px-4 pb-3 pt-2">
        <div
          className="flex items-end gap-2 rounded-2xl px-4 py-3"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            rows={1}
            className="flex-1 bg-transparent text-sm resize-none outline-none leading-relaxed"
            style={{
              color: 'var(--text-primary)',
              minHeight: '24px',
              maxHeight: '120px',
            }}
            placeholder="Message Rajin..."
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
            style={{
              background: input.trim() && !loading ? 'var(--text-primary)' : 'var(--bg-surface)',
              border: `1px solid ${input.trim() && !loading ? 'transparent' : 'var(--border)'}`,
            }}
            aria-label="Send message"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke={input.trim() && !loading ? 'var(--bg-main)' : 'var(--text-secondary)'}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
            </svg>
          </button>
        </div>
        <p className="text-center text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
          Rajin can make mistakes. Verify nutritional info.
        </p>
      </div>
    </div>
  );
}
