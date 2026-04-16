'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, memo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getToday, cn, formatDisplayDate } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import { computeNutritionTargets, calculateAge } from '@/lib/nutrition';
import DateNav from '@/components/DateNav';
import { compressChatImage } from '@/lib/image';
import { useLocale } from '@/lib/i18n';
import MarkdownContent from '@/components/MarkdownContent';
import VoiceButton from '@/components/VoiceButton';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import { useTour } from '@/components/tour/useTour';
import type { ParsedFood, ParsedExercise, ParsedDrink, ParsedMeasurement, MealType, DrinkType, FoodEdit, ExerciseEdit, DrinkEdit, MeasurementEdit, ChatContext, Profile, ChatMessage } from '@/lib/types';
import { emitExerciseEvent, checkAndEmitGoalEvents } from '@/lib/feedEvents';

// food_logs columns are INTEGER. Round any integer fields in a food edit
// payload defensively, since older chat messages may have decimal macros
// stored in chat_messages.food_edits.
function roundFoodUpdate(updated: Partial<ParsedFood>): Partial<ParsedFood> {
  const out: Partial<ParsedFood> = { ...updated };
  if (out.calories !== undefined) out.calories = Math.round(out.calories);
  if (out.protein_g !== undefined) out.protein_g = Math.round(out.protein_g);
  if (out.carbs_g !== undefined) out.carbs_g = Math.round(out.carbs_g);
  if (out.fat_g !== undefined) out.fat_g = Math.round(out.fat_g);
  return out;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  parsedFoods?: ParsedFood[];
  parsedExercises?: ParsedExercise[];
  parsedDrinks?: ParsedDrink[];
  parsedMeasurements?: ParsedMeasurement[];
  foodEdits?: FoodEdit[];
  exerciseEdits?: ExerciseEdit[];
  drinkEdits?: DrinkEdit[];
  measurementEdits?: MeasurementEdit[];
  saved?: boolean;
}

interface MessageBubbleProps {
  msg: Message;
  savingId: string | null;
  onButtonClick: (msg: Message) => void;
  onUpdateFood: (msgId: string, index: number, field: keyof ParsedFood, value: string | number) => void;
  t: (key: string) => string;
}

