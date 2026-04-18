const lessonCatalog = window.lessonCatalog || [];
const lessonEntries = window.lessonEntries || [];
const nativeAppShell = Boolean(window.BISAYA_BUDDY_APP_SHELL);

function isNativeIOSApp() {
  return nativeAppShell && window.BISAYA_BUDDY_PLATFORM === "ios";
}

const storageKeys = {
  learned: "bisaya-buddy-learned",
  bestQuiz: "bisaya-buddy-best-quiz",
  legacyBestScore: "bisaya-buddy-best-score",
  theme: "bisaya-buddy-theme",
  lessonProgress: "bisaya-buddy-lesson-progress",
  practiceInsights: "bisaya-buddy-practice-insights",
};

const adaptiveQuestionTarget = 35;

function difficultyLabelForStep(step) {
  if (step <= 7) {
    return "Starter";
  }

  if (step <= 14) {
    return "Intermediate";
  }

  return "Hard";
}

const quizModes = {
  bisayaToEnglish: {
    prompt(entry) {
      return entry.bisaya;
    },
    helper(entry) {
      return `Pronunciation: ${entry.pronunciation}`;
    },
    answerLabel(entry) {
      return entry.english;
    },
    kicker: "Translate this Bisaya phrase.",
    useAudio: false,
  },
  englishToBisaya: {
    prompt(entry) {
      return entry.english;
    },
    helper() {
      return "Choose the matching Bisaya phrase.";
    },
    answerLabel(entry) {
      return entry.bisaya;
    },
    kicker: "Find the Bisaya phrase.",
    useAudio: false,
  },
  listenToBisaya: {
    prompt() {
      return "Which Bisaya phrase are you hearing?";
    },
    helper() {
      return "Use the audio button and choose the matching Bisaya card.";
    },
    answerLabel(entry) {
      return entry.bisaya;
    },
    kicker: "Listen closely.",
    useAudio: true,
  },
};

function createEmptyQuizState(
  lessonId = null,
  mode = "bisayaToEnglish",
  totalQuestions = adaptiveQuestionTarget
) {
  return {
    lessonId,
    mode,
    totalQuestions,
    score: 0,
    questionNumber: 0,
    current: null,
    answered: false,
    recentIds: [],
    reviewQueue: [],
    exposureCounts: {},
    repeatGoal: 2,
    completed: false,
    finalPercent: 0,
  };
}

function createEmptyPracticeState(lessonId = null, totalQuestions = adaptiveQuestionTarget) {
  return {
    lessonId,
    totalQuestions,
    score: 0,
    questionNumber: 0,
    current: null,
    recentIds: [],
    reviewQueue: [],
    exposureCounts: {},
    repeatGoal: 2,
    attempts: 0,
    hintLevel: 0,
    completed: false,
    checked: false,
    finalPercent: 0,
    feedback: "",
    feedbackTone: "",
    hint: "Hints will appear here.",
  };
}

function readJSON(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Ignore storage write failures in private browsing or strict environments.
  }
}

function matchesMediaQuery(query) {
  if (!window.matchMedia) {
    return false;
  }

  try {
    return window.matchMedia(query).matches;
  } catch (error) {
    return false;
  }
}

function isIOSDevice() {
  const userAgent = window.navigator.userAgent || "";
  const platform = window.navigator.platform || "";
  const maxTouchPoints = window.navigator.maxTouchPoints || 0;

  return (
    /iPad|iPhone|iPod/.test(userAgent) ||
    (platform === "MacIntel" && maxTouchPoints > 1)
  );
}

function isStandaloneDisplayMode() {
  return (
    matchesMediaQuery("(display-mode: standalone)") ||
    window.navigator.standalone === true
  );
}

function prefersDarkTheme() {
  return matchesMediaQuery("(prefers-color-scheme: dark)");
}

function readThemePreference() {
  try {
    const stored = window.localStorage.getItem(storageKeys.theme);
    if (stored === "\"dark\"" || stored === "\"light\"") {
      return JSON.parse(stored);
    }

    if (stored === "dark" || stored === "light") {
      return stored;
    }
  } catch (error) {
    return prefersDarkTheme() ? "dark" : "light";
  }

  return prefersDarkTheme() ? "dark" : "light";
}

function hasStoredThemePreference() {
  try {
    const stored = window.localStorage.getItem(storageKeys.theme);
    return (
      stored === "\"dark\"" ||
      stored === "\"light\"" ||
      stored === "dark" ||
      stored === "light"
    );
  } catch (error) {
    return false;
  }
}

function readBestQuiz() {
  const storedBest = readJSON(storageKeys.bestQuiz, null);
  if (typeof storedBest === "number") {
    return storedBest;
  }

  const legacy = readJSON(storageKeys.legacyBestScore, 0);
  if (typeof legacy === "number") {
    return legacy <= 10 ? legacy * 10 : legacy;
  }

  return 0;
}

const state = {
  tab: "course",
  search: "",
  lesson: "All lessons",
  category: "All categories",
  startedLesson: null,
  lessonExercise: "study",
  learned: new Set(readJSON(storageKeys.learned, [])),
  bestQuiz: readBestQuiz(),
  lessonProgress: readJSON(storageKeys.lessonProgress, {}),
  practiceInsights: readJSON(storageKeys.practiceInsights, {}),
  statsOpen: false,
  theme: readThemePreference(),
  themePreferenceSaved: hasStoredThemePreference(),
  deferredInstallPrompt: null,
  iosWelcomeVisible: isNativeIOSApp(),
  iosCompletionModal: null,
  lessonQuiz: createEmptyQuizState(),
  typingSession: createEmptyPracticeState(),
  grammarSession: createEmptyPracticeState(),
};

const fallbackLessons = Array.from(new Set(lessonEntries.map((entry) => entry.lesson))).map(
  (id) => ({ id, shortTitle: id, summary: "" })
);
const orderedLessons = (lessonCatalog.length > 0 ? lessonCatalog : fallbackLessons).map(
  (lesson, index) => {
    const step = typeof lesson.step === "number" ? lesson.step : index + 1;
    return {
      ...lesson,
      step,
      difficulty: lesson.difficulty || difficultyLabelForStep(step),
    };
  }
);
const lessonLookup = new Map(orderedLessons.map((lesson) => [lesson.id, lesson]));
const lessonIndexLookup = new Map(orderedLessons.map((lesson, index) => [lesson.id, index]));

const elements = {
  lessonCount: document.querySelector("#lesson-count"),
  cardCount: document.querySelector("#card-count"),
  learnedCount: document.querySelector("#learned-count"),
  bestScore: document.querySelector("#best-score"),
  iosWelcomeScreen: document.querySelector("#ios-welcome-screen"),
  iosWelcomeLesson: document.querySelector("#ios-welcome-lesson"),
  iosWelcomeStart: document.querySelector("#ios-welcome-start"),
  iosCompleteModal: document.querySelector("#ios-complete-modal"),
  iosCompleteTitle: document.querySelector("#ios-complete-title"),
  iosCompleteCopy: document.querySelector("#ios-complete-copy"),
  iosCompleteNext: document.querySelector("#ios-complete-next"),
  iosCompleteStay: document.querySelector("#ios-complete-stay"),
  iosTopBar: document.querySelector("#ios-top-bar"),
  iosJourneyTitle: document.querySelector("#ios-journey-title"),
  iosJourneyPill: document.querySelector("#ios-journey-pill"),
  iosJourneyBar: document.querySelector("#ios-journey-bar"),
  lessonList: document.querySelector("#lesson-list"),
  categoryList: document.querySelector("#category-list"),
  searchInput: document.querySelector("#search-input"),
  clearFilters: document.querySelector("#clear-filters"),
  cardGrid: document.querySelector("#card-grid"),
  emptyState: document.querySelector("#empty-state"),
  tabs: Array.from(document.querySelectorAll(".tab")),
  themeToggle: document.querySelector("#theme-toggle"),
  statsToggle: document.querySelector("#stats-toggle"),
  installApp: document.querySelector("#install-app"),
  shareApp: document.querySelector("#share-app"),
  appStatus: document.querySelector("#app-status"),
  themeMeta: document.querySelector('meta[name="theme-color"]'),
  statsPanel: document.querySelector("#stats-panel"),
  statsTitle: document.querySelector("#stats-title"),
  statsCopy: document.querySelector("#stats-copy"),
  statsFocusPill: document.querySelector("#stats-focus-pill"),
  statsCompletedSteps: document.querySelector("#stats-completed-steps"),
  statsCurrentStep: document.querySelector("#stats-current-step"),
  statsAccuracy: document.querySelector("#stats-accuracy"),
  statsAttempts: document.querySelector("#stats-attempts"),
  statsTrackList: document.querySelector("#stats-track-list"),
  statsFocusList: document.querySelector("#stats-focus-list"),
  statsRecommendation: document.querySelector("#stats-recommendation"),
  activeLesson: document.querySelector("#active-lesson"),
  activeCategory: document.querySelector("#active-category"),
  activeCount: document.querySelector("#active-count"),
  selectedLessonStatus: document.querySelector("#selected-lesson-status"),
  selectedLessonProgress: document.querySelector("#selected-lesson-progress"),
  startSelectedLesson: document.querySelector("#start-selected-lesson"),
  studyTitle: document.querySelector("#study-title"),
  studySummary: document.querySelector("#study-summary"),
  pathTitle: document.querySelector("#path-title"),
  pathCopy: document.querySelector("#path-copy"),
  pathStepPill: document.querySelector("#path-step-pill"),
  pathDifficulty: document.querySelector("#path-difficulty"),
  pathStudyState: document.querySelector("#path-study-state"),
  pathQuizState: document.querySelector("#path-quiz-state"),
  pathTypingState: document.querySelector("#path-typing-state"),
  pathGrammarState: document.querySelector("#path-grammar-state"),
  pathStartButton: document.querySelector("#path-start-button"),
  pathFootnote: document.querySelector("#path-footnote"),
  views: {
    course: document.querySelector("#course-view"),
    lesson: document.querySelector("#lesson-view"),
  },
  lessonTitle: document.querySelector("#lesson-title"),
  lessonSummary: document.querySelector("#lesson-summary"),
  lessonStatus: document.querySelector("#lesson-status"),
  lessonProgressText: document.querySelector("#lesson-progress-text"),
  lessonProgressBar: document.querySelector("#lesson-progress-bar"),
  lessonCardsCount: document.querySelector("#lesson-cards-count"),
  lessonLearnedCount: document.querySelector("#lesson-learned-count"),
  lessonQuizBest: document.querySelector("#lesson-quiz-best"),
  lessonTypingBest: document.querySelector("#lesson-typing-best"),
  lessonGrammarBest: document.querySelector("#lesson-grammar-best"),
  lessonEmpty: document.querySelector("#lesson-empty"),
  lessonBody: document.querySelector("#lesson-body"),
  lessonStudyGrid: document.querySelector("#lesson-study-grid"),
  studyNextTitle: document.querySelector("#study-next-title"),
  studyNextCopy: document.querySelector("#study-next-copy"),
  studyNextPill: document.querySelector("#study-next-pill"),
  studyNavButtons: Array.from(document.querySelectorAll(".study-nav-button")),
  backToCourse: document.querySelector("#back-to-course"),
  exerciseTabs: Array.from(document.querySelectorAll(".exercise-tab")),
  exercisePanes: {
    study: document.querySelector("#exercise-study"),
    quiz: document.querySelector("#exercise-quiz"),
    typing: document.querySelector("#exercise-typing"),
    grammar: document.querySelector("#exercise-grammar"),
  },
  lessonQuizMode: document.querySelector("#lesson-quiz-mode"),
  lessonQuizProgress: document.querySelector("#lesson-quiz-progress"),
  lessonQuizScore: document.querySelector("#lesson-quiz-score"),
  lessonQuizPrompt: document.querySelector("#lesson-quiz-prompt"),
  lessonQuizHelper: document.querySelector("#lesson-quiz-helper"),
  lessonQuizOptions: document.querySelector("#lesson-quiz-options"),
  lessonQuizFeedback: document.querySelector("#lesson-quiz-feedback"),
  lessonQuizAudioWrap: document.querySelector("#lesson-quiz-audio-wrap"),
  lessonQuizAudioButton: document.querySelector("#lesson-quiz-audio-button"),
  lessonStartQuiz: document.querySelector("#lesson-start-quiz"),
  lessonNextQuestion: document.querySelector("#lesson-next-question"),
  typingPrompt: document.querySelector("#typing-prompt"),
  typingHelper: document.querySelector("#typing-helper"),
  typingInput: document.querySelector("#typing-input"),
  typingHint: document.querySelector("#typing-hint"),
  typingFeedback: document.querySelector("#typing-feedback"),
  typingProgress: document.querySelector("#typing-progress"),
  typingScore: document.querySelector("#typing-score"),
  startTyping: document.querySelector("#start-typing"),
  checkTyping: document.querySelector("#check-typing"),
  nextTyping: document.querySelector("#next-typing"),
  revealTyping: document.querySelector("#reveal-typing"),
  grammarPrompt: document.querySelector("#grammar-prompt"),
  grammarHelper: document.querySelector("#grammar-helper"),
  grammarSentence: document.querySelector("#grammar-sentence"),
  grammarInput: document.querySelector("#grammar-input"),
  grammarHint: document.querySelector("#grammar-hint"),
  grammarFeedback: document.querySelector("#grammar-feedback"),
  grammarProgress: document.querySelector("#grammar-progress"),
  grammarScore: document.querySelector("#grammar-score"),
  startGrammar: document.querySelector("#start-grammar"),
  checkGrammar: document.querySelector("#check-grammar"),
  nextGrammar: document.querySelector("#next-grammar"),
  revealGrammar: document.querySelector("#reveal-grammar"),
};

function logNative(level, message) {
  try {
    window.BisayaBuddyNative?.log?.(level, message);
  } catch (error) {
    // Ignore bridge issues outside the macOS wrapper.
  }
}

