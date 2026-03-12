/**
 * Zustand store for calculator state management
 *
 * Replaces Python's AppState class with reactive state management
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { GearParams, TabId } from '@/types';
import { DEFAULTS, DEFAULT_SMOOTH, DEFAULT_FILLET_ADD, DEFAULT_FILLET_DED } from '@/lib/constants';

// Maximum history size for undo/redo
const MAX_HISTORY = 50;

interface HistoryState {
  params: GearParams;
  smooth: number;
  filletAdd: number;
  filletDed: number;
}

interface CalculatorState {
  // Parameter values
  params: GearParams;

  // Additional settings
  smooth: number;
  filletAdd: number;
  filletDed: number;

  // UI state
  activeTab: TabId;
  isComputing: boolean;
  computeProgress: number;
  lastError: string | null;

  // Undo/redo history
  history: HistoryState[];
  historyIndex: number;

  // Actions
  setParam: <K extends keyof GearParams>(key: K, value: GearParams[K]) => void;
  setParams: (params: Partial<GearParams>) => void;
  setSmooth: (value: number) => void;
  setFilletAdd: (value: number) => void;
  setFilletDed: (value: number) => void;
  resetToDefaults: () => void;

  // Tab control
  setActiveTab: (tab: TabId) => void;

  // Computing state
  setComputing: (computing: boolean) => void;
  setComputeProgress: (progress: number) => void;
  setError: (error: string | null) => void;

  // Undo/redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  pushHistory: () => void;

  // Config management
  getConfig: () => object;
  loadConfig: (config: object) => void;
}

export const useCalculatorStore = create<CalculatorState>()(
  persist(
    (set, get) => ({
      // Initial state
      params: { ...DEFAULTS },
      smooth: DEFAULT_SMOOTH,
      filletAdd: DEFAULT_FILLET_ADD,
      filletDed: DEFAULT_FILLET_DED,
      activeTab: 'flexspline-tooth',
      isComputing: false,
      computeProgress: 0,
      lastError: null,
      history: [],
      historyIndex: -1,

      // Set a single parameter
      setParam: (key, value) => {
        set((state) => {
          const newParams = { ...state.params, [key]: value };

          // Auto-link z_c to z_f + 2 if z_f changes
          if (key === 'z_f' && typeof value === 'number') {
            newParams.z_c = value + 2;
          }

          return { params: newParams };
        });
        get().pushHistory();
      },

      // Set multiple parameters at once
      setParams: (params) => {
        set((state) => ({
          params: { ...state.params, ...params },
        }));
        get().pushHistory();
      },

      // Setters for additional settings
      setSmooth: (value) => set({ smooth: value }),
      setFilletAdd: (value) => set({ filletAdd: value }),
      setFilletDed: (value) => set({ filletDed: value }),

      // Reset all values to defaults
      resetToDefaults: () => {
        set({
          params: { ...DEFAULTS },
          smooth: DEFAULT_SMOOTH,
          filletAdd: DEFAULT_FILLET_ADD,
          filletDed: DEFAULT_FILLET_DED,
          lastError: null,
        });
        get().pushHistory();
      },

      // Tab control
      setActiveTab: (tab) => set({ activeTab: tab }),

      // Computing state management
      setComputing: (computing) => set({ isComputing: computing }),
      setComputeProgress: (progress) => set({ computeProgress: progress }),
      setError: (error) => set({ lastError: error }),

      // Push current state to history
      pushHistory: () => {
        set((state) => {
          const currentState: HistoryState = {
            params: { ...state.params },
            smooth: state.smooth,
            filletAdd: state.filletAdd,
            filletDed: state.filletDed,
          };

          // Truncate forward history if we're not at the end
          const newHistory = state.history.slice(0, state.historyIndex + 1);
          newHistory.push(currentState);

          // Limit history size
          if (newHistory.length > MAX_HISTORY) {
            newHistory.shift();
            return {
              history: newHistory,
              historyIndex: newHistory.length - 1,
            };
          }

          return {
            history: newHistory,
            historyIndex: newHistory.length - 1,
          };
        });
      },

      // Undo to previous state
      undo: () => {
        set((state) => {
          if (state.historyIndex <= 0) return state;

          const newIndex = state.historyIndex - 1;
          const prevState = state.history[newIndex];

          return {
            params: { ...prevState.params },
            smooth: prevState.smooth,
            filletAdd: prevState.filletAdd,
            filletDed: prevState.filletDed,
            historyIndex: newIndex,
          };
        });
      },

      // Redo to next state
      redo: () => {
        set((state) => {
          if (state.historyIndex >= state.history.length - 1) return state;

          const newIndex = state.historyIndex + 1;
          const nextState = state.history[newIndex];

          return {
            params: { ...nextState.params },
            smooth: nextState.smooth,
            filletAdd: nextState.filletAdd,
            filletDed: nextState.filletDed,
            historyIndex: newIndex,
          };
        });
      },

      // Check if undo is available
      canUndo: () => get().historyIndex > 0,

      // Check if redo is available
      canRedo: () => get().historyIndex < get().history.length - 1,

      // Get current config as JSON-serializable object
      getConfig: () => {
        const state = get();
        return {
          params: state.params,
          smooth: state.smooth,
          filletAdd: state.filletAdd,
          filletDed: state.filletDed,
        };
      },

      // Load config from JSON object
      loadConfig: (config: any) => {
        set({
          params: config.params ? { ...DEFAULTS, ...config.params } : { ...DEFAULTS },
          smooth: config.smooth ?? DEFAULT_SMOOTH,
          filletAdd: config.filletAdd ?? config.fillet_add ?? DEFAULT_FILLET_ADD,
          filletDed: config.filletDed ?? config.fillet_ded ?? DEFAULT_FILLET_DED,
        });
        get().pushHistory();
      },
    }),
    {
      name: 'harmonic-dct-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        params: state.params,
        smooth: state.smooth,
        filletAdd: state.filletAdd,
        filletDed: state.filletDed,
      }),
    }
  )
);

// Selector hooks for common use cases
export const useParams = () => useCalculatorStore((state) => state.params);
export const useActiveTab = () => useCalculatorStore((state) => state.activeTab);
export const useIsComputing = () => useCalculatorStore((state) => state.isComputing);