const MessageBubble = memo(function MessageBubble({ msg, savingId, onButtonClick, onUpdateFood, t }: MessageBubbleProps) {
  const hasActionable =
    (msg.parsedFoods?.length ?? 0) > 0 ||
    (msg.parsedExercises?.length ?? 0) > 0 ||
    (msg.parsedDrinks?.length ?? 0) > 0 ||
    (msg.parsedMeasurements?.length ?? 0) > 0 ||
    (msg.foodEdits?.length ?? 0) > 0 ||
    (msg.exerciseEdits?.length ?? 0) > 0 ||
    (msg.drinkEdits?.length ?? 0) > 0 ||
    (msg.measurementEdits?.length ?? 0) > 0;

  const getLabel = () => {
    const hasAdds = (msg.parsedFoods?.length ?? 0) > 0 || (msg.parsedExercises?.length ?? 0) > 0 || (msg.parsedDrinks?.length ?? 0) > 0 || (msg.parsedMeasurements?.length ?? 0) > 0;
    const hasEdits = (msg.foodEdits?.length ?? 0) > 0 || (msg.exerciseEdits?.length ?? 0) > 0 || (msg.drinkEdits?.length ?? 0) > 0 || (msg.measurementEdits?.length ?? 0) > 0;
    if (hasAdds && hasEdits) return t('chat.saveAndApply');
    if (hasEdits) return t('chat.applyChanges');
    return t('chat.saveToLog');
  };

  const mealLabel = (type: string) => {
    if (type === 'breakfast') return t('meal.breakfast');
    if (type === 'lunch') return t('meal.lunch');
    if (type === 'dinner') return t('meal.dinner');
    if (type === 'snack') return t('meal.snack');
    return t('meal.other');
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
        {msg.imageUrl && (
          <img src={msg.imageUrl} alt="Attached" className="rounded-xl mb-2 max-h-48 w-auto" />
        )}
        {msg.role === 'assistant' ? (
          <MarkdownContent content={msg.content} />
        ) : (
          <p className="text-sm whitespace-pre-line">{msg.content}</p>
        )}

        {/* Parsed Food Cards (Add) */}
        {msg.parsedFoods && msg.parsedFoods.length > 0 && (
          <div className="mt-3 space-y-2">
            {msg.parsedFoods.map((food, i) => (
              <div key={i} className="bg-surface-secondary rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-accent-text uppercase">{mealLabel(food.meal_type)}</span>
                  {!msg.saved && (
                    <select
                      value={food.meal_type}
                      onChange={(e) => onUpdateFood(msg.id, i, 'meal_type', e.target.value as MealType)}
                      className="text-xs bg-surface border border-border-strong rounded-lg px-1.5 py-0.5"
                    >
                      <option value="breakfast">{t('meal.breakfast')}</option>
                      <option value="lunch">{t('meal.lunch')}</option>
                      <option value="dinner">{t('meal.dinner')}</option>
                      <option value="snack">{t('meal.snack')}</option>
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

        {/* Parsed Drink Cards (Add) */}
        {msg.parsedDrinks && msg.parsedDrinks.length > 0 && (
          <div className="mt-3 space-y-2">
            {msg.parsedDrinks.map((drink, i) => (
              <div key={i} className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3">
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase">{drink.drink_type}</span>
                <p className="text-sm font-medium text-text-primary">{drink.description}</p>
                <div className="flex gap-3 mt-1 text-xs text-text-secondary">
                  <span>{drink.volume_ml}ml</span>
                  {drink.calories > 0 && <span>{drink.calories} cal</span>}
                  {drink.protein_g ? <span>{drink.protein_g}g P</span> : null}
                  {drink.carbs_g ? <span>{drink.carbs_g}g C</span> : null}
                  {drink.fat_g ? <span>{drink.fat_g}g F</span> : null}
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
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase">{t('common.edit')}</span>
                  <span className="text-xs text-amber-600 dark:text-amber-500">&middot; {mealLabel(edit.original.meal_type)}</span>
                </div>
                <p className="text-sm font-medium text-text-primary">{edit.original.description}</p>
                <div className="mt-1.5 space-y-0.5">
                  {edit.updated.calories !== undefined && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-text-secondary line-through">{edit.original.calories} cal</span>
                      <span className="text-text-secondary">&rarr;</span>
                      <span className="font-semibold text-amber-700 dark:text-amber-400">{edit.updated.calories} cal</span>
                    </div>
                  )}
                  {edit.updated.description !== undefined && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-text-secondary line-through">{edit.original.description}</span>
                      <span className="text-text-secondary">&rarr;</span>
                      <span className="font-semibold text-amber-700 dark:text-amber-400">{edit.updated.description}</span>
                    </div>
                  )}
                  {edit.updated.protein_g !== undefined && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-text-secondary line-through">{edit.original.protein_g ?? 0}g P</span>
                      <span className="text-text-secondary">&rarr;</span>
                      <span className="font-semibold text-amber-700 dark:text-amber-400">{edit.updated.protein_g}g P</span>
                    </div>
                  )}
                  {edit.updated.carbs_g !== undefined && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-text-secondary line-through">{edit.original.carbs_g ?? 0}g C</span>
                      <span className="text-text-secondary">&rarr;</span>
                      <span className="font-semibold text-amber-700 dark:text-amber-400">{edit.updated.carbs_g}g C</span>
                    </div>
                  )}
                  {edit.updated.fat_g !== undefined && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-text-secondary line-through">{edit.original.fat_g ?? 0}g F</span>
                      <span className="text-text-secondary">&rarr;</span>
                      <span className="font-semibold text-amber-700 dark:text-amber-400">{edit.updated.fat_g}g F</span>
                    </div>
                  )}
                  {edit.updated.meal_type !== undefined && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-text-secondary line-through">{edit.original.meal_type}</span>
                      <span className="text-text-secondary">&rarr;</span>
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
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase">{t('common.edit')}</span>
                </div>
                <p className="text-sm font-medium text-text-primary">{edit.original.exercise_type}</p>
                <div className="mt-1.5 space-y-0.5">
                  {edit.updated.duration_minutes !== undefined && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-text-secondary line-through">{edit.original.duration_minutes} min</span>
                      <span className="text-text-secondary">&rarr;</span>
                      <span className="font-semibold text-amber-700 dark:text-amber-400">{edit.updated.duration_minutes} min</span>
                    </div>
                  )}
                  {edit.updated.calories_burned !== undefined && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-text-secondary line-through">{edit.original.calories_burned} cal</span>
                      <span className="text-text-secondary">&rarr;</span>
                      <span className="font-semibold text-amber-700 dark:text-amber-400">{edit.updated.calories_burned} cal</span>
                    </div>
                  )}
                  {edit.updated.exercise_type !== undefined && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-text-secondary line-through">{edit.original.exercise_type}</span>
                      <span className="text-text-secondary">&rarr;</span>
                      <span className="font-semibold text-amber-700 dark:text-amber-400">{edit.updated.exercise_type}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Drink Edit Cards */}
        {msg.drinkEdits && msg.drinkEdits.length > 0 && (
          <div className="mt-3 space-y-2">
            {msg.drinkEdits.map((edit, i) => (
              <div key={i} className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase">{t('common.edit')}</span>
                  <span className="text-xs text-amber-600 dark:text-amber-500">&middot; {edit.original.drink_type}</span>
                </div>
                <p className="text-sm font-medium text-text-primary">{edit.original.description}</p>
                <div className="mt-1.5 space-y-0.5">
                  {edit.updated.volume_ml !== undefined && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-text-secondary line-through">{edit.original.volume_ml}ml</span>
                      <span className="text-text-secondary">&rarr;</span>
                      <span className="font-semibold text-amber-700 dark:text-amber-400">{edit.updated.volume_ml}ml</span>
                    </div>
                  )}
                  {edit.updated.calories !== undefined && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-text-secondary line-through">{edit.original.calories} cal</span>
                      <span className="text-text-secondary">&rarr;</span>
                      <span className="font-semibold text-amber-700 dark:text-amber-400">{edit.updated.calories} cal</span>
                    </div>
                  )}
                  {edit.updated.description !== undefined && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-text-secondary line-through">{edit.original.description}</span>
                      <span className="text-text-secondary">&rarr;</span>
                      <span className="font-semibold text-amber-700 dark:text-amber-400">{edit.updated.description}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Parsed Measurement Cards (Add) */}
        {msg.parsedMeasurements && msg.parsedMeasurements.length > 0 && (
          <div className="mt-3 space-y-2">
            {msg.parsedMeasurements.map((m, i) => (
              <div key={i} className="bg-purple-50 dark:bg-purple-950/30 rounded-xl p-3">
                <span className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase">{t('log.measurements')}</span>
                <div className="flex gap-3 mt-1 text-xs text-text-secondary">
                  {m.weight_kg !== null && <span>{m.weight_kg} kg</span>}
                  {m.height_cm !== null && <span>{m.height_cm} cm</span>}
                </div>
                {m.notes && <p className="text-xs text-text-tertiary mt-1">{m.notes}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Measurement Edit Cards */}
        {msg.measurementEdits && msg.measurementEdits.length > 0 && (
          <div className="mt-3 space-y-2">
            {msg.measurementEdits.map((edit, i) => (
              <div key={i} className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase">{t('common.edit')}</span>
                  <span className="text-xs text-amber-600 dark:text-amber-500">&middot; 📏</span>
                </div>
                <div className="mt-1.5 space-y-0.5">
                  {edit.updated.weight_kg !== undefined && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-text-secondary line-through">{edit.original.weight_kg ?? '-'} kg</span>
                      <span className="text-text-secondary">&rarr;</span>
                      <span className="font-semibold text-amber-700 dark:text-amber-400">{edit.updated.weight_kg} kg</span>
                    </div>
                  )}
                  {edit.updated.height_cm !== undefined && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-text-secondary line-through">{edit.original.height_cm ?? '-'} cm</span>
                      <span className="text-text-secondary">&rarr;</span>
                      <span className="font-semibold text-amber-700 dark:text-amber-400">{edit.updated.height_cm} cm</span>
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
              (msg.foodEdits?.length || msg.exerciseEdits?.length || msg.drinkEdits?.length || msg.measurementEdits?.length)
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : 'bg-accent hover:bg-accent-hover text-accent-fg'
            )}
          >
            {savingId === msg.id ? t('common.saving') : getLabel()}
          </button>
        ) : msg.saved ? (
          <p className="mt-2 text-xs text-positive-text font-medium text-center">
            {(msg.foodEdits?.length || msg.exerciseEdits?.length || msg.drinkEdits?.length || msg.measurementEdits?.length) ? t('chat.changesApplied') : t('chat.saved')}
          </p>
        ) : null}
      </div>
    </div>
  );
});

function dbRowToMessage(row: ChatMessage): Message {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    imageUrl: row.image_url ?? undefined,
    parsedFoods: row.parsed_foods ?? undefined,
    parsedExercises: row.parsed_exercises ?? undefined,
    parsedDrinks: row.parsed_drinks ?? undefined,
    parsedMeasurements: row.parsed_measurements ?? undefined,
    foodEdits: row.food_edits ?? undefined,
    exerciseEdits: row.exercise_edits ?? undefined,
    drinkEdits: row.drink_edits ?? undefined,
    measurementEdits: row.measurement_edits ?? undefined,
    saved: row.saved,
  };
}

export default function ChatPage() {
  const { user } = useAuth();
  const { t, locale } = useLocale();
  const { showToast, ToastContainer } = useToast();
  const { isActive: tourActive, getStepId, nextStep, advanceToStep } = useTour();
  const [date, setDate] = useState(getToday());
  const [displayName, setDisplayName] = useState('');

  // Fetch display name for tour welcome
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase.from('profiles').select('display_name').eq('id', user.id).single().then(({ data }) => {
      if (data?.display_name) setDisplayName(data.display_name);
    });
  }, [user]);

  const welcomeMessage = useMemo<Message>(() => {
    if (tourActive && displayName) {
      return {
        id: 'welcome',
        role: 'assistant',
        content: t('chat.welcomeTour').replace('{name}', displayName),
      };
    }
    return {
      id: 'welcome',
      role: 'assistant',
      content: t('chat.welcome'),
    };
  }, [t, tourActive, displayName]);

  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<ChatContext | null>(null);
  const shouldAutoScroll = useRef(false);
  const imagePreviewRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const savingLockRef = useRef(false);

  const isToday = date === getToday();
  const [hasHistoryMessages, setHasHistoryMessages] = useState(false);

  // Track imagePreview in ref so cleanup always has the latest value
  useEffect(() => {
    imagePreviewRef.current = imagePreview;
  }, [imagePreview]);

  // Revoke image preview blob URL on unmount
  useEffect(() => {
    return () => {
      if (imagePreviewRef.current) URL.revokeObjectURL(imagePreviewRef.current);
    };
  }, []);

  // Abort any in-flight API call on unmount or date change
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, [date]);

  // Fetch messages from DB for the selected date
  const fetchMessages = useCallback(async () => {
    if (!user) return;
    shouldAutoScroll.current = false;
    setLoadingMessages(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id,user_id,role,content,image_url,parsed_foods,parsed_exercises,parsed_drinks,parsed_measurements,food_edits,exercise_edits,drink_edits,measurement_edits,saved,date,created_at')
      .eq('user_id', user.id)
      .eq('date', date)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch messages:', error.message);
      setLoadingMessages(false);
      return;
    }

    if (data && data.length > 0) {
      setMessages(data.map((row: ChatMessage) => dbRowToMessage(row)));
      setHasHistoryMessages(true);
    } else {
      setMessages(date === getToday() ? [welcomeMessage] : []);
      setHasHistoryMessages(false);
    }
    setLoadingMessages(false);
  }, [user, date, welcomeMessage]);

  // Fetch context: profile + today's logs
  const fetchContext = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const today = getToday();

    const [profileRes, foodRes, exerciseRes, drinkRes, habitsRes, habitLogsRes, measurementRes] = await Promise.all([
      supabase.from('profiles').select('id,display_name,calorie_offset_min,calorie_offset_max,daily_water_goal_ml,date_of_birth,gender,height_cm,weight_kg').eq('id', user.id).single(),
      supabase.from('food_logs').select('id,description,meal_type,calories,protein_g,carbs_g,fat_g').eq('user_id', user.id).eq('date', today).order('created_at'),
      supabase.from('exercise_logs').select('id,exercise_type,duration_minutes,calories_burned').eq('user_id', user.id).eq('date', today).order('created_at'),
      supabase.from('drink_logs').select('id,drink_type,description,volume_ml,calories,protein_g,carbs_g,fat_g').eq('user_id', user.id).eq('date', today).order('created_at'),
      supabase.from('habits').select('id,name,emoji').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
      supabase.from('habit_logs').select('habit_id,completed,logged_at').eq('user_id', user.id).eq('date', today),
      supabase.from('measurement_logs').select('id,height_cm,weight_kg,notes,logged_at').eq('user_id', user.id).eq('date', today).order('logged_at', { ascending: false }),
    ]);

    if (profileRes.error) {
      console.error('Failed to fetch profile for chat context:', profileRes.error.message);
    }
    const profile = profileRes.data as Profile | null;
    const foodLogs = foodRes.data || [];
    const exerciseLogs = exerciseRes.data || [];
    const drinkLogs = drinkRes.data || [];
    const habitsData = habitsRes.data || [];
    const habitLogsData = habitLogsRes.data || [];
    const measurementLogs = measurementRes.data || [];

    let profileContext: ChatContext['profile'] = null;
    if (profile) {
      const targets = computeNutritionTargets(profile);
      const age = profile.date_of_birth ? calculateAge(profile.date_of_birth) : null;
      if (targets.hasData) {
        profileContext = {
          display_name: profile.display_name,
          gender: profile.gender,
          age,
          height_cm: profile.height_cm,
          weight_kg: profile.weight_kg,
          calorieTarget: targets.calorieTarget,
          tdee: targets.tdee,
          calorieGoalType: targets.deltaLabel,
          calorieRangeMin: targets.calorieRange.min,
          calorieRangeMax: targets.calorieRange.max,
          proteinTarget: `${targets.protein.min}-${targets.protein.max}g`,
          carbsTarget: `${targets.carbs.min}-${targets.carbs.max}g`,
          fatTarget: `${targets.fat.min}-${targets.fat.max}g`,
          waterGoalMl: profile.daily_water_goal_ml ?? 2000,
        };
      } else {
        profileContext = {
          display_name: profile.display_name,
          gender: profile.gender,
          age,
          height_cm: profile.height_cm,
          weight_kg: profile.weight_kg,
          calorieTarget: 2000 + Math.round(((profile.calorie_offset_min ?? -200) + (profile.calorie_offset_max ?? 200)) / 2),
          tdee: 2000,
          calorieGoalType: 'not set',
          calorieRangeMin: 0,
          calorieRangeMax: 0,
          proteinTarget: 'not set',
          carbsTarget: 'not set',
          fatTarget: 'not set',
          waterGoalMl: profile.daily_water_goal_ml ?? 2000,
        };
      }
    }

    const drinkCalories = drinkLogs.reduce((sum: number, l: { calories: number }) => sum + l.calories, 0);
    const waterMl = drinkLogs.filter((l: { drink_type: string }) => l.drink_type === 'water').reduce((sum: number, l: { volume_ml: number }) => sum + l.volume_ml, 0);

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
      todayDrinkLogs: drinkLogs.map((log: { id: string; drink_type: DrinkType; description: string; volume_ml: number; calories: number; protein_g: number | null; carbs_g: number | null; fat_g: number | null }, i: number) => ({
        index: i + 1,
        id: log.id,
        drink_type: log.drink_type,
        description: log.description,
        volume_ml: log.volume_ml,
        calories: log.calories,
        protein_g: log.protein_g,
        carbs_g: log.carbs_g,
        fat_g: log.fat_g,
      })),
      todayHabitLogs: habitsData.map((habit: { id: string; name: string; emoji: string }, i: number) => {
        const log = habitLogsData.find((l: { habit_id: string }) => l.habit_id === habit.id);
        return {
          index: i + 1,
          id: habit.id,
          habit_name: habit.name,
          emoji: habit.emoji,
          completed: log?.completed ?? false,
          logged_at: log?.logged_at ?? null,
        };
      }),
      todayMeasurementLogs: measurementLogs.map((log: { id: string; height_cm: number | null; weight_kg: number | null; notes: string | null; logged_at: string }, i: number) => ({
        index: i + 1,
        id: log.id,
        height_cm: log.height_cm,
        weight_kg: log.weight_kg,
        notes: log.notes,
        logged_at: log.logged_at,
      })),
      profile: profileContext,
      totalCalories: foodLogs.reduce((sum: number, l: { calories: number }) => sum + l.calories, 0) + drinkCalories,
      totalCaloriesBurned: exerciseLogs.reduce((sum: number, l: { calories_burned: number }) => sum + l.calories_burned, 0),
      totalDrinkCalories: drinkCalories,
      totalWaterMl: waterMl,
      waterGoalMl: profile?.daily_water_goal_ml ?? 2000,
      totalProtein: foodLogs.reduce((sum: number, l: { protein_g: number | null }) => sum + (l.protein_g ?? 0), 0),
      totalCarbs: foodLogs.reduce((sum: number, l: { carbs_g: number | null }) => sum + (l.carbs_g ?? 0), 0),
      totalFat: foodLogs.reduce((sum: number, l: { fat_g: number | null }) => sum + (l.fat_g ?? 0), 0),
    };
  }, [user]);

  // Load messages when date or user changes
  useEffect(() => {
    if (user) queueMicrotask(() => fetchMessages());
  }, [user, date, fetchMessages]);

  // Fetch context on mount
  useEffect(() => {
    if (user) queueMicrotask(() => fetchContext());
  }, [user, fetchContext]);

  // Scroll to bottom when messages change
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    if (shouldAutoScroll.current) {
      // Instant scroll to bottom for new messages (send/receive)
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, loading]);

  // Instant scroll to bottom after initial load (no animation, no flash)
  useLayoutEffect(() => {
    if (!loadingMessages && messages.length > 0) {
      const container = messagesContainerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [loadingMessages, messages.length]);


  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Revoke previous preview URL before creating a new one
    if (imagePreviewRef.current) URL.revokeObjectURL(imagePreviewRef.current);
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  };

  const clearImage = () => {
    setImageFile(null);
    if (imagePreviewRef.current) URL.revokeObjectURL(imagePreviewRef.current);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const sendMessage = async (textOverride?: string) => {
    const messageText = textOverride ?? input;
    if ((!messageText.trim() && !imageFile) || loading || !isToday) return;

    if (messageText.trim().length > 1000) {
      showToast('error', t('chat.messageTooLong'));
      return;
    }

    // Abort any previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const userContent = messageText.trim() || (imageFile ? t('chat.whatsInPhoto') : '');
    const currentImageFile = imageFile;
    const currentImagePreview = imagePreview;
    setInput('');
    clearImage();
    setLoading(true);
    shouldAutoScroll.current = true;

    // Tour: advance from chat-input step to ai-response step
    if (tourActive && getStepId() === 'chat-input') {
      advanceToStep('ai-response');
    }

    // Refresh context before sending
    await fetchContext();

    if (controller.signal.aborted) { setLoading(false); return; }

    const supabase = createClient();

    // Upload image to Supabase Storage if present
    let uploadedImageUrl: string | null = null;
    if (currentImageFile) {
      try {
        const compressed = await compressChatImage(currentImageFile);
        const path = `${user!.id}/${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('chat-images')
          .upload(path, compressed, { contentType: 'image/jpeg' });

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(path);
          uploadedImageUrl = urlData.publicUrl;
        }
      } catch {
        // If upload fails, still send the text message
      }
    }

    // Insert user message to DB
    const { data: userRow } = await supabase
      .from('chat_messages')
      .insert({ user_id: user!.id, date, role: 'user', content: userContent, image_url: uploadedImageUrl })
      .select()
      .single();

    const userMsg: Message = userRow
      ? dbRowToMessage(userRow)
      : { id: `temp-${Date.now()}`, role: 'user', content: userContent, imageUrl: uploadedImageUrl || currentImagePreview || undefined };

    setMessages((prev) => [...prev, userMsg]);

    // Build conversation history from recent messages (last 10, excluding welcome)
    // Skip error messages (no parsed data/edits) so they don't pollute the model's context
    // Include parsed data + edits so the LLM sees the correct response format
    const recentMessages = messages
      .filter((m) => {
        if (m.id === 'welcome') return false;
        // Skip assistant error messages (no parsed data and no edits)
        if (m.role === 'assistant') {
          const hasData = (m.parsedFoods?.length ?? 0) > 0 || (m.parsedExercises?.length ?? 0) > 0 ||
            (m.parsedDrinks?.length ?? 0) > 0 || (m.parsedMeasurements?.length ?? 0) > 0 ||
            (m.foodEdits?.length ?? 0) > 0 || (m.exerciseEdits?.length ?? 0) > 0 ||
            (m.drinkEdits?.length ?? 0) > 0 || (m.measurementEdits?.length ?? 0) > 0;
          if (!hasData) return false;
        }
        return true;
      })
      .slice(-10)
      .map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.role === 'assistant' ? {
          parsedFoods: m.parsedFoods,
          parsedExercises: m.parsedExercises,
          parsedDrinks: m.parsedDrinks,
          parsedMeasurements: m.parsedMeasurements,
          foodEdits: m.foodEdits,
          exerciseEdits: m.exerciseEdits,
          drinkEdits: m.drinkEdits,
          measurementEdits: m.measurementEdits,
        } : {}),
      }));

    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userContent, context: contextRef.current, history: recentMessages, image_url: uploadedImageUrl, locale }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(65000)]),
      });

      const data = await res.json();

      if (!res.ok) {
        // Show error in UI but don't persist to DB — error messages pollute conversation history
        const errorContent = data.error || t('chat.somethingWrong');
        setMessages((prev) => [
          ...prev,
          { id: `error-${Date.now()}`, role: 'assistant', content: errorContent },
        ]);
        // Tour: revert back to chat-input so user can retry
        if (tourActive && getStepId() === 'ai-response') {
          advanceToStep('chat-input');
        }
        setLoading(false);
        return;
      }

      const foods: ParsedFood[] = data.foods || [];
      const exercises: ParsedExercise[] = data.exercises || [];
      const drinks: ParsedDrink[] = data.drinks || [];
      const measurements: ParsedMeasurement[] = data.measurements || [];
      const foodEdits: FoodEdit[] = data.food_edits || [];
      const exerciseEdits: ExerciseEdit[] = data.exercise_edits || [];
      const drinkEdits: DrinkEdit[] = data.drink_edits || [];
      const measurementEdits: MeasurementEdit[] = data.measurement_edits || [];
      const textMessage: string | null = data.message || null;

      const hasAdds = foods.length > 0 || exercises.length > 0 || drinks.length > 0 || measurements.length > 0;
      const hasEdits = foodEdits.length > 0 || exerciseEdits.length > 0 || drinkEdits.length > 0 || measurementEdits.length > 0;

      // Build response text
      // Strip any "Found N items..." / "Ditemukan N item..." the model echoed,
      // since the client generates its own action text below.
      let responseText = '';
      if (textMessage) {
        const actionTextPattern = /\n?\n?(?:Found|Ditemukan)\s+\d+.+(?:to confirm|untuk konfirmasi)\.?$/i;
        responseText = textMessage.replace(actionTextPattern, '').trim();
      }
      if (hasAdds || hasEdits) {
        const parts: string[] = [];
        if (foods.length > 0) parts.push(`${foods.length} ${t('chat.foodItems')}`);
        if (exercises.length > 0) parts.push(`${exercises.length} ${t('chat.exercises')}`);
        if (drinks.length > 0) parts.push(`${drinks.length} ${t('chat.drinkItems')}`);
        if (measurements.length > 0) parts.push(`${measurements.length} ${t('chat.measurementItems')}`);
        if (foodEdits.length > 0) parts.push(`${foodEdits.length} ${t('chat.foodEdits')}`);
        if (exerciseEdits.length > 0) parts.push(`${exerciseEdits.length} ${t('chat.exerciseEdits')}`);
        if (drinkEdits.length > 0) parts.push(`${drinkEdits.length} ${t('chat.drinkEdits')}`);
        if (measurementEdits.length > 0) parts.push(`${measurementEdits.length} ${t('chat.measurementEdits')}`);

        const buttonLabel = hasEdits && hasAdds ? t('chat.saveAndApply') : hasEdits ? t('chat.applyChanges') : t('common.save');
        const actionText = `${t('chat.found')} ${parts.join(` ${t('chat.and')} `)}. ${t('chat.reviewAndTap')} ${buttonLabel} ${t('chat.toConfirm')}`;
        responseText = responseText ? `${responseText}\n\n${actionText}` : actionText;
      }

      if (!responseText) {
        responseText = t('chat.couldntFind');
      }

      // Insert assistant message to DB
      // Build insert object dynamically — only include measurement columns when there's data
      // to stay backwards-compatible with DBs that haven't migrated those columns yet
      const insertPayload: Record<string, unknown> = {
        user_id: user!.id,
        date,
        role: 'assistant',
        content: responseText,
        parsed_foods: foods.length > 0 ? foods : null,
        parsed_exercises: exercises.length > 0 ? exercises : null,
        parsed_drinks: drinks.length > 0 ? drinks : null,
        food_edits: foodEdits.length > 0 ? foodEdits : null,
        exercise_edits: exerciseEdits.length > 0 ? exerciseEdits : null,
        drink_edits: drinkEdits.length > 0 ? drinkEdits : null,
        saved: false,
      };
      if (measurements.length > 0) insertPayload.parsed_measurements = measurements;
      if (measurementEdits.length > 0) insertPayload.measurement_edits = measurementEdits;

      const { data: assistantRow, error: insertError } = await supabase
        .from('chat_messages')
        .insert(insertPayload)
        .select()
        .single();

      if (insertError) {
        console.error('Failed to insert assistant message:', insertError.message);
      }

      const assistantMsg: Message = assistantRow
        ? dbRowToMessage(assistantRow)
        : {
            id: `temp-${Date.now()}`,
            role: 'assistant',
            content: responseText,
            parsedFoods: foods.length > 0 ? foods : undefined,
            parsedExercises: exercises.length > 0 ? exercises : undefined,
            parsedDrinks: drinks.length > 0 ? drinks : undefined,
            parsedMeasurements: measurements.length > 0 ? measurements : undefined,
            foodEdits: foodEdits.length > 0 ? foodEdits : undefined,
            exerciseEdits: exerciseEdits.length > 0 ? exerciseEdits : undefined,
            drinkEdits: drinkEdits.length > 0 ? drinkEdits : undefined,
            measurementEdits: measurementEdits.length > 0 ? measurementEdits : undefined,
            saved: (hasAdds || hasEdits) ? false : undefined,
          };

      setMessages((prev) => [...prev, assistantMsg]);

      // Tour: advance from ai-response to parsed-result (or skip to log-page if no actionable items)
      if (tourActive && getStepId() === 'ai-response') {
        if (hasAdds || hasEdits) {
          advanceToStep('parsed-result');
        } else {
          advanceToStep('log-page');
        }
      }
    } catch (err) {
      // Don't show error if request was intentionally aborted (e.g., date change, unmount)
      if (err instanceof DOMException && err.name === 'AbortError') {
        setLoading(false);
        return;
      }
      // Show timeout-specific message vs generic error
      const isTimeout = err instanceof DOMException && err.name === 'TimeoutError';
      setMessages((prev) => [
        ...prev,
        { id: `error-${Date.now()}`, role: 'assistant', content: isTimeout ? t('chat.requestTimeout') : t('chat.somethingWrong') },
      ]);
      // Tour: revert back to chat-input so user can retry
      if (tourActive && getStepId() === 'ai-response') {
        advanceToStep('chat-input');
      }
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

  const saveResults = useCallback(async (msgId: string, foods: ParsedFood[], exercises: ParsedExercise[], drinks: ParsedDrink[] = [], measurements: ParsedMeasurement[] = []) => {
    if (!user || savingLockRef.current) return;
    savingLockRef.current = true;
    setSavingId(msgId);
    const supabase = createClient();
    const today = getToday();
    let hasError = false;

    if (foods.length > 0) {
      const { error } = await supabase.from('food_logs').insert(
        foods.map((f) => ({
          user_id: user.id, date: today, meal_type: f.meal_type, description: f.description,
          // food_logs columns are INTEGER — round defensively in case the chat
          // message was stored before the parse API rounded macros.
          calories: Math.round(f.calories),
          protein_g: Math.round(f.protein_g),
          carbs_g: Math.round(f.carbs_g),
          fat_g: Math.round(f.fat_g),
          source: 'chat' as const,
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

    if (drinks.length > 0) {
      const { error } = await supabase.from('drink_logs').insert(
        drinks.map((d) => ({
          user_id: user.id, date: today, drink_type: d.drink_type, description: d.description,
          volume_ml: d.volume_ml, calories: d.calories, protein_g: d.protein_g,
          carbs_g: d.carbs_g, fat_g: d.fat_g, source: 'chat' as const,
        }))
      );
      if (error) hasError = true;
    }

    if (measurements.length > 0) {
      const { error } = await supabase.from('measurement_logs').insert(
        measurements.map((m) => ({
          user_id: user.id, date: today, height_cm: m.height_cm, weight_kg: m.weight_kg,
          notes: m.notes, source: 'chat' as const,
        }))
      );
      if (error) hasError = true;
    }

    if (hasError) {
      showToast('error', t('chat.failedSave'));
      setSavingId(null);
      savingLockRef.current = false;
      return;
    }

    await markSaved(msgId);
    setSavingId(null);
    savingLockRef.current = false;
    fetchContext();

    // Emit feed events for exercises and goal checks
    const feedDate = today;
    Promise.resolve().then(async () => {
      for (const e of exercises) {
        await emitExerciseEvent(user.id, e.exercise_type, e.duration_minutes, e.calories_burned).catch(console.warn);
      }
      await checkAndEmitGoalEvents(user.id, feedDate).catch(console.warn);
    }).catch(console.warn);

    // Tour: advance after save
    if (tourActive && getStepId() === 'parsed-result') {
      nextStep();
    }
  }, [user, showToast, fetchContext, t, tourActive, getStepId, nextStep]);

  const confirmEdits = useCallback(async (msgId: string, foodEdits: FoodEdit[], exerciseEdits: ExerciseEdit[], drinkEdits: DrinkEdit[] = [], measurementEdits: MeasurementEdit[] = []) => {
    if (!user || savingLockRef.current) return;
    savingLockRef.current = true;
    setSavingId(msgId);
    const supabase = createClient();
    let hasError = false;

    for (const edit of foodEdits) {
      const { error } = await supabase.from('food_logs').update(roundFoodUpdate(edit.updated)).eq('id', edit.log_id).eq('user_id', user.id);
      if (error) hasError = true;
    }

    for (const edit of exerciseEdits) {
      const { error } = await supabase.from('exercise_logs').update(edit.updated).eq('id', edit.log_id).eq('user_id', user.id);
      if (error) hasError = true;
    }

    for (const edit of drinkEdits) {
      const { error } = await supabase.from('drink_logs').update(edit.updated).eq('id', edit.log_id).eq('user_id', user.id);
      if (error) hasError = true;
    }

    for (const edit of measurementEdits) {
      const { error } = await supabase.from('measurement_logs').update(edit.updated).eq('id', edit.log_id).eq('user_id', user.id);
      if (error) hasError = true;
    }

    if (hasError) {
      showToast('error', t('chat.failedApply'));
      setSavingId(null);
      savingLockRef.current = false;
      return;
    }

    await markSaved(msgId);
    setSavingId(null);
    savingLockRef.current = false;
    fetchContext();

    // Check goal events after edits
    checkAndEmitGoalEvents(user.id, getToday()).catch(console.warn);

    // Tour: advance after save
    if (tourActive && getStepId() === 'parsed-result') {
      nextStep();
    }
  }, [user, showToast, fetchContext, t, tourActive, getStepId, nextStep]);

  const handleSaveAndApply = useCallback(async (msg: Message) => {
    if (!user || savingLockRef.current) return;
    savingLockRef.current = true;
    setSavingId(msg.id);
    const supabase = createClient();
    const today = getToday();
    let hasError = false;

    if (msg.parsedFoods && msg.parsedFoods.length > 0) {
      const { error } = await supabase.from('food_logs').insert(
        msg.parsedFoods.map((f) => ({
          user_id: user.id, date: today, meal_type: f.meal_type, description: f.description,
          // food_logs columns are INTEGER — round defensively in case the chat
          // message was stored before the parse API rounded macros.
          calories: Math.round(f.calories),
          protein_g: Math.round(f.protein_g),
          carbs_g: Math.round(f.carbs_g),
          fat_g: Math.round(f.fat_g),
          source: 'chat' as const,
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
    if (msg.parsedDrinks && msg.parsedDrinks.length > 0) {
      const { error } = await supabase.from('drink_logs').insert(
        msg.parsedDrinks.map((d) => ({
          user_id: user.id, date: today, drink_type: d.drink_type, description: d.description,
          volume_ml: d.volume_ml, calories: d.calories, protein_g: d.protein_g,
          carbs_g: d.carbs_g, fat_g: d.fat_g, source: 'chat' as const,
        }))
      );
      if (error) hasError = true;
    }
    if (msg.parsedMeasurements && msg.parsedMeasurements.length > 0) {
      const { error } = await supabase.from('measurement_logs').insert(
        msg.parsedMeasurements.map((m) => ({
          user_id: user.id, date: today, height_cm: m.height_cm, weight_kg: m.weight_kg,
          notes: m.notes, source: 'chat' as const,
        }))
      );
      if (error) hasError = true;
    }

    if (msg.foodEdits) {
      for (const edit of msg.foodEdits) {
        const { error } = await supabase.from('food_logs').update(roundFoodUpdate(edit.updated)).eq('id', edit.log_id).eq('user_id', user.id);
        if (error) hasError = true;
      }
    }
    if (msg.exerciseEdits) {
      for (const edit of msg.exerciseEdits) {
        const { error } = await supabase.from('exercise_logs').update(edit.updated).eq('id', edit.log_id).eq('user_id', user.id);
        if (error) hasError = true;
      }
    }
    if (msg.drinkEdits) {
      for (const edit of msg.drinkEdits) {
        const { error } = await supabase.from('drink_logs').update(edit.updated).eq('id', edit.log_id).eq('user_id', user.id);
        if (error) hasError = true;
      }
    }
    if (msg.measurementEdits) {
      for (const edit of msg.measurementEdits) {
        const { error } = await supabase.from('measurement_logs').update(edit.updated).eq('id', edit.log_id).eq('user_id', user.id);
        if (error) hasError = true;
      }
    }

    if (hasError) {
      showToast('error', t('chat.failedSave'));
      setSavingId(null);
      savingLockRef.current = false;
      return;
    }

    await markSaved(msg.id);
    setSavingId(null);
    savingLockRef.current = false;
    fetchContext();

    // Emit feed events for exercises and goal checks
    const feedDate2 = today;
    Promise.resolve().then(async () => {
      if (msg.parsedExercises) {
        for (const e of msg.parsedExercises) {
          await emitExerciseEvent(user.id, e.exercise_type, e.duration_minutes, e.calories_burned).catch(console.warn);
        }
      }
      await checkAndEmitGoalEvents(user.id, feedDate2).catch(console.warn);
    }).catch(console.warn);

    // Tour: advance after save
    if (tourActive && getStepId() === 'parsed-result') {
      nextStep();
    }
  }, [user, showToast, fetchContext, t, tourActive, getStepId, nextStep]);

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

  const handleButtonClick = useCallback((msg: Message) => {
    const hasAdds = (msg.parsedFoods?.length ?? 0) > 0 || (msg.parsedExercises?.length ?? 0) > 0 || (msg.parsedDrinks?.length ?? 0) > 0 || (msg.parsedMeasurements?.length ?? 0) > 0;
    const hasEdits = (msg.foodEdits?.length ?? 0) > 0 || (msg.exerciseEdits?.length ?? 0) > 0 || (msg.drinkEdits?.length ?? 0) > 0 || (msg.measurementEdits?.length ?? 0) > 0;

    if (hasAdds && hasEdits) {
      handleSaveAndApply(msg);
    } else if (hasEdits) {
      confirmEdits(msg.id, msg.foodEdits || [], msg.exerciseEdits || [], msg.drinkEdits || [], msg.measurementEdits || []);
    } else {
      saveResults(msg.id, msg.parsedFoods || [], msg.parsedExercises || [], msg.parsedDrinks || [], msg.parsedMeasurements || []);
    }
  }, [handleSaveAndApply, confirmEdits, saveResults]);

  const { isExpanded } = useDesktopLayout();

  return (
    <div className={cn(
      'fixed top-0 left-0 right-0 bg-bg overflow-hidden z-10 flex flex-col bottom-nav-offset',
      isExpanded && 'sm:!bottom-0 sm:left-16 xl:left-60'
    )}>
      <div className={cn('max-w-lg mx-auto flex flex-col h-full w-full', isExpanded && 'lg:max-w-3xl')}>
      {ToastContainer}

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-6 pb-2">
        <h1 className="text-xl font-bold text-text-primary">{t('chat.title')}</h1>
        <DateNav date={date} onDateChange={setDate} />
      </div>

      {/* History banner for past dates */}
      {!isToday && !loadingMessages && (
        <div className="mx-4 mb-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
          <p className="text-xs text-amber-700 dark:text-amber-400 text-center font-medium">
            {t('chat.viewingHistory').replace('{date}', formatDisplayDate(date, locale))}
          </p>
        </div>
      )}

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 pb-4 space-y-4 scrollbar-hide">
        {loadingMessages ? (
          <div className="flex justify-center py-8">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-loading-dots rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-loading-dots rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-loading-dots rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        ) : !isToday && !hasHistoryMessages ? (
          <div className="flex justify-center py-12">
            <p className="text-sm text-text-tertiary">{t('chat.noHistory')}</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isWelcome = msg.id === 'welcome';
            const isLastAssistant = msg.role === 'assistant' && idx === messages.length - 1 && !isWelcome;
            const hasActionable = (msg.parsedFoods?.length ?? 0) > 0 || (msg.parsedExercises?.length ?? 0) > 0 || (msg.parsedDrinks?.length ?? 0) > 0 || (msg.parsedMeasurements?.length ?? 0) > 0;
            return (
              <div
                key={msg.id}
                data-tour={isLastAssistant && hasActionable ? 'parsed-result' : isLastAssistant ? 'ai-response' : undefined}
              >
                <MessageBubble
                  msg={msg}
                  savingId={savingId}
                  onButtonClick={handleButtonClick}
                  onUpdateFood={updateFood}
                  t={t}
                />
              </div>
            );
          })
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

      {/* Input — only visible for today */}
      {isToday && (
      <div className="px-4 pt-2 pb-4">
        {/* Image preview */}
        {imagePreview && (
          <div className="mb-2 relative inline-block">
            <img src={imagePreview} alt="Preview" className="h-20 rounded-xl object-cover" />
            <button
              onClick={clearImage}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-text-primary text-bg rounded-full flex items-center justify-center text-xs"
              aria-label="Remove image"
            >
              &times;
            </button>
          </div>
        )}
        <div className="flex items-center bg-surface-secondary rounded-2xl px-4 py-1" data-tour="chat-input">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
          {!voiceRecording && (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="p-2 text-text-tertiary hover:text-text-primary disabled:opacity-30 transition-colors rounded-lg"
                aria-label="Attach photo"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) sendMessage();
                }}
                className="flex-1 py-3 bg-transparent focus:outline-none text-sm text-text-primary placeholder:text-text-tertiary"
                placeholder={t('chat.placeholder')}
              />
            </>
          )}
          <VoiceButton
            onTranscript={(text) => sendMessage(text)}
            onRecordingChange={setVoiceRecording}
            onError={(key) => showToast('error', t(key))}
            disabled={loading}
            lang={locale === 'id' ? 'id-ID' : 'en-US'}
          />
          {!voiceRecording && (
            <button
              onClick={() => sendMessage()}
              disabled={loading || (!input.trim() && !imageFile)}
              className="p-2 text-text-tertiary hover:text-text-primary disabled:opacity-30 transition-colors rounded-lg"
              aria-label="Send message"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          )}
        </div>
      </div>
      )}
      </div>
    </div>
  );
}