function formatError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function registerGlobalErrorHandlers() {
  window.addEventListener("error", (event) => {
    logNative(
      "error",
      `Window error: ${event.message} @ ${event.filename || "inline"}:${event.lineno || 0}`
    );
  });

  window.addEventListener("unhandledrejection", (event) => {
    logNative("error", `Unhandled rejection: ${formatError(event.reason)}`);
  });
}

function nativePlatformLabel() {
  return window.BISAYA_BUDDY_PLATFORM === "ios" ? "iOS" : "macOS";
}

function lessonLabel(step) {
  return `${isNativeIOSApp() ? "Lesson" : "Step"} ${step}`;
}

function formatLessonHeading(lessonId) {
  const lesson = getLessonMeta(lessonId);
  return `${lessonLabel(lesson.step)} · ${lesson.shortTitle}`;
}

function getIOSPrimaryLessonId() {
  return getCurrentPathLesson()?.id || orderedLessons[orderedLessons.length - 1]?.id || null;
}

function renderIOSWelcomeScreen() {
  if (!isNativeIOSApp() || !elements.iosWelcomeScreen) {
    return;
  }

  const lessonId = getIOSPrimaryLessonId();
  const lesson = lessonId ? getLessonMeta(lessonId) : null;

  elements.iosWelcomeScreen.hidden = !state.iosWelcomeVisible;
  document.body.classList.toggle("ios-welcome-active", state.iosWelcomeVisible);

  if (!lesson) {
    elements.iosWelcomeLesson.textContent = "Course complete";
    elements.iosWelcomeStart.textContent = "Review Bisaya";
    return;
  }

  elements.iosWelcomeLesson.textContent = formatLessonHeading(lesson.id);
  elements.iosWelcomeStart.textContent = getCurrentPathLesson()
    ? "Start Learning Bisaya"
    : "Review Bisaya";
}

function renderIOSCompletionModal() {
  if (!isNativeIOSApp() || !elements.iosCompleteModal) {
    return;
  }

  const modal = state.iosCompletionModal;
  elements.iosCompleteModal.hidden = !modal;
  document.body.classList.toggle("ios-modal-active", Boolean(modal));

  if (!modal) {
    return;
  }

  const lesson = getLessonMeta(modal.lessonId);
  const nextLesson = modal.nextLessonId ? getLessonMeta(modal.nextLessonId) : null;

  elements.iosCompleteTitle.textContent = `Congratulations, you finished ${lessonLabel(
    lesson.step
  )}`;
  elements.iosCompleteCopy.textContent = nextLesson
    ? `${lessonLabel(nextLesson.step)} is now unlocked and ready for you.`
    : "You completed the full Bisaya course. Great work.";
  elements.iosCompleteNext.textContent = nextLesson
    ? `Get to ${lessonLabel(nextLesson.step)}`
    : "Review this lesson";
}

function renderIOSNativeExperience() {
  const enabled = isNativeIOSApp();
  document.body.classList.toggle("ios-native-app", enabled);

  if (!enabled) {
    return;
  }

  renderIOSWelcomeScreen();
  renderIOSCompletionModal();
}

function renderIOSJourneyHeader() {
  if (!isNativeIOSApp() || !elements.iosJourneyTitle || !elements.iosJourneyBar) {
    return;
  }

  const totalLessons = orderedLessons.length;
  const completedLessons = orderedLessons.filter((lesson) =>
    isLessonFullyCompleted(lesson.id)
  ).length;
  const lessonId = state.startedLesson || getIOSPrimaryLessonId();

  if (!lessonId || totalLessons === 0) {
    elements.iosJourneyTitle.textContent = "Course complete";
    elements.iosJourneyPill.textContent = "100% complete";
    elements.iosJourneyBar.style.width = "100%";
    return;
  }

  const summary = getLessonProgressSummary(lessonId);
  const progressUnits = Math.min(
    totalLessons,
    completedLessons + (summary.completed ? 0 : summary.overall / 100)
  );
  const coursePercent = Math.round((progressUnits / totalLessons) * 100);

  elements.iosJourneyTitle.textContent = `${lessonLabel(summary.step)} of ${totalLessons}`;
  elements.iosJourneyPill.textContent =
    completedLessons === totalLessons
      ? "Course complete"
      : `${coursePercent}% complete`;
  elements.iosJourneyBar.style.width = `${Math.max(coursePercent, 3)}%`;
}

function getActiveLessonPane() {
  return elements.exercisePanes[state.lessonExercise] || null;
}

function syncIOSStickyTopBarState() {
  const activePane = getActiveLessonPane();
  const hasStickyOffset = Boolean(
    isNativeIOSApp() &&
    state.startedLesson &&
    !state.iosWelcomeVisible &&
    !state.iosCompletionModal &&
    activePane &&
    activePane.scrollTop > 10
  );

  document.body.classList.toggle("ios-topbar-scrolled", hasStickyOffset);
  elements.iosTopBar?.classList.toggle("is-scrolled", hasStickyOffset);
}

function logIOSOverflowIfNeeded() {
  if (!isNativeIOSApp()) {
    return;
  }

  window.requestAnimationFrame(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const offenders = Array.from(document.querySelectorAll("body *"))
      .filter((node) => {
        if (!(node instanceof HTMLElement)) {
          return false;
        }

        if (node.hidden || node.offsetParent === null) {
          return false;
        }

        const overflowAmount = Math.round(node.scrollWidth - node.clientWidth);
        return overflowAmount > 8;
      })
      .slice(0, 5)
      .map((node) => {
        const parts = [node.tagName.toLowerCase()];
        if (node.id) {
          parts.push(`#${node.id}`);
        }
        const className =
          typeof node.className === "string"
            ? node.className
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 3)
                .map((name) => `.${name}`)
                .join("")
            : "";
        const overflowAmount = Math.round(node.scrollWidth - node.clientWidth);
        return `${parts.join("")}${className} (+${overflowAmount}px)`;
      });

    if (offenders.length > 0) {
      logNative(
        "warning",
        `iOS layout overflow detected at ${viewportWidth}px wide: ${offenders.join(", ")}`
      );
    }
  });
}

function init() {
  registerGlobalErrorHandlers();
  logNative(
    "info",
    `JS init started. nativeShell=${nativeAppShell} platform=${window.BISAYA_BUDDY_PLATFORM || "web"} singleFile=${Boolean(window.BISAYA_BUDDY_SINGLE_FILE)}`
  );
  applyTheme(state.theme);
  registerSystemThemeEvents();
  configurePlatformUI();
  bindEvents();
  renderApp();
  registerInstallEvents();
  registerServiceWorker();
  setAppStatus(initialStatusMessage());
}

function configurePlatformUI() {
  if (nativeAppShell) {
    elements.installApp.hidden = true;
    elements.shareApp.hidden = true;
  } else if (isIOSDevice() && !isStandaloneDisplayMode()) {
    elements.installApp.hidden = false;
    elements.installApp.textContent = "Add to Home Screen";
  } else if (isStandaloneDisplayMode()) {
    elements.installApp.hidden = true;
  }

  elements.bestScore.textContent = `${state.bestQuiz}%`;
}

function initialStatusMessage() {
  if (nativeAppShell) {
    return `Native ${nativePlatformLabel()} app mode loaded. Lesson audio and interactions run locally.`;
  }

  if (isIOSDevice()) {
    if (isStandaloneDisplayMode()) {
      return "Bisaya Buddy is running as an iPhone or iPad home screen app.";
    }

    if (window.location.protocol === "file:") {
      return "For iPhone or iPad, host the app on https or localhost first, then use Share and Add to Home Screen.";
    }

    return "iPhone and iPad ready. In Safari, use Share and Add to Home Screen to install it.";
  }

  if (window.location.protocol === "file:") {
    return "This one-file or local-folder version opens offline. For install and share links, run it on localhost or host it on https.";
  }

  return "Share-ready web app loaded. Install becomes available when the browser supports it.";
}

function bindEvents() {
  elements.iosWelcomeStart?.addEventListener("click", () => {
    startIOSLearningJourney();
  });

  elements.iosCompleteNext?.addEventListener("click", () => {
    openNextIOSLesson();
  });

  elements.iosCompleteStay?.addEventListener("click", () => {
    dismissIOSCompletionModal();
  });

  elements.themeToggle.addEventListener("click", () => {
    state.themePreferenceSaved = true;
    applyTheme(state.theme === "dark" ? "light" : "dark", { persist: true });
  });

  elements.statsToggle.addEventListener("click", () => {
    state.statsOpen = !state.statsOpen;
    renderStatsPanel();
  });

  elements.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    renderCourseCards();
    syncHeaderStats();
  });

  elements.clearFilters.addEventListener("click", () => {
    state.search = "";
    state.lesson = "All lessons";
    state.category = "All categories";
    elements.searchInput.value = "";
    renderApp();
  });

  elements.lessonList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-lesson]");
    if (!button) {
      return;
    }

    state.lesson = button.dataset.lesson;
    renderApp();
  });

  elements.categoryList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-category]");
    if (!button) {
      return;
    }

    state.category = button.dataset.category;
    renderCourseCards();
    renderScopeControls();
    syncHeaderStats();
  });

  elements.tabs.forEach((tabButton) => {
    tabButton.addEventListener("click", () => switchTab(tabButton.dataset.tab));
  });

  elements.cardGrid.addEventListener("click", handleCardGridAction);
  elements.lessonStudyGrid.addEventListener("click", handleCardGridAction);

  elements.startSelectedLesson.addEventListener("click", () => {
    startSelectedLesson();
  });

  elements.pathStartButton.addEventListener("click", () => {
    startCurrentPathLesson();
  });

  elements.backToCourse.addEventListener("click", () => {
    if (
      isNativeIOSApp() &&
      state.startedLesson &&
      isLessonFullyCompleted(state.startedLesson)
    ) {
      const nextLessonId = getNextLessonId(state.startedLesson);
      if (nextLessonId) {
        openLessonWorkspace(nextLessonId, { setStatus: false });
        renderApp();
        setAppStatus(`${formatLessonHeading(nextLessonId)} is unlocked and ready.`);
        return;
      }
    }

    switchTab("course");
  });

  elements.exerciseTabs.forEach((button) => {
    button.addEventListener("click", () => {
      switchLessonExercise(button.dataset.exercise);
    });
  });

  Object.values(elements.exercisePanes).forEach((pane) => {
    pane.addEventListener(
      "scroll",
      () => {
        syncIOSStickyTopBarState();
      },
      { passive: true }
    );
  });

  elements.studyNavButtons.forEach((button) => {
    button.addEventListener("click", () => {
      openPracticeFromStudy(button.dataset.exercise);
    });
  });

  elements.lessonQuizMode.addEventListener("change", (event) => {
    state.lessonQuiz = createEmptyQuizState(state.startedLesson, event.target.value);
    renderLessonQuizCard();
  });

  elements.lessonStartQuiz.addEventListener("click", () => {
    startLessonQuiz();
  });

  elements.lessonNextQuestion.addEventListener("click", () => {
    nextLessonQuizQuestion();
  });

  elements.lessonQuizAudioButton.addEventListener("click", async () => {
    if (state.lessonQuiz.current?.entry) {
      await playEntryAudio(state.lessonQuiz.current.entry);
    }
  });

  elements.startTyping.addEventListener("click", () => {
    startTypingSession();
  });

  elements.checkTyping.addEventListener("click", () => {
    checkTypingAnswer();
  });

  elements.nextTyping.addEventListener("click", () => {
    advanceTypingSession();
  });

  elements.revealTyping.addEventListener("click", () => {
    revealTypingHint();
  });

  elements.typingInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (state.typingSession.checked) {
        advanceTypingSession();
      } else {
        checkTypingAnswer();
      }
    }
  });

  elements.startGrammar.addEventListener("click", () => {
    startGrammarSession();
  });

  elements.checkGrammar.addEventListener("click", () => {
    checkGrammarAnswer();
  });

  elements.nextGrammar.addEventListener("click", () => {
    advanceGrammarSession();
  });

  elements.revealGrammar.addEventListener("click", () => {
    revealGrammarHint();
  });

  elements.grammarInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (state.grammarSession.checked) {
        advanceGrammarSession();
      } else {
        checkGrammarAnswer();
      }
    }
  });

  elements.installApp.addEventListener("click", async () => {
    await promptInstall();
  });

  elements.shareApp.addEventListener("click", async () => {
    await shareApp();
  });

  window.addEventListener("resize", () => {
    syncIOSStickyTopBarState();
    logIOSOverflowIfNeeded();
  });
}

function handleCardGridAction(event) {
  const actionButton = event.target.closest("button[data-action]");
  if (!actionButton) {
    return;
  }

  const entry = lessonEntries.find((item) => item.id === actionButton.dataset.id);
  if (!entry) {
    return;
  }

  if (actionButton.dataset.action === "play-audio") {
    playEntryAudio(entry);
    return;
  }

  if (actionButton.dataset.action === "toggle-learned") {
    toggleLearned(entry.id);
    renderApp();
  }
}

function registerInstallEvents() {
  if (nativeAppShell) {
    return;
  }

  if (isStandaloneDisplayMode()) {
    elements.installApp.hidden = true;
    setAppStatus(
      isIOSDevice()
        ? "Bisaya Buddy is running as an iPhone or iPad home screen app."
        : "Installed app mode is active."
    );
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    elements.installApp.hidden = false;
    setAppStatus("Install is available. You can add Bisaya Buddy to your dock or home screen.");
  });

  window.addEventListener("appinstalled", () => {
    state.deferredInstallPrompt = null;
    elements.installApp.hidden = true;
    setAppStatus("Bisaya Buddy was installed successfully.");
  });
}

