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

  // Auto-scroll to bottom on new messages or loading change
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

    // Save food logs
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

    // Save exercise logs
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

    // Mark as saved
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

  return (
    <div className="max-w-lg mx-auto flex flex-col h-[calc(100vh-4rem)]">
      {ToastContainer}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-4 space-y-4 scrollbar-hide">
        {messages.map((msg) => (
          <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-3 animate-bounce-in',
                msg.role === 'user'
                  ? 'bg-accent text-accent-fg'
                  : 'bg-surface border border-border'
              )}
            >
              <p className="text-sm">{msg.content}</p>

              {/* Parsed Food Cards */}
              {msg.parsedFoods && msg.parsedFoods.length > 0 && (
                <div className="mt-3 space-y-2">
                  {msg.parsedFoods.map((food, i) => (
                    <div key={i} className="bg-surface-secondary rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-accent-text uppercase">{food.meal_type}</span>
                        {!msg.saved && (
                          <select
                            value={food.meal_type}
                            onChange={(e) => updateFood(msg.id, i, 'meal_type', e.target.value as MealType)}
                            className="text-xs bg-surface border border-border-strong rounded-lg px-1.5 py-0.5"
                          >
                            <option value="breakfast">Breakfast</option>
                            <option value="lunch">Lunch</option>
                            <option value="dinner">Dinner</option>
                            <option value="snack">Snack</option>
                          </select>
                        )}
                      </div>
                      <p className="text-sm font-medium text-text-primary">{food.description}</p>
                      <div className="flex gap-3 mt-1 text-xs text-text-secondary">
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
                    <div key={i} className="bg-exercise-surface rounded-xl p-3">
                      <p className="text-sm font-medium text-text-primary">{ex.exercise_type}</p>
                      <div className="flex gap-3 mt-1 text-xs text-text-secondary">
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
                  className="mt-3 w-full py-2 bg-accent hover:bg-accent-hover text-accent-fg text-sm font-medium rounded-xl transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {savingId === msg.id ? 'Saving...' : 'Save to Log'}
                </button>
              ) : msg.saved ? (
                <p className="mt-2 text-xs text-positive-text font-medium text-center">Saved!</p>
              ) : null}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface border border-border rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-loading-dots rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-loading-dots rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-loading-dots rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 bg-bg">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            className="flex-1 px-4 py-3 rounded-xl border border-border-strong bg-surface focus:outline-none focus:ring-1 focus:ring-input-ring text-sm"
            placeholder="What did you eat or do today?"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="px-4 py-3 bg-accent hover:bg-accent-hover text-accent-fg rounded-xl transition-all disabled:opacity-50"
            aria-label="Send message"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
