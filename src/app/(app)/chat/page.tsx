'use client';

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getToday, cn } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import { computeNutritionTargets } from '@/lib/nutrition';
import DateNav from '@/components/DateNav';
import type { ParsedFood, ParsedExercise, MealType, FoodEdit, ExerciseEdit, ChatContext, Profile, ChatMessage } from '@/lib/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  parsedFoods?: ParsedFood[];
  parsedExercises?: ParsedExercise[];
  foodEdits?: FoodEdit[];
  exerciseEdits?: ExerciseEdit[];
  saved?: boolean;
}

interface MessageBubbleProps {
  msg: Message;
  savingId: string | null;
  onButtonClick: (msg: Message) => void;
  onUpdateFood: (msgId: string, index: number, field: keyof ParsedFood, value: string | number) => void;
}

const MessageBubble = memo(function MessageBubble({ msg, savingId, onButtonClick, onUpdateFood }: MessageBubbleProps) {
  const hasActionable =
    (msg.parsedFoods?.length ?? 0) > 0 ||
    (msg.parsedExercises?.length ?? 0) > 0 ||
    (msg.foodEdits?.length ?? 0) > 0 ||
    (msg.exerciseEdits?.length ?? 0) > 0;

  const getLabel = () => {
    const hasAdds = (msg.parsedFoods?.length ?? 0) > 0 || (msg.parsedExercises?.length ?? 0) > 0;
    const hasEdits = (msg.foodEdits?.length ?? 0) > 0 || (msg.exerciseEdits?.length ?? 0) > 0;
    if (hasAdds && hasEdits) return 'Save & Apply Changes';
    if (hasEdits) return 'Apply Changes';
    return 'Save to Log';
  };

  return (
    <div className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-3 animate-bounce-in',
          msg.role === 'user'
            ? 'bg-accent text-accent-fg'
            : 'bg-surface'
        )}
      >
        <p className="text-sm whitespace-pre-line">{msg.content}</p>

        {/* Parsed Food Cards (Add) */}
        {msg.parsedFoods && msg.parsedFoods.length > 0 && (
          <div className="mt-3 space-y-2">
            {msg.parsedFoods.map((food, i) => (
              <div key={i} className="bg-surface-secondary rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-accent-text uppercase">{food.meal_type === 'snack' ? 'Other' : food.meal_type}</span>
                  {!msg.saved && (
                    <select
                      value={food.meal_type}
                      onChange={(e) => onUpdateFood(msg.id, i, 'meal_type', e.target.value as MealType)}
                      className="text-xs bg-surface border border-border-strong rounded-lg px-1.5 py-0.5"
                    >
                      <option value="breakfast">Breakfast</option>
                      <option value="lunch">Lunch</option>
                      <option value="dinner">Dinner</option>
                      <option value="snack">Other</option>
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

        {/* Parsed Exercise Cards (Add) */}
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

        {/* Food Edit Cards */}
        {msg.foodEdits && msg.foodEdits.length > 0 && (
          <div className="mt-3 space-y-2">
            {msg.foodEdits.map((edit, i) => (
              <div key={i} className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase">Edit</span>
                  <span className="text-xs text-amber-600 dark:text-amber-500">· {edit.original.meal_type === 'snack' ? 'Other' : edit.original.meal_type}</span>
                </div>
                <p className="text-sm font-medium text-text-primary">{edit.original.description}</p>
                <div className="mt-1.5 space-y-0.5">
                  {edit.updated.calories !== undefined && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-text-secondary line-through">{edit.original.calories} cal</span>
                      <span className="text-text-secondary">→</span>
                      <span className="font-semibold text-amber-700 dark:text-amber-400">{edit.updated.calories} cal</span>
                    </div>
                  )}
                  {edit.updated.description !== undefined && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-text-secondary line-through">{edit.original.description}</span>
                      <span className="text-text-secondary">→</span>
                      <span className="font-semibold text-amber-700 dark:text-amber-400">{edit.updated.description}</span>
                    </div>
                  )}
                  {edit.updated.protein_g !== undefined && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-text-secondary line-through">{edit.original.protein_g ?? 0}g P</span>
                      <span className="text-text-secondary">→</span>
                      <span className="font-semibold text-amber-700 dark:text-amber-400">{edit.updated.protein_g}g P</span>
                    </div>
                  )}
                  {edit.updated.carbs_g !== undefined && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-text-secondary line-through">{edit.original.carbs_g ?? 0}g C</span>
                      <span className="text-text-secondary">→</span>
                      <span className="font-semibold text-amber-700 dark:text-amber-400">{edit.updated.carbs_g}g C</span>
                    </div>
                  )}
                  {edit.updated.fat_g !== undefined && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-text-secondary line-through">{edit.original.fat_g ?? 0}g F</span>
                      <span className="text-text-secondary">→</span>
                      <span className="font-semibold text-amber-700 dark:text-amber-400">{edit.updated.fat_g}g F</span>
                    </div>
                  )}
                  {edit.updated.meal_type !== undefined && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-text-secondary line-through">{edit.original.meal_type}</span>
                      <span className="text-text-secondary">→</span>
                      <span className="font-semibold text-amber-700 dark:text-amber-400">{edit.updated.meal_type}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Exercise Edit Cards */}
        {msg.exerciseEdits && msg.exerciseEdits.length > 0 && (
          <div className="mt-3 space-y-2">
            {msg.exerciseEdits.map((edit, i) => (
              <div key={i} className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase">Edit</span>
                </div>
                <p className="text-sm font-medium text-text-primary">{edit.original.exercise_type}</p>
                <div className="mt-1.5 space-y-0.5">
                  {edit.updated.duration_minutes !== undefined && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-text-secondary line-through">{edit.original.duration_minutes} min</span>
                      <span className="text-text-secondary">→</span>
                      <span className="font-semibold text-amber-700 dark:text-amber-400">{edit.updated.duration_minutes} min</span>
                    </div>
                  )}
                  {edit.updated.calories_burned !== undefined && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-text-secondary line-through">{edit.original.calories_burned} cal</span>
                      <span className="text-text-secondary">→</span>
                      <span className="font-semibold text-amber-700 dark:text-amber-400">{edit.updated.calories_burned} cal</span>
                    </div>
                  )}
                  {edit.updated.exercise_type !== undefined && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-text-secondary line-through">{edit.original.exercise_type}</span>
                      <span className="text-text-secondary">→</span>
                      <span className="font-semibold text-amber-700 dark:text-amber-400">{edit.updated.exercise_type}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action Button */}
        {hasActionable && !msg.saved ? (
          <button
            onClick={() => onButtonClick(msg)}
            disabled={savingId === msg.id}
            className={cn(
              'mt-3 w-full py-2 text-sm font-medium rounded-xl transition-all active:scale-[0.98] disabled:opacity-50',
              (msg.foodEdits?.length || msg.exerciseEdits?.length)
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : 'bg-accent hover:bg-accent-hover text-accent-fg'
            )}
          >
            {savingId === msg.id ? 'Saving...' : getLabel()}
          </button>
        ) : msg.saved ? (
          <p className="mt-2 text-xs text-positive-text font-medium text-center">
            {(msg.foodEdits?.length || msg.exerciseEdits?.length) ? 'Changes applied!' : 'Saved!'}
          </p>
        ) : null}
      </div>
    </div>
  );
});

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: 'Hi! I can log food & exercise, edit your entries, answer nutrition questions, and give meal recommendations. Try "had nasi goreng for lunch", "change breakfast to 400 cal", or "what should I eat for dinner?"',
};

function dbRowToMessage(row: ChatMessage): Message {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    parsedFoods: row.parsed_foods ?? undefined,
    parsedExercises: row.parsed_exercises ?? undefined,
    foodEdits: row.food_edits ?? undefined,
    exerciseEdits: row.exercise_edits ?? undefined,
    saved: row.saved,
  };
}

export default function ChatPage() {
  const { user } = useAuth();
  const { showToast, ToastContainer } = useToast();
  const [date, setDate] = useState(getToday());
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<ChatContext | null>(null);
  const shouldAutoScroll = useRef(false);

  const isToday = date === getToday();

  // Fetch messages from DB for the selected date
  const fetchMessages = useCallback(async () => {
    if (!user) return;
    shouldAutoScroll.current = false;
    setLoadingMessages(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date)
      .order('created_at', { ascending: true });

    if (data && data.length > 0) {
      setMessages(data.map((row: ChatMessage) => dbRowToMessage(row)));
    } else {
      setMessages([WELCOME_MESSAGE]);
    }
    setLoadingMessages(false);
  }, [user, date]);

  // Fetch context: profile + today's logs
  const fetchContext = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const today = getToday();

    const [profileRes, foodRes, exerciseRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('food_logs').select('*').eq('user_id', user.id).eq('date', today).order('created_at'),
      supabase.from('exercise_logs').select('*').eq('user_id', user.id).eq('date', today).order('created_at'),
    ]);

    const profile = profileRes.data as Profile | null;
    const foodLogs = foodRes.data || [];
    const exerciseLogs = exerciseRes.data || [];

    let profileContext: ChatContext['profile'] = null;
    if (profile) {
      const targets = computeNutritionTargets(profile);
      if (targets.hasData) {
        profileContext = {
          display_name: profile.display_name,
          calorieTarget: targets.calorieTarget,
          tdee: targets.tdee,
          proteinTarget: `${targets.protein.min}-${targets.protein.max}g`,
          carbsTarget: `${targets.carbs.min}-${targets.carbs.max}g`,
          fatTarget: `${targets.fat.min}-${targets.fat.max}g`,
        };
      } else {
        profileContext = {
          display_name: profile.display_name,
          calorieTarget: 2000 + (profile.daily_calorie_offset ?? 0),
          tdee: 2000,
          proteinTarget: 'not set',
          carbsTarget: 'not set',
          fatTarget: 'not set',
        };
      }
    }

    contextRef.current = {
      todayFoodLogs: foodLogs.map((log: { id: string; description: string; meal_type: MealType; calories: number; protein_g: number | null; carbs_g: number | null; fat_g: number | null }, i: number) => ({
        index: i + 1,
        id: log.id,
        description: log.description,
        meal_type: log.meal_type,
        calories: log.calories,
        protein_g: log.protein_g,
        carbs_g: log.carbs_g,
        fat_g: log.fat_g,
      })),
      todayExerciseLogs: exerciseLogs.map((log: { id: string; exercise_type: string; duration_minutes: number; calories_burned: number }, i: number) => ({
        index: i + 1,
        id: log.id,
        exercise_type: log.exercise_type,
        duration_minutes: log.duration_minutes,
        calories_burned: log.calories_burned,
      })),
      profile: profileContext,
      totalCalories: foodLogs.reduce((sum: number, l: { calories: number }) => sum + l.calories, 0),
      totalCaloriesBurned: exerciseLogs.reduce((sum: number, l: { calories_burned: number }) => sum + l.calories_burned, 0),
      totalProtein: foodLogs.reduce((sum: number, l: { protein_g: number | null }) => sum + (l.protein_g ?? 0), 0),
      totalCarbs: foodLogs.reduce((sum: number, l: { carbs_g: number | null }) => sum + (l.carbs_g ?? 0), 0),
      totalFat: foodLogs.reduce((sum: number, l: { fat_g: number | null }) => sum + (l.fat_g ?? 0), 0),
    };
  }, [user]);

  // Load messages when date or user changes
  useEffect(() => {
    if (user) fetchMessages();
  }, [user, date, fetchMessages]);

  // Fetch context on mount
  useEffect(() => {
    if (user) fetchContext();
  }, [user, fetchContext]);

  // Auto-scroll to bottom only when sending/receiving (not on initial load or date switch)
  useEffect(() => {
    if (shouldAutoScroll.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  // Resize container when iOS keyboard opens/closes
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const onResize = () => {
      if (!containerRef.current) return;
      const kbOpen = window.innerHeight - vv.height > 100;
      if (kbOpen) {
        // Keyboard open: fill visual viewport (hides nav, input sits above keyboard)
        containerRef.current.style.height = `${vv.height}px`;
        // Counteract iOS auto-scroll that pushes header off screen
        window.scrollTo(0, 0);
      } else {
        // Keyboard closed: leave room for nav bar (4rem = 64px)
        containerRef.current.style.height = 'calc(100% - 4rem)';
      }
    };

    vv.addEventListener('resize', onResize);
    return () => {
      vv.removeEventListener('resize', onResize);
      // Reset scroll when leaving chat page
      window.scrollTo(0, 0);
    };
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || loading || !isToday) return;

    if (input.trim().length > 1000) {
      showToast('error', 'Message too long (max 1,000 characters)');
      return;
    }

    const userContent = input.trim();
    setInput('');
    setLoading(true);
    shouldAutoScroll.current = true;

    // Refresh context before sending
    await fetchContext();

    const supabase = createClient();

    // Insert user message to DB
    const { data: userRow } = await supabase
      .from('chat_messages')
      .insert({ user_id: user!.id, date, role: 'user', content: userContent })
      .select()
      .single();

    const userMsg: Message = userRow
      ? dbRowToMessage(userRow)
      : { id: `temp-${Date.now()}`, role: 'user', content: userContent };

    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userContent, context: contextRef.current }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Insert error message to DB
        const errorContent = data.error || 'Sorry, something went wrong. Please try again.';
        const { data: errRow } = await supabase
          .from('chat_messages')
          .insert({ user_id: user!.id, date, role: 'assistant', content: errorContent })
          .select()
          .single();

        setMessages((prev) => [
          ...prev,
          errRow ? dbRowToMessage(errRow) : { id: `temp-${Date.now()}`, role: 'assistant', content: errorContent },
        ]);
        setLoading(false);
        return;
      }

      const foods: ParsedFood[] = data.foods || [];
      const exercises: ParsedExercise[] = data.exercises || [];
      const foodEdits: FoodEdit[] = data.food_edits || [];
      const exerciseEdits: ExerciseEdit[] = data.exercise_edits || [];
      const textMessage: string | null = data.message || null;

      const hasAdds = foods.length > 0 || exercises.length > 0;
      const hasEdits = foodEdits.length > 0 || exerciseEdits.length > 0;

      // Build response text
      let responseText = '';
      if (textMessage) {
        responseText = textMessage;
      }
      if (hasAdds || hasEdits) {
        const parts: string[] = [];
        if (foods.length > 0) parts.push(`${foods.length} food item${foods.length > 1 ? 's' : ''}`);
        if (exercises.length > 0) parts.push(`${exercises.length} exercise${exercises.length > 1 ? 's' : ''}`);
        if (foodEdits.length > 0) parts.push(`${foodEdits.length} food edit${foodEdits.length > 1 ? 's' : ''}`);
        if (exerciseEdits.length > 0) parts.push(`${exerciseEdits.length} exercise edit${exerciseEdits.length > 1 ? 's' : ''}`);

        const actionText = `Found ${parts.join(' and ')}. Review and tap ${hasEdits && hasAdds ? 'Save & Apply' : hasEdits ? 'Apply Changes' : 'Save'} to confirm.`;
        responseText = responseText ? `${responseText}\n\n${actionText}` : actionText;
      }

      if (!responseText) {
        responseText = "I couldn't find any food or exercise in your message. Try being more specific!";
      }

      // Insert assistant message to DB
      const { data: assistantRow } = await supabase
        .from('chat_messages')
        .insert({
          user_id: user!.id,
          date,
          role: 'assistant',
          content: responseText,
          parsed_foods: foods.length > 0 ? foods : null,
          parsed_exercises: exercises.length > 0 ? exercises : null,
          food_edits: foodEdits.length > 0 ? foodEdits : null,
          exercise_edits: exerciseEdits.length > 0 ? exerciseEdits : null,
          saved: false,
        })
        .select()
        .single();

      const assistantMsg: Message = assistantRow
        ? dbRowToMessage(assistantRow)
        : {
            id: `temp-${Date.now()}`,
            role: 'assistant',
            content: responseText,
            parsedFoods: foods.length > 0 ? foods : undefined,
            parsedExercises: exercises.length > 0 ? exercises : undefined,
            foodEdits: foodEdits.length > 0 ? foodEdits : undefined,
            exerciseEdits: exerciseEdits.length > 0 ? exerciseEdits : undefined,
            saved: (hasAdds || hasEdits) ? false : undefined,
          };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errorContent = 'Sorry, something went wrong. Please try again.';
      const { data: errRow } = await supabase
        .from('chat_messages')
        .insert({ user_id: user!.id, date, role: 'assistant', content: errorContent })
        .select()
        .single();

      setMessages((prev) => [
        ...prev,
        errRow ? dbRowToMessage(errRow) : { id: `temp-${Date.now()}`, role: 'assistant', content: errorContent },
      ]);
    }

    setLoading(false);
  };

  const markSaved = async (msgId: string) => {
    // Update in state
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, saved: true } : m)));
    // Update in DB (ignore errors for temp IDs)
    if (!msgId.startsWith('temp-') && msgId !== 'welcome') {
      const supabase = createClient();
      await supabase.from('chat_messages').update({ saved: true }).eq('id', msgId);
    }
  };

  const saveResults = useCallback(async (msgId: string, foods: ParsedFood[], exercises: ParsedExercise[]) => {
    if (!user || savingId) return;
    setSavingId(msgId);
    const supabase = createClient();
    const today = getToday();
    let hasError = false;

    if (foods.length > 0) {
      const { error } = await supabase.from('food_logs').insert(
        foods.map((f) => ({
          user_id: user.id, date: today, meal_type: f.meal_type, description: f.description,
          calories: f.calories, protein_g: f.protein_g, carbs_g: f.carbs_g, fat_g: f.fat_g, source: 'chat' as const,
        }))
      );
      if (error) hasError = true;
    }

    if (exercises.length > 0) {
      const { error } = await supabase.from('exercise_logs').insert(
        exercises.map((e) => ({
          user_id: user.id, date: today, exercise_type: e.exercise_type, duration_minutes: e.duration_minutes,
          calories_burned: e.calories_burned, notes: e.notes, source: 'chat' as const,
        }))
      );
      if (error) hasError = true;
    }

    if (hasError) {
      showToast('error', 'Failed to save some entries. Please try again.');
      setSavingId(null);
      return;
    }

    await markSaved(msgId);
    setSavingId(null);
    fetchContext();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, showToast, fetchContext]);

  const confirmEdits = useCallback(async (msgId: string, foodEdits: FoodEdit[], exerciseEdits: ExerciseEdit[]) => {
    if (!user || savingId) return;
    setSavingId(msgId);
    const supabase = createClient();
    let hasError = false;

    for (const edit of foodEdits) {
      const { error } = await supabase.from('food_logs').update(edit.updated).eq('id', edit.log_id).eq('user_id', user.id);
      if (error) hasError = true;
    }

    for (const edit of exerciseEdits) {
      const { error } = await supabase.from('exercise_logs').update(edit.updated).eq('id', edit.log_id).eq('user_id', user.id);
      if (error) hasError = true;
    }

    if (hasError) {
      showToast('error', 'Failed to apply some edits. Please try again.');
      setSavingId(null);
      return;
    }

    await markSaved(msgId);
    setSavingId(null);
    fetchContext();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, showToast, fetchContext]);

  const handleSaveAndApply = useCallback(async (msg: Message) => {
    if (!user || savingId) return;
    setSavingId(msg.id);
    const supabase = createClient();
    const today = getToday();
    let hasError = false;

    if (msg.parsedFoods && msg.parsedFoods.length > 0) {
      const { error } = await supabase.from('food_logs').insert(
        msg.parsedFoods.map((f) => ({
          user_id: user.id, date: today, meal_type: f.meal_type, description: f.description,
          calories: f.calories, protein_g: f.protein_g, carbs_g: f.carbs_g, fat_g: f.fat_g, source: 'chat' as const,
        }))
      );
      if (error) hasError = true;
    }
    if (msg.parsedExercises && msg.parsedExercises.length > 0) {
      const { error } = await supabase.from('exercise_logs').insert(
        msg.parsedExercises.map((e) => ({
          user_id: user.id, date: today, exercise_type: e.exercise_type, duration_minutes: e.duration_minutes,
          calories_burned: e.calories_burned, notes: e.notes, source: 'chat' as const,
        }))
      );
      if (error) hasError = true;
    }

    if (msg.foodEdits) {
      for (const edit of msg.foodEdits) {
        const { error } = await supabase.from('food_logs').update(edit.updated).eq('id', edit.log_id).eq('user_id', user.id);
        if (error) hasError = true;
      }
    }
    if (msg.exerciseEdits) {
      for (const edit of msg.exerciseEdits) {
        const { error } = await supabase.from('exercise_logs').update(edit.updated).eq('id', edit.log_id).eq('user_id', user.id);
        if (error) hasError = true;
      }
    }

    if (hasError) {
      showToast('error', 'Failed to save some entries. Please try again.');
      setSavingId(null);
      return;
    }

    await markSaved(msg.id);
    setSavingId(null);
    fetchContext();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, showToast, fetchContext]);

  const updateFood = useCallback((msgId: string, index: number, field: keyof ParsedFood, value: string | number) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId || !m.parsedFoods) return m;
        const newFoods = [...m.parsedFoods];
        newFoods[index] = { ...newFoods[index], [field]: value };
        return { ...m, parsedFoods: newFoods };
      })
    );
  }, []);

  const updateExercise = useCallback((msgId: string, index: number, field: keyof ParsedExercise, value: string | number) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId || !m.parsedExercises) return m;
        const newExercises = [...m.parsedExercises];
        newExercises[index] = { ...newExercises[index], [field]: value };
        return { ...m, parsedExercises: newExercises };
      })
    );
  }, []);

  const handleButtonClick = useCallback((msg: Message) => {
    const hasAdds = (msg.parsedFoods?.length ?? 0) > 0 || (msg.parsedExercises?.length ?? 0) > 0;
    const hasEdits = (msg.foodEdits?.length ?? 0) > 0 || (msg.exerciseEdits?.length ?? 0) > 0;

    if (hasAdds && hasEdits) {
      handleSaveAndApply(msg);
    } else if (hasEdits) {
      confirmEdits(msg.id, msg.foodEdits || [], msg.exerciseEdits || []);
    } else {
      saveResults(msg.id, msg.parsedFoods || [], msg.parsedExercises || []);
    }
  }, [handleSaveAndApply, confirmEdits, saveResults]);

  return (
    <div ref={containerRef} className="fixed top-0 left-0 right-0 bg-bg overflow-hidden z-10 flex flex-col" style={{ height: 'calc(100% - 4rem)' }}>
      <div className="max-w-lg mx-auto flex flex-col h-full w-full">
      {ToastContainer}

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-6 pb-2">
        <h1 className="text-xl font-bold text-text-primary">Chat</h1>
        <DateNav date={date} onDateChange={setDate} />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4 scrollbar-hide">
        {loadingMessages ? (
          <div className="flex justify-center py-8">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-loading-dots rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-loading-dots rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-loading-dots rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              savingId={savingId}
              onButtonClick={handleButtonClick}
              onUpdateFood={updateFood}
            />
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface rounded-2xl px-4 py-3">
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
      <div className="px-4 pt-2 pb-4">
        <div className={cn(
          'flex items-center bg-surface-secondary rounded-2xl px-4 py-1 transition-colors',
          !isToday && 'opacity-50'
        )}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            disabled={!isToday}
            className="flex-1 py-3 bg-transparent focus:outline-none text-sm text-text-primary placeholder:text-text-tertiary disabled:cursor-not-allowed"
            placeholder={isToday ? 'Log, edit, ask, or get recommendations...' : 'Switch to today to send messages'}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim() || !isToday}
            className="p-2 text-text-tertiary hover:text-text-primary disabled:opacity-30 transition-colors rounded-lg"
            aria-label="Send message"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