async function promptInstall() {
  if (nativeAppShell) {
    setAppStatus("Install actions are only available in the browser version.");
    return;
  }

  if (isIOSDevice()) {
    if (isStandaloneDisplayMode()) {
      setAppStatus("Bisaya Buddy is already running from your iPhone or iPad home screen.");
      return;
    }

    if (window.location.protocol === "file:") {
      setAppStatus("Open the hosted https version first on iPhone or iPad, then use Share and Add to Home Screen.");
      return;
    }

    setAppStatus("On iPhone or iPad, open the Safari share menu and choose Add to Home Screen.");
    return;
  }

  if (!state.deferredInstallPrompt) {
    if (window.location.protocol === "file:") {
      setAppStatus("Open it from localhost or an https link first, then install it from the browser.");
    } else {
      setAppStatus("Use your browser menu to install or add this app to your home screen.");
    }
    return;
  }

  state.deferredInstallPrompt.prompt();
  await state.deferredInstallPrompt.userChoice;
  state.deferredInstallPrompt = null;
  elements.installApp.hidden = true;
}

async function shareApp() {
  if (nativeAppShell) {
    setAppStatus(
      `The native ${nativePlatformLabel()} app runs locally. Share the installed app build, or send the hosted web version instead.`
    );
    return;
  }

  if (window.location.protocol === "file:") {
    setAppStatus("This local file is self-contained. To share it as a live installable app, upload the project folder to a static host and send the https link.");
    return;
  }

  const shareData = {
    title: "Bisaya Buddy",
    text: "Learn Bisaya with lesson workspaces, English translations, pronunciation guides, audio, and guided exercises.",
    url: window.location.href,
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      setAppStatus("Share sheet opened.");
      return;
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(window.location.href);
      setAppStatus("App link copied to clipboard.");
      return;
    }
  } catch (error) {
    setAppStatus("Sharing was canceled or not available in this browser.");
    return;
  }

  setAppStatus(
    isIOSDevice()
      ? "Use the Safari share menu to share or add this app to your home screen."
      : "Sharing is not available in this browser."
  );
}

function registerServiceWorker() {
  const secureContext =
    window.location.protocol === "https:" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  if (!("serviceWorker" in navigator) || !secureContext) {
    return;
  }

  navigator.serviceWorker.register("service-worker.js").catch(() => {
    setAppStatus("The app loaded, but offline caching could not be enabled.");
  });
}

function renderApp() {
  if (state.lesson !== "All lessons" && !isLessonUnlocked(state.lesson)) {
    state.lesson = "All lessons";
  }

  if (state.startedLesson && !isLessonUnlocked(state.startedLesson)) {
    state.startedLesson = null;
    state.lessonExercise = "study";
    state.lessonQuiz = createEmptyQuizState(null, elements.lessonQuizMode.value);
    state.typingSession = createEmptyPracticeState();
    state.grammarSession = createEmptyPracticeState();
  }

  renderScopeControls();
  renderStatsPanel();
  renderCourseHero();
  renderPathPanel();
  renderCourseCards();
  renderLessonWorkspace();
  renderIOSJourneyHeader();
  syncHeaderStats();

  if (isNativeIOSApp()) {
    state.tab = "lesson";
  }

  switchTab(state.tab);
  renderIOSNativeExperience();
  syncIOSStickyTopBarState();
  logIOSOverflowIfNeeded();
}

function renderScopeControls() {
  renderLessonList();
  renderCategoryList();
  syncScopeLabels();
}

function registerSystemThemeEvents() {
  if (!window.matchMedia) {
    return;
  }

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  if (!mediaQuery.addEventListener) {
    return;
  }

  mediaQuery.addEventListener("change", (event) => {
    if (state.themePreferenceSaved) {
      return;
    }

    applyTheme(event.matches ? "dark" : "light");
  });
}

function applyTheme(theme, options = {}) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  state.theme = nextTheme;
  document.documentElement.dataset.theme = nextTheme;
  document.documentElement.style.colorScheme = nextTheme;
  updateThemeToggle();
  updateThemeMeta();

  if (options.persist) {
    writeJSON(storageKeys.theme, nextTheme);
  }
}

function updateThemeToggle() {
  const currentThemeLabel = state.theme === "dark" ? "Dark" : "Light";
  const nextThemeLabel = state.theme === "dark" ? "light" : "dark";

  elements.themeToggle.textContent = `Theme: ${currentThemeLabel}`;
  elements.themeToggle.setAttribute("aria-label", `Switch to ${nextThemeLabel} mode`);
  elements.themeToggle.title = `Switch to ${nextThemeLabel} mode`;
}

function updateThemeMeta() {
  if (!elements.themeMeta) {
    return;
  }

  const metaColor = state.theme === "dark" ? "#252b26" : "#ece6db";
  elements.themeMeta.setAttribute("content", metaColor);
}

function createEmptyPracticeRecord() {
  return {
    attempts: 0,
    correct: 0,
    wrong: 0,
    lastResult: "",
    lastAttemptAt: 0,
  };
}

function getLessonPracticeInsights(lessonId) {
  return state.practiceInsights[lessonId] || {};
}

function getExercisePracticeInsights(lessonId, exerciseName) {
  return getLessonPracticeInsights(lessonId)[exerciseName] || {};
}

function getPracticeRecord(lessonId, exerciseName, entryId) {
  return (
    getExercisePracticeInsights(lessonId, exerciseName)[entryId] ||
    createEmptyPracticeRecord()
  );
}

function recordPracticeResult(lessonId, exerciseName, entryId, correct) {
  if (!lessonId || !exerciseName || !entryId) {
    return;
  }

  const lessonInsights = getLessonPracticeInsights(lessonId);
  const exerciseInsights = getExercisePracticeInsights(lessonId, exerciseName);
  const current = getPracticeRecord(lessonId, exerciseName, entryId);
  const next = {
    attempts: current.attempts + 1,
    correct: current.correct + (correct ? 1 : 0),
    wrong: current.wrong + (correct ? 0 : 1),
    lastResult: correct ? "correct" : "wrong",
    lastAttemptAt: Date.now(),
  };

  state.practiceInsights = {
    ...state.practiceInsights,
    [lessonId]: {
      ...lessonInsights,
      [exerciseName]: {
        ...exerciseInsights,
        [entryId]: next,
      },
    },
  };

  writeJSON(storageKeys.practiceInsights, state.practiceInsights);
  renderStatsPanel();
}

function getPracticeTotals(lessonId = null) {
  const totals = {
    attempts: 0,
    correct: 0,
    wrong: 0,
  };

  const lessonIds = lessonId ? [lessonId] : Object.keys(state.practiceInsights);

  lessonIds.forEach((currentLessonId) => {
    const lessonInsights = getLessonPracticeInsights(currentLessonId);
    Object.values(lessonInsights).forEach((exerciseInsights) => {
      Object.values(exerciseInsights).forEach((record) => {
        totals.attempts += record.attempts || 0;
        totals.correct += record.correct || 0;
        totals.wrong += record.wrong || 0;
      });
    });
  });

  return totals;
}

function getExercisePracticeTotals(lessonId, exerciseName) {
  const totals = {
    attempts: 0,
    correct: 0,
    wrong: 0,
  };

  Object.values(getExercisePracticeInsights(lessonId, exerciseName)).forEach((record) => {
    totals.attempts += record.attempts || 0;
    totals.correct += record.correct || 0;
    totals.wrong += record.wrong || 0;
  });

  return totals;
}

function getFocusLessonId() {
  if (state.startedLesson) {
    return state.startedLesson;
  }

  if (state.lesson !== "All lessons" && isLessonUnlocked(state.lesson)) {
    return state.lesson;
  }

  return getCurrentPathLesson()?.id || orderedLessons[0]?.id || null;
}

function getAdaptiveEntryWeight(lessonId, exerciseName, entryId, session) {
  const record = getPracticeRecord(lessonId, exerciseName, entryId);
  const unresolvedMistakes = Math.max(record.wrong - record.correct, 0);
  const exposureCount = session.exposureCounts[entryId] || 0;
  const freshBonus = exposureCount === 0 ? 1 : 0;

  return (
    1 +
    freshBonus +
    record.wrong * 3 +
    unresolvedMistakes * 2 +
    (record.lastResult === "wrong" ? 1 : 0)
  );
}

function pickAdaptiveEntry(session, pool, exerciseName, recentWindow = 2) {
  const reviewEntry = takeReviewEntry(session, pool, recentWindow);
  if (reviewEntry) {
    return reviewEntry;
  }

  const blockedIds = new Set(session.recentIds.slice(-recentWindow));
  const filteredPool = pool.filter((entry) => !blockedIds.has(entry.id));
  const sourcePool = filteredPool.length > 0 ? filteredPool : pool;

  return weightedRandomItem(sourcePool, (entry) =>
    getAdaptiveEntryWeight(session.lessonId, exerciseName, entry.id, session)
  );
}

function getLessonFocusItems(lessonId, limit = 5) {
  if (!lessonId) {
    return [];
  }

  const lessonInsights = getLessonPracticeInsights(lessonId);
  const aggregate = new Map();

  ["quiz", "typing", "grammar"].forEach((exerciseName) => {
    const exerciseInsights = lessonInsights[exerciseName] || {};
    Object.entries(exerciseInsights).forEach(([entryId, record]) => {
      const current = aggregate.get(entryId) || {
        entry: lessonEntries.find((item) => item.id === entryId),
        attempts: 0,
        correct: 0,
        wrong: 0,
        exercises: [],
      };

      current.attempts += record.attempts || 0;
      current.correct += record.correct || 0;
      current.wrong += record.wrong || 0;

      if ((record.wrong || 0) > 0) {
        current.exercises.push(`${labelForExercise(exerciseName)} ${record.wrong} wrong`);
      }

      aggregate.set(entryId, current);
    });
  });

  return Array.from(aggregate.values())
    .filter((item) => item.entry && item.wrong > 0)
    .sort((left, right) => {
      const leftPriority =
        left.wrong * 4 + Math.max(left.wrong - left.correct, 0) * 3 + left.attempts;
      const rightPriority =
        right.wrong * 4 + Math.max(right.wrong - right.correct, 0) * 3 + right.attempts;
      return rightPriority - leftPriority;
    })
    .slice(0, limit);
}

function renderStatsPanel() {
  const focusLessonId = getFocusLessonId();
  const completedSteps = orderedLessons.filter((lesson) => isLessonFullyCompleted(lesson.id)).length;
  const overallPracticeTotals = getPracticeTotals();
  const overallAccuracy = overallPracticeTotals.attempts
    ? Math.round((overallPracticeTotals.correct / overallPracticeTotals.attempts) * 100)
    : 0;

  elements.statsPanel.hidden = !state.statsOpen;
  elements.statsToggle.textContent = state.statsOpen ? "Hide statistics" : "Statistics";
  elements.statsToggle.setAttribute("aria-expanded", String(state.statsOpen));
  elements.statsToggle.classList.toggle("is-active", state.statsOpen);
  elements.statsCompletedSteps.textContent = `${completedSteps} / ${orderedLessons.length}`;
  elements.statsAccuracy.textContent = `${overallAccuracy}%`;
  elements.statsAttempts.textContent = String(overallPracticeTotals.attempts);

  if (!focusLessonId) {
    elements.statsTitle.textContent = "Statistics";
    elements.statsCopy.textContent =
      `Track your progress here. Each practice session now uses ${adaptiveQuestionTarget} adaptive questions.`;
    elements.statsFocusPill.textContent = "0 focus items";
    elements.statsCurrentStep.textContent = "No step";
    elements.statsTrackList.innerHTML = '<div class="stats-empty">Start a step to see a breakdown here.</div>';
    elements.statsFocusList.innerHTML =
      '<div class="stats-empty">No practice data yet. Wrong answers will appear here once you start a session.</div>';
    elements.statsRecommendation.textContent =
      "Start the current step and this panel will begin tracking what needs more practice.";
    return;
  }

  const lesson = getLessonMeta(focusLessonId);
  const lessonSummary = getLessonProgressSummary(focusLessonId);
  const lessonTotals = getPracticeTotals(focusLessonId);
  const lessonAccuracy = lessonTotals.attempts
    ? Math.round((lessonTotals.correct / lessonTotals.attempts) * 100)
    : 0;
  const quizTotals = getExercisePracticeTotals(focusLessonId, "quiz");
  const typingTotals = getExercisePracticeTotals(focusLessonId, "typing");
  const grammarTotals = getExercisePracticeTotals(focusLessonId, "grammar");
  const focusItems = getLessonFocusItems(focusLessonId);
  const exerciseSteps = getExerciseStepState(focusLessonId);
  const recommendedExercise = getRecommendedExerciseForLesson(focusLessonId);

  elements.statsTitle.textContent = `Statistics · Step ${lesson.step}`;
  elements.statsCopy.textContent = `${lesson.shortTitle}. ${adaptiveQuestionTarget} adaptive questions per practice session, with extra weight on phrases you miss.`;
  elements.statsFocusPill.textContent = `${focusItems.length} focus item${focusItems.length === 1 ? "" : "s"}`;
  elements.statsCurrentStep.textContent = `${lesson.step} · ${lessonSummary.overall}%`;
  elements.statsTrackList.innerHTML = [
    {
      label: "Study",
      status: lessonSummary.studyComplete ? "Complete" : "In progress",
      copy: `${lessonSummary.learnedCount} / ${lessonSummary.cardsCount} learned`,
      tone: lessonSummary.studyComplete ? "is-complete" : recommendedExercise === "study" ? "is-current" : "is-ready",
    },
    {
      label: "Quiz",
      status: exerciseSteps.quiz.unlocked ? `${lessonSummary.quizBest}% best` : "Locked",
      copy: quizTotals.attempts
        ? `${quizTotals.attempts} quiz attempts · ${quizTotals.wrong} wrong answers`
        : "Adaptive review starts after Step 1 Study is done",
      tone: !exerciseSteps.quiz.unlocked ? "is-locked" : lessonSummary.quizComplete ? "is-complete" : recommendedExercise === "quiz" ? "is-current" : "is-active",
    },
    {
      label: "Typing",
      status: exerciseSteps.typing.unlocked ? `${lessonSummary.typingBest}% best` : "Locked",
      copy: exerciseSteps.typing.unlocked
        ? typingTotals.attempts
          ? `${typingTotals.attempts} typing attempts · ${typingTotals.wrong} wrong answers`
          : `${lessonAccuracy}% lesson accuracy so far`
        : exerciseSteps.typing.requirement,
      tone: !exerciseSteps.typing.unlocked ? "is-locked" : lessonSummary.typingComplete ? "is-complete" : recommendedExercise === "typing" ? "is-current" : "is-active",
    },
    {
      label: "Grammar",
      status: exerciseSteps.grammar.unlocked ? `${lessonSummary.grammarBest}% best` : "Locked",
      copy: exerciseSteps.grammar.unlocked
        ? grammarTotals.attempts
          ? `${grammarTotals.attempts} grammar attempts · ${grammarTotals.wrong} wrong answers`
          : focusItems.length
            ? `Most mistakes are listed below`
            : "No repeated mistakes logged in this step yet"
        : exerciseSteps.grammar.requirement,
      tone: !exerciseSteps.grammar.unlocked ? "is-locked" : lessonSummary.grammarComplete ? "is-complete" : recommendedExercise === "grammar" ? "is-current" : "is-active",
    },
  ]
    .map(
      (item) => `
        <article class="stats-track-row">
          <div>
            <strong>${item.label}</strong>
            <p>${item.copy}</p>
          </div>
          <span class="glass-pill status-pill ${item.tone}">${item.status}</span>
        </article>
      `
    )
    .join("");

  elements.statsFocusList.innerHTML = focusItems.length
    ? focusItems
        .map(
          (item) => `
            <article class="stats-focus-item">
              <strong>${item.entry.bisaya}</strong>
              <p>${item.entry.english}</p>
              <span>${item.wrong} wrong across ${item.exercises.join(" · ")}</span>
            </article>
          `
        )
        .join("")
    : '<div class="stats-empty">No repeated weak spots logged in this step yet. The panel will highlight them once mistakes start clustering.</div>';

  elements.statsRecommendation.textContent = focusItems.length
    ? `Best next focus: Step ${lesson.step} · ${labelForExercise(recommendedExercise)}. Start with "${focusItems[0].entry.bisaya}" because it is causing the most mistakes.`
    : `Best next focus: Step ${lesson.step} · ${labelForExercise(recommendedExercise)}. Keep going and the panel will surface weak spots automatically.`;
}

function difficultyClassName(difficulty) {
  return difficulty.toLowerCase().replace(/\s+/g, "-");
}

function getLessonMeta(lessonId) {
  return (
    lessonLookup.get(lessonId) || {
      id: lessonId,
      shortTitle: lessonId,
      summary: "",
      step: 0,
      difficulty: "Starter",
    }
  );
}

function getPreviousLessonId(lessonId) {
  const index = lessonIndexLookup.get(lessonId);
  if (typeof index !== "number" || index <= 0) {
    return null;
  }

  return orderedLessons[index - 1].id;
}

function getNextLessonId(lessonId) {
  const index = lessonIndexLookup.get(lessonId);
  if (typeof index !== "number" || index >= orderedLessons.length - 1) {
    return null;
  }

  return orderedLessons[index + 1].id;
}

function isLessonFullyCompleted(lessonId) {
  const entries = getEntriesForLesson(lessonId);
  if (!entries.length) {
    return false;
  }

  const learnedCount = entries.filter((entry) => state.learned.has(entry.id)).length;
  const learnedPercent = Math.round((learnedCount / entries.length) * 100);
  const record = getLessonRecord(lessonId);

  return (
    learnedPercent === 100 &&
    record.quizBest === 100 &&
    record.typingBest === 100 &&
    record.grammarBest === 100
  );
}

function isLessonUnlocked(lessonId) {
  const previousLessonId = getPreviousLessonId(lessonId);
  return previousLessonId === null || isLessonFullyCompleted(previousLessonId);
}

function getUnlockedLessonCount() {
  return orderedLessons.filter((lesson) => isLessonUnlocked(lesson.id)).length;
}

function getCurrentPathLesson() {
  return (
    orderedLessons.find(
      (lesson) => isLessonUnlocked(lesson.id) && !isLessonFullyCompleted(lesson.id)
    ) || null
  );
}

function getExerciseStepState(lessonId) {
  const summary = getLessonProgressSummary(lessonId);

  return {
    study: {
      label: "Step 1 Study",
      unlocked: true,
      complete: summary.learnedPercent === 100,
      requirement: "Mark every study card in this lesson as learned.",
    },
    quiz: {
      label: "Step 2 Quiz",
      unlocked: summary.learnedPercent === 100,
      complete: summary.quizBest === 100,
      requirement: "Complete Step 1 Study at 100% first.",
    },
    typing: {
      label: "Step 3 Typing",
      unlocked: summary.learnedPercent === 100 && summary.quizBest === 100,
      complete: summary.typingBest === 100,
      requirement: "Complete Step 2 Quiz at 100% first.",
    },
    grammar: {
      label: "Step 4 Grammar",
      unlocked:
        summary.learnedPercent === 100 &&
        summary.quizBest === 100 &&
        summary.typingBest === 100,
      complete: summary.grammarBest === 100,
      requirement: "Complete Step 3 Typing at 100% first.",
    },
  };
}

function getRecommendedExerciseForLesson(lessonId) {
  const steps = getExerciseStepState(lessonId);

  if (!steps.study.complete) {
    return "study";
  }

  if (!steps.quiz.complete) {
    return "quiz";
  }

  if (!steps.typing.complete) {
    return "typing";
  }

  return "grammar";
}

function getPathStatusLabel(lessonId, overall) {
  if (!isLessonUnlocked(lessonId)) {
    return "Locked";
  }

  if (isLessonFullyCompleted(lessonId)) {
    return "Completed";
  }

  const currentPathLesson = getCurrentPathLesson();
  if (currentPathLesson?.id === lessonId) {
    return overall > 0 ? "In progress" : "Start here";
  }

  if (overall > 0) {
    return "In progress";
  }

  return "Ready";
}

function openLessonWorkspace(lessonId, options = {}) {
  const summary = getLessonProgressSummary(lessonId);
  if (!summary.unlocked) {
    const previousLessonId = getPreviousLessonId(lessonId);
    const previousLesson = previousLessonId ? getLessonMeta(previousLessonId) : null;
    setAppStatus(
      previousLesson
        ? `${lessonLabel(summary.step)} is locked. Finish ${lessonLabel(previousLesson.step)} at 100% in Study, Quiz, Typing, and Grammar first.`
        : "This lesson is still locked."
    );
    return false;
  }

  state.lesson = lessonId;
  state.startedLesson = lessonId;
  state.lessonExercise = getRecommendedExerciseForLesson(lessonId);
  state.lessonQuiz = createEmptyQuizState(state.startedLesson, elements.lessonQuizMode.value);
  state.typingSession = createEmptyPracticeState(state.startedLesson);
  state.grammarSession = createEmptyPracticeState(state.startedLesson);
  Object.values(elements.exercisePanes).forEach((pane) => {
    pane.scrollTop = 0;
  });
  renderLessonWorkspace();
  renderIOSJourneyHeader();
  switchTab("lesson");
  syncIOSStickyTopBarState();

  if (options.setStatus !== false) {
    setAppStatus(
      options.statusMessage ||
        `Opened ${formatLessonHeading(state.startedLesson)}. Continue with ${labelForExercise(
          state.lessonExercise
        )}.`
    );
  }

  return true;
}

function startIOSLearningJourney() {
  const lessonId = getIOSPrimaryLessonId();
  if (!lessonId) {
    return;
  }

  state.iosWelcomeVisible = false;
  state.iosCompletionModal = null;

  if (openLessonWorkspace(lessonId, { setStatus: false })) {
    renderApp();
    setAppStatus(
      `${formatLessonHeading(lessonId)} is ready. Start with Study and complete all four parts to unlock the next lesson.`
    );
  }
}

function dismissIOSCompletionModal() {
  state.iosCompletionModal = null;
  renderApp();
}

function openNextIOSLesson() {
  const nextLessonId = state.iosCompletionModal?.nextLessonId;
  state.iosCompletionModal = null;

  if (!nextLessonId) {
    renderApp();
    return;
  }

  if (openLessonWorkspace(nextLessonId, { setStatus: false })) {
    renderApp();
    setAppStatus(`${formatLessonHeading(nextLessonId)} is unlocked and ready.`);
  }
}

function startCurrentPathLesson() {
  const currentPathLesson = getCurrentPathLesson();
  if (!currentPathLesson) {
    setAppStatus("Every lesson in the path is complete.");
    return;
  }

  state.lesson = currentPathLesson.id;
  openLessonWorkspace(currentPathLesson.id);
}

function renderPathPanel() {
  const currentPathLesson = getCurrentPathLesson();
  const pathCards = {
    study: elements.pathStudyState.closest(".path-check"),
    quiz: elements.pathQuizState.closest(".path-check"),
    typing: elements.pathTypingState.closest(".path-check"),
    grammar: elements.pathGrammarState.closest(".path-check"),
  };

  if (!currentPathLesson) {
    elements.pathTitle.textContent = "All steps complete";
    elements.pathCopy.textContent =
      "You finished the full Bisaya path. Review any lesson whenever you want.";
    elements.pathStepPill.textContent = `${orderedLessons.length} / ${orderedLessons.length} steps`;
    elements.pathDifficulty.textContent = "Completed";
    elements.pathDifficulty.className = "difficulty-tag complete";
    elements.pathStudyState.textContent = "Complete. Every study card in the course is learned.";
    elements.pathQuizState.textContent = "Complete. Every quiz step reached 100%.";
    elements.pathTypingState.textContent = "Complete. Every typing step reached 100%.";
    elements.pathGrammarState.textContent = "Complete. Every grammar step reached 100%.";
    elements.pathStartButton.disabled = true;
    elements.pathStartButton.textContent = "All steps complete";
    elements.pathFootnote.textContent =
      "The learning path is finished. Use the sidebar to review any step.";

    Object.values(pathCards).forEach((card) => {
      if (card) {
        card.className = "path-check is-complete";
      }
    });
    return;
  }

  const summary = getLessonProgressSummary(currentPathLesson.id);
  const exerciseSteps = getExerciseStepState(currentPathLesson.id);
  const recommendedExercise = getRecommendedExerciseForLesson(currentPathLesson.id);
  const nextLessonId = getNextLessonId(currentPathLesson.id);
  const nextLesson = nextLessonId ? getLessonMeta(nextLessonId) : null;

  elements.pathTitle.textContent = `Step ${summary.step} · ${currentPathLesson.shortTitle}`;
  elements.pathCopy.textContent =
    currentPathLesson.summary ||
    "Move in order through Study, Quiz, Typing, and Grammar so the phrases settle in gently.";
  elements.pathStepPill.textContent = `Step ${summary.step} of ${orderedLessons.length}`;
  elements.pathDifficulty.textContent = summary.difficulty;
  elements.pathDifficulty.className = `difficulty-tag ${difficultyClassName(summary.difficulty)}`;
  elements.pathStudyState.textContent = summary.studyComplete
    ? `Complete. ${summary.cardsCount} of ${summary.cardsCount} cards are marked learned.`
    : `${summary.learnedCount} of ${summary.cardsCount} cards are marked learned so far.`;
  elements.pathQuizState.textContent = !exerciseSteps.quiz.unlocked
    ? exerciseSteps.quiz.requirement
    : summary.quizComplete
      ? "Complete. Quiz best score is 100%."
      : `Best quiz score: ${summary.quizBest}%. Reach 100% to continue.`;
  elements.pathTypingState.textContent = !exerciseSteps.typing.unlocked
    ? exerciseSteps.typing.requirement
    : summary.typingComplete
      ? "Complete. Typing best score is 100%."
      : `Best typing score: ${summary.typingBest}%. Reach 100% to continue.`;
  elements.pathGrammarState.textContent = !exerciseSteps.grammar.unlocked
    ? exerciseSteps.grammar.requirement
    : summary.grammarComplete
      ? "Complete. This lesson unlocked the next step."
      : `Best grammar score: ${summary.grammarBest}%. Reach 100% to unlock the next lesson.`;
  elements.pathStartButton.disabled = false;
  elements.pathStartButton.textContent =
    summary.overall > 0 ? `Continue Step ${summary.step}` : `Start Step ${summary.step}`;
  elements.pathFootnote.textContent = nextLesson
    ? `Step ${nextLesson.step} · ${nextLesson.shortTitle} stays locked until all four parts here reach 100%.`
    : "This is the final lesson in the path. Finish all four parts here to complete the course.";

  Object.entries(pathCards).forEach(([key, card]) => {
    if (!card) {
      return;
    }

    const stepState = exerciseSteps[key];
    let className = "path-check";

    if (stepState.complete) {
      className += " is-complete";
    } else if (!stepState.unlocked) {
      className += " is-locked";
    } else if (recommendedExercise === key) {
      className += " is-current";
    }

    card.className = className;
  });
}

function renderLessonList() {
  elements.lessonList.innerHTML = [
    createLessonButton({
      id: "All lessons",
      shortTitle: "Path overview",
      summary: "Browse every unlocked lesson card and follow the guided route.",
    }),
    ...orderedLessons.map((lesson) => createLessonButton(lesson)),
  ].join("");
}

function createLessonButton(lesson) {
  if (lesson.id === "All lessons") {
    const active = state.lesson === lesson.id;
    const currentPathLesson = getCurrentPathLesson();

    return `
      <button
        class="lesson-item ${active ? "is-active" : ""}"
        type="button"
        data-lesson="${lesson.id}"
      >
        <span class="lesson-card-top">
          <span class="lesson-step-badge">Overview</span>
          <span class="lesson-status-tag is-current">Current path</span>
        </span>
        <span class="lesson-title">${lesson.shortTitle}</span>
        <span class="lesson-summary">${lesson.summary}</span>
        <span class="lesson-meta-line">${
          currentPathLesson
            ? `Start with Step ${currentPathLesson.step} · ${currentPathLesson.shortTitle}`
            : "Course path complete"
        }</span>
      </button>
    `;
  }

  const active = lesson.id === state.lesson;
  const progress = getLessonProgressSummary(lesson.id);
  const locked = !progress.unlocked;
  const statusClass = statusClassName(progress.status);
  const metaLine = locked
    ? `Unlock after Step ${Math.max(lesson.step - 1, 1)} reaches 100% in all four parts.`
    : progress.completed
      ? "100% complete. The next lesson is unlocked."
      : `Study ${progress.learnedPercent}% · Quiz ${progress.quizBest}% · Typing ${progress.typingBest}% · Grammar ${progress.grammarBest}%`;

  return `
    <button
      class="lesson-item ${active ? "is-active" : ""} ${locked ? "is-locked" : ""}"
      type="button"
      data-lesson="${lesson.id}"
      ${locked ? "disabled" : ""}
    >
      <span class="lesson-card-top">
        <span class="lesson-step-badge">Step ${lesson.step}</span>
        <span class="difficulty-tag ${difficultyClassName(lesson.difficulty)}">${lesson.difficulty}</span>
      </span>
      <span class="lesson-title-row">
        <span class="lesson-title">${lesson.shortTitle}</span>
        <span class="lesson-status-tag ${statusClass}">
          ${
            locked
              ? '<span class="lesson-lock" aria-hidden="true"></span>Locked'
              : progress.status
          }
        </span>
      </span>
      <span class="lesson-summary">${lesson.summary}</span>
      <span class="lesson-meta-line">${metaLine}</span>
    </button>
  `;
}

function renderCategoryList() {
  const categories = [
    "All categories",
    ...new Set(
      getScopedEntries({ includeSearch: false, includeCategoryFilter: false }).map(
        (entry) => entry.category
      )
    ),
  ];
  elements.categoryList.innerHTML = categories
    .map((category) => {
      const active = category === state.category;
      return `
        <button
          class="chip ${active ? "is-active" : ""}"
          type="button"
          data-category="${category}"
        >
          ${category}
        </button>
      `;
    })
    .join("");
}

function switchTab(tabName) {
  state.tab = tabName;

  elements.tabs.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === tabName);
  });

  Object.entries(elements.views).forEach(([name, view]) => {
    view.classList.toggle("is-active", name === tabName);
  });

  syncIOSStickyTopBarState();
}

function switchLessonExercise(exerciseName) {
  if (state.startedLesson) {
    const exerciseSteps = getExerciseStepState(state.startedLesson);
    const selectedStep = exerciseSteps[exerciseName];

    if (selectedStep && !selectedStep.unlocked) {
      state.lessonExercise = getRecommendedExerciseForLesson(state.startedLesson);
      renderLessonExerciseState();
      setAppStatus(selectedStep.requirement);
      return;
    }
  }

  state.lessonExercise = exerciseName;
  renderLessonExerciseState();
}

function openPracticeFromStudy(exerciseName) {
  if (!state.startedLesson) {
    setAppStatus("Start a step first.");
    return;
  }

  switchLessonExercise(exerciseName);
  setAppStatus(
    `Opened ${labelForExercise(exerciseName)} for ${
      getLessonMeta(state.startedLesson).shortTitle || state.startedLesson
    }.`
  );
}

function renderLessonExerciseState() {
  const exerciseSteps = state.startedLesson
    ? getExerciseStepState(state.startedLesson)
    : null;

  if (exerciseSteps && !exerciseSteps[state.lessonExercise]?.unlocked) {
    state.lessonExercise = getRecommendedExerciseForLesson(state.startedLesson);
  }

  elements.exerciseTabs.forEach((button) => {
    const exerciseName = button.dataset.exercise;
    const stepState = exerciseSteps?.[exerciseName];

    button.classList.toggle("is-active", exerciseName === state.lessonExercise);
    button.classList.toggle("is-complete", Boolean(stepState?.complete));
    button.classList.toggle("is-locked", Boolean(stepState && !stepState.unlocked));
    button.disabled = Boolean(stepState && !stepState.unlocked);
    button.title = stepState
      ? stepState.unlocked
        ? stepState.complete
          ? `${stepState.label} complete`
          : `Open ${stepState.label}`
        : stepState.requirement
      : "";
  });

  Object.entries(elements.exercisePanes).forEach(([name, pane]) => {
    pane.classList.toggle("is-active", name === state.lessonExercise);
  });

  syncIOSStickyTopBarState();
}

function syncHeaderStats() {
  const visibleEntries = getVisibleEntries();
  const totalLessons = orderedLessons.length;

  elements.lessonCount.textContent = `${getUnlockedLessonCount()} / ${totalLessons}`;
  elements.cardCount.textContent = String(visibleEntries.length);
  elements.learnedCount.textContent = String(state.learned.size);
  elements.bestScore.textContent = `${state.bestQuiz}%`;
  elements.activeCount.textContent = `${visibleEntries.length} visible cards`;
}

function syncScopeLabels() {
  elements.activeLesson.textContent = state.lesson;
  elements.activeCategory.textContent = state.category;

  if (state.lesson !== "All lessons") {
    const lesson = getLessonMeta(state.lesson);
    elements.studyTitle.textContent = `Step ${lesson.step} · ${lesson.shortTitle}`;
    elements.studySummary.textContent =
      lesson.summary ||
      "Use the cards below to study the current lesson with audio and pronunciation.";
    return;
  }

  if (state.category !== "All categories") {
    elements.studyTitle.textContent = `${state.category} deck`;
    elements.studySummary.textContent = `Browse all ${state.category.toLowerCase()} phrases across the full course.`;
    return;
  }

  elements.studyTitle.textContent = "Browse the full course deck";
  elements.studySummary.textContent =
    "Follow the learning path from Step 1 onward, or browse unlocked lesson cards below.";
}

function renderCourseHero() {
  const hasSelectedLesson = state.lesson !== "All lessons";
  if (!hasSelectedLesson) {
    const currentPathLesson = getCurrentPathLesson();

    if (!currentPathLesson) {
      elements.selectedLessonStatus.textContent = "Course complete";
      elements.selectedLessonStatus.className = "glass-pill status-pill is-complete";
      elements.selectedLessonProgress.textContent = `All ${orderedLessons.length} steps complete`;
      elements.startSelectedLesson.disabled = true;
      elements.startSelectedLesson.textContent = "All steps complete";
      return;
    }

    const summary = getLessonProgressSummary(currentPathLesson.id);

    elements.selectedLessonStatus.textContent = summary.status;
    elements.selectedLessonStatus.className = `glass-pill status-pill ${statusClassName(summary.status)}`;
    elements.selectedLessonProgress.textContent = `Step ${currentPathLesson.step} of ${orderedLessons.length} · ${summary.overall}% complete`;
    elements.startSelectedLesson.disabled = false;
    elements.startSelectedLesson.textContent =
      summary.overall > 0 ? `Continue Step ${currentPathLesson.step}` : `Start Step ${currentPathLesson.step}`;
    return;
  }

  const progress = getLessonProgressSummary(state.lesson);
  if (!progress.unlocked) {
    const previousLesson = getLessonMeta(getPreviousLessonId(state.lesson));
    elements.selectedLessonStatus.textContent = "Locked";
    elements.selectedLessonStatus.className = "glass-pill status-pill is-locked";
    elements.selectedLessonProgress.textContent = `Finish Step ${previousLesson.step} first`;
    elements.startSelectedLesson.disabled = true;
    elements.startSelectedLesson.textContent = `Locked until Step ${previousLesson.step} is 100%`;
    return;
  }

  elements.selectedLessonStatus.textContent = progress.status;
  elements.selectedLessonStatus.className = `glass-pill status-pill ${statusClassName(progress.status)}`;
  elements.selectedLessonProgress.textContent = `Step ${progress.step} · ${progress.overall}% complete`;
  elements.startSelectedLesson.disabled = false;
  elements.startSelectedLesson.textContent = progress.completed
    ? `Review Step ${progress.step}`
    : progress.overall > 0
      ? `Continue Step ${progress.step}`
      : `Start Step ${progress.step}`;
}

function getScopedEntries(options = {}) {
  const {
    includeSearch = true,
    includeCategoryFilter = true,
    includeLessonFilter = true,
  } = options;

  return lessonEntries.filter((entry) => {
    if (!isLessonUnlocked(entry.lesson)) {
      return false;
    }

    const lessonMatch =
      !includeLessonFilter ||
      state.lesson === "All lessons" ||
      entry.lesson === state.lesson;
    const categoryMatch =
      !includeCategoryFilter ||
      state.category === "All categories" ||
      entry.category === state.category;
    const haystack = [
      entry.bisaya,
      entry.english,
      entry.pronunciation,
      entry.lesson,
      entry.category,
    ]
      .join(" ")
      .toLowerCase();
    const searchMatch = !includeSearch || !state.search || haystack.includes(state.search);
    return lessonMatch && categoryMatch && searchMatch;
  });
}

function getVisibleEntries() {
  return getScopedEntries();
}

function getEntriesForLesson(lessonId) {
  return lessonEntries.filter((entry) => entry.lesson === lessonId);
}

function renderCourseCards() {
  const entries = getVisibleEntries();
  elements.emptyState.hidden = entries.length > 0;
  renderCardSet(elements.cardGrid, entries);
}

function renderCardSet(container, entries) {
  container.innerHTML = entries
    .map((entry) => createCardMarkup(entry))
    .join("");
}

function createCardMarkup(entry) {
  const learned = state.learned.has(entry.id);
  const lesson = getLessonMeta(entry.lesson);
  return `
    <article class="study-card">
      <div class="card-top">
        <div>
          <h3 class="card-bisaya">${entry.bisaya}</h3>
          <p class="card-english">${entry.english}</p>
        </div>
        <button
          class="learn-button ${learned ? "is-on" : ""}"
          type="button"
          data-action="toggle-learned"
          data-id="${entry.id}"
        >
          ${learned ? "Learned" : "Mark learned"}
        </button>
      </div>
      <p class="card-pronunciation">Pronunciation: ${entry.pronunciation}</p>
      <div class="card-meta">
        <span class="meta-chip">Step ${lesson.step}</span>
        <span class="difficulty-tag ${difficultyClassName(lesson.difficulty)}">${lesson.difficulty}</span>
        <span class="meta-chip">${entry.category}</span>
      </div>
      <div class="card-actions">
        <button
          class="sound-button"
          type="button"
          data-action="play-audio"
          data-id="${entry.id}"
        >
          Play audio
        </button>
      </div>
    </article>
  `;
}

function toggleLearned(entryId) {
  if (state.learned.has(entryId)) {
    state.learned.delete(entryId);
  } else {
    state.learned.add(entryId);
  }

  writeJSON(storageKeys.learned, Array.from(state.learned));
}

async function playEntryAudio(entry) {
  logNative("info", `Audio requested for ${entry.id}`);

  if (playNativeAudio(entry)) {
    setAppStatus(`Playing ${entry.bisaya}.`);
    return;
  }

  if (entry.audio) {
    const audio = new Audio(entry.audio);
    audio.preload = "auto";

    try {
      await audio.play();
      setAppStatus(`Playing ${entry.bisaya}.`);
      return;
    } catch (error) {
      logNative("warning", `HTML audio failed for ${entry.id}: ${formatError(error)}`);
      // Fall through to browser speech synthesis.
    }
  }

  speakFallback(entry);
}

function playNativeAudio(entry) {
  try {
    if (!nativeAppShell || !window.BisayaBuddyNative?.playAudio) {
      return false;
    }

    window.BisayaBuddyNative.playAudio({
      id: entry.id,
      bisaya: entry.bisaya,
      tts: entry.tts,
      audio: entry.audio || "",
    });
    return true;
  } catch (error) {
    logNative("error", `Native audio bridge failed for ${entry.id}: ${formatError(error)}`);
    return false;
  }
}

function speakFallback(entry) {
  if (!("speechSynthesis" in window)) {
    setAppStatus("Audio playback is not available in this browser.");
    return;
  }

  const utterance = new SpeechSynthesisUtterance(entry.tts);
  utterance.lang = "en-US";
  utterance.rate = 0.85;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  setAppStatus(`Speaking ${entry.bisaya}.`);
}

function startSelectedLesson() {
  let lessonId = state.lesson;

  if (lessonId === "All lessons") {
    const currentPathLesson = getCurrentPathLesson();
    if (!currentPathLesson) {
      setAppStatus("Every lesson in the path is already complete.");
      return;
    }

    lessonId = currentPathLesson.id;
    state.lesson = lessonId;
  }

  openLessonWorkspace(lessonId);
}

function renderLessonWorkspace() {
  const lessonId = state.startedLesson;
  const hasLesson = Boolean(lessonId && lessonId !== "All lessons");
  const lessonUnit = isNativeIOSApp() ? "Lesson" : "Step";

  elements.lessonEmpty.hidden = hasLesson;
  elements.lessonBody.hidden = !hasLesson;
  renderLessonExerciseState();

  if (!hasLesson) {
    elements.lessonTitle.textContent = `Choose a ${lessonUnit.toLowerCase()} and press start`;
    elements.lessonSummary.textContent =
      `Each ${lessonUnit.toLowerCase()} opens its own calm workspace. Move in order through Study, Quiz, Typing, and Grammar.`;
    elements.lessonStatus.textContent = "Not started";
    elements.lessonStatus.className = "glass-pill status-pill is-ready";
    elements.backToCourse.hidden = Boolean(isNativeIOSApp());
    elements.backToCourse.textContent = "Back to course";
    elements.lessonProgressText.textContent = "0% complete";
    elements.lessonProgressBar.style.width = "0%";
    elements.lessonCardsCount.textContent = "0";
    elements.lessonLearnedCount.textContent = "0%";
    elements.lessonQuizBest.textContent = "0%";
    elements.lessonTypingBest.textContent = "0%";
    elements.lessonGrammarBest.textContent = "0%";
    elements.lessonStudyGrid.innerHTML = "";
    renderStudyNextPanel();
    renderLessonQuizCard();
    renderTypingPractice();
    renderGrammarPractice();
    return;
  }

  const lesson = getLessonMeta(lessonId);
  const entries = getEntriesForLesson(lessonId);
  const summary = getLessonProgressSummary(lessonId);
  const nextLessonId = getNextLessonId(lessonId);
  const nextLesson = nextLessonId ? getLessonMeta(nextLessonId) : null;
  const progressionCopy = summary.completed
    ? nextLesson
      ? `${lessonLabel(nextLesson.step)} is now unlocked.`
      : "You completed the full course."
    : `Finish Study, Quiz, Typing, and Grammar at 100% to unlock ${
        nextLesson ? lessonLabel(nextLesson.step) : "the end of the course"
      }.`;

  elements.lessonTitle.textContent = `${lessonUnit} ${summary.step} · ${lesson.shortTitle}`;
  elements.lessonSummary.textContent = [lesson.summary, progressionCopy]
    .filter(Boolean)
    .join(" ");
  elements.lessonStatus.textContent = summary.status;
  elements.lessonStatus.className = `glass-pill status-pill ${statusClassName(summary.status)}`;
  elements.backToCourse.hidden = isNativeIOSApp()
    ? !(summary.completed && nextLesson)
    : false;
  elements.backToCourse.textContent =
    isNativeIOSApp() && summary.completed && nextLesson
      ? `Get to ${lessonLabel(nextLesson.step)}`
      : "Back to course";
  elements.lessonProgressText.textContent = `${summary.overall}% complete`;
  elements.lessonProgressBar.style.width = `${summary.overall}%`;
  elements.lessonCardsCount.textContent = `${summary.step} / ${orderedLessons.length}`;
  elements.lessonLearnedCount.textContent = `${summary.learnedPercent}%`;
  elements.lessonQuizBest.textContent = `${summary.quizBest}%`;
  elements.lessonTypingBest.textContent = `${summary.typingBest}%`;
  elements.lessonGrammarBest.textContent = `${summary.grammarBest}%`;

  renderCardSet(elements.lessonStudyGrid, entries);
  renderStudyNextPanel(summary);
  renderLessonQuizCard();
  renderTypingPractice();
  renderGrammarPractice();
}

function getLessonRecord(lessonId) {
  return state.lessonProgress[lessonId] || {
    quizBest: 0,
    typingBest: 0,
    grammarBest: 0,
  };
}

function getLessonProgressSummary(lessonId) {
  const lesson = getLessonMeta(lessonId);
  const entries = getEntriesForLesson(lessonId);
  const learnedCount = entries.filter((entry) => state.learned.has(entry.id)).length;
  const learnedPercent = entries.length
    ? Math.round((learnedCount / entries.length) * 100)
    : 0;
  const record = getLessonRecord(lessonId);
  const unlocked = isLessonUnlocked(lessonId);
  const studyComplete = entries.length > 0 && learnedPercent === 100;
  const quizComplete = record.quizBest === 100;
  const typingComplete = record.typingBest === 100;
  const grammarComplete = record.grammarBest === 100;
  const completed = studyComplete && quizComplete && typingComplete && grammarComplete;
  const overall = Math.round(
    (learnedPercent + record.quizBest + record.typingBest + record.grammarBest) / 4
  );

  return {
    id: lessonId,
    step: lesson.step,
    difficulty: lesson.difficulty,
    cardsCount: entries.length,
    learnedCount,
    learnedPercent,
    quizBest: record.quizBest,
    typingBest: record.typingBest,
    grammarBest: record.grammarBest,
    unlocked,
    studyComplete,
    quizComplete,
    typingComplete,
    grammarComplete,
    completed,
    overall,
    status: deriveLessonStatus(lessonId, overall, unlocked, completed),
  };
}

function isLessonPracticeUnlocked(summary) {
  if (!summary) {
    return false;
  }

  return summary.studyComplete;
}

function renderStudyNextPanel(summary = null) {
  if (!summary) {
    elements.studyNextTitle.textContent = "Finish Step 1 Study to unlock Step 2 Quiz.";
    elements.studyNextCopy.textContent =
      "Once a step is active, this area shows exactly which part comes next and what still needs to reach 100%.";
    elements.studyNextPill.textContent = "0 / 4 parts complete";
    elements.studyNavButtons.forEach((button) => {
      button.disabled = true;
      button.title = "Start a step first.";
    });
    return;
  }

  const exerciseSteps = getExerciseStepState(summary.id);
  const completedParts = [
    summary.studyComplete,
    summary.quizComplete,
    summary.typingComplete,
    summary.grammarComplete,
  ].filter(Boolean).length;
  const nextLessonId = getNextLessonId(summary.id);
  const nextLesson = nextLessonId ? getLessonMeta(nextLessonId) : null;

  if (summary.completed) {
    elements.studyNextTitle.textContent = nextLesson
      ? `Step ${summary.step} complete. Step ${nextLesson.step} is now unlocked.`
      : "Every step in the course is complete.";
    elements.studyNextCopy.textContent = nextLesson
      ? `You can review this lesson at any time, or go back and start Step ${nextLesson.step} · ${nextLesson.shortTitle}.`
      : "You can review any part of this lesson whenever you want.";
  } else if (!summary.studyComplete) {
    const remaining = Math.max(summary.cardsCount - summary.learnedCount, 0);
    elements.studyNextTitle.textContent = "Finish Step 1 Study first.";
    elements.studyNextCopy.textContent = `${
      summary.learnedCount
    } of ${summary.cardsCount} cards are marked as learned. Mark the remaining ${remaining} ${
      remaining === 1 ? "card" : "cards"
    } to unlock Step 2 Quiz.`;
  } else if (!summary.quizComplete) {
    elements.studyNextTitle.textContent = "Step 2 Quiz is unlocked.";
    elements.studyNextCopy.textContent =
      summary.quizBest > 0
        ? `Your best quiz score is ${summary.quizBest}%. Reach 100% to unlock Step 3 Typing.`
        : "Use the quiz to repeat meanings in context. Reach 100% to unlock Step 3 Typing.";
  } else if (!summary.typingComplete) {
    elements.studyNextTitle.textContent = "Step 3 Typing is unlocked.";
    elements.studyNextCopy.textContent =
      summary.typingBest > 0
        ? `Your best typing score is ${summary.typingBest}%. Reach 100% to unlock Step 4 Grammar.`
        : "Type the phrases exactly so they settle in your memory. Reach 100% to unlock Step 4 Grammar.";
  } else {
    elements.studyNextTitle.textContent = "Step 4 Grammar is unlocked.";
    elements.studyNextCopy.textContent =
      summary.grammarBest > 0
        ? `Your best grammar score is ${summary.grammarBest}%. Reach 100% to unlock the next lesson.`
        : "Finish the last practice step at 100% to unlock the next lesson.";
  }

  elements.studyNextPill.textContent = `${completedParts} / 4 parts complete`;
  elements.studyNavButtons.forEach((button) => {
    const stepState = exerciseSteps[button.dataset.exercise];
    button.disabled = !stepState?.unlocked;
    button.title = stepState?.unlocked
      ? stepState.complete
        ? `Review ${stepState.label}`
        : `Open ${stepState.label}`
      : stepState?.requirement || "This step is still locked.";
  });
}

function deriveLessonStatus(lessonId, overall, unlocked, completed) {
  if (!unlocked) {
    return "Locked";
  }

  if (completed) {
    return "Completed";
  }

  const currentPathLesson = getCurrentPathLesson();
  if (currentPathLesson?.id === lessonId) {
    return overall > 0 ? "In progress" : "Start here";
  }

  if (overall > 0) {
    return "In progress";
  }

  return "Ready";
}

function statusClassName(status) {
  if (status === "Completed" || status === "Course complete") {
    return "is-complete";
  }

  if (status === "Start here") {
    return "is-current";
  }

  if (status === "In progress") {
    return "is-active";
  }

  if (status === "Locked") {
    return "is-locked";
  }

  return "is-ready";
}

function labelForExercise(exerciseName) {
  if (exerciseName === "study") {
    return "Study";
  }

  if (exerciseName === "quiz") {
    return "Quiz";
  }

  if (exerciseName === "typing") {
    return "Typing";
  }

  if (exerciseName === "grammar") {
    return "Grammar";
  }

  return "practice";
}

function takeReviewEntry(session, pool, recentWindow = 1) {
  if (!session.reviewQueue.length) {
    return null;
  }

  const blockedIds = new Set(session.recentIds.slice(-recentWindow));
  let queueIndex = session.reviewQueue.findIndex((entryId) => !blockedIds.has(entryId));

  if (queueIndex === -1) {
    queueIndex = 0;
  }

  const [entryId] = session.reviewQueue.splice(queueIndex, 1);
  return pool.find((entry) => entry.id === entryId) || null;
}

function recordExposure(session, entryId) {
  const nextExposure = (session.exposureCounts[entryId] || 0) + 1;
  session.exposureCounts[entryId] = nextExposure;
  return nextExposure;
}

function queueReviewEntry(session, entryId, options = {}) {
  const exposureGoal = options.exposureGoal || session.repeatGoal;
  const currentExposure = session.exposureCounts[entryId] || 0;

  if (currentExposure >= exposureGoal || session.reviewQueue.includes(entryId)) {
    return;
  }

  if (options.urgent) {
    session.reviewQueue.unshift(entryId);
    return;
  }

  session.reviewQueue.push(entryId);
}

function scheduleFollowUpReview(session, entryId, correct) {
  queueReviewEntry(session, entryId, {
    exposureGoal: correct ? session.repeatGoal : session.repeatGoal + 1,
    urgent: !correct,
  });
}

function buildRepeatCoachCopy(exposure, firstRoundText, repeatRoundText) {
  if (exposure > 1) {
    return repeatRoundText.replace("{round}", String(exposure));
  }

  return firstRoundText;
}

function buildEntryContext(entry) {
  const english = entry.english.toLowerCase();

  if (english.includes("good morning") || english.includes("good afternoon") || english.includes("good evening")) {
    return "you are greeting someone warmly at the start of a conversation";
  }

  if (english.includes("how are you") || english.includes("i am okay") || english.includes("i am happy")) {
    return "you are in a light check-in chat and want to sound natural";
  }

  if (english.includes("my name is") || english.includes("i am from") || english.includes("and you")) {
    return "you are introducing yourself to someone new";
  }

  if (english.includes("where") || english.includes("bathroom") || english.includes("hotel") || english.includes("taxi")) {
    return "you need quick travel help while moving around Cebu";
  }

  if (english.includes("how much") || english.includes("fare") || english.includes("expensive") || english.includes("cheap")) {
    return "you are checking a price before buying or riding";
  }

  if (english.includes("water") || english.includes("order") || english.includes("delicious") || english.includes("eat")) {
    return "you are at a restaurant or table and need this phrase naturally";
  }

  if (english.includes("tomorrow") || english.includes("tonight") || english.includes("later") || english.includes("meet")) {
    return "you are making plans in chat or on a call";
  }

  if (english.includes("i miss you") || english.includes("i love you") || english.includes("beautiful") || english.includes("handsome") || english.includes("smile")) {
    return "you are sending a sweet text or voice note";
  }

  if (english.includes("take care") || english.includes("rest") || english.includes("eat well") || english.includes("message")) {
    return "you are caring for someone in a kind, natural way";
  }

  if (entry.category === "Travel") {
    return "you are out in the city and need to say this quickly";
  }

  if (entry.category === "Romance") {
    return "you are speaking softly in a romantic conversation";
  }

  if (entry.category === "Grammar") {
    return "you want to sound more natural in a real conversation";
  }

  if (entry.category === "Conversation") {
    return "you are in an everyday chat and want a smooth, simple phrase";
  }

  return "you are in a real conversation and want to use this phrase at the right moment";
}

function updateLessonRecord(lessonId, patch) {
  const current = getLessonRecord(lessonId);
  const next = { ...current, ...patch };
  state.lessonProgress = {
    ...state.lessonProgress,
    [lessonId]: next,
  };

  if (typeof patch.quizBest === "number") {
    state.bestQuiz = Math.max(state.bestQuiz, patch.quizBest);
    writeJSON(storageKeys.bestQuiz, state.bestQuiz);
  }

  writeJSON(storageKeys.lessonProgress, state.lessonProgress);
}

function getLessonQuizPool() {
  if (!state.startedLesson) {
    return [];
  }

  return getEntriesForLesson(state.startedLesson);
}

function startLessonQuiz() {
  if (!state.startedLesson) {
    setAppStatus("Start a step first.");
    return;
  }

  const quizStep = getExerciseStepState(state.startedLesson).quiz;
  if (!quizStep.unlocked) {
    elements.lessonQuizFeedback.textContent = quizStep.requirement;
    elements.lessonQuizFeedback.className = "quiz-feedback error";
    setAppStatus(quizStep.requirement);
    return;
  }

  const pool = getLessonQuizPool();

  if (pool.length < 4) {
    elements.lessonQuizFeedback.textContent =
      "This lesson needs at least 4 phrases before the quiz can start.";
    elements.lessonQuizFeedback.className = "quiz-feedback error";
    return;
  }

  state.lessonQuiz = createEmptyQuizState(
    state.startedLesson,
    elements.lessonQuizMode.value
  );
  nextLessonQuizQuestion();
}

function nextLessonQuizQuestion() {
  const pool = getLessonQuizPool();
  const mode = quizModes[state.lessonQuiz.mode];
  const entry = pickAdaptiveEntry(state.lessonQuiz, pool, "quiz", 2);
  const options = shuffleArray([
    entry,
    ...pickDistractors(pool, entry.id, 3),
  ]).map((option) => ({
    id: option.id,
    label: mode.answerLabel(option),
  }));
  const exposure = recordExposure(state.lessonQuiz, entry.id);

  state.lessonQuiz.current = { entry, options, exposure };
  state.lessonQuiz.answered = false;
  state.lessonQuiz.questionNumber += 1;
  state.lessonQuiz.recentIds = [...state.lessonQuiz.recentIds.slice(-5), entry.id];

  renderLessonQuizCard();

  if (mode.useAudio) {
    playEntryAudio(entry);
  }
}

function renderLessonQuizCard() {
  const quiz = state.lessonQuiz;
  const mode = quizModes[quiz.mode] || quizModes.bisayaToEnglish;

  elements.lessonQuizProgress.textContent = `${quiz.questionNumber} / ${quiz.totalQuestions}`;
  elements.lessonQuizScore.textContent = String(quiz.score);
  elements.lessonQuizAudioWrap.hidden = true;
  elements.lessonQuizFeedback.className = "quiz-feedback";

  if (!state.startedLesson) {
    elements.lessonQuizPrompt.textContent = "Choose a step to start.";
    elements.lessonQuizHelper.textContent =
      "Lesson quizzes stay inside the dedicated step workspace.";
    elements.lessonQuizOptions.innerHTML = "";
    elements.lessonQuizFeedback.textContent = "";
    elements.lessonStartQuiz.hidden = false;
    elements.lessonStartQuiz.textContent = "Start quiz";
    elements.lessonNextQuestion.hidden = true;
    return;
  }

  if (quiz.completed) {
    elements.lessonQuizPrompt.textContent = `Quiz finished. Final score: ${quiz.finalPercent}%`;
    elements.lessonQuizHelper.textContent =
      quiz.finalPercent >= 100
        ? "Perfect. Step 3 Typing is now unlocked."
        : "Start again and reach 100% to unlock Step 3 Typing.";
    elements.lessonQuizOptions.innerHTML = "";
    elements.lessonQuizFeedback.textContent = "";
    elements.lessonStartQuiz.hidden = false;
    elements.lessonStartQuiz.textContent = "Play again";
    elements.lessonNextQuestion.hidden = true;
    return;
  }

  if (!quiz.current) {
    elements.lessonQuizPrompt.textContent = "Choose a quiz mode to begin.";
    elements.lessonQuizHelper.textContent =
      `This quiz uses ${quiz.totalQuestions} adaptive questions, repeats phrases to help them stick, and needs 100% to unlock Step 3 Typing.`;
    elements.lessonQuizOptions.innerHTML = "";
    elements.lessonQuizFeedback.textContent = "";
    elements.lessonStartQuiz.hidden = false;
    elements.lessonStartQuiz.textContent = "Start quiz";
    elements.lessonNextQuestion.hidden = true;
    return;
  }

  const { entry, options } = quiz.current;
  const repeatCoach = buildRepeatCoachCopy(
    quiz.current.exposure,
    "First round. This phrase comes back later so you can repeat it.",
    "Repeat round {round}. Say the phrase aloud again before you answer."
  );
  const contextCoach = `Context: Imagine ${buildEntryContext(entry)}.`;
  elements.lessonQuizPrompt.textContent = mode.prompt(entry);
  elements.lessonQuizHelper.textContent = `${mode.kicker} ${mode.helper(entry)} ${contextCoach} ${repeatCoach}`;
  elements.lessonQuizAudioWrap.hidden = !mode.useAudio;
  elements.lessonStartQuiz.hidden = true;
  elements.lessonNextQuestion.hidden = true;
  elements.lessonQuizFeedback.textContent = "";
  elements.lessonQuizOptions.innerHTML = options
    .map(
      (option) => `
        <button
          class="choice-button"
          type="button"
          data-choice-id="${option.id}"
        >
          ${option.label}
        </button>
      `
    )
    .join("");

  elements.lessonQuizOptions.querySelectorAll(".choice-button").forEach((button) => {
    button.addEventListener("click", () => gradeLessonQuizAnswer(button.dataset.choiceId));
  });
}

function gradeLessonQuizAnswer(choiceId) {
  if (state.lessonQuiz.answered || !state.lessonQuiz.current) {
    return;
  }

  state.lessonQuiz.answered = true;
  const correctId = state.lessonQuiz.current.entry.id;
  const buttons = Array.from(
    elements.lessonQuizOptions.querySelectorAll(".choice-button")
  );
  const correctButton = buttons.find(
    (button) => button.dataset.choiceId === correctId
  );
  const selectedButton = buttons.find(
    (button) => button.dataset.choiceId === choiceId
  );

  buttons.forEach((button) => {
    button.disabled = true;
  });

  if (correctButton) {
    correctButton.classList.add("is-correct");
  }

  scheduleFollowUpReview(
    state.lessonQuiz,
    state.lessonQuiz.current.entry.id,
    choiceId === correctId
  );
  recordPracticeResult(
    state.startedLesson,
    "quiz",
    state.lessonQuiz.current.entry.id,
    choiceId === correctId
  );

  if (choiceId === correctId) {
    state.lessonQuiz.score += 1;
    elements.lessonQuizFeedback.textContent = `Correct. Nice work. Repeat: ${state.lessonQuiz.current.entry.bisaya} = ${state.lessonQuiz.current.entry.english}`;
    elements.lessonQuizFeedback.className = "quiz-feedback success";
  } else {
    if (selectedButton) {
      selectedButton.classList.add("is-wrong");
    }
    elements.lessonQuizFeedback.textContent = `Not quite. Correct answer: ${
      quizModes[state.lessonQuiz.mode].answerLabel(state.lessonQuiz.current.entry)
    }. Repeat: ${state.lessonQuiz.current.entry.bisaya} = ${state.lessonQuiz.current.entry.english}`;
    elements.lessonQuizFeedback.className = "quiz-feedback error";
  }

  elements.lessonQuizScore.textContent = String(state.lessonQuiz.score);

  if (state.lessonQuiz.questionNumber >= state.lessonQuiz.totalQuestions) {
    finishLessonQuiz();
  } else {
    elements.lessonNextQuestion.hidden = false;
  }
}

function finishLessonQuiz() {
  const finalPercent = Math.round(
    (state.lessonQuiz.score / state.lessonQuiz.totalQuestions) * 100
  );
  const lessonId = state.startedLesson;
  state.lessonQuiz.completed = true;
  state.lessonQuiz.finalPercent = finalPercent;

  const current = getLessonRecord(lessonId);
  updateLessonRecord(lessonId, {
    quizBest: Math.max(current.quizBest, finalPercent),
  });

  renderApp();

  setAppStatus(
    finalPercent === 100
      ? `Step 2 Quiz complete for ${getLessonMeta(lessonId).shortTitle}. Step 3 Typing is now unlocked.`
      : `Quiz score saved at ${finalPercent}%. Reach 100% to unlock Step 3 Typing.`
  );
}

function startTypingSession() {
  if (!state.startedLesson) {
    setAppStatus("Start a step first.");
    return;
  }

  const typingStep = getExerciseStepState(state.startedLesson).typing;
  if (!typingStep.unlocked) {
    state.typingSession.feedback = typingStep.requirement;
    state.typingSession.feedbackTone = "error";
    renderTypingPractice();
    setAppStatus(typingStep.requirement);
    return;
  }

  state.typingSession = createEmptyPracticeState(state.startedLesson);
  nextTypingQuestion();
}

function nextTypingQuestion() {
  const pool = getEntriesForLesson(state.startedLesson);
  if (pool.length === 0) {
    return;
  }

  const entry = pickAdaptiveEntry(state.typingSession, pool, "typing", 2);
  const exposure = recordExposure(state.typingSession, entry.id);

  state.typingSession.current = entry;
  state.typingSession.currentExposure = exposure;
  state.typingSession.questionNumber += 1;
  state.typingSession.recentIds = [...state.typingSession.recentIds.slice(-4), entry.id];
  state.typingSession.attempts = 0;
  state.typingSession.hintLevel = 0;
  state.typingSession.checked = false;
  state.typingSession.feedback = "";
  state.typingSession.feedbackTone = "";
  state.typingSession.hint = "Hints will appear here.";
  elements.typingInput.value = "";
  renderTypingPractice();
}

function renderTypingPractice() {
  const session = state.typingSession;
  elements.typingProgress.textContent = `${session.questionNumber} / ${session.totalQuestions}`;
  elements.typingScore.textContent = `${calculateSessionPercent(session)}%`;
  elements.typingHint.textContent = session.hint;
  elements.typingFeedback.textContent = session.feedback;
  elements.typingFeedback.className = `quiz-feedback ${session.feedbackTone || ""}`.trim();
  elements.startTyping.disabled = !state.startedLesson;
  elements.startTyping.textContent =
    state.startedLesson && (session.questionNumber > 0 || session.completed)
      ? "Restart typing"
      : "Start typing";
  elements.checkTyping.disabled = true;
  elements.nextTyping.hidden = true;
  elements.nextTyping.disabled = true;
  elements.nextTyping.textContent = "Check first";
  elements.revealTyping.disabled = true;

  if (!state.startedLesson) {
    elements.typingPrompt.textContent = "Type the Bisaya phrase from the English clue.";
    elements.typingHelper.textContent =
      "Start a step first to unlock the typing coach.";
    elements.typingInput.value = "";
    elements.typingInput.disabled = true;
    return;
  }

  if (session.completed) {
    elements.typingPrompt.textContent = `Typing complete. Final score: ${session.finalPercent}%`;
    elements.typingHelper.textContent =
      session.finalPercent >= 100
        ? "Perfect. Step 4 Grammar is now unlocked."
        : "Use Start typing to run the step again and reach 100% for Step 4 Grammar.";
    elements.typingInput.disabled = true;
    elements.nextTyping.hidden = false;
    elements.nextTyping.disabled = false;
    elements.nextTyping.textContent = "Start again";
    return;
  }

  if (!session.current) {
    elements.typingPrompt.textContent = "Type the Bisaya phrase from the English clue.";
    elements.typingHelper.textContent =
      `You will get spelling support if you are close, and the ${session.totalQuestions}-question session will reuse phrases you miss.`;
    elements.typingInput.disabled = true;
    return;
  }

  elements.typingPrompt.textContent =
    session.currentExposure > 1
      ? `Context: Imagine ${buildEntryContext(session.current)}.`
      : `English: ${session.current.english}`;
  elements.typingHelper.textContent = `Meaning: ${session.current.english}. Pronunciation: ${
    session.current.pronunciation
  }. ${buildRepeatCoachCopy(
    session.currentExposure,
    "First round. This phrase returns once more so you can repeat it.",
    "Repeat round {round}. Say and type the full phrase again."
  )}`;
  elements.typingInput.disabled = session.checked;
  elements.revealTyping.disabled = false;
  elements.nextTyping.hidden = false;
  elements.nextTyping.disabled = false;

  if (session.checked) {
    elements.nextTyping.textContent =
      session.questionNumber >= session.totalQuestions ? "See result" : "Next phrase";
  } else {
    elements.checkTyping.disabled = false;
    focusPracticeField(elements.typingInput);
  }
}

function checkTypingAnswer() {
  const session = state.typingSession;
  if (!session.current || session.completed) {
    return;
  }

  const value = elements.typingInput.value.trim();
  if (!value) {
    session.feedback = "Type an answer first.";
    session.feedbackTone = "error";
    renderTypingPractice();
    return;
  }

  session.attempts += 1;
  const verdict = evaluatePhraseAnswer(value, session.current.bisaya);
  scheduleFollowUpReview(session, session.current.id, verdict.correct);
  recordPracticeResult(state.startedLesson, "typing", session.current.id, verdict.correct);

  if (verdict.correct) {
    session.score += 1;
    session.checked = true;
    session.feedback = `Correct. Nice work. Repeat aloud: ${session.current.bisaya}`;
    session.feedbackTone = "success";
  } else if (verdict.isClose && session.attempts < 2) {
    session.feedback = `Almost there. ${verdict.spellingHint}`;
    session.feedbackTone = "error";
    session.hint = buildMaskedHint(session.current.bisaya, 1);
    renderTypingPractice();
    return;
  } else {
    session.checked = true;
    session.feedback = `Not quite. Correct answer: ${session.current.bisaya}. Repeat aloud: ${session.current.bisaya}`;
    session.feedbackTone = "error";
    session.hint = `Spelling help: ${buildMaskedHint(session.current.bisaya, 2)}`;
  }

  if (session.questionNumber >= session.totalQuestions) {
    finishTypingSession();
  } else {
    session.feedback = `${session.feedback} Continue with Next phrase.`;
    renderTypingPractice();
  }
}

function revealTypingHint() {
  const session = state.typingSession;
  if (!session.current) {
    return;
  }

  session.hintLevel += 1;
  session.hint = buildMaskedHint(session.current.bisaya, session.hintLevel);
  renderTypingPractice();
}

function advanceTypingSession() {
  const session = state.typingSession;

  if (!state.startedLesson) {
    return;
  }

  if (session.completed || !session.current) {
    startTypingSession();
    return;
  }

  if (!session.checked) {
    checkTypingAnswer();
    return;
  }

  nextTypingQuestion();
}

function finishTypingSession() {
  const finalPercent = calculateSessionPercent(state.typingSession);
  const lessonId = state.startedLesson;
  state.typingSession.completed = true;
  state.typingSession.finalPercent = finalPercent;

  const current = getLessonRecord(lessonId);
  updateLessonRecord(lessonId, {
    typingBest: Math.max(current.typingBest, finalPercent),
  });

  renderApp();

  setAppStatus(
    finalPercent === 100
      ? `Step 3 Typing complete for ${getLessonMeta(lessonId).shortTitle}. Step 4 Grammar is now unlocked.`
      : `Typing score saved at ${finalPercent}%. Reach 100% to unlock Step 4 Grammar.`
  );
}

function startGrammarSession() {
  if (!state.startedLesson) {
    setAppStatus("Start a step first.");
    return;
  }

  const grammarStep = getExerciseStepState(state.startedLesson).grammar;
  if (!grammarStep.unlocked) {
    state.grammarSession.feedback = grammarStep.requirement;
    state.grammarSession.feedbackTone = "error";
    renderGrammarPractice();
    setAppStatus(grammarStep.requirement);
    return;
  }

  state.grammarSession = createEmptyPracticeState(state.startedLesson);
  nextGrammarQuestion();
}

function nextGrammarQuestion() {
  const pool = getEntriesForLesson(state.startedLesson).filter(
    (entry) => entry.bisaya.trim().split(/\s+/).length > 1
  );

  if (pool.length === 0) {
    return;
  }

  const entry = pickAdaptiveEntry(state.grammarSession, pool, "grammar", 2);
  const exposure = recordExposure(state.grammarSession, entry.id);

  state.grammarSession.current = createGrammarTask(entry);
  state.grammarSession.currentExposure = exposure;
  state.grammarSession.questionNumber += 1;
  state.grammarSession.recentIds = [
    ...state.grammarSession.recentIds.slice(-4),
    entry.id,
  ];
  state.grammarSession.attempts = 0;
  state.grammarSession.hintLevel = 0;
  state.grammarSession.checked = false;
  state.grammarSession.feedback = "";
  state.grammarSession.feedbackTone = "";
  state.grammarSession.hint = "Hints will appear here.";
  elements.grammarInput.value = "";
  renderGrammarPractice();
}

function renderGrammarPractice() {
  const session = state.grammarSession;
  elements.grammarProgress.textContent = `${session.questionNumber} / ${session.totalQuestions}`;
  elements.grammarScore.textContent = `${calculateSessionPercent(session)}%`;
  elements.grammarHint.textContent = session.hint;
  elements.grammarFeedback.textContent = session.feedback;
  elements.grammarFeedback.className = `quiz-feedback ${session.feedbackTone || ""}`.trim();
  elements.startGrammar.disabled = !state.startedLesson;
  elements.startGrammar.textContent =
    state.startedLesson && (session.questionNumber > 0 || session.completed)
      ? "Restart grammar"
      : "Start grammar";
  elements.checkGrammar.disabled = true;
  elements.nextGrammar.hidden = true;
  elements.nextGrammar.disabled = true;
  elements.nextGrammar.textContent = "Check first";
  elements.revealGrammar.disabled = true;

  if (!state.startedLesson) {
    elements.grammarPrompt.textContent = "Fill in the missing Bisaya word.";
    elements.grammarHelper.textContent =
      "Start a step first to unlock grammar exercises.";
    elements.grammarSentence.textContent =
      "The sentence with a blank will appear here.";
    elements.grammarInput.value = "";
    elements.grammarInput.disabled = true;
    return;
  }

  if (session.completed) {
    elements.grammarPrompt.textContent = `Grammar complete. Final score: ${session.finalPercent}%`;
    elements.grammarHelper.textContent =
      session.finalPercent >= 100
        ? getNextLessonId(state.startedLesson)
          ? `Perfect. The next lesson is now unlocked.`
          : "Perfect. You finished the full course."
        : "Use Start grammar to run the step again and reach 100% for the next lesson.";
    elements.grammarSentence.textContent =
      "You can repeat the exercise as many times as you want.";
    elements.grammarInput.disabled = true;
    elements.nextGrammar.hidden = false;
    elements.nextGrammar.disabled = false;
    elements.nextGrammar.textContent = "Start again";
    return;
  }

  if (!session.current) {
    elements.grammarPrompt.textContent = "Fill in the missing Bisaya word.";
    elements.grammarHelper.textContent =
      `These ${session.totalQuestions} grammar prompts focus on sentence patterns, spelling, and repeated weak spots.`;
    elements.grammarSentence.textContent =
      "The sentence with a blank will appear here.";
    elements.grammarInput.disabled = true;
    return;
  }

  elements.grammarPrompt.textContent =
    session.currentExposure > 1
      ? `Context: Imagine ${buildEntryContext(session.current.entry)}.`
      : `English clue: ${session.current.entry.english}`;
  elements.grammarHelper.textContent = `Type the missing word. Meaning: ${
    session.current.entry.english
  }. Pronunciation: ${session.current.entry.pronunciation}. ${buildRepeatCoachCopy(
    session.currentExposure,
    "First round. This sentence returns once more so you can repeat it.",
    "Repeat round {round}. Read the full sentence again after answering."
  )}`;
  elements.grammarSentence.textContent = session.current.sentence;
  elements.grammarInput.disabled = session.checked;
  elements.revealGrammar.disabled = false;
  elements.nextGrammar.hidden = false;
  elements.nextGrammar.disabled = false;

  if (session.checked) {
    elements.nextGrammar.textContent =
      session.questionNumber >= session.totalQuestions ? "See result" : "Next sentence";
  } else {
    elements.checkGrammar.disabled = false;
    focusPracticeField(elements.grammarInput);
  }
}

function checkGrammarAnswer() {
  const session = state.grammarSession;
  if (!session.current || session.completed) {
    return;
  }

  const value = elements.grammarInput.value.trim();
  if (!value) {
    session.feedback = "Type the missing word first.";
    session.feedbackTone = "error";
    renderGrammarPractice();
    return;
  }

  session.attempts += 1;
  const verdict = evaluateTokenAnswer(value, session.current.answerDisplay);
  scheduleFollowUpReview(session, session.current.entry.id, verdict.correct);
  recordPracticeResult(
    state.startedLesson,
    "grammar",
    session.current.entry.id,
    verdict.correct
  );

  if (verdict.correct) {
    session.score += 1;
    session.checked = true;
    session.feedback = `Correct. Nice work. Repeat full sentence: ${session.current.entry.bisaya}`;
    session.feedbackTone = "success";
  } else if (verdict.isClose && session.attempts < 2) {
    session.feedback = `Almost there. ${verdict.spellingHint}`;
    session.feedbackTone = "error";
    session.hint = buildTokenHint(session.current.answerDisplay, 1);
    renderGrammarPractice();
    return;
  } else {
    session.checked = true;
    session.feedback = `Not quite. Correct answer: ${session.current.answerDisplay}. Repeat full sentence: ${session.current.entry.bisaya}`;
    session.feedbackTone = "error";
    session.hint = `Spelling help: ${buildTokenHint(session.current.answerDisplay, 2)}`;
  }

  if (session.questionNumber >= session.totalQuestions) {
    finishGrammarSession();
  } else {
    session.feedback = `${session.feedback} Continue with Next sentence.`;
    renderGrammarPractice();
  }
}

function revealGrammarHint() {
  const session = state.grammarSession;
  if (!session.current) {
    return;
  }

  session.hintLevel += 1;
  session.hint = buildTokenHint(session.current.answerDisplay, session.hintLevel);
  renderGrammarPractice();
}

function advanceGrammarSession() {
  const session = state.grammarSession;

  if (!state.startedLesson) {
    return;
  }

  if (session.completed || !session.current) {
    startGrammarSession();
    return;
  }

  if (!session.checked) {
    checkGrammarAnswer();
    return;
  }

  nextGrammarQuestion();
}

function finishGrammarSession() {
  const finalPercent = calculateSessionPercent(state.grammarSession);
  const lessonId = state.startedLesson;
  const wasCompleted = isLessonFullyCompleted(lessonId);
  state.grammarSession.completed = true;
  state.grammarSession.finalPercent = finalPercent;

  const current = getLessonRecord(lessonId);
  updateLessonRecord(lessonId, {
    grammarBest: Math.max(current.grammarBest, finalPercent),
  });

  renderApp();

  const nextLessonId = getNextLessonId(lessonId);
  const nextLesson = nextLessonId ? getLessonMeta(nextLessonId) : null;
  const hasJustCompleted =
    finalPercent === 100 && !wasCompleted && isLessonFullyCompleted(lessonId);

  if (hasJustCompleted && isNativeIOSApp()) {
    state.iosCompletionModal = {
      lessonId,
      nextLessonId,
    };
    renderApp();
  }

  setAppStatus(
    finalPercent === 100
      ? nextLesson
        ? `Step 4 Grammar complete for ${getLessonMeta(lessonId).shortTitle}. Step ${nextLesson.step} is now unlocked.`
        : "Step 4 Grammar complete. You finished the full course."
      : `Grammar score saved at ${finalPercent}%. Reach 100% to unlock the next lesson.`
  );
}

function createGrammarTask(entry) {
  const tokens = entry.bisaya.split(/\s+/);
  const candidates = tokens
    .map((token, index) => ({
      index,
      clean: normalizeToken(token),
    }))
    .filter((item) => item.clean.length >= 2);

  const chosen =
    candidates.sort((left, right) => right.clean.length - left.clean.length)[0] ||
    candidates[0];
  const blankTokens = [...tokens];
  blankTokens[chosen.index] = "_____";

  return {
    entry,
    answer: chosen.clean,
    answerDisplay: tokens[chosen.index],
    sentence: blankTokens.join(" "),
  };
}

function calculateSessionPercent(session) {
  if (!session.totalQuestions) {
    return 0;
  }

  return Math.round((session.score / session.totalQuestions) * 100);
}

function evaluatePhraseAnswer(input, expected) {
  const normalizedInput = normalizePhrase(input);
  const normalizedExpected = normalizePhrase(expected);

  if (normalizedInput === normalizedExpected) {
    return { correct: true, isClose: true, spellingHint: "" };
  }

  const distance = levenshteinDistance(normalizedInput, normalizedExpected);
  const maxLength = Math.max(normalizedInput.length, normalizedExpected.length, 1);
  const similarity = 1 - distance / maxLength;

  return {
    correct: false,
    isClose: similarity >= 0.72,
    spellingHint: buildSpellingHint(normalizedExpected, normalizedInput),
  };
}

function evaluateTokenAnswer(input, expected) {
  const normalizedInput = normalizeToken(input);
  const normalizedExpected = normalizeToken(expected);

  if (normalizedInput === normalizedExpected) {
    return { correct: true, isClose: true, spellingHint: "" };
  }

  const distance = levenshteinDistance(normalizedInput, normalizedExpected);
  const maxLength = Math.max(normalizedInput.length, normalizedExpected.length, 1);
  const similarity = 1 - distance / maxLength;

  return {
    correct: false,
    isClose: similarity >= 0.7,
    spellingHint: buildSpellingHint(normalizedExpected, normalizedInput),
  };
}

function buildSpellingHint(expected, actual) {
  let index = 0;
  while (
    index < expected.length &&
    index < actual.length &&
    expected[index] === actual[index]
  ) {
    index += 1;
  }

  const fragment = expected.slice(Math.max(0, index - 1), index + 3) || expected.slice(0, 3);
  return `Check the spelling around "${fragment}".`;
}

function buildMaskedHint(phrase, level) {
  if (level <= 1) {
    return phrase
      .split(/\s+/)
      .map((word) => `${word[0] || ""}${"•".repeat(Math.max(word.length - 1, 0))}`)
      .join(" ");
  }

  if (level === 2) {
    return phrase
      .split(/\s+/)
      .map((word) => {
        if (word.length <= 2) {
          return word;
        }

        return `${word.slice(0, 2)}${"•".repeat(Math.max(word.length - 2, 0))}`;
      })
      .join(" ");
  }

  return `Answer: ${phrase}`;
}

function buildTokenHint(word, level) {
  if (level <= 1) {
    return `${word[0] || ""}${"•".repeat(Math.max(word.length - 1, 0))}`;
  }

  if (level === 2) {
    return `${word.slice(0, 2)}${"•".repeat(Math.max(word.length - 2, 0))}`;
  }

  return `Answer: ${word}`;
}

function normalizePhrase(value) {
  return value
    .toLowerCase()
    .replace(/[.,!?;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeToken(value) {
  return value
    .toLowerCase()
    .replace(/[.,!?;:]/g, "")
    .trim();
}

function focusPracticeField(element) {
  if (!element || state.tab !== "lesson") {
    return;
  }

  const pane = element.closest(".exercise-pane");
  if (pane && !pane.classList.contains("is-active")) {
    return;
  }

  try {
    element.focus({ preventScroll: true });
    if (typeof element.select === "function") {
      element.select();
    }
  } catch (error) {
    // Ignore focus failures in embedded or restricted environments.
  }
}

function levenshteinDistance(left, right) {
  const matrix = Array.from({ length: left.length + 1 }, () =>
    Array(right.length + 1).fill(0)
  );

  for (let row = 0; row <= left.length; row += 1) {
    matrix[row][0] = row;
  }

  for (let column = 0; column <= right.length; column += 1) {
    matrix[0][column] = column;
  }

  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + cost
      );
    }
  }

  return matrix[left.length][right.length];
}

function pickDistractors(pool, excludedId, amount) {
  return shuffleArray(pool.filter((entry) => entry.id !== excludedId)).slice(
    0,
    amount
  );
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function weightedRandomItem(items, weightFn) {
  if (!items.length) {
    return null;
  }

  const weights = items.map((item) => Math.max(weightFn(item) || 0, 0.1));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  if (totalWeight <= 0) {
    return randomItem(items);
  }

  let threshold = Math.random() * totalWeight;

  for (let index = 0; index < items.length; index += 1) {
    threshold -= weights[index];
    if (threshold <= 0) {
      return items[index];
    }
  }

  return items[items.length - 1];
}

function shuffleArray(items) {
  const clone = [...items];
  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
  }
  return clone;
}

function setAppStatus(message) {
  elements.appStatus.textContent = message;
}

function boot() {
  try {
    init();
  } catch (error) {
    logNative("error", `Init failed: ${formatError(error)}`);
    setAppStatus("The app hit a startup problem. Please rebuild or reopen it.");
    throw error;
  }
}

boot();
